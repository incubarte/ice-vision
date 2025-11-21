import type { ConfigState, LiveState, MatchData, Tournament, GameSummary, TournamentsData } from '@/types';
import { storageProvider } from './storage';
import { FileNotFoundError } from './storage/providers';
import { updateManifestEntry } from './sync-manifest';

// --- High-Level Data Access Functions ---

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

export async function readTournament(tournamentId: string): Promise<Partial<Tournament> | null> {
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

        if (partialTournament.matches) {
            const matchSummaryPromises = partialTournament.matches.map(async (match: MatchData) => {
                const summaryKey = `${tournamentPrefix}summaries/${match.id}.json`;
                const summary = await readJsonFile<GameSummary>(summaryKey);
                return { ...match, summary: summary || undefined };
            });
            partialTournament.matches = await Promise.all(matchSummaryPromises);
        }

        return partialTournament;
    } catch (error) {
        console.error(`Error reading tournament ${tournamentId} from provider:`, error);
        return null;
    }
}

export async function writeTournament(tournament: Tournament): Promise<void> {
    const tournamentPrefix = `tournaments/${tournament.id}/`;
    const teamsKey = `${tournamentPrefix}teams.json`;
    const fixtureKey = `${tournamentPrefix}fixture.json`;

    try {
        const teamsData = { categories: tournament.categories || [], teams: tournament.teams || [] };
        const fixtureMatches: Omit<MatchData, 'summary'>[] = [];
        const summaryWritePromises: Promise<void>[] = [];

        (tournament.matches || []).forEach(match => {
            const { summary, ...matchWithoutSummary } = match;
            if (summary) {
                const summaryKey = `${tournamentPrefix}summaries/${match.id}.json`;
                const summaryContent = JSON.stringify(summary, null, 2);
                summaryWritePromises.push(storageProvider.writeFile(summaryKey, summaryContent));
                // Note: Score and overtime info are calculated from summary when needed
            }
            fixtureMatches.push(matchWithoutSummary);
        });

        const fixtureData = { matches: fixtureMatches };
        const teamsContent = JSON.stringify(teamsData, null, 2);
        const fixtureContent = JSON.stringify(fixtureData, null, 2);

        // Write all files in parallel (fast)
        await Promise.all([
            storageProvider.writeFile(teamsKey, teamsContent),
            storageProvider.writeFile(fixtureKey, fixtureContent),
            ...summaryWritePromises,
        ]);

        // Update manifest SEQUENTIALLY to avoid race conditions
        // (manifest reads/writes need to be atomic)
        await updateManifestEntry(teamsKey, teamsContent);
        await updateManifestEntry(fixtureKey, fixtureContent);

        // Update summaries sequentially too
        const summaries = (tournament.matches || [])
            .map(match => match.summary ? {
                key: `${tournamentPrefix}summaries/${match.id}.json`,
                content: JSON.stringify(match.summary, null, 2)
            } : null)
            .filter(Boolean) as Array<{key: string, content: string}>;

        for (const {key, content} of summaries) {
            await updateManifestEntry(key, content);
        }
    } catch (error) {
        console.error(`Error writing tournament ${tournament.id} to provider:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to write tournament files to provider: ${errorMessage}`);
    }
}
