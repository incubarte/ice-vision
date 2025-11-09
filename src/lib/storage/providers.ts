import { promises as fs } from 'fs';
import path from 'path';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

// Helper function to get the storage directory from environment or default
function getStorageDir(): string {
    const storagePath = process.env.STORAGE_PATH;
    if (storagePath) {
        // Check if the path is absolute. If so, use it directly. Otherwise, join it with the current working directory.
        if (path.isAbsolute(storagePath)) {
            return storagePath;
        }
        return path.join(process.cwd(), storagePath);
    }
    // Default to './storage' in the project root if the environment variable is not set.
    return path.join(process.cwd(), 'storage');
}

// --- 1. The Storage Provider Interface ---

export interface StorageProvider {
    readFile(filePath: string): Promise<string>;
    writeFile(filePath: string, content: string): Promise<void>;
    deleteFile(filePath: string): Promise<void>;
    listFiles(directoryPath: string): Promise<string[]>;
    deleteFolder(directoryPath: string): Promise<void>;
}

// --- 2. Local Filesystem Implementation ---

// --- 3. S3 Implementation ---

export class S3StorageProvider implements StorageProvider {
    private s3: S3Client;
    private bucket: string;

    constructor() {
        this.bucket = process.env.AWS_S3_BUCKET_NAME!;
        this.s3 = new S3Client({
            region: process.env.AWS_S3_REGION!,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        });

        if (!this.bucket) {
            throw new Error('AWS_S3_BUCKET_NAME environment variable is not set.');
        }
    }

    private async streamToString(stream: any): Promise<string> {
        return new Promise((resolve, reject) => {
            const chunks: any[] = [];
            stream.on('data', (chunk: any) => chunks.push(chunk));
            stream.on('error', reject);
            stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        });
    }

    async readFile(filePath: string): Promise<string> {
        const command = new GetObjectCommand({ Bucket: this.bucket, Key: filePath });
        const { Body } = await this.s3.send(command);
        if (!Body) {
            throw new Error(`File not found in S3: ${filePath}`);
        }
        return this.streamToString(Body);
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        const command = new PutObjectCommand({ Bucket: this.bucket, Key: filePath, Body: content });
        await this.s3.send(command);
    }

    async deleteFile(filePath: string): Promise<void> {
        const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: filePath });
        await this.s3.send(command);
    }

    async listFiles(directoryPath: string): Promise<string[]> {
        const command = new ListObjectsV2Command({ Bucket: this.bucket, Prefix: directoryPath });
        const output = await this.s3.send(command);
        return output.Contents?.map(item => item.Key!.substring(directoryPath.length)) || [];
    }

    async deleteFolder(directoryPath: string): Promise<void> {
        const listCommand = new ListObjectsV2Command({ Bucket: this.bucket, Prefix: directoryPath });
        const listedObjects = await this.s3.send(listCommand);

        if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
            return;
        }

        const deleteParams = {
            Bucket: this.bucket,
            Delete: { Objects: listedObjects.Contents.map(({ Key }) => ({ Key })) },
        };

        const deleteCommand = new DeleteObjectsCommand(deleteParams);
        await this.s3.send(deleteCommand);
    }
}

export class LocalFileStorageProvider implements StorageProvider {
    private dataDir: string;

    constructor() {
        // All files are stored in the 'data' subdirectory of the storage directory
        this.dataDir = path.join(getStorageDir(), 'data');
    }

    private resolvePath(filePath: string): string {
        const resolved = path.join(this.dataDir, filePath);
        if (!resolved.startsWith(this.dataDir)) {
            throw new Error(`File path is outside the allowed directory: ${filePath}`);
        }
        return resolved;
    }

    async readFile(filePath: string): Promise<string> {
        return fs.readFile(this.resolvePath(filePath), 'utf-8');
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        const resolvedPath = this.resolvePath(filePath);
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, content, 'utf-8');
    }

    async deleteFile(filePath: string): Promise<void> {
        await fs.unlink(this.resolvePath(filePath));
    }

    async listFiles(directoryPath: string): Promise<string[]> {
        try {
            return await fs.readdir(this.resolvePath(directoryPath));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return []; // Return empty array if directory doesn't exist
            }
            throw error;
        }
    }

    async deleteFolder(directoryPath: string): Promise<void> {
        await fs.rm(this.resolvePath(directoryPath), { recursive: true, force: true });
    }
}
