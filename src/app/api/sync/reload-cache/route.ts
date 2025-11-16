import { NextResponse } from 'next/server';
import { reloadCacheFromDisk } from '@/lib/server-side-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        console.log('[API] Reloading cache from disk...');
        await reloadCacheFromDisk();
        console.log('[API] Cache reloaded successfully');

        return NextResponse.json({
            success: true,
            message: 'Cache reloaded from disk successfully'
        });
    } catch (error) {
        console.error('[API] Error reloading cache:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
