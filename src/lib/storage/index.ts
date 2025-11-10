// Este archivo actúa como un punto de entrada para el sistema de almacenamiento.
// Lee la variable de entorno para decidir qué proveedor de almacenamiento usar.

import { StorageProvider, LocalFileStorageProvider, S3StorageProvider, SupabaseStorageProvider } from './providers';

const createStorageProvider = (): StorageProvider => {
    const providerType = process.env.STORAGE_PROVIDER || 'local';
    console.log(`Using '${providerType}' storage provider.`);

    switch (providerType) {
        case 's3':
            return new S3StorageProvider();
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
