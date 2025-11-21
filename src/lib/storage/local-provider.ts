
import { promises as fs } from 'fs';
import path from 'path';
import type { ConfigState, LiveState, MatchData, Tournament } from '@/types';

// Use the STORAGE_PATH from environment variable, or default to './storage' in the project root.
export function getStorageDir(): string {
    const storagePath = process.env.STORAGE_PATH;
    if (storagePath) {
        // Check if the path is absolute. If so, use it directly. Otherwise, join it with the current working directory.
        if (path.isAbsolute(storagePath)) {
            return storagePath;
        }
        return path.join(process.cwd(), storagePath);
    }
    // Default to './storage' in the project root if the environment variable is not set.
    return path.join(process.cwd(), 'storage');
}


const getDataDir = () => path.join(getStorageDir(), 'data');
const getConfigPath = () => path.join(getDataDir(), 'config.json');
const getLiveStatePath = () => path.join(getDataDir(), 'live.json');
const getTournamentsDir = () => path.join(getDataDir(), 'tournaments');
const getVersionFilePath = () => path.join(getStorageDir(), 'lastSyncVersion.log');

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

// --- Versioning Functions ---

/**
 * Reads the current data version from lastSyncVersion.log.
 * If the file doesn't exist, it creates it with version 0 and returns 0.
 * @returns The current version number.
 */
export async function readVersion(): Promise<number> {
    const versionFilePath = getVersionFilePath();
    try {
        await fs.mkdir(path.dirname(versionFilePath), { recursive: true });
        const data = await fs.readFile(versionFilePath, 'utf-8');
        const version = parseInt(data.trim(), 10);
        return isNaN(version) ? 0 : version;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            try {
                await fs.writeFile(versionFilePath, '0', 'utf-8');
                return 0;
            } catch (writeError) {
                console.error(`Error creating version file:`, writeError);
                return 0; // Return 0 if creation fails
            }
        }
        return 0;
    }
}

/**
 * Reads the current version, increments it, and writes it back to the file.
 * This is now the single point of truth for modifying the version.
 */
async function incrementVersion(): Promise<void> {
    const versionFilePath = getVersionFilePath();
    try {
        const currentVersion = await readVersion();
        const newVersion = currentVersion === Number.MAX_SAFE_INTEGER ? 1 : currentVersion + 1;
        await fs.writeFile(versionFilePath, String(newVersion), 'utf-8');
    } catch (error) {
        console.error(`Error incrementing version file:`, error);
    }
}


// --- Funciones exportadas del proveedor local ---

export async function readConfig(): Promise<Partial<ConfigState>> {
    return (await readJsonFile<ConfigState>(getConfigPath())) || {};
}

export async function writeConfig(config: ConfigState): Promise<void> {
    await writeJsonFile(getConfigPath(), config);
    // No incrementar versión aquí para evitar inflación por cambios menores.
}

export async function readLiveState(): Promise<Partial<LiveState>> {
    return (await readJsonFile<LiveState>(getLiveStatePath())) || {};
}

export async function writeLiveState(liveState: LiveState): Promise<void> {
    await writeJsonFile(getLiveStatePath(), liveState);
    // No incrementar versión aquí para evitar inflación durante un partido.
}

export async function readTournament(tournamentId: string): Promise<Partial<Tournament> | null> {
    const tournamentsDir = getTournamentsDir();
    const tournamentDir = path.join(tournamentsDir, tournamentId);
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
    const tournamentsDir = getTournamentsDir();
    const tournamentDir = path.join(tournamentsDir, tournament.id);
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
                // Note: Score and overtime info are calculated from summary when needed
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

        await incrementVersion();

    } catch (error) {
         console.error(`Error al escribir los archivos del torneo ${tournament.id}:`, error);
        throw new Error("Fallo al escribir el archivo del torneo.");
    }
}
