
import { NextResponse } from 'next/server';
import { listFiles, readFileContentById } from '@/lib/storage/gdrive-provider';

export const dynamic = 'force-dynamic';

interface LogEntry {
  step: string;
  status: 'success' | 'error';
  message: string;
}

interface FileWithContent {
  id: string;
  name: string;
  content?: string;
}

export async function GET(request: Request) {
    const logs: LogEntry[] = [];
    
    try {
        if (process.env.STORAGE_PROVIDER !== 'googledrive') {
            logs.push({ step: "Verificar Proveedor", status: "error", message: "STORAGE_PROVIDER no es 'googledrive'."});
            return NextResponse.json({ 
                success: false, 
                message: 'El proveedor de almacenamiento de Google Drive no está activo.',
                logs: logs,
                files: [],
            }, { status: 400 });
        }

        const filesList = await listFiles(logs);
        const filesWithContent: FileWithContent[] = filesList ? [...filesList] : [];

        // Specifically try to read config.json and live.json to show in tooltip
        const filesToRead = ['config.json', 'live.json'];
        for (const fileName of filesToRead) {
            const file = filesList?.find(f => f.name === fileName);
            if (file?.id) {
                try {
                    const content = await readFileContentById(file.id);
                    const fileIndex = filesWithContent.findIndex(f => f.id === file.id);
                    if (fileIndex !== -1) {
                        filesWithContent[fileIndex].content = JSON.stringify(content, null, 2);
                    }
                } catch (readError) {
                    console.warn(`[API/DRIVE-FILES] Could not read content for ${fileName}:`, readError);
                    // Don't fail the whole request, just note it in the content
                     const fileIndex = filesWithContent.findIndex(f => f.id === file.id);
                    if (fileIndex !== -1) {
                         filesWithContent[fileIndex].content = `Error al leer: ${readError instanceof Error ? readError.message : 'Error desconocido'}`;
                    }
                }
            }
        }
        
        return NextResponse.json({ 
            success: true, 
            files: filesWithContent,
            logs: logs,
        });

    } catch (error: any) {
        const finalErrorStep = logs.find(log => log.status === 'error')?.step || "Paso Desconocido";
        if (logs.length > 0 && logs[logs.length-1].status !== 'error') {
            logs.push({ step: finalErrorStep, status: "error", message: error.message });
        }
        
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
