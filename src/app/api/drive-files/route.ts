
import { NextResponse } from 'next/server';
import { listFiles } from '@/lib/storage/gdrive-provider';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // 1. Verificar si el proveedor de Google Drive está activo en el servidor.
    if (process.env.STORAGE_PROVIDER !== 'googledrive') {
        return NextResponse.json({ success: false, message: 'El proveedor de almacenamiento de Google Drive no está activo.' }, { status: 400 });
    }

    // 2. Obtener el ID de la carpeta desde las variables de entorno del servidor.
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      return NextResponse.json({ success: false, message: 'La variable de entorno GOOGLE_DRIVE_FOLDER_ID no está configurada.' }, { status: 500 });
    }

    try {
        // 3. Llamar a listFiles pasando explícitamente el folderId.
        const files = await listFiles(folderId);
        return NextResponse.json({ success: true, files: files || [] });
    } catch (error: any) {
        // 4. Si listFiles falla, capturar el error original y devolverlo.
        console.error("[API/DRIVE-FILES] Error:", error.message);
        return NextResponse.json({ 
            success: false, 
            message: `Error al listar archivos de Google Drive: ${error.message || "Error desconocido."}` 
        }, { status: 500 });
    }
}
