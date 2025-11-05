
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, HardDrive, List, File, AlertTriangle, Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

interface DriveFile {
  id: string;
  name: string;
}

export function DriveStatusCard() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  const fetchFiles = async () => {
    setIsLoading(true);
    setError(null);
    setFiles([]);
    setIsActive(false);

    try {
      const response = await fetch('/api/drive-files');
      const data = await response.json();
      
      if (!response.ok) {
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
          ) : isActive ? (
             <Badge className="bg-green-600 hover:bg-green-700">Activo</Badge>
          ) : (
            <Badge variant="secondary">Inactivo</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Diagnóstico de conexión con la carpeta de Google Drive.
          {isActive
            ? " Muestra los archivos encontrados. Si hay un error, indica un problema de permisos o de conexión."
            : " Para usar Google Drive, configura la variable de entorno `STORAGE_PROVIDER` a `googledrive`."
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
          <>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold">Archivos en la Carpeta Raíz:</h4>
              <Button variant="outline" size="sm" onClick={fetchFiles} disabled={isLoading}>
                <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                Actualizar
              </Button>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : error ? (
              <div className="text-destructive p-4 border border-destructive/50 rounded-md flex items-start gap-3 bg-destructive/10">
                <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                <div>
                    <p className="font-semibold">Error al obtener archivos de Google Drive</p>
                    <p className="text-xs mt-1">{error}</p>
                </div>
              </div>
            ) : files.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                {files.map(file => (
                  <div key={file.id} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded-md">
                    <File className="h-4 w-4 text-muted-foreground" />
                    <span>{file.name}</span>
                  </div>
                ))}
              </div>
            ) : (
               isActive ? 
                <p className="text-sm text-muted-foreground italic">No se encontraron archivos en la carpeta raíz.</p>
                : <p className="text-sm text-muted-foreground">El proveedor de almacenamiento local está en uso. Esta sección está inactiva.</p>
            )}
          </>
      </CardContent>
    </Card>
  );
}
