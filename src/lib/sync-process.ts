
import 'server-only';
import * as gdriveProvider from './storage/gdrive-provider';
import * as localProvider from './storage/local-provider';
import type { ConfigState, LiveState, Tournament } from '@/types';

const SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

let isSyncing = false;
let syncInterval: NodeJS.Timeout | null = null;

async function runSync() {
    if (isSyncing) {
        console.log('[SYNC] Sync already in progress, skipping this run.');
        return;
    }

    console.log('[SYNC] Starting background sync from Google Drive to local file system...');
    isSyncing = true;

    try {
        // 1. Fetch all data from Google Drive
        const [config, liveState] = await Promise.all([
            gdriveProvider.readConfig(),
            gdriveProvider.readLiveState(),
        ]);

        if (!config || !liveState) {
            throw new Error('Failed to fetch base config or live state from Google Drive.');
        }

        const fullConfig = config as ConfigState;
        const tournamentPromises = (fullConfig.tournaments || []).map(t =>
            gdriveProvider.readTournament(t.id).then(tournamentData => {
                 if (tournamentData) {
                    return { ...t, ...tournamentData } as Tournament;
                }
                return null;
            })
        );
        
        const tournaments = (await Promise.all(tournamentPromises)).filter(t => t !== null) as Tournament[];
        
        fullConfig.tournaments = tournaments;

        // 2. Write all fetched data to local files
        await Promise.all([
            localProvider.writeConfig(fullConfig),
            localProvider.writeLiveState(liveState as LiveState),
            ...tournaments.map(t => localProvider.writeTournament(t))
        ]);

        console.log(`[SYNC] Sync complete. Synced config, live state, and ${tournaments.length} tournaments.`);

    } catch (error) {
        console.error('[SYNC] An error occurred during the background sync process:', error);
    } finally {
        isSyncing = false;
    }
}

export function startBackgroundSync() {
    console.log(`[SYNC] Background sync process will start and run every ${SYNC_INTERVAL_MS / 60000} minutes.`);
    
    // Run once immediately
    runSync();

    // Then set up the interval
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    syncInterval = setInterval(runSync, SYNC_INTERVAL_MS);
}
