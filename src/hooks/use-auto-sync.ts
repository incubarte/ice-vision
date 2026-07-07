'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { LiveState, ConfigState } from '@/types';

interface AutoSyncState {
    hasPendingConflicts: boolean;
    conflictCount: number;
    lastCheckAt: Date | null;
    isSyncing: boolean;
}

function isMatchInProgress(live: LiveState | null): boolean {
    if (!live?.clock) return false;
    if (live.clock.isClockRunning) return true;
    const override = live.clock.periodDisplayOverride;
    if (override === 'Warm-up' || override === 'AwaitingDecision') return false;
    if (live.clock.currentPeriod > 0 && override !== 'End of Game') return true;
    return false;
}

export function useAutoSync(
    config: ConfigState | null,
    live: LiveState | null
): AutoSyncState {
    const [state, setState] = useState<AutoSyncState>({
        hasPendingConflicts: false,
        conflictCount: 0,
        lastCheckAt: null,
        isSyncing: false,
    });

    const isSyncingRef = useRef(false);

    const runAutoSync = useCallback(async () => {
        if (!config) return;
        if (config.autoSyncAnalysisIntervalMinutes <= 0) return;
        if (isSyncingRef.current) return;

        // Skip if match is in progress and config says to skip
        const skipDuringMatch = config.autoSyncSkipDuringMatch !== false; // default true
        if (skipDuringMatch && isMatchInProgress(live)) return;

        isSyncingRef.current = true;
        setState(prev => ({ ...prev, isSyncing: true }));

        try {
            // Step 1: analyze
            const analyzeRes = await fetch('/api/sync/analyze');
            if (!analyzeRes.ok) return;
            const plan = await analyzeRes.json();

            setState(prev => ({ ...prev, lastCheckAt: new Date() }));

            const hasConflicts = (plan.conflicts?.length ?? 0) > 0;
            const hasChanges =
                (plan.toDownload?.length ?? 0) > 0 ||
                (plan.toUpload?.length ?? 0) > 0;

            if (hasConflicts) {
                // Surface conflicts but don't auto-execute
                setState(prev => ({
                    ...prev,
                    hasPendingConflicts: true,
                    conflictCount: plan.conflicts.length,
                }));
                return;
            }

            // Clear conflict state if analysis is clean
            setState(prev => ({
                ...prev,
                hasPendingConflicts: false,
                conflictCount: 0,
            }));

            if (!hasChanges) return;

            // Step 2: execute (no conflicts — safe to auto-apply)
            const executeRes = await fetch('/api/sync/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strategy: 'local-wins' }),
            });

            if (executeRes.ok) {
                const result = await executeRes.json();
                console.log('[AutoSync] Sync completed:', result);
            }
        } catch (err) {
            console.warn('[AutoSync] Error during auto-sync:', err);
        } finally {
            isSyncingRef.current = false;
            setState(prev => ({ ...prev, isSyncing: false }));
        }
    }, [config, live]);

    useEffect(() => {
        if (!config || config.autoSyncAnalysisIntervalMinutes <= 0) return;

        const intervalMs = config.autoSyncAnalysisIntervalMinutes * 60 * 1000;

        // Run once shortly after mount, then on interval
        const initialTimer = setTimeout(runAutoSync, 30_000); // 30s after load
        const interval = setInterval(runAutoSync, intervalMs);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(interval);
        };
    }, [config?.autoSyncAnalysisIntervalMinutes, runAutoSync]);

    return state;
}
