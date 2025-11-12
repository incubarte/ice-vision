import { NextResponse } from 'next/server';
import { storageProvider } from '@/lib/storage';
import { readManifest, writeManifest, hashContent, getGMTTimestamp } from '@/lib/sync-manifest';
import type { FileMetadata, SyncManifest } from '@/types';
import path from 'path';
import fs from 'fs/promises';

export const dynamic = 'force-dynamic';

// List all files recursively in a directory
async function listFilesRecursively(dirPath: string, baseDir: string): Promise<string[]> {
    const files: string[] = [];

    try {
        const items = await fs.readdir(dirPath, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(dirPath, item.name);

            if (item.isDirectory()) {
                // Recurse into subdirectories
                const subFiles = await listFilesRecursively(fullPath, baseDir);
                files.push(...subFiles);
            } else if (item.isFile() && item.name.endsWith('.json')) {
                // Get relative path from base directory
                const relativePath = path.relative(baseDir, fullPath);
                files.push(relativePath);
            }
        }
    } catch (error) {
        console.error('[Regenerate Manifest] Error reading directory:', dirPath, error);
    }

    return files;
}

/**
 * Regenerate the sync manifest based on current files in storage
 */
export async function POST() {
    try {
        console.log('[Regenerate Manifest] Starting...');

        // Get storage provider info
        const storagePath = process.env.STORAGE_PATH;
        const baseDir = storagePath
            ? (path.isAbsolute(storagePath) ? storagePath : path.join(process.cwd(), storagePath))
            : path.join(process.cwd(), 'storage');

        const dataDir = path.join(baseDir, 'data');
        console.log('[Regenerate Manifest] Data directory:', dataDir);

        // Check if data directory exists
        try {
            await fs.access(dataDir);
        } catch {
            return NextResponse.json(
                { error: 'Data directory does not exist', path: dataDir },
                { status: 404 }
            );
        }

        // List all JSON files
        const allFiles = await listFilesRecursively(dataDir, dataDir);

        // Filter: Include tournaments.json and files inside tournaments/ directory
        // Exclude: sync-manifest.json, sync-plan.json, sync-logs.json, sync-errors.json,
        //          sync-snapshots/, merge-conflict-backups/, config.json, live.json, etc.
        const files = allFiles.filter(f => f === 'tournaments.json' || f.startsWith('tournaments/'));

        console.log('[Regenerate Manifest] Found', files.length, 'files (tournaments.json + tournaments/)');

        // Create new manifest
        const manifest: SyncManifest = {
            lastSync: getGMTTimestamp(),
            files: {}
        };

        // Process each file
        let processedCount = 0;
        const errors: Array<{ file: string; error: string }> = [];

        for (const filePath of files) {
            try {
                // Read file content using storage provider
                const content = await storageProvider.readFile(filePath);

                // Get file stats
                const fullPath = path.join(dataDir, filePath);
                const stats = await fs.stat(fullPath);

                // Calculate hash
                const hash = hashContent(content);

                // Create metadata
                const metadata: FileMetadata = {
                    lastModified: stats.mtime.toISOString(),
                    hash: hash,
                    size: Buffer.byteLength(content, 'utf-8')
                    // Don't set previousVersion - this is a fresh manifest
                };

                manifest.files[filePath] = metadata;
                processedCount++;

                console.log(`[Regenerate Manifest] Processed: ${filePath}`);
            } catch (error) {
                console.error(`[Regenerate Manifest] Error processing ${filePath}:`, error);
                errors.push({
                    file: filePath,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        // Write manifest
        await writeManifest(manifest);

        console.log('[Regenerate Manifest] Complete!');
        console.log('  - Total files:', processedCount);
        console.log('  - Errors:', errors.length);

        return NextResponse.json({
            success: true,
            totalFiles: processedCount,
            errors: errors.length > 0 ? errors : undefined,
            manifest: {
                lastSync: manifest.lastSync,
                fileCount: Object.keys(manifest.files).length
            }
        });

    } catch (error) {
        console.error('[Regenerate Manifest] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
