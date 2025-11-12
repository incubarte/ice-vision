import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import { updateProgress, clearProgress } from './progress/route';
import { systemEmitter } from '@/lib/server-side-store';
import { readManifest, writeManifest, hashContent } from '@/lib/sync-manifest';
import type { FileMetadata } from '@/types';

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

// Helper to list all files recursively in a bucket
async function listAllFilesRecursively(supabase: any, bucket: string, prefix: string = ''): Promise<string[]> {
    const allFiles: string[] = [];

    async function listDir(dirPath: string) {
        console.log(`[SUPABASE-SYNC] Listing directory: "${dirPath}"`);
        const { data, error } = await supabase.storage.from(bucket).list(dirPath, { limit: 1000 });

        if (error) {
            console.error(`[SUPABASE-SYNC] Error listing ${dirPath}:`, error);
            return;
        }

        if (!data) {
            console.log(`[SUPABASE-SYNC] No data returned for ${dirPath}`);
            return;
        }

        console.log(`[SUPABASE-SYNC] Found ${data.length} items in "${dirPath}"`);

        for (const item of data) {
            const fullPath = dirPath ? `${dirPath}/${item.name}` : item.name;
            console.log(`[SUPABASE-SYNC] Item: ${fullPath}, metadata:`, item.metadata ? 'YES (file)' : 'NO (folder)');

            // If it's a file (has metadata), add it to the list
            if (item.metadata) {
                allFiles.push(fullPath);
            } else {
                // It's a folder, recurse into it
                await listDir(fullPath);
            }
        }
    }

    await listDir(prefix);
    console.log(`[SUPABASE-SYNC] Total files found: ${allFiles.length}`);
    return allFiles;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const sessionId = body.sessionId || Math.random().toString(36).substring(7);
        const excludeTournaments = body.excludeTournaments || false;

        // Clear any previous progress
        clearProgress(sessionId);

        const storageMode = process.env.STORAGE_PROVIDER || 'local';

        // Only allow this operation in local mode (to download FROM Supabase TO local)
        if (storageMode.startsWith('supabase_')) {
            return NextResponse.json(
                { error: 'Esta operación solo está disponible en modo local (para descargar desde Supabase)' },
                { status: 400 }
            );
        }

        // Get Supabase configuration - use SERVICE_KEY for full access
        const supabaseUrl = process.env.SUPABASE_URL;
        const bucket = process.env.SUPABASE_BUCKET;
        const serviceKey = process.env.SUPABASE_SERVICE_KEY;

        if (!supabaseUrl || !bucket || !serviceKey) {
            return NextResponse.json(
                { error: 'Configuración de Supabase incompleta. Necesitas SUPABASE_URL, SUPABASE_BUCKET y SUPABASE_SERVICE_KEY' },
                { status: 500 }
            );
        }

        // Create Supabase client using SERVICE_KEY for full access
        console.log('[SUPABASE-SYNC] Creating Supabase client...');
        console.log('[SUPABASE-SYNC] URL:', supabaseUrl);
        console.log('[SUPABASE-SYNC] Bucket:', bucket);
        console.log('[SUPABASE-SYNC] Using SERVICE_KEY for full access');
        console.log('[SUPABASE-SYNC] Exclude tournaments:', excludeTournaments);

        const supabase = createClient(supabaseUrl, serviceKey);

        // List all files in the bucket recursively
        console.log('[SUPABASE-SYNC] Listing files in bucket...');
        updateProgress(sessionId, { currentFile: 'Listando archivos...', totalFiles: 0 });
        let allFiles = await listAllFilesRecursively(supabase, bucket);
        console.log('[SUPABASE-SYNC] Found files:', allFiles);

        // Filter files based on what we want to download
        if (excludeTournaments) {
            // This mode downloads ONLY config.json and live.json
            // Used by "Descargar Solo Config y Live" button
            allFiles = allFiles.filter(file => {
                return file === 'config.json' || file === 'live.json';
            });
            console.log('[SUPABASE-SYNC] Downloading only config and live:', allFiles.length, 'files');
        } else {
            // This mode downloads tournaments data + manifest
            // Excludes config.json and live.json
            // Used by "Descargar TODO" button
            allFiles = allFiles.filter(file => {
                return file !== 'config.json' && file !== 'live.json';
            });
            console.log('[SUPABASE-SYNC] Downloading tournaments + manifest:', allFiles.length, 'files');
        }

        if (allFiles.length === 0) {
            updateProgress(sessionId, { isComplete: true });
            return NextResponse.json({
                success: true,
                message: 'No hay archivos en Supabase para descargar',
                filesDownloaded: 0,
                sessionId
            });
        }

        // Update total files count
        updateProgress(sessionId, { totalFiles: allFiles.length });

        // Get local storage directory
        const localStorageDir = path.join(getStorageDir(), 'data');
        console.log('[SUPABASE-SYNC] Local storage directory:', localStorageDir);
        console.log('[SUPABASE-SYNC] Total files to download:', allFiles.length);
        console.log('[SUPABASE-SYNC] Files:', allFiles);

        await fs.mkdir(localStorageDir, { recursive: true });

        let filesDownloaded = 0;
        const errors: string[] = [];

        // Download each file
        for (const filePath of allFiles) {
            try {
                // Update progress with current file
                updateProgress(sessionId, {
                    currentFile: filePath,
                    filesDownloaded
                });

                // Get the file from Supabase
                const { data, error } = await supabase.storage.from(bucket).download(filePath);

                if (error) {
                    errors.push(`No se pudo obtener el contenido de: ${filePath} - ${error.message}`);
                    continue;
                }

                if (!data) {
                    errors.push(`No se pudo obtener el contenido de: ${filePath}`);
                    continue;
                }

                // Convert blob to text
                const content = await data.text();

                // Write to local storage
                const localPath = path.join(localStorageDir, filePath);
                console.log(`[SUPABASE-SYNC] Writing file to: ${localPath}`);
                await fs.mkdir(path.dirname(localPath), { recursive: true });
                await fs.writeFile(localPath, content, 'utf-8');
                console.log(`[SUPABASE-SYNC] Successfully wrote: ${localPath}`);

                filesDownloaded++;
            } catch (err) {
                console.error(`[SUPABASE-SYNC] Error downloading ${filePath}:`, err);
                errors.push(`Error con ${filePath}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        }

        // Mark as complete
        updateProgress(sessionId, { isComplete: true, filesDownloaded });

        console.log(`[SUPABASE-SYNC] Sync completed. Downloaded: ${filesDownloaded}, Errors: ${errors.length}`);

        // Emit sync-complete event to reload server-side cache
        console.log('[SUPABASE-SYNC] Emitting sync-complete event to reload cache...');
        systemEmitter.emit('sync-complete');

        return NextResponse.json({
            success: true,
            message: `Se descargaron ${filesDownloaded} archivos de Supabase`,
            filesDownloaded,
            totalFiles: allFiles.length,
            localStorageDir,
            filesList: allFiles,
            errors: errors.length > 0 ? errors : undefined,
            sessionId
        });

    } catch (error) {
        console.error('Error syncing from Supabase:', error);
        const body = await request.json().catch(() => ({}));
        const sessionId = body.sessionId;
        if (sessionId) {
            updateProgress(sessionId, {
                isComplete: true,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
        return NextResponse.json(
            { error: 'Error al sincronizar desde Supabase', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
