import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { secret } = await request.json();
        const configuredSecret = process.env.ADMIN_WRITE_SECRET;

        if (!configuredSecret) {
            return NextResponse.json({ valid: false, reason: 'not_configured' });
        }

        const valid = typeof secret === 'string' && secret === configuredSecret;
        return NextResponse.json({ valid });
    } catch {
        return NextResponse.json({ valid: false }, { status: 400 });
    }
}
