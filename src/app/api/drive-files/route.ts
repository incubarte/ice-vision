import { NextResponse } from 'next/server';
import { listFiles } from '@/lib/storage/gdrive-provider';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    if (process.env.STORAGE_PROVIDER !== 'googledrive') {
        return NextResponse.json({ success: false, message: 'El proveedor de almacenamiento de Google Drive no está activo.' }, { status: 400 });
    }

    try {
        const files = await listFiles();
        return NextResponse.json({ success: true, files: files || [] });
    } catch (error: any) {
        console.error("[API/DRIVE-FILES] Error:", error);
        return NextResponse.json({ success: false, message: error.message || "Error al listar archivos de Google Drive." }, { status: 500 });
    }
}
