import { NextResponse } from 'next/server';
import { triggerSync, isMatchInProgress } from '@/lib/sync-trigger';
import { readConfig, readLiveState } from '@/lib/data-access';

export const dynamic = 'force-dynamic';

/**
 * Trigger a sync based on an event (match finish, summary edit)
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const trigger: 'after-match' | 'after-summary-edit' = body.trigger;

        if (!trigger) {
            return NextResponse.json(
                { error: 'Trigger type required' },
                { status: 400 }
            );
        }

        console.log('[Sync Trigger API] Trigger type:', trigger);

        // Read config and live state
        const config = await readConfig();
        const live = await readLiveState();

        // Check if match is in progress
        const matchInProgress = isMatchInProgress(live);
        console.log('[Sync Trigger API] Match in progress:', matchInProgress);

        // Execute trigger
        const result = await triggerSync(config as any, trigger, matchInProgress);

        console.log('[Sync Trigger API] Result:', result);

        return NextResponse.json({
            success: result.executed,
            ...result
        });

    } catch (error) {
        console.error('[Sync Trigger API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
