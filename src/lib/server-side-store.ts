
'use server';
import 'server-only';
import type { LiveGameState, ConfigState, RemoteCommand, AccessRequest, TunnelState, Tournament, GameState, FormatAndTimingsProfile, ScoreboardLayoutSettings, ScoreboardLayoutProfile, ReplaySettings, PenaltyTypeDefinition } from '@/types';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import os from 'os';
import localtunnel, { type Tunnel } from 'localtunnel';
import { readConfig as readConfigFromProvider, readLiveState as readLiveStateFromProvider, writeConfig as writeConfigToProvider, writeLiveState as writeLiveStateToProvider } from './storage';
import { getInitialState } from '@/contexts/game-state-context';

// --- Estado Global del Servidor y Emisores de Eventos ---

// Definir una interfaz para nuestro objeto global personalizado
interface AppGlobal {
  gameStateEmitter: EventEmitter;
  commandEmitter: EventEmitter;
  tunnelInstance: Tunnel | undefined;
  initializationPromise: Promise<void> | null;
  storedConfig: ConfigState | null;
  storedGameState: LiveState | null;
}

// Usar un símbolo único para evitar colisiones de nombres
const APP_GLOBAL_KEY = Symbol.for('icevision.app.global');

// Función para obtener nuestro espacio de nombres global, creándolo si no existe
const getAppGlobal = (): AppGlobal => {
  const globalNamespace = globalThis as any;
  if (!globalNamespace[APP_GLOBAL_KEY]) {
    globalNamespace[APP_GLOBAL_KEY] = {
      gameStateEmitter: new EventEmitter(),
      commandEmitter: new EventEmitter(),
      tunnelInstance: undefined,
      initializationPromise: null,
      storedConfig: null,
      storedGameState: null,
    };
  }
  return globalNamespace[APP_GLOBAL_KEY];
};

const appGlobal = getAppGlobal();

const gameStateEmitter = appGlobal.gameStateEmitter;
const commandEmitter = appGlobal.commandEmitter;


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

export async function getRemoteAccessPassword(): Promise<string> {
    let password = readPassword();
    if (!password) {
        password = generatePassword();
    }
    return password;
}

const performInitialization = async () => {
    console.log("[Store] Initializing store... fetching data from provider.");
    try {
        const [configResult, liveStateResult] = await Promise.all([
            readConfigFromProvider(),
            readLiveStateFromProvider()
        ]);
        
        const defaultState = getInitialState();

        appGlobal.storedConfig = { ...defaultState.config, ...(configResult || {}) };
        appGlobal.storedGameState = { ...defaultState.live, ...(liveStateResult || {}) };

        console.log("[Store] Initialization complete. Config and Live State are loaded.");

    } catch (error) {
        console.error("[Store] CRITICAL: Unhandled error during storage initialization.", error);
        appGlobal.storedConfig = getInitialState().config;
        appGlobal.storedGameState = getInitialState().live;
        throw new Error(`Server data store failed to initialize. Check server logs. Original error: ${error instanceof Error ? error.message : String(error)}`);
    }
};

if (!appGlobal.initializationPromise) {
    appGlobal.initializationPromise = performInitialization();
}

export async function getConfig(): Promise<ConfigState> {
  await appGlobal.initializationPromise;
  return appGlobal.storedConfig!;
}

export async function setConfig(newConfig: ConfigState): Promise<void> {
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
  appGlobal.storedGameState = newGameState;
  gameStateEmitter.emit('update', newGameState);
  writeLiveStateToProvider(newGameState).catch(err => {
      console.error("[Store] Failed to write live state to provider:", err);
  });
}

export async function getGameStateEmitter() {
  await appGlobal.initializationPromise;
  return gameStateEmitter;
}

export async function getCommandEmitter() {
    await appGlobal.initializationPromise;
    return commandEmitter;
}


export async function updateTunnelState(updates: Partial<TunnelState>): Promise<void> {
  if (appGlobal.storedConfig) {
    const newTunnelState = { ...appGlobal.storedConfig.tunnel, ...updates };
    await setConfig({ ...appGlobal.storedConfig, tunnel: newTunnelState });
  }
}

export async function sendCommand(command: RemoteCommand): Promise<void> {
  commandEmitter.emit('command', command);
}

export async function isClientLocal(request: Request): Promise<boolean> {
    const clientIp = (request.headers.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();
    if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
        return true;
    }
    return false;
}

// --- Auth Challenge Management ---
let accessRequests: Map<string, AccessRequest> = new Map();

export async function createAccessRequest(ip: string, userAgent: string | undefined, verificationNumber: number): Promise<AccessRequest> {
    const id = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const request: AccessRequest = { id, ip, timestamp: Date.now(), userAgent, verificationNumber, approved: false };
    accessRequests.set(id, request);
    setTimeout(async () => {
        const req = await getAccessRequest(id);
        if (req && !req.approved) {
             await removeAccessRequest(id);
        }
    }, 2 * 60 * 1000);
    return request;
}

export async function getAccessRequest(id: string): Promise<AccessRequest | undefined> {
    return accessRequests.get(id);
}

export async function getAllAccessRequests(): Promise<AccessRequest[]> {
    return Array.from(accessRequests.values()).filter(req => !req.approved);
}

export async function removeAccessRequest(id: string): Promise<void> {
    accessRequests.delete(id);
}

export async function approveAccessRequest(id: string): Promise<boolean> {
    const request = await getAccessRequest(id);
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
                const errorState: Partial<TunnelState> = { status: 'error', lastMessage: err.message || 'Unknown tunnel error' };
                updateTunnelState(errorState);
                resolve(errorState); // Resolve with error state
            });

            tunnel.on('close', () => {
                console.log('[Tunnel] Connection closed.');
                appGlobal.tunnelInstance = undefined;
                if (!isManuallyClosing) {
                    updateTunnelState({ status: 'disconnected', url: null, subdomain: null, lastMessage: 'Tunnel closed unexpectedly.' });
                } else {
                    updateTunnelState({ status: 'disconnected', url: null, subdomain: null, lastMessage: 'Disconnected manually.' });
                }
            });

        } catch (error: any) {
            console.error('[Tunnel] Failed to create tunnel:', error);
            const errorState: Partial<TunnelState> = { status: 'error', lastMessage: error.message || 'Failed to start tunnel' };
            await updateTunnelState(errorState);
            resolve(errorState);
        }
    });
}

export async function disconnectTunnel(): Promise<void> {
    isManuallyClosing = true;
    if (appGlobal.tunnelInstance) {
        appGlobal.tunnelInstance.close();
        appGlobal.tunnelInstance = undefined;
        console.log('[Tunnel] Disconnected manually.');
    }
    await updateTunnelState({ status: 'disconnected', url: null, subdomain: null });
}
