import { promises as fs } from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Helper function to get the storage directory from environment or default
function getStorageDir(): string {
    const storagePath = process.env.STORAGE_PATH;
    if (storagePath) {
        // Check if the path is absolute. If so, use it directly. Otherwise, join it with the current working directory.
        if (path.isAbsolute(storagePath)) {
            return storagePath;
        }
        return path.join(process.cwd(), storagePath);
    }
    // Default to './storage' in the project root if the environment variable is not set.
    return path.join(process.cwd(), 'storage');
}

// --- Custom Error for Abstraction ---

export class FileNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FileNotFoundError';
    }
}

// --- 1. The Storage Provider Interface ---

export interface StorageProvider {
    /**
     * Reads a file from the storage provider.
     * @param filePath The path to the file.
     * @returns A promise that resolves with the file content as a string.
     * @throws {FileNotFoundError} If the file does not exist.
     */
    readFile(filePath: string): Promise<string>;
    writeFile(filePath: string, content: string): Promise<void>;
    deleteFile(filePath: string): Promise<void>;
    listFiles(directoryPath: string): Promise<string[]>;
    deleteFolder(directoryPath: string): Promise<void>;
}

// --- 2. Local Filesystem Implementation ---

export class LocalFileStorageProvider implements StorageProvider {
    private dataDir: string;

    constructor() {
        // All files are stored in the 'data' subdirectory of the storage directory
        this.dataDir = path.join(getStorageDir(), 'data');
    }

    private resolvePath(filePath: string): string {
        const resolved = path.join(this.dataDir, filePath);
        if (!resolved.startsWith(this.dataDir)) {
            throw new Error(`File path is outside the allowed directory: ${filePath}`);
        }
        return resolved;
    }

    async readFile(filePath: string): Promise<string> {
        try {
            return await fs.readFile(this.resolvePath(filePath), 'utf-8');
        } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                throw new FileNotFoundError(`File not found on local disk: ${filePath}`);
            }
            throw error;
        }
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        const resolvedPath = this.resolvePath(filePath);
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, content, 'utf-8');

        // Update manifest for tournament files only (not config/live/sync files)
        if (filePath === 'tournaments.json' || filePath.startsWith('tournaments/')) {
            const { updateManifestEntry } = await import('../sync-manifest');
            await updateManifestEntry(filePath, content);
        }
    }

    async deleteFile(filePath: string): Promise<void> {
        await fs.unlink(this.resolvePath(filePath));
    }

    async listFiles(directoryPath: string): Promise<string[]> {
        try {
            return await fs.readdir(this.resolvePath(directoryPath));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return []; // Return empty array if directory doesn't exist
            }
            throw error;
        }
    }

    async deleteFolder(directoryPath: string): Promise<void> {
        await fs.rm(this.resolvePath(directoryPath), { recursive: true, force: true });
    }
}

// --- 3. Supabase Implementation ---

export class SupabaseStorageProvider implements StorageProvider {
    private supabase: SupabaseClient;
    private bucket: string;
    private mode: 'rw' | 'ro';

    constructor(mode: 'rw' | 'ro') {
        this.mode = mode;
        const supabaseUrl = process.env.SUPABASE_URL!;
        this.bucket = process.env.SUPABASE_BUCKET!;

        if (!this.bucket) {
            throw new Error('SUPABASE_BUCKET environment variable is not set.');
        }

        if (mode === 'rw') {
            const serviceKey = process.env.SUPABASE_SERVICE_KEY!;
            if (!serviceKey) {
                throw new Error('Supabase service key is not set for RW mode.');
            }
            this.supabase = createClient(supabaseUrl, serviceKey);
        } else { // ro mode
            const anonKey = process.env.SUPABASE_ANON_KEY!;
            if (!anonKey) {
                throw new Error('Supabase anon key is not set for RO mode.');
            }
            this.supabase = createClient(supabaseUrl, anonKey);
        }
    }

    async readFile(filePath: string): Promise<string> {
        const { data, error } = await this.supabase.storage.from(this.bucket).download(filePath);
        if (error) {
            if ('status' in error && error.status === 404) {
                throw new FileNotFoundError(`File not found in Supabase: ${filePath}`);
            }
            // Check for the existence of originalError for more detailed logging
            else if ('originalError' in error && typeof error.originalError === 'object' && error.originalError !== null && 'json' in error.originalError && typeof (error.originalError as any).json === 'function') {
                const errorBody = await (async () => {
                    try {
                        return await (error.originalError as Response).json();
                    } catch (e) {
                        console.error('Failed to parse Supabase error body.');
                        return null;
                    }
                })();

                if (errorBody && errorBody.statusCode === '404') {
                    throw new FileNotFoundError(`File not found in Supabase: ${filePath}`);
                }
                // If it's not a 404, log the detailed error for debugging
                if (errorBody) {
                    console.error('Detailed Supabase error:', JSON.stringify(errorBody, null, 2));
                }
            }
            throw error;
        }
        return data.text();
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        if (this.mode === 'ro') throw new Error('Cannot write in read-only mode.');
        const { error } = await this.supabase.storage.from(this.bucket).upload(filePath, content, { upsert: true, contentType: 'application/json' });
        if (error) throw error;
    }

    async deleteFile(filePath: string): Promise<void> {
        if (this.mode === 'ro') throw new Error('Cannot delete in read-only mode.');
        const { error } = await this.supabase.storage.from(this.bucket).remove([filePath]);
        if (error) throw error;
    }

    async listFiles(directoryPath: string): Promise<string[]> {
        const { data, error } = await this.supabase.storage.from(this.bucket).list(directoryPath, { limit: 1000 });
        if (error) throw error;
        return data?.map(file => file.name) || [];
    }

    async deleteFolder(directoryPath: string): Promise<void> {
        if (this.mode === 'ro') throw new Error('Cannot delete in read-only mode.');
        const { data, error } = await this.supabase.storage.from(this.bucket).list(directoryPath);
        if (error) throw error;
        if (!data || data.length === 0) return;

        const filesToRemove = data.map(file => `${directoryPath}/${file.name}`);
        const { error: removeError } = await this.supabase.storage.from(this.bucket).remove(filesToRemove);
        if (removeError) throw removeError;
    }
}
