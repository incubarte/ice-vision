import type { ConfigState, LiveState, MatchData, Tournament, GameSummary, TournamentsData, ShotsMetrics, PreMatchData } from '@/types';
import { storageProvider } from './storage';
import { FileNotFoundError, StorageProvider } from './storage/providers';
import { updateManifestEntry } from './sync-manifest';

// --- High-Level Data Access Functions ---

async function updateRemoteManifestEntry(filePath: string, content: string, provider: StorageProvider): Promise<void> {
    try {
        const { hashContent, getGMTTimestamp } = await import('./sync-manifest');
        let manifest: any = { lastSync: getGMTTimestamp(), files: {} };
        try {
            const existing = await provider.readFile('sync-manifest.json');
            manifest = JSON.parse(existing);
        } catch {
            // manifest doesn't exist yet, use empty one
        }
        const hash = hashContent(content);
        if (!manifest.files) manifest.files = {};
        manifest.files[filePath] = {
            hash,
            lastModified: getGMTTimestamp(),
            size: Buffer.byteLength(content, 'utf-8'),
        };
        await provider.writeFile('sync-manifest.json', JSON.stringify(manifest, null, 2));
    } catch (error) {
        console.error(`[DataAccess] Failed to update remote manifest for ${filePath}:`, error);
        // Non-fatal: don't throw, the file write already succeeded
    }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
    console.log(`[data-access] Attempting to read '${filePath}'...`);
    try {
        const data = await storageProvider.readFile(filePath);
        console.log(`[data-access] Successfully read '${filePath}'. Content length: ${data.length}`);
        return JSON.parse(data) as T;
    } catch (error) {
        if (error instanceof FileNotFoundError) {
            console.warn(`[data-access] File not found: '${filePath}'. This may be normal.`);
            return null; // File doesn't exist, a valid case.
        }
        // For any other kind of error, log it as a critical failure.
        console.error(`[data-access] Critical error reading '${filePath}':`, error);
        throw new Error(`Failed to read data file: ${filePath}`);
    }
}

export async function readConfig(): Promise<Partial<ConfigState>> {
    return (await readJsonFile<ConfigState>('config.json')) || {};
}

export async function writeConfig(config: ConfigState): Promise<void> {
    // Don't write tournaments array to config.json - it's stored separately
    const { tournaments, ...configWithoutTournaments } = config;
    await storageProvider.writeFile('config.json', JSON.stringify(configWithoutTournaments, null, 2));
}

export async function readTournaments(): Promise<Partial<TournamentsData>> {
    return (await readJsonFile<TournamentsData>('tournaments.json')) || { tournaments: [] };
}

export async function findTournamentByCode(code: string): Promise<string | null> {
    const { tournaments = [] } = await readTournaments();
    const match = tournaments.find(t => t.code?.toLowerCase() === code.toLowerCase());
    return match?.id ?? null;
}

export async function writeTournaments(tournamentsData: TournamentsData): Promise<void> {
    const content = JSON.stringify(tournamentsData, null, 2);
    await storageProvider.writeFile('tournaments.json', content);
    // Update sync manifest
    await updateManifestEntry('tournaments.json', content);
}

export async function readLiveState(): Promise<Partial<LiveState>> {
    return (await readJsonFile<LiveState>('live.json')) || {};
}

export async function writeLiveState(liveState: LiveState): Promise<void> {
    await storageProvider.writeFile('live.json', JSON.stringify(liveState, null, 2));
}

export async function readShotsMetrics(): Promise<Partial<ShotsMetrics>> {
    const metrics = await readJsonFile<ShotsMetrics>('live-shotsMetrics.json');
    if (metrics) return metrics;

    // Backward compatibility: try reading from live.json
    const liveState = await readJsonFile<LiveState>('live.json');
    if (liveState && (liveState.shotsLog || liveState.goalkeeperChangesLog)) {
        return {
            shotsLog: liveState.shotsLog || { home: [], away: [] },
            goalkeeperChangesLog: liveState.goalkeeperChangesLog || { home: [], away: [] }
        };
    }

    return { shotsLog: { home: [], away: [] }, goalkeeperChangesLog: { home: [], away: [] } };
}

export async function writeShotsMetrics(metrics: ShotsMetrics): Promise<void> {
    await storageProvider.writeFile('live-shotsMetrics.json', JSON.stringify(metrics, null, 2));
}

export async function readTournament(
    tournamentId: string,
    options: { includeSummaries?: boolean } = {}
): Promise<Partial<Tournament> | null> {
    const { includeSummaries = true } = options;
    const tournamentPrefix = `tournaments/${tournamentId}/`;
    const teamsKey = `${tournamentPrefix}teams.json`;
    const fixtureKey = `${tournamentPrefix}fixture.json`;

    try {
        const [teamsData, fixtureData] = await Promise.all([
            readJsonFile<Partial<Tournament>>(teamsKey),
            readJsonFile<Partial<Tournament>>(fixtureKey),
        ]);

        if (!teamsData && !fixtureData) return null;

        const partialTournament: Partial<Tournament> = { ...teamsData, ...fixtureData };

        if (partialTournament.matches && includeSummaries) {
            const matchSummaryPromises = partialTournament.matches.map(async (match: MatchData) => {
                const summaryKey = `${tournamentPrefix}summaries/${match.id}.json`;
                const summary = await readJsonFile<GameSummary>(summaryKey);
                // Migración: agregar campo 'phase' a partidos existentes sin este campo
                const migratedMatch = {
                    ...match,
                    phase: match.phase || 'clasificacion' as const,
                    summary: summary || undefined
                };
                return migratedMatch;
            });
            partialTournament.matches = await Promise.all(matchSummaryPromises);
        } else if (partialTournament.matches) {
            // Still apply phase migration even without summaries
            partialTournament.matches = partialTournament.matches.map((match: MatchData) => ({
                ...match,
                phase: match.phase || 'clasificacion' as const,
            }));
        }

        return partialTournament;
    } catch (error) {
        console.error(`Error reading tournament ${tournamentId} from provider:`, error);
        return null;
    }
}

