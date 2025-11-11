import { NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import path from 'path';

// Helper to get storage directory
function getStorageDir(): string {
    const storagePath = process.env.STORAGE_PATH;
    if (storagePath) {
        if (path.isAbsolute(storagePath)) {
            return storagePath;
        }
        return path.join(process.cwd(), storagePath);
    }
    return path.join(process.cwd(), 'storage');
}

// Helper to convert stream to string
async function streamToString(stream: any): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk: any) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
}

export async function POST() {
    try {
        const storageMode = process.env.STORAGE_PROVIDER || 'local';

        // Only allow this operation in local mode (to download FROM S3 TO local)
        if (storageMode === 's3') {
            return NextResponse.json(
                { error: 'Esta operación solo está disponible en modo local (para descargar desde S3)' },
                { status: 400 }
            );
        }

        // Get S3 configuration
        const bucket = process.env.AWS_S3_BUCKET_NAME;
        const region = process.env.AWS_S3_REGION;
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

        if (!bucket || !region || !accessKeyId || !secretAccessKey) {
            return NextResponse.json(
                { error: 'Configuración de S3 incompleta' },
                { status: 500 }
            );
        }

        // Create S3 client
        const s3 = new S3Client({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });

        // List all objects in the bucket
        const listCommand = new ListObjectsV2Command({ Bucket: bucket });
        const listedObjects = await s3.send(listCommand);

        if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No hay archivos en S3 para descargar',
                filesDownloaded: 0
            });
        }

        // Get local storage directory
        const localStorageDir = path.join(getStorageDir(), 'data');
        await fs.mkdir(localStorageDir, { recursive: true });

        let filesDownloaded = 0;
        const errors: string[] = [];

        // Download each file
        for (const object of listedObjects.Contents) {
            if (!object.Key) continue;

            try {
                // Get the file from S3
                const getCommand = new GetObjectCommand({ Bucket: bucket, Key: object.Key });
                const { Body } = await s3.send(getCommand);

                if (!Body) {
                    errors.push(`No se pudo obtener el contenido de: ${object.Key}`);
                    continue;
                }

                // Convert stream to string
                const content = await streamToString(Body);

                // Write to local storage
                const localPath = path.join(localStorageDir, object.Key);
                await fs.mkdir(path.dirname(localPath), { recursive: true });
                await fs.writeFile(localPath, content, 'utf-8');

                filesDownloaded++;
            } catch (err) {
                console.error(`Error downloading ${object.Key}:`, err);
                errors.push(`Error con ${object.Key}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Se descargaron ${filesDownloaded} archivos de S3`,
            filesDownloaded,
            totalFiles: listedObjects.Contents.length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Error syncing from S3:', error);
        return NextResponse.json(
            { error: 'Error al sincronizar desde S3', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
