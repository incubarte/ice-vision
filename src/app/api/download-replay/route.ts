import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getStorageDir } from '@/lib/storage/local-provider';

export async function POST(request: Request) {
    try {
        const { url, date, matchName, filename: providedFilename } = await request.json();

        if (!url) {
            return NextResponse.json({ message: 'URL del video es requerida.' }, { status: 400 });
        }

        console.log('[API/DOWNLOAD-REPLAY] Attempting to fetch URL:', url);
        const videoResponse = await fetch(url);

        if (!videoResponse.ok) {
            console.error('[API/DOWNLOAD-REPLAY] Fetch failed:', videoResponse.status, videoResponse.statusText);
            throw new Error(`Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`);
        }
        console.log('[API/DOWNLOAD-REPLAY] Fetch successful, content-type:', videoResponse.headers.get('content-type'));

        const videoBuffer = await videoResponse.arrayBuffer();
        
        const storageDir = getStorageDir();
        const baseDir = path.join(storageDir, 'replays');
        
        // Create nested directory: /storage/replays/<date>/<matchName>
        let targetDir = baseDir;
        if (date) {
            targetDir = path.join(targetDir, date);
        }
        if (matchName) {
            // Sanitize match name to be a valid folder name
            const sanitizedMatchName = matchName.replace(/[/\\?%*:|"<>]/g, '-');
            targetDir = path.join(targetDir, sanitizedMatchName);
        }
        await fs.mkdir(targetDir, { recursive: true });
        
        const filename = providedFilename || decodeURIComponent(new URL(url).pathname.split('/').pop()?.split('?')[0] || `replay-${Date.now()}.mp4`);
        const filePath = path.join(targetDir, filename);
        
        const publicPath = path.relative(baseDir, filePath).replace(/\\/g, '/');

        await fs.writeFile(filePath, Buffer.from(videoBuffer));

        // Note: The returned path is relative to the `storage/replays` directory.
        // The client-side logic that uses this might need adjustment if it was expecting a /public path.
        // However, for consistency, all data is now in storage.
        return NextResponse.json({ success: true, path: publicPath });

    } catch (error) {
        console.error('[API/DOWNLOAD-REPLAY] Error:', error);
        const errorMessage = error instanceof Error ? error.message : "Error desconocido en el servidor.";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
