
import { NextResponse } from 'next/server';
import { listFiles } from '@/lib/storage/gdrive-provider';

export const dynamic = 'force-dynamic';

interface LogEntry {
  step: string;
  status: 'success' | 'error';
  message: string;
}

export async function GET(request: Request) {
    // 1. Verificar si el proveedor de Google Drive está activo en el servidor.
    if (process.env.STORAGE_PROVIDER !== 'googledrive') {
        return NextResponse.json({ 
            success: false, 
            message: 'El proveedor de almacenamiento de Google Drive no está activo.',
            logs: [{ step: "Verificar Proveedor", status: "error", message: "STORAGE_PROVIDER no es 'googledrive'."}],
            files: [],
        }, { status: 400 });
    }

    const logs: LogEntry[] = [];
    
    try {
        logs.push({ step: "Verificar Proveedor", status: "success", message: "Proveedor 'googledrive' está activo." });
        
        // 2. listFiles ahora se encargará de toda la lógica, incluyendo la inicialización.
        const files = await listFiles(logs);
        
        return NextResponse.json({ 
            success: true, 
            files: files || [],
            logs: logs,
        });

    } catch (error: any) {
        // 3. Si cualquier paso falla, el error se captura aquí.
        const finalErrorStep = logs.find(log => log.status === 'error')?.step || "Paso Desconocido";
        logs.push({ step: finalErrorStep, status: "error", message: error.message });
        
        console.error("[API/DRIVE-FILES] Error en el proceso:", error.message);
        return NextResponse.json({ 
            success: false, 
            message: `Fallo en el paso: ${finalErrorStep}.`,
            error: error.message,
            files: [],
            logs: logs,
        }, { status: 500 });
    }
}
