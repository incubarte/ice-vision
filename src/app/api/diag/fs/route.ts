import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const TMP_DIR = '/tmp';

// Ensure the base directory exists
async function ensureTmpDir() {
    try {
        await fs.mkdir(TMP_DIR, { recursive: true });
    } catch (error) {
        console.error(`Failed to create base directory ${TMP_DIR}:`, error);
        // If this fails, subsequent operations will likely fail, which is intended.
    }
}

export async function POST(request: Request) {
    await ensureTmpDir();
    try {
        const { action, filename, folderName, content } = await request.json();

        if (filename && (filename.includes('..') || filename.includes('/'))) {
            return NextResponse.json({ success: false, message: 'Invalid filename.' }, { status: 400 });
        }
        if (folderName && (folderName.includes('..') || folderName.includes('/'))) {
            return NextResponse.json({ success: false, message: 'Invalid folder name.' }, { status: 400 });
        }

        const filePath = filename ? path.join(TMP_DIR, filename) : TMP_DIR;
        const folderPath = folderName ? path.join(TMP_DIR, folderName) : TMP_DIR;

        switch (action) {
            case 'create_file':
                await fs.writeFile(filePath, content || '', 'utf-8');
                return NextResponse.json({ success: true, message: `File '${filename}' created successfully in /tmp.` });

            case 'read_file':
                const fileContent = await fs.readFile(filePath, 'utf-8');
                return NextResponse.json({ success: true, message: `Content of '${filename}':`, data: fileContent });

            case 'delete_file':
                await fs.unlink(filePath);
                return NextResponse.json({ success: true, message: `File '${filename}' deleted successfully from /tmp.` });

            case 'create_folder':
                await fs.mkdir(folderPath, { recursive: true });
                return NextResponse.json({ success: true, message: `Folder '${folderName}' created successfully in /tmp.` });

            case 'delete_folder':
                 await fs.rm(folderPath, { recursive: true, force: true });
                return NextResponse.json({ success: true, message: `Folder '${folderName}' deleted successfully from /tmp.` });

            case 'list_files':
                const files = await fs.readdir(TMP_DIR);
                return NextResponse.json({ success: true, message: 'Files and folders in /tmp:', data: files });

            default:
                return NextResponse.json({ success: false, message: 'Invalid action.' }, { status: 400 });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
    }
}
