import { NextResponse } from 'next/server';
import { analyzeSync, executeSync, ConflictStrategy } from '@/lib/sync-service';
import { systemEmitter } from '@/lib/server-side-store';

export const dynamic = 'force-dynamic';

/**
 * Execute sync based on current differences between local and remote
 * - Uploads files that need to be uploaded (unless remote-wins strategy)
 * - Downloads files that need to be downloaded
 * - Resolves conflicts based on strategy
 * - Updates both local and remote manifests
 */
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const strategy: ConflictStrategy = body.strategy || 'local-wins';
        const onlyFiles: string[] | undefined = body.onlyFiles; // Array of specific files to sync

        console.log('[Sync Execute] Starting sync execution...');
        console.log('[Sync Execute] Strategy:', strategy);
        console.log('[Sync Execute] Only files:', onlyFiles);

        // 1. First analyze what needs to be synced
        const analysis = await analyzeSync();

        console.log('[Sync Execute] Analysis:', {
            toUpload: analysis.summary.uploadCount,
            toDownload: analysis.summary.downloadCount,
            conflicts: analysis.summary.conflictCount
        });

        // 2. If nothing to sync, return early
        const totalChanges = analysis.summary.uploadCount + analysis.summary.downloadCount + analysis.summary.conflictCount;
        if (totalChanges === 0) {
            return NextResponse.json({
                success: true,
                message: 'No changes to sync',
                result: {
                    success: true,
                    filesUploaded: 0,
                    filesDownloaded: 0,
                    conflictsResolved: 0,
                    errors: []
                }
            });
        }

        // 3. Execute sync with options
        const result = await executeSync(analysis, {
            strategy,
            filterFiles: onlyFiles ? (filePath) => onlyFiles.includes(filePath) : undefined
        });

        console.log('[Sync Execute] Sync complete:', {
            uploaded: result.filesUploaded,
            downloaded: result.filesDownloaded,
            conflicts: result.conflictsResolved,
            errors: result.errors.length,
            backupPath: result.backupPath
        });

        // 4. Reload server-side cache if files were downloaded
        if (result.filesDownloaded > 0) {
            console.log('[Sync Execute] Reloading server-side cache...');
            systemEmitter.emit('sync-complete');
        }

        return NextResponse.json({
            success: result.success,
            message: `Sync completed: ${result.filesUploaded} uploaded, ${result.filesDownloaded} downloaded, ${result.conflictsResolved} conflicts resolved`,
            result
        });

    } catch (error) {
        console.error('[Sync Execute] Error executing sync:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                details: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}
