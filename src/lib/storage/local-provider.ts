import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import type { ConfigState, LiveState, MatchData, Tournament } from '@/types';

// Definición de las rutas de los archivos de datos.
const DATA_DIR = path.join(process.cwd(), 'src/data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const LIVE_STATE_PATH = path.join(DATA_DIR, 'live.json');
const TOURNAMENTS_DIR = path.join(DATA_DIR, 'tournaments');

/**
 * Lee y parsea un archivo JSON de una ruta dada.
 * @param filePath La ruta al archivo.
 * @returns El contenido parseado o null si no existe.
 */
async function readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as T;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null; // El archivo no existe, es un caso de uso válido.
        }
        console.error(`Error al leer ${filePath}:`, error);
        throw new Error(`Fallo al leer el archivo de base de datos: ${path.basename(filePath)}`);
    }
}

/**
 * Escribe datos en un archivo JSON en una ruta dada.
 * @param filePath La ruta al archivo.
 * @param data Los datos a escribir.
 */
async function writeJsonFile(filePath: string, data: any): Promise<void> {
    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error(`Error al escribir en ${filePath}:`, error);
        throw new Error(`Fallo al escribir en el archivo de base de datos: ${path.basename(filePath)}`);
    }
}

// --- Funciones exportadas del proveedor local ---

export async function readConfig(): Promise<Partial<ConfigState>> {
    return (await readJsonFile<ConfigState>(CONFIG_PATH)) || {};
}

export async function writeConfig(config: ConfigState): Promise<void> {
    await writeJsonFile(CONFIG_PATH, config);
}

export async function readLiveState(): Promise<Partial<LiveState>> {
    return (await readJsonFile<LiveState>(LIVE_STATE_PATH)) || {};
}

export async function writeLiveState(liveState: LiveState): Promise<void> {
    await writeJsonFile(LIVE_STATE_PATH, liveState);
}

export async function readTournament(tournamentId: string): Promise<Partial<Tournament> | null> {
    const tournamentDir = path.join(TOURNAMENTS_DIR, tournamentId);
    const teamsFilePath = path.join(tournamentDir, 'teams.json');
    const fixtureFilePath = path.join(tournamentDir, 'fixture.json');
    const summariesDir = path.join(tournamentDir, 'summaries');

    try {
        await fs.access(tournamentDir); // Chequea si el directorio existe

        const [teamsData, fixtureData] = await Promise.all([
            readJsonFile(teamsFilePath),
            readJsonFile(fixtureFilePath)
        ]);
        
        const partialTournament: Partial<Tournament> = {
          ...(teamsData as Partial<Tournament> || {}),
          ...(fixtureData as Partial<Tournament> || {}),
        };

        if (partialTournament.matches) {
            const matchSummaryPromises = partialTournament.matches.map(async (match: MatchData) => {
                const summaryPath = path.join(summariesDir, `${match.id}.json`);
                try {
                    const summary = await readJsonFile(summaryPath);
                    return { ...match, summary: summary || undefined };
                } catch {
                    return match; // Devuelve el partido sin resumen si el archivo no se encuentra
                }
            });
            partialTournament.matches = await Promise.all(matchSummaryPromises);
        }
        
        return partialTournament;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }
        console.error(`Error al leer el torneo ${tournamentId}:`, error);
        return null;
    }
}

export async function writeTournament(tournament: Tournament): Promise<void> {
    const tournamentDir = path.join(TOURNAMENTS_DIR, tournament.id);
    const teamsFilePath = path.join(tournamentDir, 'teams.json');
    const fixtureFilePath = path.join(tournamentDir, 'fixture.json');
    const summariesDir = path.join(tournamentDir, 'summaries');

    try {
        await fs.mkdir(summariesDir, { recursive: true });

        const teamsData = {
            categories: tournament.categories || [],
            teams: tournament.teams || [],
        };
        
        const fixtureMatches: Omit<MatchData, 'summary'>[] = [];
        const summaryWritePromises: Promise<void>[] = [];

        (tournament.matches || []).forEach(match => {
            const { summary, ...matchWithoutSummary } = match;
            
            if (summary) {
                const summaryPath = path.join(summariesDir, `${match.id}.json`);
                summaryWritePromises.push(writeJsonFile(summaryPath, summary));
                
                 const homeScore = (summary.statsByPeriod || []).reduce((acc, p) => acc + (p.stats.goals.home?.length ?? 0), 0) + (summary.shootout?.homeAttempts.filter(a => a.isGoal).length ?? 0);
                 const awayScore = (summary.statsByPeriod || []).reduce((acc, p) => acc + (p.stats.goals.away?.length ?? 0), 0) + (summary.shootout?.awayAttempts.filter(a => a.isGoal).length ?? 0);
                
                matchWithoutSummary.homeScore = homeScore;
                matchWithoutSummary.awayScore = awayScore;
                matchWithoutSummary.overTimeOrShootouts = summary.overTimeOrShootouts;
            }
            fixtureMatches.push(matchWithoutSummary);
        });

        const fixtureData = {
            matches: fixtureMatches,
        };

        await Promise.all([
            writeJsonFile(teamsFilePath, teamsData),
            writeJsonFile(fixtureFilePath, fixtureData),
            ...summaryWritePromises,
        ]);

    } catch (error) {
         console.error(`Error al escribir los archivos del torneo ${tournament.id}:`, error);
        throw new Error("Fallo al escribir el archivo del torneo.");
    }
}
