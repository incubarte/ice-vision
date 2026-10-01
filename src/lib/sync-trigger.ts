import { analyzeSync, executeSync, type SyncAnalysis } from './sync-service';
import { clearDirty } from './sync-dirty-tracker';
import type { ConfigState, SyncPlan } from '@/types';

/** Convert a SyncPlan (from analyzeSync) to the SyncAnalysis shape that executeSync expects. */
function planToAnalysis(plan: SyncPlan): SyncAnalysis {
    return {
        toUpload:   plan.toUpload.map(i => ({ filePath: i.filePath, action: 'upload'   as const, reason: 'local newer' })),
        toDownload: plan.toDownload.map(i => ({ filePath: i.filePath, action: 'download' as const, reason: 'remote newer' })),
        conflicts:  plan.conflicts.map(i => ({ filePath: i.filePath, action: 'conflict' as const, reason: 'both modified' })),
        unchanged:  [],
        summary: {
            totalFiles:    plan.summary.uploadCount + plan.summary.downloadCount + plan.summary.conflictCount + plan.summary.unchangedCount,
            uploadCount:   plan.summary.uploadCount,
            downloadCount: plan.summary.downloadCount,
            conflictCount: plan.summary.conflictCount,
            unchangedCount: plan.summary.unchangedCount,
        },
    };
}

/**
 * Files that should never be auto-synced (match-state files that change
 * constantly during a game and are not needed for tournament data persistence).
 * live.json      — clock/score state, changes every tick
 * live-shotsMetrics.json — shots log & goalkeeper changes, changes on every shot
 */
const AUTO_SYNC_EXCLUDED = new Set(['live.json', 'live-shotsMetrics.json']);

// Module-level semaphore — prevents concurrent sync runs regardless of how many
// requests arrive (periodic timer, startup recovery, manual trigger all share this).
let syncInProgress = false;

/**
 * Trigger a sync based on configuration
 * Returns true if sync was executed, false if skipped
 */
export async function triggerSync(
    config: ConfigState,
    trigger: 'after-summary-edit'
): Promise<{ executed: boolean; message: string; filesSync: number }> {
    if (syncInProgress) {
        console.log('[Sync Trigger] Already running — skipping');
        return { executed: false, message: 'Sync ya en curso', filesSync: 0 };
    }

    syncInProgress = true;
    try {
        if (!config.syncEnabled) {
            return { executed: false, message: 'Sync desactivado en config', filesSync: 0 };
        }

        console.log(`[Sync Trigger] Executing sync triggered by: ${trigger}`);

        // 1. Analyze
        const analysis = await analyzeSync();

        const totalChanges = analysis.summary.uploadCount + analysis.summary.downloadCount;

        // 2. Nothing to do
        if (totalChanges === 0) {
            console.log('[Sync Trigger] No changes to sync');
            return { executed: false, message: 'Sin cambios para sincronizar', filesSync: 0 };
        }

        // 3. Execute — local always wins, conflicts auto-resolved
        const result = await executeSync(planToAnalysis(analysis), {
            strategy: 'local-wins',
            trigger,
            filterFiles: (f) => !AUTO_SYNC_EXCLUDED.has(f),
        });

        const filesSync = result.filesUploaded + result.filesDownloaded + result.conflictsResolved;

        if (result.success) {
            clearDirty().catch(err => console.error('[Sync Trigger] Failed to clear dirty flag:', err));
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
    } finally {
        syncInProgress = false;
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
