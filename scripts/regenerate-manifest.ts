import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { SyncManifest, FileMetadata } from '../src/types';

// Helper to get storage directory
function getStorageDir(): string {
    const storagePath = process.env.STORAGE_PATH;
    if (storagePath) {
        if (path.isAbsolute(storagePath)) {
            return storagePath;
        }
        return path.join(process.cwd(), storagePath);
    }
    return path.join(process.cwd(), 'storage');
}

// Hash content using MD5
function hashContent(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
}

// Get GMT timestamp
function getGMTTimestamp(): string {
    return new Date().toISOString();
}

// List all files recursively
async function listFilesRecursively(dir: string, baseDir: string): Promise<string[]> {
    const files: string[] = [];
    const items = await fs.readdir(dir, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            const subFiles = await listFilesRecursively(fullPath, baseDir);
            files.push(...subFiles);
        } else if (item.isFile() && item.name.endsWith('.json')) {
            // Get relative path from storage/data
            const relativePath = path.relative(baseDir, fullPath);
            files.push(relativePath);
        }
    }

    return files;
}

async function regenerateManifest() {
    try {
        const storageDir = getStorageDir();
        const dataDir = path.join(storageDir, 'data');
        const manifestPath = path.join(dataDir, 'sync-manifest.json');

        console.log('[Regenerate Manifest] Storage dir:', storageDir);
        console.log('[Regenerate Manifest] Data dir:', dataDir);

        // Check if data directory exists
        try {
            await fs.access(dataDir);
        } catch {
            console.error('[Regenerate Manifest] Data directory does not exist:', dataDir);
            process.exit(1);
        }

        // List all JSON files
        console.log('[Regenerate Manifest] Listing files...');
        const allFiles = await listFilesRecursively(dataDir, dataDir);

        // Filter out the manifest itself
        const files = allFiles.filter(f => f !== 'sync-manifest.json');

        console.log('[Regenerate Manifest] Found', files.length, 'files');

        // Create manifest
        const manifest: SyncManifest = {
            lastSync: getGMTTimestamp(),
            files: {}
        };

        // Process each file
        for (const filePath of files) {
            const fullPath = path.join(dataDir, filePath);
            console.log('[Regenerate Manifest] Processing:', filePath);

            try {
                const content = await fs.readFile(fullPath, 'utf-8');
                const stats = await fs.stat(fullPath);
                const hash = hashContent(content);

                const metadata: FileMetadata = {
                    lastModified: stats.mtime.toISOString(),
                    hash: hash,
                    size: Buffer.byteLength(content, 'utf-8'),
                    // Don't set previousVersion - this is a fresh manifest
                };

                manifest.files[filePath] = metadata;
                console.log(`  - Hash: ${hash}, Size: ${metadata.size}, Modified: ${metadata.lastModified}`);
            } catch (err) {
                console.error(`  - ERROR reading file:`, err);
            }
        }

        // Write manifest
        const manifestContent = JSON.stringify(manifest, null, 2);
        await fs.writeFile(manifestPath, manifestContent, 'utf-8');

        console.log('\n[Regenerate Manifest] ✅ Manifest regenerated successfully!');
        console.log('[Regenerate Manifest] Total files:', Object.keys(manifest.files).length);
        console.log('[Regenerate Manifest] Manifest path:', manifestPath);
        console.log('\nManifest summary:');
        console.log('- lastSync:', manifest.lastSync);
        console.log('- files:', Object.keys(manifest.files).length);

        // Show first few files
        const filesList = Object.keys(manifest.files).slice(0, 5);
        console.log('\nFirst 5 files:');
        filesList.forEach(f => console.log('  -', f));
        if (Object.keys(manifest.files).length > 5) {
            console.log('  ... and', Object.keys(manifest.files).length - 5, 'more');
        }

    } catch (error) {
        console.error('[Regenerate Manifest] Error:', error);
        process.exit(1);
    }
}

// Run the script
regenerateManifest();
