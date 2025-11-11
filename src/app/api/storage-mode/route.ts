import { NextResponse } from 'next/server';

export async function GET() {
    const storageMode = process.env.STORAGE_PROVIDER || 'local';

    return NextResponse.json({
        mode: storageMode,
        isS3: storageMode === 's3'
    });
}
