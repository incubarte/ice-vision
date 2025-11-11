import type { ConfigState, LiveState, MatchData, Tournament, GameSummary, TournamentsData } from '@/types';
import { storageProvider } from './storage';
import { FileNotFoundError } from './storage/providers';

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
    await storageProvider.writeFile('tournaments.json', JSON.stringify(tournamentsData, null, 2));
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
                summaryWritePromises.push(storageProvider.writeFile(summaryKey, JSON.stringify(summary, null, 2)));
                
                const homeScore = (summary.statsByPeriod || []).reduce((acc, p) => acc + (p.stats.goals.home?.length ?? 0), 0) + (summary.shootout?.homeAttempts.filter(a => a.isGoal).length ?? 0);
                const awayScore = (summary.statsByPeriod || []).reduce((acc, p) => acc + (p.stats.goals.away?.length ?? 0), 0) + (summary.shootout?.awayAttempts.filter(a => a.isGoal).length ?? 0);
                
                matchWithoutSummary.homeScore = homeScore;
                matchWithoutSummary.awayScore = awayScore;
                matchWithoutSummary.overTimeOrShootouts = summary.overTimeOrShootouts;
            }
            fixtureMatches.push(matchWithoutSummary);
        });

        const fixtureData = { matches: fixtureMatches };

        await Promise.all([
            storageProvider.writeFile(teamsKey, JSON.stringify(teamsData, null, 2)),
            storageProvider.writeFile(fixtureKey, JSON.stringify(fixtureData, null, 2)),
            ...summaryWritePromises,
        ]);
    } catch (error) {
        console.error(`Error writing tournament ${tournament.id} to provider:`, error);
        throw new Error("Failed to write tournament files to provider.");
    }
}
