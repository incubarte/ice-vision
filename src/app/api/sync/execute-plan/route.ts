import { NextResponse } from 'next/server';
import { executeSyncPlan } from '@/lib/sync-service';

export const dynamic = 'force-dynamic';

/**
 * Execute the saved sync plan
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { trigger } = body;

        console.log('[Sync Execute API] Executing saved plan...');

        const result = await executeSyncPlan({ trigger });

        console.log('[Sync Execute API] Execution complete:', {
            success: result.success,
            uploaded: result.filesUploaded,
            downloaded: result.filesDownloaded,
            conflictsResolved: result.conflictsResolved,
            errors: result.errors.length
        });

        return NextResponse.json({
            success: result.success,
            ...result,
            message: result.success
                ? `Successfully synced ${result.filesUploaded + result.filesDownloaded + result.conflictsResolved} files`
                : `Partially synced with ${result.errors.length} errors`
        });

    } catch (error) {
        console.error('[Sync Execute API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
