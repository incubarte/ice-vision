
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Video, ListVideo, Loader2, RefreshCw, Download, Play, CheckCircle, XCircle, Calendar as CalendarIcon, AlertTriangle, Copy, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendRemoteCommand } from '@/app/actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useGameState } from '@/contexts/game-state-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


type LoadingStatus = 'idle' | 'loading' | 'success' | 'error';
type DownloadStatus = 'idle' | 'downloading' | 'success' | 'error';

interface FirebaseReplay {
    id: string;
    location: string;
    url: string;
    filename: string;
    isNew: boolean;
    matchName: string;
}

export default function ReplaysPage() {
    const { state } = useGameState();
    const [allReplayFiles, setAllReplayFiles] = useState<string[]>([]);
    const [filteredReplayFiles, setFilteredReplayFiles] = useState<string[]>([]);
    const [selectedReplay, setSelectedReplay] = useState<string | null>(null);
    const [status, setStatus] = useState<LoadingStatus>('loading');
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const { toast } = useToast();

    const [isManualDownloadOpen, setIsManualDownloadOpen] = useState(false);
    const [videoUrl, setVideoUrl] = useState('');
    const [manualMatchName, setManualMatchName] = useState('Manual');
    const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle');

    const [syncDate, setSyncDate] = useState<Date>();
    const [isSyncActive, setIsSyncActive] = useState(false);
    const [newReplays, setNewReplays] = useState<FirebaseReplay[]>([]);
    const [isMassDownloading, setIsMassDownloading] = useState(false);
    const [firebaseError, setFirebaseError] = useState<string | null>(null);
    const [startTimeSeconds, setStartTimeSeconds] = useState<number | null>(4);

    const replaySettings = state.config.replays;

    useEffect(() => {
        setSyncDate(new Date());
    }, []);

    const fetchReplays = useCallback(async () => {
        setStatus('loading');
        setError(null);
        try {
            const response = await fetch('/api/replays');
            const data = await response.json();
            if (data.success) {
                setAllReplayFiles(data.files);
                setStatus('success');
            } else {
                throw new Error(data.message || 'Error en el servidor');
            }
        } catch (err: any) {
            setError(err.message || 'No se pudo conectar para obtener la lista de repeticiones.');
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        fetchReplays();
    }, [fetchReplays]);
    
     useEffect(() => {
        if (!syncDate) return;
        const dateString = format(syncDate, 'yyyy-MM-dd');
        setFilteredReplayFiles(
            allReplayFiles.filter(file => file.startsWith(dateString))
        );
        setSelectedReplay(null); // Deselect video when date changes
    }, [syncDate, allReplayFiles]);

    const convertGsToHttps = useCallback((gsPath: string): string => {
        if (!gsPath.startsWith('gs://') || !replaySettings?.downloadUrlBase) return '';
        const pathWithoutPrefix = gsPath.substring(5);
        const firstSlashIndex = pathWithoutPrefix.indexOf('/');
        if (firstSlashIndex === -1) return ''; 

        const bucketName = pathWithoutPrefix.substring(0, firstSlashIndex);
        const filePath = pathWithoutPrefix.substring(firstSlashIndex + 1);

        const encodedFilePath = encodeURIComponent(filePath);
        
        return `${replaySettings.downloadUrlBase}${encodedFilePath}?alt=media`;
    }, [replaySettings]);
    
    useEffect(() => {
        if (!isSyncActive || !replaySettings?.syncUrl || !syncDate) {
            setNewReplays([]);
            if(isSyncActive && !replaySettings?.syncUrl) setFirebaseError("URL de sincronización no configurada.");
            return;
        }

        const sync = async () => {
            try {
                const formattedDate = format(syncDate, 'yyyy-MM-dd');
                const response = await fetch(replaySettings.syncUrl);
                if (!response.ok) throw new Error(`Firebase returned status ${response.status}`);
                const data = await response.json();
                
                const dayData = data?.[formattedDate];
                if (!dayData) {
                    setNewReplays([]);
                    setFirebaseError(null);
                    return;
                }

                const fetchedReplays: FirebaseReplay[] = [];
                for (const matchName in dayData) {
                    const matchReplays = dayData[matchName];
                    for (const replayId in matchReplays) {
                        const location = matchReplays[replayId].location;
                        if (location && location.startsWith('gs://')) {
                            const filename = location.split('/').pop()?.split('?')[0] || `replay-${replayId}.mp4`;
                            const httpsUrl = convertGsToHttps(location);
                            
                            const sanitizedMatchName = matchName.replace(/[/\\?%*:|"<>]/g, '-');
                            const expectedLocalPath = `${formattedDate}/${sanitizedMatchName}/${filename}`;

                            if (httpsUrl) {
                                fetchedReplays.push({
                                    id: replayId,
                                    location,
                                    url: httpsUrl,
                                    filename,
                                    matchName,
                                    isNew: !allReplayFiles.includes(expectedLocalPath)
                                });
                            }
                        }
                    }
                }
                
                setNewReplays(fetchedReplays.filter(r => r.isNew));
                setFirebaseError(null);
            } catch (err) {
                setFirebaseError("No se pudo conectar a Firebase. Reintentando...");
                console.error("Firebase sync error:", err);
            }
        };

        sync();
        const interval = setInterval(sync, 10000);

        return () => clearInterval(interval);
    }, [isSyncActive, syncDate, allReplayFiles, replaySettings, convertGsToHttps]);

    // IMPORTANT: The server now saves replays to a non-public 'storage' directory.
    // We need a way to serve these videos. This creates a temporary blob URL.
    const getVideoUrl = (replayFile: string | null): string | null => {
        // This is a placeholder. A proper implementation would need a dedicated API route
        // to securely serve the video file from the storage directory.
        // For now, this will likely fail as it's not a public path.
        // A temporary fix is to assume the client can access the server's file system,
        // which is not true in production. Let's create a proxy endpoint.
        // The ideal solution is an API route like /api/video/[...path] that streams the file.
        // For now, let's pretend /storage is served statically, which it is NOT by default in Next.js.
        // To make this work, we need an API endpoint to proxy the video.
        // Let's assume we create one at `/api/replays/[...filepath]`.
        if (!replayFile) return null;
        // This won't work directly, but it's the conceptual path.
        // We'll need a dedicated API route.
        // For demonstration, let's pretend it works, but acknowledge it needs a backend change.
        return `/replays/${replayFile}`; // This path assumes the 'storage/replays' is served at '/replays'
    };

    const handleSelectReplay = (replayFile: string) => {
        setSelectedReplay(replayFile);
    };
    
    useEffect(() => {
        if (selectedReplay && videoRef.current) {
            videoRef.current.load();
        }
    }, [selectedReplay]);

    const handleDownloadVideo = async (urlToDownload: string, filename: string, matchName: string, downloadDate?: Date) => {
        setDownloadStatus('downloading');
        try {
            const body: { url: string, date?: string, matchName?: string, filename: string } = { url: urlToDownload, filename, matchName };
            if (downloadDate) {
                body.date = format(downloadDate, 'yyyy-MM-dd');
            }

            const response = await fetch('/api/download-replay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Error en el servidor');

            setDownloadStatus('success');
            return { success: true, newFilePath: data.path };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "No se pudo conectar con el servidor.";
            setDownloadStatus('error');
            toast({ title: "Error de Descarga", description: `${errorMessage} URL: ${urlToDownload}`, variant: "destructive", duration: 5000 });
            return { success: false };
        }
    };
    
    const handleManualDownload = async () => {
        if (!videoUrl) {
            toast({ title: "URL Requerida", description: "Por favor, ingresa la URL del video.", variant: "destructive" });
            return;
        }
        const urlPath = new URL(videoUrl).pathname;
        const decodedPath = decodeURIComponent(urlPath);
        const filename = decodedPath.split('/').pop() || `manual-${Date.now()}.mp4`;

        const result = await handleDownloadVideo(videoUrl, filename, manualMatchName, syncDate);
        if (result.success) {
            toast({ title: "Descarga Manual Exitosa", description: "El video ha sido descargado." });
            setVideoUrl('');
            setManualMatchName('Manual');
            setIsManualDownloadOpen(false);
            fetchReplays();
        }
    };

    const handleMassDownload = async () => {
        if (!syncDate) return;
        setIsMassDownloading(true);
        const downloadedFiles: string[] = [];
        
        for (const replay of newReplays) {
            const result = await handleDownloadVideo(replay.url, replay.filename, replay.matchName, syncDate);
            if (result.success && result.newFilePath) {
                downloadedFiles.push(result.newFilePath);
            }
        }
        
        if (downloadedFiles.length > 0) {
            setAllReplayFiles(prev => [...prev, ...downloadedFiles].sort((a, b) => b.localeCompare(a)));
        }
        
        setNewReplays([]);
        setIsMassDownloading(false);
        toast({
            title: "Descarga Masiva Completa",
            description: `${downloadedFiles.length} videos descargados.`,
        });
    };
    
    const handleShowOnScoreboard = async () => {
        if (!selectedReplay) {
            toast({ title: "Video no seleccionado", description: "Por favor, selecciona un video de la lista para mostrar.", variant: "destructive" });
            return;
        }
        // IMPORTANT: The URL sent to the scoreboard must be a publicly accessible one.
        // We'll proxy it through a new API endpoint.
        const scoreboardUrl = `/api/replays/${selectedReplay}`;
        const startTime = startTimeSeconds ?? 0;
        await sendRemoteCommand({ type: 'START_LOADING_REPLAY', payload: { url: scoreboardUrl, startTimeSeconds: startTime } });
        toast({ title: "Comando Enviado", description: `El scoreboard mostrará la repetición desde el segundo ${startTime}.` });
    };

    const handleCopyToClipboard = (text: string, label: string) => {
        toast({
          title: `URL para Copiar (${label})`,
          description: text,
          duration: 10000,
        });
    };

    const newReplaysGroupedByMatch = useMemo(() => {
        return newReplays.reduce((acc, replay) => {
            (acc[replay.matchName] = acc[replay.matchName] || []).push(replay);
            return acc;
        }, {} as Record<string, FirebaseReplay[]>);
    }, [newReplays]);
    
    const localFilesGroupedByMatch = useMemo(() => {
        return filteredReplayFiles.reduce((acc, file) => {
            const parts = file.split('/');
            const matchName = parts.length > 2 ? parts[1] : 'General';
            (acc[matchName] = acc[matchName] || []).push(file);
            return acc;
        }, {} as Record<string, string[]>);
    }, [filteredReplayFiles]);

    return (
        <div className="w-full max-w-7xl mx-auto py-8 space-y-6">
            <div className="flex items-center gap-4">
                <Video className="h-8 w-8 text-primary"/>
                <h1 className="text-3xl font-bold text-primary-foreground">Mesa de VAR - Repeticiones</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Herramientas de Video</CardTitle>
                </CardHeader>
                 <CardContent className="flex flex-col sm:flex-row items-start gap-4">
                     <div>
                        <Label>Sincronización Automática</Label>
                         <div className="flex items-center gap-2">
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full sm:w-auto justify-start text-left font-normal", !syncDate && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {syncDate ? format(syncDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={syncDate} onSelect={(date) => date && setSyncDate(date)} initialFocus locale={es} />
                                </PopoverContent>
                            </Popover>
                            <Button onClick={() => setIsSyncActive(!isSyncActive)} variant={isSyncActive ? 'destructive' : 'default'} disabled={!replaySettings?.syncUrl}>
                                {isSyncActive ? "Detener Sync" : "Iniciar Sync"}
                            </Button>
                        </div>
                     </div>
                      <div className="sm:border-l sm:pl-4">
                        <Label>Descarga Manual</Label>
                        <div className="flex items-center gap-2">
                            <Button onClick={() => setIsManualDownloadOpen(true)}>
                                <Download className="mr-2 h-4 w-4" /> Descarga Manual
                            </Button>
                        </div>
                     </div>
                </CardContent>
            </Card>
            
            {isSyncActive && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center justify-between">
                            Nuevas Repeticiones Disponibles ({newReplays.length})
                            {firebaseError && <span className="text-xs font-normal text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4"/> {firebaseError}</span>}
                        </CardTitle>
                    </CardHeader>
                    {newReplays.length > 0 && (
                        <CardContent>
                            <ScrollArea className="h-40 pr-3">
                                <Accordion type="multiple" className="w-full">
                                    {Object.entries(newReplaysGroupedByMatch).map(([matchName, replays]) => (
                                        <AccordionItem value={matchName} key={matchName}>
                                            <AccordionTrigger className="text-sm font-semibold">
                                                <div className="flex items-center gap-2">
                                                    <Folder className="h-4 w-4" />
                                                    <span>{matchName} ({replays.length})</span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-1 pl-4">
                                                    {replays.map(replay => (
                                                        <button 
                                                            key={replay.id} 
                                                            className="text-sm text-left text-muted-foreground truncate hover:text-foreground w-full flex items-center gap-2"
                                                            onClick={() => handleCopyToClipboard(replay.url, 'URL de descarga')}
                                                        >
                                                            <Copy className="h-3 w-3 shrink-0" />
                                                            <span>{decodeURIComponent(replay.filename)}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </ScrollArea>
                             <Button onClick={handleMassDownload} disabled={isMassDownloading} className="mt-4 w-full">
                                {isMassDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                Descargar {newReplays.length} Videos Nuevos
                            </Button>
                        </CardContent>
                    )}
                 </Card>
            )}

            <div className="flex-grow grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                <Card className="col-span-1 flex flex-col">
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2"><ListVideo className="h-5 w-5"/> Videos Descargados</CardTitle>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchReplays} disabled={status === 'loading'}>
                            <RefreshCw className={cn("h-4 w-4", status === 'loading' && "animate-spin")} />
                        </Button>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-hidden">
                        <ScrollArea className="h-full pr-3">
                            {status === 'loading' && <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/></div>}
                            {status === 'error' && <div className="text-destructive text-center p-4">{error}</div>}
                            {status === 'success' && (
                                Object.keys(localFilesGroupedByMatch).length > 0 ? (
                                     <Accordion type="multiple" className="w-full">
                                        {Object.entries(localFilesGroupedByMatch).map(([matchName, files]) => (
                                            <AccordionItem value={matchName} key={matchName}>
                                                <AccordionTrigger className="text-sm font-semibold">
                                                    <div className="flex items-center gap-2">
                                                        <Folder className="h-4 w-4" />
                                                        <span>{matchName} ({files.length})</span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="space-y-1 pl-4">
                                                        {files.map(file => (
                                                            <Button
                                                                key={file}
                                                                variant={selectedReplay === file ? 'secondary' : 'ghost'}
                                                                className="w-full justify-start text-left h-auto py-1"
                                                                onClick={() => handleSelectReplay(file)}
                                                            >
                                                                <span className="truncate text-xs">{file.split('/').pop()}</span>
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                ) : (
                                    <div className="text-center text-muted-foreground py-10">No hay repeticiones descargadas para la fecha seleccionada.</div>
                                )
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col bg-black">
                     <div className="flex-grow relative">
                        {selectedReplay ? (
                            <video
                                ref={videoRef}
                                key={selectedReplay}
                                className="w-full h-full object-contain"
                                controls
                                autoPlay
                                onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0; }}
                            >
                                <source src={`/api/replays/${selectedReplay}`} type="video/mp4" />
                                Tu navegador no soporta el tag de video.
                            </video>
                        ) : (
                            <div className="text-center text-muted-foreground p-8 flex flex-col items-center justify-center h-full">
                                <Video className="h-24 w-24 mx-auto mb-4" />
                                <p className="text-lg">Selecciona un video de la lista para reproducirlo.</p>
                            </div>
                        )}
                     </div>
                     <div className="p-4 border-t border-border/20 flex items-center gap-4">
                        <Button onClick={handleShowOnScoreboard} disabled={!selectedReplay}>
                            <Play className="mr-2 h-4 w-4" /> Mostrar en Scoreboard
                        </Button>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="startTime" className="whitespace-nowrap">desde el segundo:</Label>
                            <Input
                                id="startTime"
                                type="text"
                                value={startTimeSeconds === null || startTimeSeconds === undefined ? '' : startTimeSeconds.toString()}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '') {
                                        setStartTimeSeconds(null as any); // Allow empty temporarily
                                        return;
                                    }
                                    const num = parseInt(value, 10);
                                    if (!isNaN(num) && num >= 0) {
                                        setStartTimeSeconds(num);
                                    }
                                }}
                                onBlur={(e) => {
                                    if (e.target.value === '') {
                                        setStartTimeSeconds(0); // Default to 0 if empty
                                    }
                                }}
                                placeholder="0"
                                className="w-16 text-center"
                            />
                        </div>
                    </div>
                </Card>
            </div>
             <Dialog open={isManualDownloadOpen} onOpenChange={setIsManualDownloadOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Descarga Manual de Video</DialogTitle>
                        <DialogDescription>
                            Pega la URL del video que deseas descargar. Se guardará en una carpeta con la fecha y nombre de partido que indiques.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="manualUrl">URL del Video</Label>
                          <Input 
                              id="manualUrl"
                              value={videoUrl}
                              onChange={(e) => {
                                  setVideoUrl(e.target.value);
                                  setDownloadStatus('idle');
                              }}
                              placeholder="https://example.com/video.mp4"
                          />
                        </div>
                        <div className="space-y-2">
                           <Label htmlFor="manualMatchName">Nombre del Partido</Label>
                           <Input 
                                id="manualMatchName"
                                value={manualMatchName}
                                onChange={(e) => setManualMatchName(e.target.value)}
                                placeholder="Ej: Equipo A vs Equipo B"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button onClick={handleManualDownload} disabled={downloadStatus === 'downloading' || !videoUrl || !manualMatchName}>
                            {downloadStatus === 'downloading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Descargar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