/**
 * Write a single match summary file without touching other files
 */
export async function writeSingleMatchSummary(
    tournamentId: string,
    matchId: string,
    summary: any,
    provider?: StorageProvider
): Promise<void> {
    const summaryKey = `tournaments/${tournamentId}/summaries/${matchId}.json`;
    const summaryContent = JSON.stringify(summary, null, 2);

    if (provider) {
        // Admin request: write via the provided rw provider and update remote manifest
        await provider.writeFile(summaryKey, summaryContent);
        await updateRemoteManifestEntry(summaryKey, summaryContent, provider);
    } else {
        // Normal path: use the default storageProvider (may be local or supabase_ro)
        await storageProvider.writeFile(summaryKey, summaryContent);
        await updateManifestEntry(summaryKey, summaryContent);
    }

    console.log(`[Data Access] Saved summary for match ${matchId} (only this file was modified)`);
}

/**
 * Write raw source files used to generate a summary, for auditing/debugging purposes.
 * Saved to tournaments/{tournamentId}/summaries/raw/{matchId}/
 */
export async function writeRawSummaryFiles(
    tournamentId: string,
    matchId: string,
    files: {
        liveState: any;
        shotsMetrics: any;
        voiceEvents: any;
    }
): Promise<void> {
    const rawPrefix = `tournaments/${tournamentId}/summaries/raw/${matchId}`;

    await Promise.all([
        storageProvider.writeFile(`${rawPrefix}/live.json`, JSON.stringify(files.liveState, null, 2)),
        storageProvider.writeFile(`${rawPrefix}/shots-metrics.json`, JSON.stringify(files.shotsMetrics, null, 2)),
        storageProvider.writeFile(`${rawPrefix}/voice-events.json`, JSON.stringify(files.voiceEvents, null, 2)),
    ]);

    console.log(`[Data Access] Saved raw summary files for match ${matchId}`);
}

export async function writeTournament(tournament: Tournament, provider?: StorageProvider): Promise<void> {
    const tournamentPrefix = `tournaments/${tournament.id}/`;
    const teamsKey = `${tournamentPrefix}teams.json`;
    const fixtureKey = `${tournamentPrefix}fixture.json`;

    try {
        const teamsData = {
            clubs: tournament.clubs || [],
            categories: tournament.categories || [],
            teams: tournament.teams || [],
            staff: tournament.staff || []
        };
        const fixtureMatches: Omit<MatchData, 'summary'>[] = [];

        // NOTE: We do NOT write summaries here anymore
        // Summaries are saved individually via writeSingleMatchSummary() to avoid unnecessary file writes
        (tournament.matches || []).forEach(match => {
            const { summary, ...matchWithoutSummary } = match;
            // Just add to fixture without the summary (summaries are in separate files)
            fixtureMatches.push(matchWithoutSummary);
        });

        const fixtureData = { matches: fixtureMatches };
        const teamsContent = JSON.stringify(teamsData, null, 2);
        const fixtureContent = JSON.stringify(fixtureData, null, 2);

        if (provider) {
            // Admin request: write via the provided rw provider and update remote manifest
            await Promise.all([
                provider.writeFile(teamsKey, teamsContent),
                provider.writeFile(fixtureKey, fixtureContent),
            ]);
            await updateRemoteManifestEntry(teamsKey, teamsContent, provider);
            await updateRemoteManifestEntry(fixtureKey, fixtureContent, provider);
        } else {
            // Normal path: use the default storageProvider
            await Promise.all([
                storageProvider.writeFile(teamsKey, teamsContent),
                storageProvider.writeFile(fixtureKey, fixtureContent),
            ]);
            await updateManifestEntry(teamsKey, teamsContent);
            await updateManifestEntry(fixtureKey, fixtureContent);
        }

        // NOTE: Summaries are NOT updated here
        // They are updated individually when saved via writeSingleMatchSummary()
    } catch (error) {
        console.error(`Error writing tournament ${tournament.id} to provider:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to write tournament files to provider: ${errorMessage}`);
    }
}

// --- Pre-match roster data (ephemeral, deleted when match starts) ---

const preMatchKey = (tournamentId: string, matchId: string, teamId: string) =>
    `tournaments/${tournamentId}/pre-match/${matchId}-${teamId}.json`;

export async function readPreMatchData(
    tournamentId: string,
    matchId: string,
    teamId: string,
    provider?: StorageProvider
): Promise<PreMatchData | null> {
    const key = preMatchKey(tournamentId, matchId, teamId);
    if (provider) {
        try {
            const data = await provider.readFile(key);
            return JSON.parse(data) as PreMatchData;
        } catch {
            return null;
        }
    }
    return readJsonFile<PreMatchData>(key);
}

export async function writePreMatchData(data: PreMatchData, provider?: StorageProvider): Promise<void> {
    const key = preMatchKey(data.tournamentId, data.matchId, data.teamId);
    const p = provider || storageProvider;
    await p.writeFile(key, JSON.stringify(data, null, 2));
}

export async function deletePreMatchData(
    tournamentId: string,
    matchId: string,
    teamId: string,
    provider?: StorageProvider
): Promise<void> {
    try {
        const p = provider || storageProvider;
        await p.deleteFile(preMatchKey(tournamentId, matchId, teamId));
    } catch {
        // Ignore — file may already be deleted
    }
}
