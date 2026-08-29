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

// Pre-match path whitelist: tournaments/{id}/pre-match/{filename}.json
// This is the ONLY path pattern that pre-match writes are allowed to touch.
const PRE_MATCH_PATH_REGEX = /^tournaments\/[^/]+\/pre-match\/[^/]+\.json$/;

function isPreMatchPath(filePath: string): boolean {
    return PRE_MATCH_PATH_REGEX.test(filePath);
}

/**
 * Creates a storage provider for pre-match writes.
 * Wraps a full RW Supabase provider but ONLY allows writes/deletes to
 * tournaments/{id}/pre-match/{filename}.json paths.
 * Reads are unrestricted (needed to look up tournament data).
 * Use this instead of createAdminStorageProvider() for pre-match routes
 * so that a compromised pre-match password cannot touch any other data.
 */
export function createPreMatchStorageProvider(): StorageProvider {
    const inner = new SupabaseStorageProvider('rw');

    return {
        readFile: (p) => inner.readFile(p),
        readBinaryFile: (p) => inner.readBinaryFile(p),
        listFiles: (p) => inner.listFiles(p),
        writeFile: (filePath, content) => {
            if (!isPreMatchPath(filePath)) {
                return Promise.reject(new Error(`Pre-match write denied: '${filePath}' is not a pre-match path`));
            }
            return inner.writeFile(filePath, content);
        },
        writeBinaryFile: (_filePath, _content, _contentType) => {
            return Promise.reject(new Error('Pre-match provider does not allow binary writes'));
        },
        deleteFile: (filePath) => {
            if (!isPreMatchPath(filePath)) {
                return Promise.reject(new Error(`Pre-match delete denied: '${filePath}' is not a pre-match path`));
            }
            return inner.deleteFile(filePath);
        },
        deleteFolder: (_directoryPath) => {
            return Promise.reject(new Error('Pre-match provider does not allow folder deletion'));
        },
    };
}
