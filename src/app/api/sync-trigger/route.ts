import { NextResponse } from 'next/server';
import { triggerSync } from '@/lib/sync-trigger';
import { readConfig } from '@/lib/data-access';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const trigger: 'after-summary-edit' = body.trigger;

        if (!trigger) {
            return NextResponse.json({ error: 'Trigger type required' }, { status: 400 });
        }

        const config = await readConfig();
        const result = await triggerSync(config as any, trigger);

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
