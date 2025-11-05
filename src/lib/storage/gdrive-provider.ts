
import { google } from 'googleapis';
import stream from 'stream';
import path from 'path';
import { promises as fs } from 'fs';
import type { ConfigState, LiveState, Tournament, MatchData } from '@/types';

// --- Configuración y Autenticación con Google Drive ---

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const CREDENTIALS_PATH = path.join(process.cwd(), 'env_drive_credentials.json');

let drive: any;
let initializationPromise: Promise<void> | null = null;

interface LogEntry {
  step: string;
  status: 'success' | 'error';
  message: string;
}

async function initializeDrive(logs: LogEntry[]) {
    if (drive) return;
    
    if (initializationPromise) {
        return initializationPromise;
    }

    const performInitialization = async () => {
        const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!FOLDER_ID) {
            throw new Error("[GDRIVE_PROVIDER] FATAL: La variable de entorno GOOGLE_DRIVE_FOLDER_ID no está configurada.");
        }
        
        let credentials;
        try {
            const credentialsContent = await fs.readFile(CREDENTIALS_PATH, 'utf8');
            credentials = JSON.parse(credentialsContent);
            if (!credentials.client_email || !credentials.private_key) {
                throw new Error("El archivo de credenciales es inválido o está incompleto.");
            }
            logs.push({ step: "Leer Credenciales", status: "success", message: `Credenciales leídas exitosamente de ${path.basename(CREDENTIALS_PATH)}.` });
        } catch (error: any) {
             if (error.code === 'ENOENT') {
                throw new Error(`El archivo de credenciales '${path.basename(CREDENTIALS_PATH)}' no se encontró en la raíz del proyecto.`);
            }
            throw new Error(`Error al leer o parsear el archivo de credenciales: ${error.message}`);
        }

        try {
            const authClient = new google.auth.JWT(
                credentials.client_email,
                undefined,
                credentials.private_key,
                SCOPES
            );
            await authClient.authorize();
            drive = google.drive({ version: 'v3', auth: authClient });
            logs.push({ step: "Autenticación con Google", status: "success", message: "Autenticación JWT exitosa." });
        } catch (error: any) {
            throw new Error(`Fallo en la autenticación con Google: ${error.message}`);
        }
    };
    
    initializationPromise = performInitialization().catch(err => {
        initializationPromise = null;
        drive = null; 
        throw err;
    });

    return initializationPromise;
}

async function getDriveClient(logs?: LogEntry[]) {
    const internalLogs = logs || [];
    await initializeDrive(internalLogs);
    return drive;
}

async function findFileId(name: string, parentId: string): Promise<string | null> {
    try {
        const driveClient = await getDriveClient([]);
        const res = await driveClient.files.list({
            q: `name = '${name}' and '${parentId}' in parents and trashed = false`,
            fields: 'files(id)',
            spaces: 'drive',
        });
        return res.data.files?.[0]?.id || null;
    } catch (error: any) {
        console.error(`[GDRIVE_PROVIDER] Error en la API de Drive al buscar '${name}':`, error.message);
        throw error;
    }
}

async function readFileContent<T>(fileId: string): Promise<T | null> {
    try {
        const driveClient = await getDriveClient([]);
        const res = await driveClient.files.get({ fileId: fileId, alt: 'media' });
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
        if (error.code === 404) {
            console.warn(`[GDRIVE_PROVIDER] Archivo con ID '${fileId}' no encontrado.`);
            return null;
        }
        console.error(`[GDRIVE_PROVIDER] Error leyendo el contenido del archivo ID '${fileId}':`, error.message);
        throw error;
    }
}


export async function readConfig(): Promise<Partial<ConfigState> | null> {
    try {
        await getDriveClient([]);
        const fileId = await findFileId('config.json', process.env.GOOGLE_DRIVE_FOLDER_ID!);
        if (!fileId) {
            console.warn("ADVERTENCIA: El archivo 'config.json' no se encontró en Google Drive. Se usará una configuración vacía.");
            return {};
        }
        return (await readFileContent<ConfigState>(fileId)) || {};
    } catch (error) {
        console.error("Error crítico en readConfig:", error);
        return null;
    }
}

export async function readLiveState(): Promise<Partial<LiveState> | null> {
     try {
        await getDriveClient([]);
        const fileId = await findFileId('live.json', process.env.GOOGLE_DRIVE_FOLDER_ID!);
        if (!fileId) {
            console.warn("ADVERTENCIA: El archivo 'live.json' no se encontró en Google Drive. Se usará un estado en vivo vacío.");
            return {};
        }
        return (await readFileContent<LiveState>(fileId)) || {};
    } catch (error) {
        console.error("Error crítico en readLiveState:", error);
        return null;
    }
}


async function createOrUpdateFile(fileName: string, parentId: string, data: any): Promise<void> {
    await getDriveClient([]);
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
        console.error(`[GDRIVE_PROVIDER] Error al escribir el archivo '${fileName}':`, error.message);
        throw error;
    }
}

async function getOrCreateFolder(name: string, parentId: string): Promise<string> {
    await getDriveClient([]);
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
    await createOrUpdateFile('config.json', process.env.GOOGLE_DRIVE_FOLDER_ID!, config);
}

export async function writeLiveState(liveState: LiveState): Promise<void> {
    await createOrUpdateFile('live.json', process.env.GOOGLE_DRIVE_FOLDER_ID!, liveState);
}

export async function readTournament(tournamentId: string): Promise<Partial<Tournament> | null> {
    const tournamentsFolderId = await getOrCreateFolder('tournaments', process.env.GOOGLE_DRIVE_FOLDER_ID!);
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
    const tournamentsFolderId = await getOrCreateFolder('tournaments', process.env.GOOGLE_DRIVE_FOLDER_ID!);
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

export async function listFiles(logs: LogEntry[]): Promise<{ id: string; name: string }[] | null> {
    const driveClient = await getDriveClient(logs);
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

    try {
        logs.push({ step: "Verificar Acceso a Carpeta", status: "success", message: `Intentando acceder a la carpeta ID: ...${folderId!.slice(-6)}` });
        const folderRes = await driveClient.files.get({
            fileId: folderId,
            fields: 'id, name',
        });
        logs.at(-1)!.message += ` - ¡Éxito! Nombre: "${folderRes.data.name}".`;
    } catch (error: any) {
        const errorMessage = `No se pudo encontrar o acceder a la carpeta de Drive. Verifica que el ID es correcto y que la cuenta de servicio tiene permisos de 'Lector'. Error original: ${error.message}`;
        logs.at(-1)!.status = 'error';
        logs.at(-1)!.message = errorMessage;
        throw new Error(errorMessage);
    }
    
    try {
        logs.push({ step: "Listar Contenido de Carpeta", status: "success", message: "Buscando archivos..." });
        const res = await driveClient.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name)',
            spaces: 'drive',
            pageSize: 100,
        });
        logs.at(-1)!.message += ` - Encontrados ${res.data.files?.length || 0} archivos/subcarpetas.`;
        return res.data.files || [];
    } catch (error: any) {
        const errorMessage = `Error en API de Drive al listar archivos: ${error.message}`;
        logs.at(-1)!.status = 'error';
        logs.at(-1)!.message = errorMessage;
        throw new Error(errorMessage);
    }
}
