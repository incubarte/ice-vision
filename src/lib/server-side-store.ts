import 'server-only';
import type { LiveGameState, ConfigState, RemoteCommand, AccessRequest, TunnelState, Tournament, GameState, FormatAndTimingsProfile, ScoreboardLayoutSettings, ScoreboardLayoutProfile, ReplaySettings, PenaltyTypeDefinition } from '@/types';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import os from 'os';
import localtunnel, { type Tunnel } from 'localtunnel';
import { readConfig as readConfigFromProvider, readLiveState as readLiveStateFromProvider, writeConfig as writeConfigToProvider, writeLiveState as writeLiveStateToProvider } from './storage';
import defaultSettings from '@/config/defaults.json';

// --- Estado Global del Servidor y Emisores de Eventos ---

// Definir una interfaz para nuestro objeto global personalizado
interface AppGlobal {
  gameStateEmitter: EventEmitter | undefined;
  commandEmitter: EventEmitter | undefined;
  tunnelInstance: Tunnel | undefined;
  initializationPromise: Promise<void> | null;
  storedConfig: ConfigState | null;
  storedGameState: LiveState | null;
}

// Usar un símbolo único para evitar colisiones de nombres
const APP_GLOBAL_KEY = Symbol.for('icevision.app.global');

// Función para obtener nuestro espacio de nombres global, creándolo si no existe
const getAppGlobal = (): AppGlobal => {
  if (!(globalThis as any)[APP_GLOBAL_KEY]) {
    (globalThis as any)[APP_GLOBAL_KEY] = {
      gameStateEmitter: undefined,
      commandEmitter: undefined,
      tunnelInstance: undefined,
      initializationPromise: null,
      storedConfig: null,
      storedGameState: null,
    };
  }
  return (globalThis as any)[APP_GLOBAL_KEY];
};


const appGlobal = getAppGlobal();

export const gameStateEmitter = appGlobal.gameStateEmitter ?? (appGlobal.gameStateEmitter = new EventEmitter());
export const commandEmitter = appGlobal.commandEmitter ?? (appGlobal.commandEmitter = new EventEmitter());

// --- Gestión de Contraseña de Acceso Remoto ---

const PASSWORD_FILE_PATH = path.join(os.tmpdir(), '.remote_password');

function generatePassword(): string {
    const newPassword = Math.floor(10000 + Math.random() * 90000).toString();
    try {
        fs.writeFileSync(PASSWORD_FILE_PATH, newPassword, 'utf8');
        console.log(`*************************************************`);
        console.log(`* New Remote Access Password Generated: ${newPassword} *`);
        console.log(`* Stored at: ${PASSWORD_FILE_PATH}                 *`);
        console.log(`*************************************************`);
        return newPassword;
    } catch (error) {
        console.error("!!! CRITICAL: FAILED TO WRITE PASSWORD FILE !!!", error);
        return newPassword;
    }
}

function readPassword(): string | null {
    try {
        if (fs.existsSync(PASSWORD_FILE_PATH)) {
            return fs.readFileSync(PASSWORD_FILE_PATH, 'utf8').trim();
        }
        return null;
    } catch (error) {
        console.error("!!! CRITICAL: FAILED TO READ PASSWORD FILE !!!", error);
        return null;
    }
}

export function getRemoteAccessPassword(): string {
    let password = readPassword();
    if (!password) {
        password = generatePassword();
    }
    return password;
}

const safeUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const INITIAL_LAYOUT_SETTINGS: ScoreboardLayoutSettings = {
  scoreboardVerticalPosition: -4,
  scoreboardHorizontalPosition: 0,
  clockSize: 12,
  teamNameSize: 3,
  teamNameWidth: 16,
  scoreSize: 8,
  periodSize: 4.5,
  playersOnIceIconSize: 1.75,
  categorySize: 1.25,
  teamLabelSize: 1,
  penaltiesTitleSize: 2,
  penaltyPlayerNumberSize: 3.5,
  penaltyTimeSize: 3.5,
  penaltyPlayerIconSize: 2.5,
  standingsTableFontSize: 1.8,
  standingsTableRowHeight: 4.25,
  teamLogoOpacity: 10,
  primaryColor: '223 65% 33%',
  accentColor: '40 100% 67%',
  backgroundColor: '223 70% 11%',
  mainContentGap: 3,
  scoreLabelGap: -2,
};

export const createDefaultFormatAndTimingsProfile = (): FormatAndTimingsProfile => ({
  id: safeUUID(),
  name: "Predeterminado (App)",
  ...defaultSettings.formatAndTimings,
  gameTimeMode: 'stopped',
  autoActivatePuckPenalties: true,
  enableStoppedTimeAlert: false,
  stoppedTimeAlertGoalDiff: 1,
  stoppedTimeAlertTimeRemaining: 2,
  penaltyTypes: defaultSettings.penaltyTypes.map(p => ({
    ...p,
    reducesPlayerCount: p.reducesPlayerCount,
    clearsOnGoal: p.clearsOnGoal,
    isBenchPenalty: p.isBenchPenalty || false,
  })) as PenaltyTypeDefinition[],
  defaultPenaltyTypeId: defaultSettings.defaultPenaltyTypeId,
});

