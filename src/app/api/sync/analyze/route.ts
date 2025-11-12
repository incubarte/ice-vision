import { NextResponse } from 'next/server';
import { analyzeSync } from '@/lib/sync-service';

export const dynamic = 'force-dynamic';

/**
 * Analyze what would be synced without actually syncing
 * This is a dry-run to show differences between local and remote
 */
export async function GET() {
    try {
        console.log('[Sync API] Creating sync plan...');

        const plan = await analyzeSync();

        console.log('[Sync API] Plan created:', {
            status: plan.status,
            toUpload: plan.summary.uploadCount,
            toDownload: plan.summary.downloadCount,
            conflicts: plan.summary.conflictCount,
            unchanged: plan.summary.unchangedCount
        });

        return NextResponse.json({
            success: true,
            plan,
            message: `Plan created: ${plan.summary.uploadCount} to upload, ${plan.summary.downloadCount} to download, ${plan.summary.conflictCount} conflicts${plan.status === 'ready' ? ' (ready to execute)' : ' (needs conflict resolution)'}`
        });

    } catch (error) {
        console.error('[Sync API] Error analyzing sync:', error);

        // Check if it's a network/timeout error
        const isNetworkError = error instanceof Error && (
            error.message.includes('fetch failed') ||
            error.message.includes('timeout') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('ETIMEDOUT')
        );

        return NextResponse.json(
            {
                success: false,
                error: isNetworkError
                    ? 'No se pudo conectar a Supabase. Verifica tu conexión a internet.'
                    : (error instanceof Error ? error.message : 'Unknown error'),
                isNetworkError,
                details: error instanceof Error ? error.stack : undefined
            },
            { status: isNetworkError ? 503 : 500 }
        );
    }
}
