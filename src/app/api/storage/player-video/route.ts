import { NextResponse } from 'next/server';
import { storageProvider } from '@/lib/storage';
import { removeManifestEntry } from '@/lib/sync-manifest';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Upload a player celebration video (.webm)
 */
export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const tournamentId = formData.get('tournamentId') as string;
        const teamName = formData.get('teamName') as string;
        const playerName = formData.get('playerName') as string;

        if (!file || !tournamentId || !teamName || !playerName) {
            return NextResponse.json(
                { error: 'Missing required fields: file, tournamentId, teamName, or playerName' },
                { status: 400 }
            );
        }

        if (file.type !== 'video/webm') {
            return NextResponse.json(
                { error: 'File must be a .webm video' },
                { status: 400 }
            );
        }

        const sanitizedPlayerName = playerName
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');

        const hash = crypto.randomBytes(2).toString('hex');
        const fileName = `${sanitizedPlayerName}_${hash}.webm`;

        const sanitizedTeamName = teamName
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');

        const filePath = `tournaments/${tournamentId}/players/${sanitizedTeamName}/${fileName}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await storageProvider.writeBinaryFile(filePath, buffer, 'video/webm');

        return NextResponse.json({ success: true, fileName, filePath });

    } catch (error) {
        console.error('[Player Video Upload API] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

/**
 * Delete a player celebration video
 */
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const filePath = searchParams.get('path');

        if (!filePath) {
            return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
        }

        if (!filePath.startsWith('tournaments/')) {
            return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
        }

        await storageProvider.deleteFile(filePath);

        try {
            await removeManifestEntry(filePath);
        } catch {
            // non-fatal
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Player Video Delete API] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
