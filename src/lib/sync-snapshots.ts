import { promises as fs } from 'fs';
import path from 'path';
import type { SyncSnapshotMetadata } from '@/types';

// Get the data directory path
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

function getSnapshotsDir(): string {
    return path.join(getDataDir(), 'sync-snapshots');
}

function getSnapshotDir(snapshotId: string): string {
    return path.join(getSnapshotsDir(), snapshotId);
}

/**
 * Save snapshot of a conflict (both local and remote versions)
 */
export async function saveConflictSnapshot(
    snapshotId: string,
    filePath: string,
    localContent: string,
    remoteContent: string,
    winner: 'local' | 'remote',
    localHash: string,
    remoteHash: string
): Promise<void> {
    try {
        const snapshotDir = getSnapshotDir(snapshotId);

        // Create snapshot directory if it doesn't exist
        await fs.mkdir(snapshotDir, { recursive: true });

        // Save local version
        const localFilePath = path.join(snapshotDir, `${filePath}.local`);
        await fs.mkdir(path.dirname(localFilePath), { recursive: true });
        await fs.writeFile(localFilePath, localContent, 'utf-8');

        // Save remote version
        const remoteFilePath = path.join(snapshotDir, `${filePath}.remote`);
        await fs.mkdir(path.dirname(remoteFilePath), { recursive: true });
        await fs.writeFile(remoteFilePath, remoteContent, 'utf-8');

        // Save metadata
        const metadata: SyncSnapshotMetadata = {
            timestamp: snapshotId,
            filePath,
            winner,
            localHash,
            remoteHash
        };

        const metadataPath = path.join(snapshotDir, `${filePath}.metadata.json`);
        await fs.mkdir(path.dirname(metadataPath), { recursive: true });
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

        console.log(`[Snapshots] Saved conflict snapshot for ${filePath} (winner: ${winner})`);
    } catch (error) {
        console.error(`[Snapshots] Error saving snapshot for ${filePath}:`, error);
        throw error;
    }
}

/**
 * Read snapshot metadata
 */
export async function readSnapshotMetadata(snapshotId: string, filePath: string): Promise<SyncSnapshotMetadata | null> {
    try {
        const metadataPath = path.join(getSnapshotDir(snapshotId), `${filePath}.metadata.json`);
        const content = await fs.readFile(metadataPath, 'utf-8');
        return JSON.parse(content) as SyncSnapshotMetadata;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }
        console.error(`[Snapshots] Error reading metadata for ${filePath}:`, error);
        throw error;
    }
}

/**
 * Read local version from snapshot
 */
export async function readSnapshotLocal(snapshotId: string, filePath: string): Promise<string | null> {
    try {
        const localFilePath = path.join(getSnapshotDir(snapshotId), `${filePath}.local`);
        return await fs.readFile(localFilePath, 'utf-8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }
        console.error(`[Snapshots] Error reading local snapshot for ${filePath}:`, error);
        throw error;
    }
}

/**
 * Read remote version from snapshot
 */
export async function readSnapshotRemote(snapshotId: string, filePath: string): Promise<string | null> {
    try {
        const remoteFilePath = path.join(getSnapshotDir(snapshotId), `${filePath}.remote`);
        return await fs.readFile(remoteFilePath, 'utf-8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }
        console.error(`[Snapshots] Error reading remote snapshot for ${filePath}:`, error);
        throw error;
    }
}

/**
 * List all snapshots for a specific snapshot ID
 */
export async function listSnapshotFiles(snapshotId: string): Promise<string[]> {
    try {
        const snapshotDir = getSnapshotDir(snapshotId);
        const files = await fs.readdir(snapshotDir, { recursive: true, withFileTypes: true });

        // Get only metadata files to avoid duplicates
        return files
            .filter(file => file.isFile() && file.name.endsWith('.metadata.json'))
            .map(file => {
                const fullPath = path.join(file.path || snapshotDir, file.name);
                const relativePath = path.relative(snapshotDir, fullPath);
                // Remove .metadata.json suffix
                return relativePath.replace('.metadata.json', '');
            });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [];
        }
        console.error(`[Snapshots] Error listing snapshots:`, error);
        throw error;
    }
}

/**
 * List all snapshot IDs (timestamps)
 */
export async function listAllSnapshots(): Promise<string[]> {
    try {
        const snapshotsDir = getSnapshotsDir();
        const dirs = await fs.readdir(snapshotsDir, { withFileTypes: true });

        return dirs
            .filter(dir => dir.isDirectory())
            .map(dir => dir.name)
            .sort()
            .reverse(); // Most recent first
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [];
        }
        console.error(`[Snapshots] Error listing all snapshots:`, error);
        throw error;
    }
}

/**
 * Delete old snapshots (keep only last N)
 */
export async function cleanupOldSnapshots(keepCount: number = 10): Promise<number> {
    try {
        const allSnapshots = await listAllSnapshots();

        if (allSnapshots.length <= keepCount) {
            return 0;
        }

        const toDelete = allSnapshots.slice(keepCount);
        let deletedCount = 0;

        for (const snapshotId of toDelete) {
            const snapshotDir = getSnapshotDir(snapshotId);
            await fs.rm(snapshotDir, { recursive: true, force: true });
            deletedCount++;
            console.log(`[Snapshots] Deleted old snapshot: ${snapshotId}`);
        }

        return deletedCount;
    } catch (error) {
        console.error(`[Snapshots] Error cleaning up old snapshots:`, error);
        throw error;
    }
}
