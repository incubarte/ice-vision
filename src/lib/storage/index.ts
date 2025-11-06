
// Este archivo actúa como un punto de entrada para el sistema de almacenamiento.
// Lee la variable de entorno para decidir qué proveedor de almacenamiento usar.

import * as localProvider from './local-provider';
import * as gdriveProvider from './gdrive-provider';
import type { ConfigState, LiveState, Tournament } from '@/types';
import { startBackgroundSync } from '@/lib/sync-process';

interface StorageProvider {
    readConfig: () => Promise<Partial<ConfigState> | null>;
    writeConfig: (config: ConfigState) => Promise<void>;
    readLiveState: () => Promise<Partial<LiveState> | null>;
    writeLiveState: (liveState: LiveState) => Promise<void>;
    readTournament: (tournamentId: string) => Promise<Partial<Tournament> | null>;
    writeTournament: (tournament: Tournament) => Promise<void>;
}

let provider: StorageProvider;

const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY === 'true';
const storageProvider = process.env.STORAGE_PROVIDER;

if (isReadOnly && storageProvider === 'googledrive') {
    console.log("Using 'local' provider for reads (read-only mode with Google Drive backend). Background sync will be active.");
    provider = {
        ...localProvider, // Use local provider for all read operations
        // Disable write operations in read-only mode
        writeConfig: async () => Promise.resolve(),
        writeLiveState: async () => Promise.resolve(),
        writeTournament: async () => Promise.resolve(),
    };
    // Iniciar el proceso de sincronización en segundo plano
    startBackgroundSync();
} else if (storageProvider === 'googledrive') {
    console.log("Using 'googledrive' storage provider.");
    provider = gdriveProvider;
} else {
    console.log("Using 'local' storage provider.");
    provider = localProvider;
}

export const {
    readConfig,
    writeConfig,
    readLiveState,
    writeLiveState,
    readTournament,
    writeTournament,
} = provider;
