// Este archivo actúa como un punto de entrada para el sistema de almacenamiento.
// Lee la variable de entorno para decidir qué proveedor de almacenamiento usar.

import { StorageProvider, LocalFileStorageProvider, SupabaseStorageProvider } from './providers';

const createStorageProvider = (): StorageProvider => {
    const providerType = process.env.STORAGE_PROVIDER || 'local';

    switch (providerType) {
        case 'supabase_rw':
            return new SupabaseStorageProvider('rw');
        case 'supabase_ro':
            return new SupabaseStorageProvider('ro');
        case 'local':
        default:
            return new LocalFileStorageProvider();
    }
};

export const storageProvider = createStorageProvider();

// Helper to check if we're in read-only mode (supabase_ro)
export function isReadOnlyMode(): boolean {
    const providerType = process.env.STORAGE_PROVIDER || 'local';
    return providerType === 'supabase_ro';
}

export function isSupabaseMode(): boolean {
    const providerType = process.env.STORAGE_PROVIDER || 'local';
    return providerType === 'supabase_ro' || providerType === 'supabase_rw';
}

// Creates a one-off RW provider for admin requests, independently of STORAGE_PROVIDER.
// This way STORAGE_PROVIDER can stay as supabase_ro and the service key is only
// used when an explicit admin request is made.
export function createAdminStorageProvider(): StorageProvider {
    return new SupabaseStorageProvider('rw');
}
