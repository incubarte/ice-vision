import { analyzeSync, executeSync } from './sync-service';
import type { ConfigState } from '@/types';

/**
 * Trigger a sync based on configuration
 * Returns true if sync was executed, false if skipped
 */
export async function triggerSync(
    config: ConfigState,
    trigger: 'after-match' | 'after-summary-edit',
    isMatchInProgress?: boolean
): Promise<{ executed: boolean; message: string; filesSync: number }> {
    try {
        // Check if this trigger is enabled
        if (trigger === 'after-match' && !config.autoSyncAfterMatch) {
            console.log('[Sync Trigger] After-match sync disabled in config');
            return { executed: false, message: 'Sync tras partido desactivado', filesSync: 0 };
        }

        if (trigger === 'after-summary-edit' && !config.autoSyncAfterSummaryEdit) {
            console.log('[Sync Trigger] After-summary-edit sync disabled in config');
            return { executed: false, message: 'Sync tras edición de summary desactivado', filesSync: 0 };
        }

        // Check if we should skip during match
        if (config.autoSyncSkipDuringMatch && isMatchInProgress) {
            console.log('[Sync Trigger] Skipping sync - match in progress');
            return { executed: false, message: 'Sync omitido: partido en curso', filesSync: 0 };
        }

        console.log(`[Sync Trigger] Executing sync triggered by: ${trigger}`);

        // 1. Analyze
        const analysis = await analyzeSync();

        const totalChanges = analysis.summary.uploadCount + analysis.summary.downloadCount;

        // 2. Check if there are changes
        if (totalChanges === 0) {
            console.log('[Sync Trigger] No changes to sync');
            return { executed: false, message: 'Sin cambios para sincronizar', filesSync: 0 };
        }

        // 3. Check if there are conflicts and auto-resolve is disabled
        if (analysis.summary.conflictCount > 0 && !config.autoSyncResolveConflicts) {
            console.log('[Sync Trigger] Conflicts detected but auto-resolve disabled');
            return {
                executed: false,
                message: `${analysis.summary.conflictCount} conflictos detectados - sync omitido`,
                filesSync: 0
            };
        }

        // 4. Execute sync
        const result = await executeSync(analysis, {
            strategy: 'local-wins',
            trigger
        });

        const filesSync = result.filesUploaded + result.filesDownloaded + result.conflictsResolved;

        if (result.success) {
            return {
                executed: true,
                message: `Sincronizado: ${filesSync} archivos`,
                filesSync
            };
        } else {
            return {
                executed: true,
                message: `Sincronizado parcialmente: ${filesSync} archivos, ${result.errors.length} errores`,
                filesSync
            };
        }

    } catch (error) {
        console.error('[Sync Trigger] Error:', error);
        return {
            executed: false,
            message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
            filesSync: 0
        };
    }
}

/**
 * Check if there's a match in progress
 */
export function isMatchInProgress(live: any): boolean {
    if (!live || !live.clock) return false;

    // Match is in progress if:
    // - Clock is running, OR
    // - We're not in warm-up and period > 0
    const { isClockRunning, currentPeriod, periodDisplayOverride } = live.clock;

    // If clock is running, match is definitely in progress
    if (isClockRunning) return true;

    // If we're in warm-up or awaiting decision, not in progress
    if (periodDisplayOverride === 'Warm-up' || periodDisplayOverride === 'AwaitingDecision') {
        return false;
    }

    // If we're past warm-up (period > 0) and not in end of game, match is in progress
    if (currentPeriod > 0 && periodDisplayOverride !== 'End of Game') {
        return true;
    }

    return false;
}
