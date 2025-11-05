
import { google, Auth } from 'googleapis';
import stream from 'stream';
import { promises as fs } from 'fs';
import path from 'path';
import type { ConfigState, LiveState, Tournament, MatchData } from '@/types';

// --- Configuración y Autenticación con Google Drive ---

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const CREDENTIALS_PATH = path.join(process.cwd(), 'env_drive_credentials.json');

let drive: any;

// Una promesa que se resolverá cuando la inicialización esté completa.
let initializationPromise: Promise<void> | null = null;
let isInitializing = false;

async function initializeDrive() {
    if (initializationPromise) {
        return initializationPromise;
    }

    isInitializing = true;
    initializationPromise = new Promise(async (resolve, reject) => {
        if (!FOLDER_ID) {
            const err = new Error("[GDRIVE_PROVIDER] FATAL: La variable de entorno GOOGLE_DRIVE_FOLDER_ID no está configurada.");
            console.error(err.message);
            isInitializing = false;
            return reject(err);
        }

        try {
            let credentialsFileContent = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
            
             // Limpia el BOM (Byte Order Mark) si existe.
            if (credentialsFileContent.charCodeAt(0) === 0xFEFF) {
                credentialsFileContent = credentialsFileContent.slice(1);
            }
            credentialsFileContent = credentialsFileContent.trim();


            const credentials = JSON.parse(credentialsFileContent);

            const authClient = new google.auth.JWT(
                credentials.client_email,
                undefined,
                credentials.private_key,
                SCOPES
            );

            await authClient.authorize(); 

            drive = google.drive({ version: 'v3', auth: authClient });
            console.log("[GDRIVE_PROVIDER] Cliente de Google Drive inicializado y autenticado correctamente.");
            isInitializing = false;
            resolve();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Error desconocido durante la inicialización de Google Drive.";
            console.error("[GDRIVE_PROVIDER] !! FALLO CRÍTICO EN LA INICIALIZACIÓN !!", errorMessage);
            isInitializing = false;
            // Rechaza la promesa para que las funciones que la esperan fallen claramente.
            reject(new Error(`Fallo al inicializar la autenticación con Google Drive: ${errorMessage}`));
        }
    });

    return initializationPromise;
}

// Todas las funciones que interactúan con 'drive' deben esperar a que la inicialización se complete.
async function checkPrerequisites() {
    if (isInitializing && initializationPromise) {
        return initializationPromise;
    }
    if (!drive) {
        await initializeDrive();
    }
}

async function findFileId(name: string, parentId: string): Promise<string | null> {
    await checkPrerequisites();
    try {
        const res = await drive.files.list({
            q: `name = '${name}' and '${parentId}' in parents and trashed = false`,
            fields: 'files(id)',
            spaces: 'drive',
        });
        return res.data.files?.[0]?.id || null;
    } catch (error: any) {
        if (error.code === 403) {
             throw new Error(`Error de Permiso (403) al buscar '${name}'. Asegúrate de que la API de Google Drive esté HABILITADA en tu proyecto de Google Cloud y que la cuenta de servicio tenga permisos de 'Lector' o 'Editor' en la carpeta de Drive.`);
        }
        console.error(`[GDRIVE_PROVIDER] Error en la API de Drive al buscar '${name}':`, error);
        // Propaga el error original para un diagnóstico más preciso.
        throw error;
    }
}

async function readFileContent<T>(fileId: string): Promise<T | null> {
    await checkPrerequisites();
    try {
        const res = await drive.files.get({ fileId: fileId, alt: 'media' });
        const chunks: any[] = [];
        return new Promise((resolve, reject) => {
            (res.data as any).on('data', (chunk: any) => chunks.push(chunk));
            (res.data as any).on('end', () => {
                try {
                    const content = Buffer.concat(chunks).toString();
                    resolve(JSON.parse(content));
                } catch (e) {
                    reject(new Error(`Fallo al parsear el contenido JSON del archivo con ID ${fileId}`));
                }
            });
            (res.data as any).on('error', (err: any) => reject(err));
        });
    } catch (error: any) {
        console.error(`[GDRIVE_PROVIDER] Error leyendo el contenido del archivo ID '${fileId}':`, error);
        throw new Error(`No se pudo leer el contenido del archivo desde Google Drive (ID: ${fileId})`);
    }
}


export async function readConfig(): Promise<Partial<ConfigState>> {
    const fileId = await findFileId('config.json', FOLDER_ID!);
    if (!fileId) {
        console.warn("ADVERTENCIA: El archivo 'config.json' no se encontró en Google Drive. Se usará una configuración vacía.");
        return {};
    }
    return (await readFileContent<ConfigState>(fileId)) || {};
}

export async function readLiveState(): Promise<Partial<LiveState>> {
    const fileId = await findFileId('live.json', FOLDER_ID!);
    if (!fileId) {
        console.warn("ADVERTENCIA: El archivo 'live.json' no se encontró en Google Drive. Se usará un estado en vivo vacío.");
        return {};
    }
    return (await readFileContent<LiveState>(fileId)) || {};
}


