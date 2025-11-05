
// Este archivo actúa como un punto de entrada para el sistema de almacenamiento.
// Lee la variable de entorno para decidir qué proveedor de almacenamiento usar.

import * as localProvider from './local-provider';
import * as gdriveProvider from './gdrive-provider';
import type { ConfigState, LiveState, Tournament } from '@/types';

interface StorageProvider {
    readConfig: () => Promise<Partial<ConfigState> | null>;
    writeConfig: (config: ConfigState) => Promise<void>;
    readLiveState: () => Promise<Partial<LiveState> | null>;
    writeLiveState: (liveState: LiveState) => Promise<void>;
    readTournament: (tournamentId: string) => Promise<Partial<Tournament> | null>;
    writeTournament: (tournament: Tournament) => Promise<void>;
}

let provider: StorageProvider;

if (process.env.STORAGE_PROVIDER === 'googledrive') {
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
