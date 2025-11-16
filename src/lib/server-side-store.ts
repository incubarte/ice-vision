
import type { LiveGameState, ConfigState, RemoteCommand, AccessRequest, TunnelState, TournamentsData } from '@/types';
import { EventEmitter } from 'events';
import { headers } from 'next/headers';
import fs from 'fs';
import path from 'path';
import os from 'os';
import localtunnel, { type Tunnel } from 'localtunnel';
import { readConfig, readLiveState, readTournaments } from './data-access';

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
  systemEmitter: EventEmitter | undefined; // Emitter for system-level events
  tunnelInstance: Tunnel | undefined;
};

export const gameStateEmitter =
  globalForEmitters.gameStateEmitter ?? new EventEmitter();
  
export const commandEmitter =
  globalForEmitters.commandEmitter ?? new EventEmitter();

export const systemEmitter = 
  globalForEmitters.systemEmitter ?? new EventEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalForEmitters.gameStateEmitter = gameStateEmitter;
  globalForEmitters.commandEmitter = commandEmitter;
  globalForEmitters.systemEmitter = systemEmitter;
}

// --- In-memory Caching ---
let storedConfig: ConfigState | null = null;
let storedGameState: LiveGameState | null = null;
let storedTournaments: TournamentsData | null = null;

// Function to load/reload all data from disk into the cache
export async function reloadCacheFromDisk() {
    console.log('[Cache] Reloading data from disk...');
    try {
        const [config, liveState, tournaments] = await Promise.all([
            readConfig(),
            readLiveState(),
            readTournaments()
        ]);
        storedConfig = config as ConfigState;
        storedGameState = liveState as LiveGameState;
        storedTournaments = tournaments as TournamentsData;
        console.log('[Cache] Reload complete. Tournaments count:', storedTournaments?.tournaments?.length || 0);
    } catch (error) {
        console.error('[Cache] Failed to reload cache from disk:', error);
    }
}

// Listen for sync completion to reload the cache
systemEmitter.on('sync-complete', reloadCacheFromDisk);


export async function getConfig(): Promise<ConfigState | null> {
  if (!storedConfig) {
    await reloadCacheFromDisk();
  }
  // Merge config with tournaments from separate cache
  if (storedConfig && storedTournaments) {
    return {
      ...storedConfig,
      tournaments: storedTournaments.tournaments
    };
  }
  return storedConfig;
}

export function setConfig(newConfig: ConfigState): void {
  storedConfig = newConfig;
}

export async function getTournaments(): Promise<TournamentsData | null> {
  if (!storedTournaments) {
    await reloadCacheFromDisk();
  }
  return storedTournaments;
}

export function setTournaments(newTournaments: TournamentsData): void {
  storedTournaments = newTournaments;
}

export async function updateTunnelState(updates: Partial<TunnelState>) {
  const currentConfig = await getConfig();
  if (currentConfig) {
    storedConfig = {
      ...currentConfig,
      tunnel: {
        ...currentConfig.tunnel,
        ...updates
      }
    };
  }
}

export async function getGameState(): Promise<LiveGameState | null> {
  if (!storedGameState) {
    await reloadCacheFromDisk();
  }
  return storedGameState;
}

export function setGameState(newGameState: LiveGameState): void {
  storedGameState = newGameState;
  gameStateEmitter.emit('update', newGameState);
}

export function sendCommand(command: RemoteCommand): void {
  commandEmitter.emit('command', command);
}

export function isClientLocal(request: Request): boolean {
    const clientIp = (request.headers.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();
    
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


// Ensure password file is checked/created on startup
getRemoteAccessPassword();
