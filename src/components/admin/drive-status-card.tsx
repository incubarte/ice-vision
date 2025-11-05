
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, HardDrive, File, AlertTriangle, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '../ui/scroll-area';


interface DriveFile {
  id: string;
  name: string;
  content?: string;
}

interface LogEntry {
  step: string;
  status: 'success' | 'error';
  message: string;
}

export function DriveStatusCard() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  const fetchFiles = async () => {
    setIsLoading(true);
    setError(null);
    setFiles([]);
    setLogs([]);
    setIsActive(false);

    try {
      const response = await fetch('/api/drive-files');
      const data = await response.json();
      
      setLogs(data.logs || []);

      if (!response.ok || !data.success) {
        setIsActive(response.status !== 400); 
        throw new Error(data.message || 'Error en el servidor al intentar obtener los archivos de Drive.');
      }
      
      setIsActive(true);
      setFiles(data.files);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            <span>Estado de Google Drive</span>
          </div>
          {isLoading ? (
             <Badge variant="secondary">Verificando...</Badge>
          ) : isActive && !error ? (
             <Badge className="bg-green-600 hover:bg-green-700">Activo</Badge>
          ) : (
            <Badge variant={error ? 'destructive' : 'secondary'}>{error ? 'Error' : 'Inactivo'}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Diagnóstico de conexión con la carpeta de Google Drive.
        </CardDescription>
      </CardHeader>
      <CardContent>
          <>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold">Log de Conexión:</h4>
              <Button variant="outline" size="sm" onClick={fetchFiles} disabled={isLoading}>
                <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                Reintentar
              </Button>
            </div>
             <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><span>Ejecutando diagnóstico...</span></div>
                ) : logs.length > 0 ? (
                    logs.map((log, index) => (
                        <div key={index} className={cn("flex items-start gap-2 text-xs", log.status === 'error' && 'text-destructive')}>
                           {log.status === 'success' ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5"/> : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                           <div>
                             <span className="font-bold">{log.step}:</span> {log.message}
                           </div>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground italic">No hay logs para mostrar.</p>
                )}
            </div>
            
            {error && (
              <div className="text-destructive mt-4 p-4 border border-destructive/50 rounded-md flex items-start gap-3 bg-destructive/10">
                <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                <div>
                    <p className="font-semibold">Error Final</p>
                    <p className="text-xs mt-1">{error}</p>
                </div>
              </div>
            )}

            {isActive && !error && (
                 <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2">Archivos encontrados en la carpeta raíz:</h4>
                    {files.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                      <TooltipProvider>
                        {files.map(file => (
                        <Tooltip key={file.id} delayDuration={100}>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded-md cursor-help">
                                    <File className="h-4 w-4 text-muted-foreground" />
                                    <span>{file.name}</span>
                                </div>
                            </TooltipTrigger>
                            {file.content && (
                                <TooltipContent side="right" align="start" className="max-w-lg max-h-80">
                                    <p className="font-bold mb-2 text-primary">{file.name}</p>
                                    <ScrollArea className="h-full">
                                        <pre className="text-xs bg-muted p-2 rounded-md">{file.content}</pre>
                                    </ScrollArea>
                                </TooltipContent>
                            )}
                        </Tooltip>
                        ))}
                      </TooltipProvider>
                    </div>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">No se encontraron archivos en la carpeta raíz.</p>
                    )}
                 </div>
            )}
          </>
      </CardContent>
    </Card>
  );
}
