
import { NextResponse } from 'next/server';
import { listFiles } from '@/lib/storage/gdrive-provider';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    if (process.env.STORAGE_PROVIDER !== 'googledrive') {
        return NextResponse.json({ success: false, message: 'El proveedor de almacenamiento de Google Drive no está activo.' }, { status: 400 });
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      return NextResponse.json({ success: false, message: 'La variable de entorno GOOGLE_DRIVE_FOLDER_ID no está configurada.' }, { status: 500 });
    }

    try {
        const files = await listFiles(folderId);
        return NextResponse.json({ success: true, files: files || [] });
    } catch (error: any) {
        console.error("[API/DRIVE-FILES] Error:", error);
        return NextResponse.json({ success: false, message: error.message || "Error desconocido al listar archivos de Google Drive." }, { status: 500 });
    }
}
