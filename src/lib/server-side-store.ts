
import type { LiveGameState, ConfigState, RemoteCommand, AccessRequest, TunnelState } from '@/types';
import { EventEmitter } from 'events';
import { headers } from 'next/headers';
import fs from 'fs';
import path from 'path';
import os from 'os';
import localtunnel, { type Tunnel } from 'localtunnel';
import { readConfig as readConfigFromProvider, readLiveState as readLiveStateFromProvider, writeConfig as writeConfigToProvider, writeLiveState as writeLiveStateToProvider } from './storage';
import { getInitialState } from '@/contexts/game-state-context';


let storedConfig: ConfigState | null = null;
let storedGameState: LiveState | null = null;
let accessRequests: Map<string, AccessRequest> = new Map();

const PASSWORD_FILE_PATH = path.join(os.tmpdir(), '.remote_password');

// --- Centralized Password Management ---
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
        // Fallback to in-memory if file system fails
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
// --- End Password Management ---

const globalForEmitters = globalThis as unknown as {
  gameStateEmitter: EventEmitter | undefined;
  commandEmitter: EventEmitter | undefined;
  tunnelInstance: Tunnel | undefined;
  initializationPromise: Promise<void> | null;
};

export const gameStateEmitter =
  globalForEmitters.gameStateEmitter ?? new EventEmitter();
  
export const commandEmitter =
  globalForEmitters.commandEmitter ?? new EventEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalForEmitters.gameStateEmitter = gameStateEmitter;
  globalForEmitters.commandEmitter = commandEmitter;
}

async function initializeStore() {
    if (globalForEmitters.initializationPromise) {
        return globalForEmitters.initializationPromise;
    }

    const performInitialization = async () => {
        console.log("[Store] Initializing store... fetching data from provider.");
        const defaultState = getInitialState();
        try {
            const [configResult, liveStateResult] = await Promise.all([
                readConfigFromProvider(),
                readLiveStateFromProvider()
            ]);
            
            if (configResult && Object.keys(configResult).length > 0) {
                storedConfig = configResult as ConfigState;
                console.log("[Store] Config loaded successfully from provider.");
            } else {
                 console.warn("[Store] Could not read config from provider or it was empty. Using default config.");
                 storedConfig = defaultState.config;
            }

            if (liveStateResult && Object.keys(liveStateResult).length > 0) {
                 storedGameState = liveStateResult as LiveState;
                 console.log("[Store] Live State loaded successfully from provider.");
            } else {
                 console.warn("[Store] Could not read live state from provider or it was empty. Using default live state.");
                 storedGameState = defaultState.live;
            }

        } catch (error) {
            console.error("[Store] CRITICAL: Unhandled error during storage initialization. Loading default state as a fallback.", error);
            storedConfig = defaultState.config;
            storedGameState = defaultState.live;
        } finally {
             // Final guarantee that state is never null
            if (!storedConfig) storedConfig = defaultState.config;
            if (!storedGameState) storedGameState = defaultState.live;
            console.log("[Store] Initialization complete.");
        }
    };

    globalForEmitters.initializationPromise = performInitialization();
    return globalForEmitters.initializationPromise;
}


export async function getConfig(): Promise<ConfigState> {
  await initializeStore();
  // Guaranteed to be non-null after initialization
  return storedConfig!;
}

export function setConfig(newConfig: ConfigState): void {
  storedConfig = newConfig;
  // Asynchronous write to provider
  writeConfigToProvider(newConfig).catch(err => {
      console.error("[Store] Failed to write config to provider:", err);
  });
}

export function updateTunnelState(updates: Partial<TunnelState>) {
  if (storedConfig) {
    const newTunnelState = { ...storedConfig.tunnel, ...updates };
    setConfig({ ...storedConfig, tunnel: newTunnelState });
  }
}

export async function getGameState(): Promise<LiveState> {
  await initializeStore();
  // Guaranteed to be non-null after initialization
  return storedGameState!;
}

export function setGameState(newGameState: LiveState): void {
  storedGameState = newGameState;
  gameStateEmitter.emit('update', newGameState);
  // Asynchronous write to provider
  writeLiveStateToProvider(newGameState).catch(err => {
      console.error("[Store] Failed to write live state to provider:", err);
  });
}

export function sendCommand(command: RemoteCommand): void {
  commandEmitter.emit('command', command);
}

export function isClientLocal(request: Request): boolean {
    const reqHeaders = headers();
    const clientIp = (reqHeaders.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();
    
    // Check if client is localhost. This is the most reliable check.
    if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
        return true;
    }

    // A more advanced subnet check is prone to errors in different network environments.
    // For simplicity and robustness in this application's context, we'll consider any
    // non-loopback IP as "remote", requiring a password. This is a safer default.
    return false;
}

// --- Auth Challenge Management ---

export function createAccessRequest(ip: string, userAgent: string | undefined, verificationNumber: number): AccessRequest {
    const id = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const request: AccessRequest = { id, ip, timestamp: Date.now(), userAgent, verificationNumber, approved: false };
    accessRequests.set(id, request);
    // Set a timeout to remove the request after 2 minutes if it's not approved.
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
    
    // Remove the request after a short period to allow the client to fetch the password
    setTimeout(() => removeAccessRequest(id), 30 * 1000);
    
    return true;
}


// --- Tunnel Management with Reconnect ---
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
                globalForEmitters.tunnelInstance = tunnel;

                tunnel.on('url', (url: string) => {
                    console.log(`[Tunnel] Connected successfully at: ${url}`);
                    const successState: Partial<TunnelState> = { status: 'connected', url, subdomain };
                    updateTunnelState(successState);
                    resolve(successState);
                });

                tunnel.on('error', (err: any) => {
                    console.warn('[Tunnel] Error:', err?.message || err);
                    updateTunnelState({ status: 'error', lastMessage: err.message || 'Unknown tunnel error' });
                    // No need to resolve here, the 'close' event will handle it.
                });

                tunnel.on('close', () => {
                    console.log('[Tunnel] Connection closed.');
                    globalForEmitters.tunnelInstance = undefined;
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
    if (globalForEmitters.tunnelInstance) {
        globalForEmitters.tunnelInstance.close();
        globalForEmitters.tunnelInstance = undefined;
        console.log('[Tunnel] Disconnected manually.');
    }
    updateTunnelState({ status: 'disconnected', url: null, subdomain: null });
}


// Ensure password file is checked/created on startup and data is loaded
getRemoteAccessPassword();
initializeStore();

    