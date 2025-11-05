
import { google } from 'googleapis';
import stream from 'stream';
import { promises as fs } from 'fs';
import path from 'path';
import type { ConfigState, LiveState, Tournament, MatchData } from '@/types';

// --- Configuración y Autenticación con Google Drive ---

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const CREDENTIALS_PATH = path.join(process.cwd(), 'env_drive_credentials.json');

let drive: any;
let isInitialized = false;

async function initializeDrive() {
    if (isInitialized) return;

    try {
        const credentialsFile = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
        const credentials = JSON.parse(credentialsFile);

        const auth = new google.auth.JWT(
            credentials.client_email,
            undefined,
            credentials.private_key,
            SCOPES
        );

        drive = google.drive({ version: 'v3', auth });
        isInitialized = true;
    } catch (error) {
        const errorMessage = error instanceof Error ? `Error al leer o parsear las credenciales: ${error.message}` : "Error desconocido durante la inicialización de Google Drive.";
        console.error("[GDRIVE_PROVIDER] ¡¡ERROR CRÍTICO EN LA INICIALIZACIÓN!!", errorMessage);
        throw new Error(errorMessage);
    }
}

const checkPrerequisites = async () => {
    if (!isInitialized) {
        await initializeDrive();
    }
    if (!FOLDER_ID) {
        throw new Error("La variable de entorno GOOGLE_DRIVE_FOLDER_ID no está configurada.");
    }
};

async function findFileOrFolder(name: string, parentId: string, mimeType?: string): Promise<string | null> {
    await checkPrerequisites();
    let query = `name = '${name}' and '${parentId}' in parents and trashed = false`;
    if (mimeType) {
        query += ` and mimeType = '${mimeType}'`;
    }
    try {
        const res = await drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive',
        });
        
        return res.data.files?.[0]?.id || null;
    } catch (error: any) {
        console.error(`[GDRIVE_PROVIDER] Error en la API de Drive al buscar '${name}':`, error.message);
        throw error;
    }
}

export async function listFiles(folderId?: string): Promise<{ id: string; name: string }[] | null> {
    await checkPrerequisites();
    const targetFolderId = folderId || FOLDER_ID;
    if (!targetFolderId) {
        throw new Error("No se ha proporcionado un ID de carpeta para listar archivos.");
    }
    try {
        const res = await drive.files.list({
            q: `'${targetFolderId}' in parents and trashed = false`,
            fields: 'files(id, name)',
            spaces: 'drive',
            pageSize: 100,
        });
        return res.data.files || [];
    } catch (error: any) {
        console.error(`[GDRIVE_PROVIDER] Error listando archivos en la carpeta ${targetFolderId}:`, error.message);
        throw error;
    }
}


async function createFolder(name: string, parentId: string): Promise<string> {
    await checkPrerequisites();
    try {
        const fileMetadata = {
            name: name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        };
        const res = await drive.files.create({
            requestBody: fileMetadata,
            fields: 'id',
        });
        if (!res.data.id) throw new Error("Failed to get ID for created folder.");
        return res.data.id;
    } catch (error) {
        console.error(`Error creating folder '${name}':`, error);
        throw error;
    }
}

async function getOrCreateFolder(name: string, parentId: string): Promise<string> {
    const folderId = await findFileOrFolder(name, parentId, 'application/vnd.google-apps.folder');
    return folderId || createFolder(name, parentId);
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
                    reject(new Error(`Failed to parse JSON content for file ID ${fileId}`));
                }
            });
            (res.data as any).on('error', (err: any) => reject(err));
        });
    } catch (error: any) {
        if (error.code === 404) return null; // File not found is a valid case
        console.error(`Error reading file content for ID '${fileId}':`, error);
        throw error;
    }
}

async function createOrUpdateFile(fileName: string, parentId: string, data: any): Promise<void> {
    await checkPrerequisites();
    const content = JSON.stringify(data, null, 2);
    const fileId = await findFileOrFolder(fileName, parentId);

    const media = {
        mimeType: 'application/json',
        body: new stream.Readable({
            read() {
                this.push(content);
                this.push(null);
            }
        }),
    };

    try {
        if (fileId) {
            await drive.files.update({ fileId: fileId, media: media });
        } else {
            await drive.files.create({
                media: media,
                requestBody: {
                    name: fileName,
                    parents: [parentId],
                },
            });
        }
    } catch (error) {
        console.error(`Error creating/updating file '${fileName}':`, error);
        throw error;
    }
}

export async function readConfig(): Promise<Partial<ConfigState> | null> {
    await checkPrerequisites();
    const fileId = await findFileOrFolder('config.json', FOLDER_ID!);
    if (!fileId) return null;
    return await readFileContent<ConfigState>(fileId);
}

export async function writeConfig(config: ConfigState): Promise<void> {
    await checkPrerequisites();
    await createOrUpdateFile('config.json', FOLDER_ID!, config);
}

export async function readLiveState(): Promise<Partial<LiveState> | null> {
    await checkPrerequisites();
    const fileId = await findFileOrFolder('live.json', FOLDER_ID!);
    if (!fileId) return null;
    return await readFileContent<LiveState>(fileId);
}

export async function writeLiveState(liveState: LiveState): Promise<void> {
    await checkPrerequisites();
    await createOrUpdateFile('live.json', FOLDER_ID!, liveState);
}

export async function readTournament(tournamentId: string): Promise<Partial<Tournament> | null> {
    await checkPrerequisites();
    const tournamentsFolderId = await getOrCreateFolder('tournaments', FOLDER_ID!);
    const tournamentFolderId = await findFileOrFolder(tournamentId, tournamentsFolderId, 'application/vnd.google-apps.folder');
    if (!tournamentFolderId) return null;

    const teamsFileId = await findFileOrFolder('teams.json', tournamentFolderId);
    const fixtureFileId = await findFileOrFolder('fixture.json', tournamentFolderId);
    
    const [teamsData, fixtureData] = await Promise.all([
        teamsFileId ? readFileContent(teamsFileId) : Promise.resolve(null),
        fixtureFileId ? readFileContent(fixtureFileId) : Promise.resolve(null)
    ]);

    const partialTournament: Partial<Tournament> = {
        ...(teamsData as Partial<Tournament> || {}),
        ...(fixtureData as Partial<Tournament> || {}),
    };

    if (partialTournament.matches) {
        const summariesFolderId = await findFileOrFolder('summaries', tournamentFolderId, 'application/vnd.google-apps.folder');
        if (summariesFolderId) {
            const matchSummaryPromises = partialTournament.matches.map(async (match: MatchData) => {
                const summaryFileId = await findFileOrFolder(`${match.id}.json`, summariesFolderId);
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
    await checkPrerequisites();
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
            
            const homeGoals = (summary.statsByPeriod || []).reduce((acc, p) => acc + (p.stats.goals.home?.length ?? 0), 0) + (summary.shootout?.homeAttempts.filter(a => a.isGoal).length ?? 0);
            const awayGoals = (summary.statsByPeriod || []).reduce((acc, p) => acc + (p.stats.goals.away?.length ?? 0), 0) + (summary.shootout?.awayAttempts.filter(a => a.isGoal).length ?? 0);
            
            matchWithoutSummary.homeScore = homeGoals;
            matchWithoutSummary.awayScore = awayGoals;
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