export const createDefaultScoreboardLayoutProfile = (): ScoreboardLayoutProfile => ({
    id: safeUUID(),
    name: "Diseño Predeterminado (App)",
    ...INITIAL_LAYOUT_SETTINGS
});


// Función para crear un estado por defecto completo.
export const getInitialState = (): GameState => {
  const defaultFormatProfile = createDefaultFormatAndTimingsProfile();
  const defaultLayoutProfile = createDefaultScoreboardLayoutProfile();
  
  return {
    config: {
      ...defaultSettings.formatAndTimings,
      gameTimeMode: 'stopped',
      autoActivatePuckPenalties: true,
      enableStoppedTimeAlert: false,
      stoppedTimeAlertGoalDiff: 1,
      stoppedTimeAlertTimeRemaining: 2,
      penaltyTypes: defaultSettings.penaltyTypes.map(p => ({...p, isBenchPenalty: p.isBenchPenalty || false })) as PenaltyTypeDefinition[],
      defaultPenaltyTypeId: defaultSettings.defaultPenaltyTypeId,
      formatAndTimingsProfiles: [defaultFormatProfile],
      selectedFormatAndTimingsProfileId: defaultFormatProfile.id,
      playSoundAtPeriodEnd: true,
      customHornSoundDataUrl: null,
      enableTeamSelectionInMiniScoreboard: true,
      enablePlayerSelectionForPenalties: true,
      showAliasInPenaltyPlayerSelector: true,
      showAliasInControlsPenaltyList: true,
      showAliasInScoreboardPenalties: true,
      enablePenaltyCountdownSound: true,
      penaltyCountdownStartTime: 10,
      customPenaltyBeepSoundDataUrl: null,
      enableDebugMode: false,
      tickIntervalMs: 200,
      scoreboardLayout: INITIAL_LAYOUT_SETTINGS,
      scoreboardLayoutProfiles: [defaultLayoutProfile],
      selectedScoreboardLayoutProfileId: defaultLayoutProfile.id,
      selectedMatchCategory: '',
      tournaments: [],
      selectedTournamentId: null,
      tunnel: {
        subdomain: defaultSettings.tunnel.subdomainPrefix,
        port: defaultSettings.tunnel.port,
        status: 'disconnected',
        url: null,
        lastMessage: null,
      },
      replays: {
        syncUrl: "https://hockeando-default-rtdb.firebaseio.com/Replays.json",
        downloadUrlBase: "https://firebasestorage.googleapis.com/v0/b/hockeando.appspot.com/o/"
      },
    },
    live: {
      score: { home: 0, away: 0, homeShots: 0, awayShots: 0 },
      penalties: { home: [], away: [] },
      goals: { home: [], away: [] },
      penaltiesLog: { home: [], away: [] },
      shotsLog: { home: [], away: [] },
      attendance: { home: [], away: [] },
      clock: {
        currentTime: defaultFormatProfile.defaultWarmUpDuration,
        currentPeriod: 0,
        isClockRunning: false,
        periodDisplayOverride: 'Warm-up',
        preTimeoutState: null,
        clockStartTimeMs: null,
        remainingTimeAtStartCs: null,
        absoluteElapsedTimeCs: 0,
        _liveAbsoluteElapsedTimeCs: 0,
        isFlashingZero: false,
      },
      shootout: { isActive: false, rounds: 5, homeAttempts: [], awayAttempts: [], initiator: null },
      homeTeamName: 'Local',
      awayTeamName: 'Visitante',
      playHornTrigger: 0,
      playPenaltyBeepTrigger: 0,
      pendingPowerPlayGoal: null,
      overlayMessage: null,
      goalCelebration: null,
      replayLoadRequest: null,
      replayOverlay: null,
      matchId: null,
      playedPeriods: [],
    },
    _initialConfigLoadComplete: false,
  };
};

// La promesa de inicialización. El núcleo de la solución.
const performInitialization = async () => {
    console.log("[Store] Initializing store... fetching data from provider.");
    const defaultState = getInitialState();
    try {
        const [configResult, liveStateResult] = await Promise.all([
            readConfigFromProvider(),
            readLiveStateFromProvider()
        ]);
        
        appGlobal.storedConfig = (configResult && Object.keys(configResult).length > 0)
            ? configResult as ConfigState
            : defaultState.config;
            
        appGlobal.storedGameState = (liveStateResult && Object.keys(liveStateResult).length > 0)
            ? liveStateResult as LiveState
            : defaultState.live;

        console.log("[Store] Initialization complete. Config and Live State are loaded.");

    } catch (error) {
        console.error("[Store] CRITICAL: Unhandled error during storage initialization.", error);
        throw new Error(`Server data store failed to initialize. Check server logs. Original error: ${error instanceof Error ? error.message : String(error)}`);
    }
};

// Crear la promesa de inicialización UNA SOLA VEZ usando el objeto global.
if (!appGlobal.initializationPromise) {
    appGlobal.initializationPromise = performInitialization();
}

