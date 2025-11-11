"use client";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, ShieldAlert, LogIn, SlidersHorizontal, Info, MessageSquare, CalendarCheck, Clapperboard, Download, Cloud, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from "@/hooks/use-auth";
import { HockeyPuckSpinner } from "@/components/ui/hockey-puck-spinner";
import { useRouter } from "next/navigation";
import { useGameState } from "@/contexts/game-state-context";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { sendRemoteCommand } from '@/app/actions';
import { cn } from "@/lib/utils";


function PerformanceSettingsCard() {
    const { state, dispatch, isLoading } = useGameState();
    const { toast } = useToast();
    const [tickInterval, setTickInterval] = useState(String(state.config.tickIntervalMs || 200));

    const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTickInterval(e.target.value);
    };

    const handleIntervalBlur = () => {
        let value = parseInt(tickInterval, 10);
        if (isNaN(value) || value < 100) {
            value = 100;
            toast({
                title: "Valor Inválido",
                description: "El intervalo mínimo es 100ms. Se ha establecido a 100ms.",
                variant: "destructive",
            });
        }
        setTickInterval(String(value));
        dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: { tickIntervalMs: value } });
        toast({
            title: "Configuración Actualizada",
            description: `El intervalo del reloj se ha establecido a ${value}ms.`
        });
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Configuración de Rendimiento</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Cargando...</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5" /> Configuración de Rendimiento
                </CardTitle>
                <CardDescription>
                    Ajustes que pueden afectar la performance y la precisión de la aplicación.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="tickInterval" className="text-base">Intervalo de Actualización del Reloj (ms)</Label>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="max-w-xs">Define cada cuántos milisegundos se actualiza el reloj principal. Un valor más bajo es más preciso pero consume más recursos. Un valor más alto es menos preciso pero más ligero. Mínimo: 100ms.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                  </div>
                   <Input
                        id="tickInterval"
                        type="number"
                        value={tickInterval}
                        onChange={handleIntervalChange}
                        onBlur={handleIntervalBlur}
                        placeholder="ej. 200"
                        min="100"
                        className="w-40 mt-2"
                    />
                </div>
            </CardContent>
        </Card>
    )
}

function MatchStatusCard() {
    const { state, isLoading } = useGameState();

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Estado del Partido Actual</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Cargando...</p>
                </CardContent>
            </Card>
        )
    }

    const matchId = state.live?.matchId;
    const playedPeriods = state.live?.playedPeriods || [];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CalendarCheck className="h-5 w-5" /> Estado del Partido (Test)
                </CardTitle>
                <CardDescription>
                    Información de debug sobre el partido actual en juego.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {matchId ? (
                    <div>
                        <p className="text-sm font-semibold text-green-400">Partido del Fixture Activo:</p>
                        <p className="text-xs font-mono text-muted-foreground mt-1 bg-muted p-2 rounded-md">{matchId}</p>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">No hay un partido del fixture activo.</p>
                )}
                 <div>
                    <p className="text-sm font-semibold text-blue-400">Períodos Jugados Registrados:</p>
                    <p className="text-xs font-mono text-muted-foreground mt-1 bg-muted p-2 rounded-md">
                        {playedPeriods.length > 0 ? playedPeriods.join(', ') : 'Ninguno'}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

function SupabaseSyncCard() {
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSyncFromSupabase = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch('/api/sync-from-supabase', {
                method: 'POST'
            });

            const data = await response.json();

            if (response.ok && data.success) {
                console.log('[SUPABASE-SYNC] Response data:', data);
                console.log('[SUPABASE-SYNC] Files saved to:', data.localStorageDir);
                console.log('[SUPABASE-SYNC] Downloaded files:', data.filesList);

                toast({
                    title: "✅ Sincronización Completada",
                    description: `Se descargaron ${data.filesDownloaded} de ${data.totalFiles} archivos desde Supabase a: ${data.localStorageDir}`,
                    className: "bg-green-600 text-white border-green-700",
                    duration: 10000,
                });

                if (data.errors && data.errors.length > 0) {
                    console.error('Errores durante la sincronización:', data.errors);
                    toast({
                        title: "⚠️ Algunos archivos fallaron",
                        description: `${data.errors.length} archivos tuvieron errores. Ver consola para detalles.`,
                        variant: "destructive",
                    });
                }
            } else {
                throw new Error(data.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('Error syncing from Supabase:', error);
            toast({
                title: "❌ Error de Sincronización",
                description: error instanceof Error ? error.message : "No se pudo sincronizar desde Supabase",
                variant: "destructive",
            });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <Card className="bg-purple-500/10 border-purple-500/30">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-600">
                    <Cloud className="h-5 w-5" /> Sincronización desde Supabase
                </CardTitle>
                <CardDescription>
                    Descargar y sobreescribir el almacenamiento local con los datos de Supabase Storage.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="text-sm text-purple-800 dark:text-purple-200 font-semibold mb-2">
                        ⚠️ Descarga desde Supabase
                    </p>
                    <p className="text-xs text-purple-700 dark:text-purple-300">
                        Esta operación descargará todos los archivos desde Supabase Storage y los guardará localmente,
                        <strong> sobreescribiendo</strong> los archivos existentes en tu almacenamiento local.
                    </p>
                </div>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            disabled={isSyncing}
                            className="w-full bg-purple-600 hover:bg-purple-700"
                        >
                            {isSyncing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Descargando desde Supabase...
                                </>
                            ) : (
                                <>
                                    <Download className="mr-2 h-4 w-4" />
                                    <Cloud className="mr-2 h-4 w-4" />
                                    Descargar y Sobreescribir desde Supabase
                                </>
                            )}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>⚠️ Confirmar Sincronización desde Supabase</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción descargará todos los archivos desde Supabase Storage y <strong>sobreescribirá</strong> los archivos locales existentes.
                                Los datos actuales en tu almacenamiento local serán reemplazados. ¿Estás seguro de que quieres continuar?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSyncFromSupabase} className="bg-purple-600 hover:bg-purple-700">
                                Sí, Descargar y Sobreescribir
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}


