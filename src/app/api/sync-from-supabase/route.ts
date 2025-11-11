import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import { updateProgress, clearProgress } from './progress/route';
import { systemEmitter } from '@/lib/server-side-store';

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

        // Get Supabase configuration (use same logic as SupabaseStorageProvider in RO mode)
        const supabaseUrl = process.env.SUPABASE_URL;
        const bucket = process.env.SUPABASE_BUCKET;
        const anonKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !bucket || !anonKey) {
            return NextResponse.json(
                { error: 'Configuración de Supabase incompleta. Necesitas SUPABASE_URL, SUPABASE_BUCKET y SUPABASE_ANON_KEY' },
                { status: 500 }
            );
        }

        // Create Supabase client using ANON_KEY (same as supabase_ro mode)
        console.log('[SUPABASE-SYNC] Creating Supabase client...');
        console.log('[SUPABASE-SYNC] URL:', supabaseUrl);
        console.log('[SUPABASE-SYNC] Bucket:', bucket);
        console.log('[SUPABASE-SYNC] Using ANON_KEY (same as supabase_ro mode)');

        const supabase = createClient(supabaseUrl, anonKey);

        // List all files in the bucket recursively
        console.log('[SUPABASE-SYNC] Listing files in bucket...');
        updateProgress(sessionId, { currentFile: 'Listando archivos...', totalFiles: 0 });
        const allFiles = await listAllFilesRecursively(supabase, bucket);
        console.log('[SUPABASE-SYNC] Found files:', allFiles);

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
