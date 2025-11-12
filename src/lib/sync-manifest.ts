import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { SyncManifest, FileMetadata, FileVersion } from '@/types';

const MANIFEST_FILE = 'sync-manifest.json';

// Simple in-memory lock to prevent concurrent manifest updates
let manifestLock: Promise<void> = Promise.resolve();

/**
 * Acquire a lock for manifest operations
 * This prevents race conditions when multiple files are written simultaneously
 */
async function withManifestLock<T>(operation: () => Promise<T>): Promise<T> {
    const previousLock = manifestLock;
    let releaseLock: () => void;

    manifestLock = new Promise<void>(resolve => {
        releaseLock = resolve;
    });

    try {
        await previousLock;
        return await operation();
    } finally {
        releaseLock!();
    }
}

// Get the data directory path (same logic as LocalFileStorageProvider)
function getDataDir(): string {
    const storagePath = process.env.STORAGE_PATH;
    if (storagePath) {
        if (path.isAbsolute(storagePath)) {
            return path.join(storagePath, 'data');
        }
        return path.join(process.cwd(), storagePath, 'data');
    }
    return path.join(process.cwd(), 'storage', 'data');
}

function getManifestPath(): string {
    return path.join(getDataDir(), MANIFEST_FILE);
}

/**
 * Calculate MD5 hash of content
 */
export function hashContent(content: string): string {
    return createHash('md5').update(content).digest('hex');
}

/**
 * Get current timestamp in ISO 8601 GMT+0
 */
export function getGMTTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Read sync manifest from storage
 */
export async function readManifest(): Promise<SyncManifest> {
    try {
        const manifestPath = getManifestPath();
        const content = await fs.readFile(manifestPath, 'utf-8');
        return JSON.parse(content) as SyncManifest;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            // Return empty manifest if file doesn't exist
            return {
                lastSync: getGMTTimestamp(),
                files: {}
            };
        }

        // If JSON is corrupted, log error and return empty manifest
        if (error instanceof SyntaxError) {
            console.error('[Manifest] Corrupted manifest detected, returning empty manifest. Error:', error.message);
            // Backup corrupted file
            try {
                const manifestPath = getManifestPath();
                const backupPath = manifestPath.replace('.json', `.corrupted.${Date.now()}.json`);
                await fs.copyFile(manifestPath, backupPath);
                console.error(`[Manifest] Backed up corrupted manifest to: ${backupPath}`);
            } catch (backupError) {
                console.error('[Manifest] Failed to backup corrupted manifest:', backupError);
            }

            return {
                lastSync: getGMTTimestamp(),
                files: {}
            };
        }

        throw error;
    }
}

/**
 * Write sync manifest to storage
 */
export async function writeManifest(manifest: SyncManifest): Promise<void> {
    return withManifestLock(async () => {
        const manifestPath = getManifestPath();
        await fs.mkdir(path.dirname(manifestPath), { recursive: true });
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    });
}

/**
 * Update manifest entry for a file that was just written locally
 * IMPORTANT: Does NOT update previousVersion - that only happens after sync
 */
export async function updateManifestEntry(
    filePath: string,
    content: string
): Promise<void> {
    return withManifestLock(async () => {
        const manifest = await readManifest();

        const currentMetadata = manifest.files[filePath];

        const newMetadata: FileMetadata = {
            lastModified: getGMTTimestamp(),
            hash: hashContent(content),
            size: Buffer.byteLength(content, 'utf8')
        };

        // PRESERVE previousVersion from current metadata
        // previousVersion only gets updated after successful sync
        if (currentMetadata?.previousVersion) {
            newMetadata.previousVersion = currentMetadata.previousVersion;
        }

        manifest.files[filePath] = newMetadata;

        // Write directly without calling writeManifest to avoid double-locking
        const manifestPath = getManifestPath();
        await fs.mkdir(path.dirname(manifestPath), { recursive: true });
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    });
}

/**
 * Update previousVersion for a file after successful sync
 * This marks the current version as the "synced baseline" for future conflict detection
 */
export async function updatePreviousVersionAfterSync(
    filePath: string,
    syncedVersion: FileVersion
): Promise<void> {
    return withManifestLock(async () => {
        const manifest = await readManifest();
        const currentMetadata = manifest.files[filePath];

        if (currentMetadata) {
            currentMetadata.previousVersion = syncedVersion;
            manifest.files[filePath] = currentMetadata;

            // Write directly without calling writeManifest to avoid double-locking
            const manifestPath = getManifestPath();
            await fs.mkdir(path.dirname(manifestPath), { recursive: true });
            await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
        }
    });
}

/**
 * Remove file from manifest (when deleted)
 */
export async function removeManifestEntry(filePath: string): Promise<void> {
    return withManifestLock(async () => {
        const manifest = await readManifest();
        delete manifest.files[filePath];

        // Write directly without calling writeManifest to avoid double-locking
        const manifestPath = getManifestPath();
        await fs.mkdir(path.dirname(manifestPath), { recursive: true });
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    });
}

/**
 * Get list of all files tracked in manifest
 */
export async function getTrackedFiles(): Promise<string[]> {
    const manifest = await readManifest();
    return Object.keys(manifest.files);
}

/**
 * Update lastSync timestamp after successful sync
 */
export async function updateLastSyncTime(): Promise<void> {
    const manifest = await readManifest();
    manifest.lastSync = getGMTTimestamp();
    await writeManifest(manifest);
}
