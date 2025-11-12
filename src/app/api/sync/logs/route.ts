import { NextResponse } from 'next/server';
import { readSyncLogs } from '@/lib/sync-logs';

export const dynamic = 'force-dynamic';

/**
 * Get sync logs
 */
export async function GET() {
    try {
        const logs = await readSyncLogs();

        // Return last 10 logs
        const recentLogs = logs.slice(0, 10);

        return NextResponse.json({
            success: true,
            logs: recentLogs
        });
    } catch (error) {
        console.error('[Sync Logs API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