export default function AdminPage() {
  const { toast } = useToast();
  const { authStatus } = useAuth();
  const { dispatch } = useGameState();
  const router = useRouter();

  const handleClearConfigOnly = () => {
    dispatch({ type: 'RESET_CONFIG_TO_DEFAULTS' });
    toast({
      title: "Configuración Restablecida",
      description: "Se han restablecido los perfiles y configuraciones. Los equipos se mantienen.",
    });
  };

  const handleClearAllData = () => {
    dispatch({ type: 'RESET_CONFIG_TO_DEFAULTS' });
    if (typeof localStorage !== 'undefined') {
        localStorage.clear();
    }
    toast({
      title: "Todos los Datos Eliminados",
      description: "Se ha limpiado toda la configuración, equipos y caché. La página se recargará.",
      variant: 'destructive',
    });
    setTimeout(() => window.location.reload(), 1500);
  }

  if (authStatus === 'loading') {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
        <HockeyPuckSpinner className="h-12 w-12 text-primary mb-4" />
        <p className="text-xl text-foreground">Verificando acceso...</p>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    router.replace('/mobile-controls/login');
    return (
       <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive-foreground">Acceso Denegado</h1>
        <p className="text-muted-foreground mt-2">No tienes permisos para ver esta página. Redirigiendo al login...</p>
        <Button onClick={() => router.push('/mobile-controls/login')} className="mt-4">
            <LogIn className="mr-2 h-4 w-4" /> Ir a Login
        </Button>
      </div>
    );
  }


  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 py-10">
        <div className="text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-primary" />
            <h1 className="text-3xl font-bold">Panel de Administración</h1>
            <p className="text-muted-foreground mt-2">Herramientas para la gestión avanzada de la aplicación.</p>
        </div>
        
        <Card>
            <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                    <Clapperboard className="h-5 w-5" /> Herramientas de Overlays
                </CardTitle>
                <CardDescription>
                    Controla mensajes en el scoreboard. La gestión de repeticiones se ha movido a la página de "Replays (VAR)".
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant="secondary" onClick={() => sendRemoteCommand({ type: 'SHOW_OVERLAY_MESSAGE', payload: { text: "Valentino Caffe", duration: 5000 } })}>
                    <MessageSquare className="mr-2 h-4 w-4" /> Mostrar Overlay de Prueba
                </Button>
            </CardContent>
        </Card>

        <MatchStatusCard />

        <PerformanceSettingsCard />

        <SupabaseSyncCard />

        <Card className="bg-destructive/10 border-destructive/30">
            <CardHeader>
                <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
                <CardDescription className="text-destructive/80">
                    Las acciones en esta sección son irreversibles y pueden causar la pérdida de datos. Úsalas con precaución.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="bg-amber-600 hover:bg-amber-700 border-amber-500 text-white">
                              <Trash2 className="mr-2 h-4 w-4" /> Limpiar Configuración (Mantener Equipos)
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar Limpieza de Configuración</AlertDialogTitle>
                          <AlertDialogDescription>
                              Esta acción eliminará la configuración de perfiles, sonido, display, etc. <strong>Tus equipos y jugadores guardados NO serán eliminados.</strong> ¿Estás seguro de que quieres continuar?
                          </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearConfigOnly} className="bg-amber-600 hover:bg-amber-700">
                              Sí, Limpiar Configuración
                          </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                  <p className="text-xs text-amber-500/80 mt-2">
                      Opción segura: Borra los perfiles de configuración, pero no tus equipos.
                  </p>
                </div>
                
                <div>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Limpiar TODO (Incluyendo Equipos)
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                          <AlertDialogTitle>¡Confirmación Final!</AlertDialogTitle>
                          <AlertDialogDescription>
                              Esta acción eliminará permanentemente TODA la configuración, TODOS los equipos y jugadores guardados y la caché del navegador. Esta acción es irreversible. ¿Estás seguro de que quieres borrar absolutamente todo?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearAllData} className="bg-destructive hover:bg-destructive/90">
                              Sí, Borrar Todo
                          </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                  <p className="text-xs text-destructive/80 mt-2">
                      Opción nuclear: Borra todo. No habrá vuelta atrás.
                  </p>
                </div>

            </CardContent>
        </Card>
    </div>
  );
}
