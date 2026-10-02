import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const { mobileCode } = await req.json();

        if (!mobileCode || mobileCode.length !== 3) {
            return NextResponse.json({ valid: false, reason: 'invalid_format' });
        }

        const livePath = path.join(process.cwd(), 'tmp', 'new-storage', 'data', 'live.json');
        const liveData = JSON.parse(await readFile(livePath, 'utf-8'));
        const expectedCode = liveData.mobileEventsCode;

        if (!expectedCode) {
            return NextResponse.json({ valid: false, reason: 'no_code_set' });
        }

        return NextResponse.json({ valid: mobileCode === expectedCode });
    } catch (error) {
        console.error('[verify-code] Error:', error);
        return NextResponse.json({ valid: false, reason: 'server_error' }, { status: 500 });
    }
}
