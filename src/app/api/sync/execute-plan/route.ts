import { NextResponse } from 'next/server';
import { executeSyncPlan } from '@/lib/sync-service';

export const dynamic = 'force-dynamic';

/**
 * Execute the saved sync plan
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { trigger, plan } = body;

        console.log('[Sync Execute API] Executing plan...', plan ? '(filtered)' : '(saved)');

        const result = await executeSyncPlan({ trigger, plan });

        console.log('[Sync Execute API] Execution complete:', {
            success: result.success,
            uploaded: result.filesUploaded,
            downloaded: result.filesDownloaded,
            conflictsResolved: result.conflictsResolved,
            errors: result.errors.length
        });

        return NextResponse.json({
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
