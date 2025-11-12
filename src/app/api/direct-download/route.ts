import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { storageProvider } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * Direct download of specific files from Supabase
 * Does NOT use sync/manifest system - just downloads the files directly
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const files: string[] = body.files || [];

        if (!files || files.length === 0) {
            return NextResponse.json(
                { error: 'No files specified' },
                { status: 400 }
            );
        }

        console.log('[Direct Download] Downloading files:', files);

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
        const bucket = process.env.SUPABASE_BUCKET;

        if (!supabaseUrl || !supabaseKey || !bucket) {
            throw new Error('Supabase configuration missing');
        }

        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });

        let filesDownloaded = 0;
        const errors: Array<{ filePath: string; error: string }> = [];

        for (const filePath of files) {
            try {
                console.log('[Direct Download] Downloading:', filePath);

                const { data, error } = await supabase.storage
                    .from(bucket)
                    .download(filePath);

                if (error) {
                    console.error('[Direct Download] Error downloading:', filePath, error);
                    errors.push({
                        filePath,
                        error: `Download failed: ${error.message}`
                    });
                    continue;
                }

                if (!data) {
                    errors.push({
                        filePath,
                        error: 'No data returned'
                    });
                    continue;
                }

                const content = await data.text();
                await storageProvider.writeFile(filePath, content);
                filesDownloaded++;
                console.log('[Direct Download] Successfully downloaded:', filePath);

            } catch (err) {
                console.error('[Direct Download] Exception downloading:', filePath, err);
                errors.push({
                    filePath,
                    error: err instanceof Error ? err.message : 'Unknown error'
                });
            }
        }

        console.log('[Direct Download] Complete. Downloaded:', filesDownloaded, 'Errors:', errors.length);

        return NextResponse.json({
            success: errors.length === 0,
            filesDownloaded,
            totalFiles: files.length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('[Direct Download] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
