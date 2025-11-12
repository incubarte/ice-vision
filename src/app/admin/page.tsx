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
import { Trash2, ShieldAlert, LogIn, SlidersHorizontal, Info, MessageSquare, CalendarCheck, Clapperboard, Download, Cloud, Loader2, RefreshCw, FileSearch, Bug, RefreshCcw, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from "@/hooks/use-auth";
import { HockeyPuckSpinner } from "@/components/ui/hockey-puck-spinner";
import { useRouter } from "next/navigation";
import { useGameState } from "@/contexts/game-state-context";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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

function SyncAnalysisCard() {
    const { toast } = useToast();
    const { state, dispatch } = useGameState();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [analysis, setAnalysis] = useState<any>(null);
    const [selectedConflict, setSelectedConflict] = useState<any>(null);

    // Auto-sync configuration states
    const [autoAnalysisEnabled, setAutoAnalysisEnabled] = useState((state.config.autoSyncAnalysisIntervalMinutes || 0) > 0);
    const [autoAnalysisInterval, setAutoAnalysisInterval] = useState(state.config.autoSyncAnalysisIntervalMinutes || 5);
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(state.config.autoSyncEnabled || false);
    const [autoResolveConflicts, setAutoResolveConflicts] = useState(state.config.autoSyncResolveConflicts || false);
    const [skipSyncDuringMatch, setSkipSyncDuringMatch] = useState(state.config.autoSyncSkipDuringMatch ?? true);
    const [syncAfterMatch, setSyncAfterMatch] = useState(state.config.autoSyncAfterMatch || false);
    const [syncAfterSummaryEdit, setSyncAfterSummaryEdit] = useState(state.config.autoSyncAfterSummaryEdit || false);

    // Handlers for auto-sync config changes
    const handleAutoAnalysisEnabledChange = (checked: boolean) => {
        setAutoAnalysisEnabled(checked);
        // When enabling, use the interval value; when disabling, set to 0
        const intervalValue = checked ? autoAnalysisInterval : 0;
        dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: { autoSyncAnalysisIntervalMinutes: intervalValue } });

        // If disabling, also disable dependent features
        if (!checked) {
            setAutoSyncEnabled(false);
            setSkipSyncDuringMatch(true);
            dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: {
                autoSyncEnabled: false,
                autoSyncSkipDuringMatch: true
            }});
        }
    };

    const handleAutoAnalysisIntervalChange = (value: number) => {
        setAutoAnalysisInterval(value);
        // Only update if auto-analysis is enabled
        if (autoAnalysisEnabled) {
            dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: { autoSyncAnalysisIntervalMinutes: value } });
        }
    };

    const handleAutoSyncEnabledChange = (checked: boolean) => {
        setAutoSyncEnabled(checked);
        dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: { autoSyncEnabled: checked } });
    };

    const handleAutoResolveConflictsChange = (checked: boolean) => {
        setAutoResolveConflicts(checked);
        dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: { autoSyncResolveConflicts: checked } });
    };

    const handleSkipSyncDuringMatchChange = (checked: boolean) => {
        setSkipSyncDuringMatch(checked);
        dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: { autoSyncSkipDuringMatch: checked } });
    };

    const handleSyncAfterMatchChange = (checked: boolean) => {
        setSyncAfterMatch(checked);
        dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: { autoSyncAfterMatch: checked } });
    };

    const handleSyncAfterSummaryEditChange = (checked: boolean) => {
        setSyncAfterSummaryEdit(checked);
        dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: { autoSyncAfterSummaryEdit: checked } });
    };

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        setAnalysis(null);
        try {
            const response = await fetch('/api/sync/analyze');
            const data = await response.json();

            if (response.ok && data.success) {
                setAnalysis(data.analysis);
                toast({
                    title: "✅ Análisis Completado",
                    description: data.message,
                    className: "bg-green-600 text-white border-green-700",
                });
            } else {
                throw new Error(data.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('Error analyzing sync:', error);
            toast({
                title: "❌ Error de Análisis",
                description: error instanceof Error ? error.message : "No se pudo analizar la sincronización",
                variant: "destructive",
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleExecuteSync = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch('/api/sync/execute', {
                method: 'POST'
            });
            const data = await response.json();

            if (response.ok && data.result) {
                const { result } = data;
                const totalSynced = result.filesUploaded + result.filesDownloaded + result.conflictsResolved;

                // Show success if at least some files were synced
                if (totalSynced > 0) {
                    toast({
                        title: "✅ Sincronización Completada",
                        description: data.message,
                        className: "bg-green-600 text-white border-green-700",
                        duration: 5000,
                    });
                }

                // Show errors if any
                if (result.errors && result.errors.length > 0) {
                    toast({
                        title: `⚠️ ${result.errors.length} Error(es) Durante Sync`,
                        description: result.errors.map((e: any) => `${e.filePath}: ${e.error}`).join('\n').substring(0, 200),
                        variant: "destructive",
                        duration: 10000,
                    });
                }

                // Show backup path if conflicts were resolved
                if (result.backupPath) {
                    toast({
                        title: "📦 Archivos en Conflicto Respaldados",
                        description: `Versiones remotas guardadas en: ${result.backupPath}`,
                        className: "bg-yellow-600 text-white border-yellow-700",
                        duration: 8000,
                    });
                }

                // Reload page to refresh context if files were downloaded
                if (result.filesDownloaded > 0) {
                    setTimeout(() => {
                        if (typeof window !== 'undefined') {
                            if (typeof localStorage !== 'undefined') {
                                const keysToKeep = ['auth-token'];
                                const allKeys = Object.keys(localStorage);
                                allKeys.forEach(key => {
                                    if (!keysToKeep.includes(key)) {
                                        localStorage.removeItem(key);
                                    }
                                });
                            }
                            const currentUrl = new URL(window.location.href);
                            currentUrl.searchParams.set('_t', Date.now().toString());
                            window.location.href = currentUrl.toString();
                        }
                    }, 2000);
                }

                // Re-analyze to show updated state
                setTimeout(() => handleAnalyze(), 500);

            } else {
                throw new Error(data.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('Error executing sync:', error);
            toast({
                title: "❌ Error de Sincronización",
                description: error instanceof Error ? error.message : "No se pudo ejecutar la sincronización",
                variant: "destructive",
            });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <Card className="bg-blue-500/10 border-blue-500/30">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600">
                    <RefreshCcw className="h-5 w-5" /> Sincronización Normal
                </CardTitle>
                <CardDescription>
                    Analiza y sincroniza archivos entre local y Supabase. Resuelve conflictos según la estrategia configurada (por defecto: local gana).
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Auto-Sync Configuration */}
                <div className="bg-muted/50 p-4 rounded-lg border space-y-4">
                    <h4 className="font-semibold text-sm">⚙️ Configuración de Sync Automático</h4>

                    {/* Activar análisis automático */}
                    <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5 flex-1">
                            <Label htmlFor="auto-analysis-enabled" className="text-xs">
                                Análisis Automático
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Analizar diferencias automáticamente cada cierto intervalo
                            </p>
                        </div>
                        <Switch
                            id="auto-analysis-enabled"
                            checked={autoAnalysisEnabled}
                            onCheckedChange={handleAutoAnalysisEnabledChange}
                        />
                    </div>

                    {/* Intervalo de análisis */}
                    {autoAnalysisEnabled && (
                        <div className="flex items-center justify-between space-x-4 pl-4 border-l-2">
                            <div className="space-y-0.5 flex-1">
                                <Label htmlFor="auto-analysis-interval" className="text-xs">
                                    Intervalo (minutos)
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Cada cuántos minutos analizar
                                </p>
                            </div>
                            <Input
                                id="auto-analysis-interval"
                                type="number"
                                min="1"
                                placeholder="5"
                                className="h-8 text-sm w-20"
                                value={autoAnalysisInterval}
                                onChange={(e) => handleAutoAnalysisIntervalChange(parseInt(e.target.value) || 1)}
                            />
                        </div>
                    )}

                    {/* Sync automático */}
                    {autoAnalysisEnabled && (
                        <div className="flex items-center justify-between space-x-2 pl-4 border-l-2">
                            <div className="space-y-0.5">
                                <Label htmlFor="auto-sync-enabled" className="text-xs">
                                    Sync Automático
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Ejecutar sync automáticamente tras análisis (si hay cambios)
                                </p>
                            </div>
                            <Switch
                                id="auto-sync-enabled"
                                checked={autoSyncEnabled}
                                onCheckedChange={handleAutoSyncEnabledChange}
                            />
                        </div>
                    )}

                    {/* Evitar sync durante partido */}
                    {autoAnalysisEnabled && (
                        <div className="flex items-center justify-between space-x-2 pl-4 border-l-2">
                            <div className="space-y-0.5">
                                <Label htmlFor="skip-sync-during-match" className="text-xs">
                                    Evitar Sync Durante Partido
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    No ejecutar sync automático si hay un partido en curso
                                </p>
                            </div>
                            <Switch
                                id="skip-sync-during-match"
                                checked={skipSyncDuringMatch}
                                onCheckedChange={handleSkipSyncDuringMatchChange}
                            />
                        </div>
                    )}

                    {/* Resolver conflictos automáticamente */}
                    <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5">
                            <Label htmlFor="auto-resolve-conflicts" className="text-xs">
                                Resolver Conflictos Automáticamente
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Sincronizar incluso si hay conflictos (local gana)
                            </p>
                        </div>
                        <Switch
                            id="auto-resolve-conflicts"
                            checked={autoResolveConflicts}
                            onCheckedChange={handleAutoResolveConflictsChange}
                        />
                    </div>

                    {/* Sync tras partido finalizado */}
                    <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5">
                            <Label htmlFor="sync-after-match" className="text-xs">
                                Sync Tras Partido Finalizado
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Ejecutar sync automáticamente cuando un partido finaliza
                            </p>
                        </div>
                        <Switch
                            id="sync-after-match"
                            checked={syncAfterMatch}
                            onCheckedChange={handleSyncAfterMatchChange}
                        />
                    </div>

                    {/* Sync tras edición de summary */}
                    <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5">
                            <Label htmlFor="sync-after-summary-edit" className="text-xs">
                                Sync Tras Edición de Summary
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Ejecutar sync automáticamente tras editar un summary
                            </p>
                        </div>
                        <Switch
                            id="sync-after-summary-edit"
                            checked={syncAfterSummaryEdit}
                            onCheckedChange={handleSyncAfterSummaryEditChange}
                        />
                    </div>
                </div>

                <Button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || isSyncing}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                >
                    {isAnalyzing ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Analizando...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Analizar Diferencias
                        </>
                    )}
                </Button>

                {analysis && (
                    <>
                        {/* Show execute button if there are changes to sync */}
                        {(analysis.summary.uploadCount > 0 || analysis.summary.downloadCount > 0 || analysis.summary.conflictCount > 0) && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        disabled={isSyncing}
                                        className="w-full bg-green-600 hover:bg-green-700"
                                    >
                                        {isSyncing ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Sincronizando...
                                            </>
                                        ) : (
                                            <>
                                                <Cloud className="mr-2 h-4 w-4" />
                                                Ejecutar Sincronización
                                            </>
                                        )}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>⚠️ Confirmar Sincronización</AlertDialogTitle>
                                        <AlertDialogDescription asChild>
                                            <div>
                                                <p>Esta acción realizará los siguientes cambios:</p>
                                                <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
                                                    {analysis.summary.uploadCount > 0 && (
                                                        <li>Subir {analysis.summary.uploadCount} archivo(s) a Supabase</li>
                                                    )}
                                                    {analysis.summary.downloadCount > 0 && (
                                                        <li>Descargar {analysis.summary.downloadCount} archivo(s) desde Supabase</li>
                                                    )}
                                                    {analysis.summary.conflictCount > 0 && (
                                                        <li>Resolver {analysis.summary.conflictCount} conflicto(s) - Local gana, remoto se respalda</li>
                                                    )}
                                                </ul>
                                                <p className="mt-2 font-semibold">¿Deseas continuar?</p>
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleExecuteSync}
                                            className="bg-green-600 hover:bg-green-700"
                                        >
                                            Sí, Sincronizar
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </>
                )}

                {analysis && (
                    <div className="mt-4 space-y-3 text-sm">
                        <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                            <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">Resumen:</h4>
                            <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                                <li>📤 <strong>Subir:</strong> {analysis.summary.uploadCount} archivos</li>
                                <li>📥 <strong>Descargar:</strong> {analysis.summary.downloadCount} archivos</li>
                                <li>⚠️ <strong>Conflictos:</strong> {analysis.summary.conflictCount} archivos</li>
                                <li>✅ <strong>Sin cambios:</strong> {analysis.summary.unchangedCount} archivos</li>
                            </ul>
                        </div>

                        {analysis.toUpload.length > 0 && (
                            <details className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg border border-green-200 dark:border-green-800">
                                <summary className="cursor-pointer font-semibold text-green-800 dark:text-green-200">
                                    📤 Para Subir ({analysis.toUpload.length})
                                </summary>
                                <ul className="mt-2 space-y-1 text-xs font-mono max-h-40 overflow-y-auto text-green-700 dark:text-green-300">
                                    {analysis.toUpload.map((item: any) => (
                                        <li key={item.filePath} title={item.reason}>
                                            {item.filePath}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        )}

                        {analysis.toDownload.length > 0 && (
                            <details className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                                <summary className="cursor-pointer font-semibold text-blue-800 dark:text-blue-200">
                                    📥 Para Descargar ({analysis.toDownload.length})
                                </summary>
                                <ul className="mt-2 space-y-1 text-xs font-mono max-h-40 overflow-y-auto text-blue-700 dark:text-blue-300">
                                    {analysis.toDownload.map((item: any) => (
                                        <li key={item.filePath} title={item.reason}>
                                            {item.filePath}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        )}

                        {analysis.conflicts.length > 0 && (
                            <details className="bg-yellow-50 dark:bg-yellow-950/30 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                <summary className="cursor-pointer font-semibold text-yellow-800 dark:text-yellow-200">
                                    ⚠️ Conflictos ({analysis.conflicts.length})
                                </summary>
                                <ul className="mt-2 space-y-1 text-xs font-mono max-h-40 overflow-y-auto text-yellow-700 dark:text-yellow-300">
                                    {analysis.conflicts.map((item: any) => (
                                        <li
                                            key={item.filePath}
                                            title="Click para ver detalles"
                                            className="cursor-pointer hover:underline hover:text-yellow-600 dark:hover:text-yellow-400"
                                            onClick={() => setSelectedConflict(item)}
                                        >
                                            {item.filePath} - Local gana
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        )}

                        {/* Conflict Details Dialog */}
                        <AlertDialog open={!!selectedConflict} onOpenChange={(open) => !open && setSelectedConflict(null)}>
                            <AlertDialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-yellow-600">
                                        ⚠️ Conflicto: {selectedConflict?.filePath}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription asChild>
                                        <div>
                                            <p className="mb-4 text-yellow-700 dark:text-yellow-300">
                                                Ambas versiones han cambiado desde la última sincronización. La versión local ganará y la remota se respaldará.
                                            </p>

                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Local Version */}
                                                <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
                                                    <h4 className="font-semibold mb-3 text-green-800 dark:text-green-200 flex items-center gap-2">
                                                        <span className="text-lg">💻</span> Versión Local (Gana)
                                                    </h4>
                                                    {selectedConflict?.localVersion && (
                                                        <dl className="space-y-2 text-sm">
                                                            <div>
                                                                <dt className="font-semibold text-green-700 dark:text-green-300">Hash:</dt>
                                                                <dd className="font-mono text-xs text-green-600 dark:text-green-400 break-all">
                                                                    {selectedConflict.localVersion.hash}
                                                                </dd>
                                                            </div>
                                                            <div>
                                                                <dt className="font-semibold text-green-700 dark:text-green-300">Última modificación:</dt>
                                                                <dd className="text-green-600 dark:text-green-400">
                                                                    {new Date(selectedConflict.localVersion.lastModified).toLocaleString()}
                                                                </dd>
                                                            </div>
                                                            <div>
                                                                <dt className="font-semibold text-green-700 dark:text-green-300">Tamaño:</dt>
                                                                <dd className="text-green-600 dark:text-green-400">
                                                                    {selectedConflict.localVersion.size} bytes
                                                                </dd>
                                                            </div>
                                                            {selectedConflict.localVersion.previousVersion && (
                                                                <div className="mt-3 pt-3 border-t border-green-300 dark:border-green-700">
                                                                    <dt className="font-semibold text-green-700 dark:text-green-300 mb-2">Versión anterior:</dt>
                                                                    <dd className="text-xs space-y-1">
                                                                        <div>
                                                                            <span className="text-green-600 dark:text-green-400">Hash: </span>
                                                                            <span className="font-mono text-green-500 dark:text-green-500 break-all">
                                                                                {selectedConflict.localVersion.previousVersion.hash}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-green-600 dark:text-green-400">
                                                                            Modificado: {new Date(selectedConflict.localVersion.previousVersion.lastModified).toLocaleString()}
                                                                        </div>
                                                                    </dd>
                                                                </div>
                                                            )}
                                                        </dl>
                                                    )}
                                                </div>

                                                {/* Remote Version */}
                                                <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                                                    <h4 className="font-semibold mb-3 text-blue-800 dark:text-blue-200 flex items-center gap-2">
                                                        <span className="text-lg">☁️</span> Versión Remota (Respaldo)
                                                    </h4>
                                                    {selectedConflict?.remoteVersion && (
                                                        <dl className="space-y-2 text-sm">
                                                            <div>
                                                                <dt className="font-semibold text-blue-700 dark:text-blue-300">Hash:</dt>
                                                                <dd className="font-mono text-xs text-blue-600 dark:text-blue-400 break-all">
                                                                    {selectedConflict.remoteVersion.hash}
                                                                </dd>
                                                            </div>
                                                            <div>
                                                                <dt className="font-semibold text-blue-700 dark:text-blue-300">Última modificación:</dt>
                                                                <dd className="text-blue-600 dark:text-blue-400">
                                                                    {new Date(selectedConflict.remoteVersion.lastModified).toLocaleString()}
                                                                </dd>
                                                            </div>
                                                            <div>
                                                                <dt className="font-semibold text-blue-700 dark:text-blue-300">Tamaño:</dt>
                                                                <dd className="text-blue-600 dark:text-blue-400">
                                                                    {selectedConflict.remoteVersion.size} bytes
                                                                </dd>
                                                            </div>
                                                            {selectedConflict.remoteVersion.previousVersion && (
                                                                <div className="mt-3 pt-3 border-t border-blue-300 dark:border-blue-700">
                                                                    <dt className="font-semibold text-blue-700 dark:text-blue-300 mb-2">Versión anterior:</dt>
                                                                    <dd className="text-xs space-y-1">
                                                                        <div>
                                                                            <span className="text-blue-600 dark:text-blue-400">Hash: </span>
                                                                            <span className="font-mono text-blue-500 dark:text-blue-500 break-all">
                                                                                {selectedConflict.remoteVersion.previousVersion.hash}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-blue-600 dark:text-blue-400">
                                                                            Modificado: {new Date(selectedConflict.remoteVersion.previousVersion.lastModified).toLocaleString()}
                                                                        </div>
                                                                    </dd>
                                                                </div>
                                                            )}
                                                        </dl>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cerrar</AlertDialogCancel>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function SyncErrorsCard() {
    const { toast } = useToast();
    const [syncErrors, setSyncErrors] = useState<{ filePath: string; error: string; attempts: number; hasConflict: boolean; conflictDetectedAt?: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);

    // Load errors from manifest
    const loadSyncErrors = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/sync/manifest');
            const data = await response.json();

            if (response.ok && data.manifest) {
                const errors = Object.entries(data.manifest.files || {})
                    .filter(([_, metadata]: [string, any]) => {
                        return metadata.syncAttempts > 0 || metadata.hasConflict === true;
                    })
                    .map(([filePath, metadata]: [string, any]) => ({
                        filePath,
                        error: metadata.lastSyncError || 'Conflicto detectado',
                        attempts: metadata.syncAttempts || 0,
                        hasConflict: metadata.hasConflict || false,
                        conflictDetectedAt: metadata.conflictDetectedAt
                    }));

                setSyncErrors(errors);
            }
        } catch (error) {
            console.error('Error loading sync errors:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Load errors on mount and poll every 10 seconds
    useEffect(() => {
        loadSyncErrors();

        // Poll every 10 seconds to catch new errors/conflicts
        const interval = setInterval(() => {
            loadSyncErrors();
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    const handleRetrySync = async () => {
        setIsRetrying(true);
        try {
            // Trigger a full analysis and sync
            const response = await fetch('/api/sync/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy: 'local-wins',
                    sessionId: Math.random().toString(36).substring(7)
                })
            });

            const data = await response.json();

            if (response.ok) {
                toast({
                    title: "✅ Sync Completado",
                    description: `Se sincronizaron ${data.filesUploaded + data.filesDownloaded + data.conflictsResolved} archivos.`,
                    className: "bg-green-600 text-white border-green-700",
                });

                // Reload errors
                setTimeout(() => loadSyncErrors(), 500);
            } else {
                throw new Error(data.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('Error retrying sync:', error);
            toast({
                title: "❌ Error en Sync",
                description: error instanceof Error ? error.message : "No se pudo reintentar la sincronización",
                variant: "destructive",
            });
        } finally {
            setIsRetrying(false);
        }
    };

    const handleClearErrors = async () => {
        try {
            const response = await fetch('/api/sync/manifest');
            const data = await response.json();

            if (response.ok && data.manifest) {
                // Clear error flags from manifest
                const updatedFiles = { ...data.manifest.files };
                Object.keys(updatedFiles).forEach(filePath => {
                    delete updatedFiles[filePath].syncAttempts;
                    delete updatedFiles[filePath].lastSyncError;
                    delete updatedFiles[filePath].hasConflict;
                    delete updatedFiles[filePath].conflictDetectedAt;
                });

                const updateResponse = await fetch('/api/sync/manifest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        manifest: {
                            ...data.manifest,
                            files: updatedFiles
                        }
                    })
                });

                if (updateResponse.ok) {
                    toast({
                        title: "✅ Errores Limpiados",
                        description: "Se limpiaron todos los errores del manifest.",
                    });
                    loadSyncErrors();
                } else {
                    throw new Error('Error updating manifest');
                }
            }
        } catch (error) {
            console.error('Error clearing errors:', error);
            toast({
                title: "❌ Error",
                description: "No se pudieron limpiar los errores",
                variant: "destructive",
            });
        }
    };

    if (isLoading) {
        return (
            <Card className="bg-amber-500/10 border-amber-500/30">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="h-5 w-5" /> Errores de Sincronización
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando errores...
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (syncErrors.length === 0) {
        return (
            <Card className="bg-green-500/10 border-green-500/30">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-600">
                        <AlertTriangle className="h-5 w-5" /> Errores de Sincronización
                    </CardTitle>
                    <CardDescription>
                        Archivos con errores de sync o conflictos pendientes
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-4">
                        <p className="text-sm text-green-600 font-semibold">✅ No hay errores de sincronización</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Todos los archivos están sincronizados correctamente
                        </p>
                    </div>
                    <div className="flex justify-center pt-2 border-t mt-4">
                        <Button
                            onClick={() => loadSyncErrors()}
                            variant="outline"
                            size="sm"
                        >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Actualizar
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-amber-500/10 border-amber-500/30">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-5 w-5" /> Errores de Sincronización
                </CardTitle>
                <CardDescription>
                    Archivos con errores de sync o conflictos pendientes ({syncErrors.length})
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Error list */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {syncErrors.map((error) => (
                        <div
                            key={error.filePath}
                            className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-mono text-amber-900 dark:text-amber-100 truncate">
                                        {error.filePath}
                                    </p>
                                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                        {error.hasConflict ? (
                                            <>
                                                <strong>Conflicto detectado</strong>
                                                {error.conflictDetectedAt && (
                                                    <> - {new Date(error.conflictDetectedAt).toLocaleString()}</>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                {error.error}
                                            </>
                                        )}
                                    </p>
                                    {error.attempts > 0 && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                            Intentos fallidos: {error.attempts}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                    <Button
                        onClick={handleRetrySync}
                        disabled={isRetrying}
                        className="flex-1"
                        variant="default"
                    >
                        {isRetrying ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Reintentando...
                            </>
                        ) : (
                            <>
                                <RefreshCcw className="mr-2 h-4 w-4" />
                                Reintentar Sync
                            </>
                        )}
                    </Button>
                    <Button
                        onClick={handleClearErrors}
                        disabled={isRetrying}
                        variant="outline"
                    >
                        Limpiar Errores
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function SupabaseSyncCard() {
    const { toast } = useToast();
    const [isSyncingConfig, setIsSyncingConfig] = useState(false);
    const [isSyncingAll, setIsSyncingAll] = useState(false);
    const [isRegeneratingManifest, setIsRegeneratingManifest] = useState(false);

    const handleDownloadConfigAndLive = async () => {
        setIsSyncingConfig(true);
        try {
            const response = await fetch('/api/sync-from-supabase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: Math.random().toString(36).substring(7),
                    excludeTournaments: true // Download ONLY config.json and live.json
                })
            });

            const data = await response.json();

            if (response.ok) {
                toast({
                    title: "✅ Descarga Completada",
                    description: `Se descargaron ${data.filesDownloaded} archivos desde Supabase. La página se recargará.`,
                    className: "bg-green-600 text-white border-green-700",
                    duration: 3000,
                });

                if (data.errors && data.errors.length > 0) {
                    toast({
                        title: "⚠️ Algunos archivos fallaron",
                        description: `${data.errors.length} errores. Ver consola.`,
                        variant: "destructive",
                        duration: 3000,
                    });
                }

                // Reload after download
                setTimeout(() => {
                    if (typeof window !== 'undefined') {
                        if (typeof localStorage !== 'undefined') {
                            const keysToKeep = ['auth-token'];
                            const allKeys = Object.keys(localStorage);
                            allKeys.forEach(key => {
                                if (!keysToKeep.includes(key)) {
                                    localStorage.removeItem(key);
                                }
                            });
                        }
                        const currentUrl = new URL(window.location.href);
                        currentUrl.searchParams.set('_t', Date.now().toString());
                        window.location.href = currentUrl.toString();
                    }
                }, 2000);
            } else {
                throw new Error(data.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('Error downloading from Supabase:', error);
            toast({
                title: "❌ Error de Descarga",
                description: error instanceof Error ? error.message : "No se pudo descargar desde Supabase",
                variant: "destructive",
            });
        } finally {
            setIsSyncingConfig(false);
        }
    };

    const handleSyncFromSupabase = async () => {
        setIsSyncingAll(true);
        try {
            const response = await fetch('/api/sync-from-supabase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: Math.random().toString(36).substring(7),
                    excludeTournaments: false // Download tournaments + manifest (exclude config & live)
                })
            });

            const data = await response.json();

            if (response.ok) {
                const filesDownloaded = data.filesDownloaded || 0;

                toast({
                    title: "✅ Descarga Completada",
                    description: `Se descargaron ${filesDownloaded} archivos desde Supabase. La página se recargará.`,
                    className: "bg-green-600 text-white border-green-700",
                    duration: 3000,
                });

                if (data.errors && data.errors.length > 0) {
                    toast({
                        title: "⚠️ Algunos archivos fallaron",
                        description: `${data.errors.length} errores. Ver consola.`,
                        variant: "destructive",
                        duration: 3000,
                    });
                }

                // Reload after download
                setTimeout(() => {
                    if (typeof window !== 'undefined') {
                        if (typeof localStorage !== 'undefined') {
                            const keysToKeep = ['auth-token'];
                            const allKeys = Object.keys(localStorage);
                            allKeys.forEach(key => {
                                if (!keysToKeep.includes(key)) {
                                    localStorage.removeItem(key);
                                }
                            });
                        }
                        const currentUrl = new URL(window.location.href);
                        currentUrl.searchParams.set('_t', Date.now().toString());
                        window.location.href = currentUrl.toString();
                    }
                }, 2000);
            } else {
                throw new Error(data.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('Error downloading from Supabase:', error);
            toast({
                title: "❌ Error de Descarga",
                description: error instanceof Error ? error.message : "No se pudo descargar desde Supabase",
                variant: "destructive",
            });
        } finally {
            setIsSyncingAll(false);
        }
    };

    const handleRegenerateManifest = async () => {
        setIsRegeneratingManifest(true);
        try {
            const response = await fetch('/api/regenerate-manifest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (response.ok) {
                toast({
                    title: "✅ Manifest Regenerado",
                    description: `Se procesaron ${data.totalFiles} archivos. El manifest se regeneró exitosamente.`,
                    className: "bg-green-600 text-white border-green-700",
                    duration: 3000,
                });
            } else {
                throw new Error(data.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('Error regenerating manifest:', error);
            toast({
                title: "❌ Error Regenerando Manifest",
                description: error instanceof Error ? error.message : "No se pudo regenerar el manifest",
                variant: "destructive",
            });
        } finally {
            setIsRegeneratingManifest(false);
        }
    };

    return (
        <Card className="bg-purple-500/10 border-purple-500/30">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-600">
                    <AlertTriangle className="h-5 w-5" /> Override desde Supabase
                </CardTitle>
                <CardDescription>
                    Sobreescribir archivos locales con los de Supabase (remoto siempre gana). Usa con precaución.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="text-sm text-purple-800 dark:text-purple-200 font-semibold mb-2">
                        ⚠️ Override Local con Remoto
                    </p>
                    <p className="text-xs text-purple-700 dark:text-purple-300">
                        Estas operaciones <strong>sobreescribirán</strong> tus archivos locales con los de Supabase.
                        La versión remota siempre ganará, incluso en conflictos. Úsalo solo si estás seguro.
                    </p>
                </div>

                {/* Download only config and live */}
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            disabled={isSyncingConfig || isSyncingAll}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            {isSyncingConfig ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Descargando Config y Live...
                                </>
                            ) : (
                                <>
                                    <Download className="mr-2 h-4 w-4" />
                                    Descargar Solo Config y Live
                                </>
                            )}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>⚠️ Descargar Config y Live</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esto descargará SOLO los archivos <strong>config.json</strong> y <strong>live.json</strong> desde Supabase,
                                sobreescribiendo tus versiones locales. Los datos de torneos NO se modificarán.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDownloadConfigAndLive} className="bg-blue-600 hover:bg-blue-700">
                                Sí, Descargar Config y Live
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Download everything */}
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            disabled={isSyncingConfig || isSyncingAll}
                            className="w-full bg-purple-600 hover:bg-purple-700"
                        >
                            {isSyncingAll ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Descargando Torneos...
                                </>
                            ) : (
                                <>
                                    <Cloud className="mr-2 h-4 w-4" />
                                    Descargar Torneos desde Supabase
                                </>
                            )}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>⚠️ Descargar Torneos desde Supabase</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esto descargará <strong>todos los torneos, partidos y fixtures</strong> desde Supabase Storage y sobreescribirá tus archivos locales.
                                También descargará el manifest remoto. Los archivos config.json y live.json NO se modificarán. ¿Estás seguro?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSyncFromSupabase} className="bg-purple-600 hover:bg-purple-700">
                                Sí, Descargar Torneos
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Regenerate Manifest */}
                <div className="mt-4 pt-4 border-t">
                    <Button
                        onClick={handleRegenerateManifest}
                        disabled={isRegeneratingManifest || isSyncingConfig || isSyncingAll}
                        variant="outline"
                        className="w-full"
                    >
                        {isRegeneratingManifest ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Regenerando Manifest...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Regenerar Manifest Local
                            </>
                        )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                        Regenera el manifest basándose en los archivos actuales en storage local. Útil si descargaste archivos manualmente.
                    </p>
                </div>
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

        <Tabs defaultValue="debug" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="debug" className="flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    Debug
                </TabsTrigger>
                <TabsTrigger value="sync" className="flex items-center gap-2">
                    <RefreshCcw className="h-4 w-4" />
                    Sincronización
                </TabsTrigger>
                <TabsTrigger value="danger" className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Danger Zone
                </TabsTrigger>
            </TabsList>

            {/* DEBUG TAB */}
            <TabsContent value="debug" className="space-y-6 mt-6">
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
            </TabsContent>

            {/* SYNC TAB */}
            <TabsContent value="sync" className="space-y-6 mt-6">
                <SyncAnalysisCard />
                <SyncErrorsCard />
                <SupabaseSyncCard />
            </TabsContent>

            {/* DANGER ZONE TAB */}
            <TabsContent value="danger" className="space-y-6 mt-6">
                <PerformanceSettingsCard />

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
                                            Esta acción eliminará permanentemente TODA la configuración, TODOS los equipos y jugadores guardados y la caché del navegador. Esta acción es irreversible. ¿Estás seguro de que quieres borrar absolutamente todo?
                                        </AlertDialogDescription>
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
            </TabsContent>
        </Tabs>
    </div>
  );
}
