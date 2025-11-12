import { NextResponse } from 'next/server';
import { analyzeSync } from '@/lib/sync-service';

export const dynamic = 'force-dynamic';

/**
 * Analyze what would be synced without actually syncing
 * This is a dry-run to show differences between local and remote
 */
export async function GET() {
    try {
        console.log('[Sync API] Starting sync analysis (dry-run)...');

        const analysis = await analyzeSync();

        console.log('[Sync API] Analysis complete:', {
            toUpload: analysis.summary.uploadCount,
            toDownload: analysis.summary.downloadCount,
            conflicts: analysis.summary.conflictCount,
            unchanged: analysis.summary.unchangedCount
        });

        return NextResponse.json({
            success: true,
            analysis,
            message: `Analysis complete: ${analysis.summary.uploadCount} to upload, ${analysis.summary.downloadCount} to download, ${analysis.summary.conflictCount} conflicts`
        });

    } catch (error) {
        console.error('[Sync API] Error analyzing sync:', error);
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
