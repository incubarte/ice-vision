import { NextResponse } from 'next/server';
import { readManifest, writeManifest } from '@/lib/sync-manifest';

export const dynamic = 'force-dynamic';

/**
 * GET - Read the sync manifest
 */
export async function GET() {
    try {
        const manifest = await readManifest();
        return NextResponse.json({ manifest });
    } catch (error) {
        console.error('[Manifest API] Error reading manifest:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

/**
 * POST - Update the sync manifest
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { manifest } = body;

        if (!manifest) {
            return NextResponse.json(
                { error: 'Manifest data required' },
                { status: 400 }
            );
        }

        await writeManifest(manifest);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Manifest API] Error writing manifest:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