export async function getConfig(): Promise<ConfigState> {
  await appGlobal.initializationPromise;
  return appGlobal.storedConfig!;
}

export async function setConfig(newConfig: ConfigState): Promise<void> {
  await appGlobal.initializationPromise;
  appGlobal.storedConfig = newConfig;
  writeConfigToProvider(newConfig).catch(err => {
      console.error("[Store] Failed to write config to provider:", err);
  });
}

export async function getGameState(): Promise<LiveState> {
  await appGlobal.initializationPromise;
  return appGlobal.storedGameState!;
}

export async function setGameState(newGameState: LiveState): Promise<void> {
  await appGlobal.initializationPromise;
  appGlobal.storedGameState = newGameState;
  gameStateEmitter.emit('update', newGameState);
  writeLiveStateToProvider(newGameState).catch(err => {
      console.error("[Store] Failed to write live state to provider:", err);
  });
}

// Las funciones restantes no necesitan esperar porque suponen que el estado ya está cargado por las funciones anteriores.
export function updateTunnelState(updates: Partial<TunnelState>) {
  if (appGlobal.storedConfig) {
    const newTunnelState = { ...appGlobal.storedConfig.tunnel, ...updates };
    setConfig({ ...appGlobal.storedConfig, tunnel: newTunnelState });
  }
}

export function sendCommand(command: RemoteCommand): void {
  commandEmitter.emit('command', command);
}

export function isClientLocal(request: Request): boolean {
    const clientIp = (request.headers.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();
    if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
        return true;
    }
    return false;
}

// --- Auth Challenge Management ---
let accessRequests: Map<string, AccessRequest> = new Map();

export function createAccessRequest(ip: string, userAgent: string | undefined, verificationNumber: number): AccessRequest {
    const id = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const request: AccessRequest = { id, ip, timestamp: Date.now(), userAgent, verificationNumber, approved: false };
    accessRequests.set(id, request);
    setTimeout(() => {
        const req = accessRequests.get(id);
        if (req && !req.approved) {
             removeAccessRequest(id);
        }
    }, 2 * 60 * 1000);
    return request;
}

export function getAccessRequest(id: string): AccessRequest | undefined {
    return accessRequests.get(id);
}

export function getAllAccessRequests(): AccessRequest[] {
    return Array.from(accessRequests.values()).filter(req => !req.approved);
}

export function removeAccessRequest(id: string): void {
    accessRequests.delete(id);
}

export function approveAccessRequest(id: string): boolean {
    const request = accessRequests.get(id);
    if (!request) {
        return false;
    }
    request.approved = true;
    accessRequests.set(id, request);
    
    setTimeout(() => removeAccessRequest(id), 30 * 1000);
    
    return true;
}

// --- Tunnel Management ---
let isManuallyClosing = false;

const getDynamicSubdomain = () => {
    const prefix = 'icevision-fs';
    const randomNumber = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}-${randomNumber}`;
};

export async function connectTunnel(port: number): Promise<Partial<TunnelState>> {
    const subdomain = getDynamicSubdomain();
    isManuallyClosing = false;
    console.log(`[Tunnel] Attempting to connect on port ${port} with subdomain ${subdomain}...`);
    
    return new Promise(async (resolve) => {
        const createAndHandleTunnel = async () => {
            try {
                const tunnel = await localtunnel({ port, subdomain });
                appGlobal.tunnelInstance = tunnel;

                tunnel.on('url', (url: string) => {
                    console.log(`[Tunnel] Connected successfully at: ${url}`);
                    const successState: Partial<TunnelState> = { status: 'connected', url, subdomain };
                    updateTunnelState(successState);
                    resolve(successState);
                });

                tunnel.on('error', (err: any) => {
                    console.warn('[Tunnel] Error:', err?.message || err);
                    updateTunnelState({ status: 'error', lastMessage: err.message || 'Unknown tunnel error' });
                });

                tunnel.on('close', () => {
                    console.log('[Tunnel] Connection closed.');
                    appGlobal.tunnelInstance = undefined;
                    updateTunnelState({ status: 'disconnected', url: null, subdomain: null });
                    if (!isManuallyClosing) {
                        console.log('[Tunnel] Unexpected close. Reconnecting in 3 seconds...');
                        setTimeout(createAndHandleTunnel, 3000);
                    }
                });
            } catch (error: any) {
                console.error('[Tunnel] Failed to create tunnel:', error);
                const errorState: Partial<TunnelState> = { status: 'error', lastMessage: error.message || 'Failed to start tunnel' };
                updateTunnelState(errorState);
                resolve(errorState);
            }
        };
        await createAndHandleTunnel();
    });
}

export function disconnectTunnel(): void {
    isManuallyClosing = true;
    if (appGlobal.tunnelInstance) {
        appGlobal.tunnelInstance.close();
        appGlobal.tunnelInstance = undefined;
        console.log('[Tunnel] Disconnected manually.');
    }
    updateTunnelState({ status: 'disconnected', url: null, subdomain: null });
}

// Ensure password file is checked/created on startup
getRemoteAccessPassword();