async function createOrUpdateFile(fileName: string, parentId: string, data: any): Promise<void> {
    await checkPrerequisites();
    const fileId = await findFileId(fileName, parentId);
    const media = {
        mimeType: 'application/json',
        body: new stream.Readable({
            read() {
                this.push(JSON.stringify(data, null, 2));
                this.push(null);
            }
        }),
    };

    try {
        if (fileId) {
            await drive.files.update({ fileId, media });
        } else {
            await drive.files.create({
                media,
                requestBody: { name: fileName, parents: [parentId] },
            });
        }
    } catch (error: any) {
        if (error.code === 403) {
             throw new Error(`Error de Permiso (403) al escribir '${fileName}'. Asegúrate de que la API de Google Drive esté HABILITADA y que la cuenta de servicio tenga permisos de 'Editor' en la carpeta de Drive.`);
        }
        console.error(`[GDRIVE_PROVIDER] Error al escribir el archivo '${fileName}':`, error.message);
        throw new Error(`No se pudo escribir el archivo en Google Drive: ${fileName}`);
    }
}

async function getOrCreateFolder(name: string, parentId: string): Promise<string> {
    await checkPrerequisites();
    let folderId = await findFileId(name, parentId);
    if (!folderId) {
        const fileMetadata = {
            name: name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        };
        const res = await drive.files.create({
            requestBody: fileMetadata,
            fields: 'id',
        });
        if (!res.data.id) throw new Error(`No se pudo crear o encontrar la carpeta ${name}`);
        folderId = res.data.id;
    }
    return folderId;
}

export async function writeConfig(config: ConfigState): Promise<void> {
    await createOrUpdateFile('config.json', FOLDER_ID!, config);
}

export async function writeLiveState(liveState: LiveState): Promise<void> {
    await createOrUpdateFile('live.json', FOLDER_ID!, liveState);
}

export async function readTournament(tournamentId: string): Promise<Partial<Tournament> | null> {
    const tournamentsFolderId = await getOrCreateFolder('tournaments', FOLDER_ID!);
    const tournamentFolderId = await findFileId(tournamentId, tournamentsFolderId);
    if (!tournamentFolderId) return null;

    const teamsFileId = await findFileId('teams.json', tournamentFolderId);
    const fixtureFileId = await findFileId('fixture.json', tournamentFolderId);
    
    const [teamsData, fixtureData] = await Promise.all([
        teamsFileId ? readFileContent(teamsFileId) : Promise.resolve(null),
        fixtureFileId ? readFileContent(fixtureFileId) : Promise.resolve(null)
    ]);

    const partialTournament: Partial<Tournament> = {
        ...(teamsData as Partial<Tournament> || {}),
        ...(fixtureData as Partial<Tournament> || {}),
    };

    if (partialTournament.matches) {
        const summariesFolderId = await findFileId('summaries', tournamentFolderId);
        if (summariesFolderId) {
            const matchSummaryPromises = partialTournament.matches.map(async (match: MatchData) => {
                const summaryFileId = await findFileId(`${match.id}.json`, summariesFolderId);
                if (summaryFileId) {
                    const summary = await readFileContent(summaryFileId);
                    return { ...match, summary: summary || undefined };
                }
                return match;
            });
            partialTournament.matches = await Promise.all(matchSummaryPromises);
        }
    }
    
    return partialTournament;
}

export async function writeTournament(tournament: Tournament): Promise<void> {
    const tournamentsFolderId = await getOrCreateFolder('tournaments', FOLDER_ID!);
    const tournamentFolderId = await getOrCreateFolder(tournament.id, tournamentsFolderId);

    const teamsData = { categories: tournament.categories || [], teams: tournament.teams || [] };
    
    const fixtureMatches: Omit<MatchData, 'summary'>[] = [];
    const summaryWritePromises: Promise<void>[] = [];
    
    const summariesFolderId = await getOrCreateFolder('summaries', tournamentFolderId);
    
    (tournament.matches || []).forEach(match => {
        const { summary, ...matchWithoutSummary } = match;
        if (summary) {
            summaryWritePromises.push(createOrUpdateFile(`${match.id}.json`, summariesFolderId, summary));
            
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
        createOrUpdateFile('teams.json', tournamentFolderId, teamsData),
        createOrUpdateFile('fixture.json', tournamentFolderId, fixtureData),
        ...summaryWritePromises,
    ]);
}

export async function listFiles(folderId: string): Promise<{ id: string; name: string }[] | null> {
    await checkPrerequisites();
    try {
        const res = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name)',
            spaces: 'drive',
            pageSize: 100,
        });
        return res.data.files || [];
    } catch (error: any) {
        if (error.code === 403) {
             throw new Error(`Error de Permiso (403). Asegúrate de que la API de Google Drive esté HABILITADA en tu proyecto de Google Cloud y que la cuenta de servicio tenga permisos de 'Lector' o 'Editor' en la carpeta de Drive.`);
        }
        console.error(`[GDRIVE_PROVIDER] Error listando archivos en la carpeta ${folderId}:`, error.message);
        throw error;
    }
}
