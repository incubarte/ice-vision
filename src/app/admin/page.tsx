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
import { Trash2, ShieldAlert, LogIn, SlidersHorizontal, Info, MessageSquare, CalendarCheck, Clapperboard, Download, Cloud, Loader2, RefreshCw, FileSearch, Bug, RefreshCcw, AlertTriangle, MoreVertical, Undo2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from "@/hooks/use-auth";
import { HockeyPuckSpinner } from "@/components/ui/hockey-puck-spinner";
import { useRouter } from "next/navigation";
import { useGameState } from "@/contexts/game-state-context";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { sendRemoteCommand } from '@/app/actions';
import { cn } from "@/lib/utils";
import type { Tournament } from "@/types";
import { format as formatDate } from "date-fns";
import { es } from "date-fns/locale";
import dynamic from "next/dynamic";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { FolderFileList } from "@/components/sync/folder-file-list";
import { RemoteFileManager } from "@/components/sync/remote-file-manager";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Dynamically import react-diff-viewer to avoid SSR issues
const ReactDiffViewer = dynamic(() => import('react-diff-viewer-continued'), {
    ssr: false,
    loading: () => <p>Cargando comparación...</p>
});

/**
 * Extract match information from a file path
 * Pattern: tournaments/{tournamentId}/summaries/{matchId}.json
 */
function extractMatchInfoFromPath(filePath: string, tournaments: Tournament[]) {
    // Check if it's a summary file
    const summaryMatch = filePath.match(/tournaments\/([^/]+)\/summaries\/([^/]+)\.json/);
    if (!summaryMatch) return null;

    const [, tournamentId, matchId] = summaryMatch;

    // Early return if no tournaments
    if (!tournaments || tournaments.length === 0) {
        // When tournaments are not loaded, we cannot determine if it's outside fixture
        // Return null to avoid false positives
        return null;
    }

    // Find the tournament
    let tournament = tournaments.find(t => t.id === tournamentId);

    // If tournament not found, search all tournaments for the match
    if (!tournament) {
        for (const t of tournaments) {
            if (t.matches?.find(m => m.id === matchId)) {
                tournament = t;
                break;
            }
        }
    }

    // If tournament doesn't exist at all, cannot determine status
    if (!tournament) {
        return null;
    }

    // If tournament exists but doesn't have matches loaded, we cannot determine if it's outside fixture
    // Return null to avoid false positives (matches might exist but just not loaded in this context)
    if (!tournament.matches || tournament.matches.length === 0) {
        return null;
    }

    // Find the match
    const match = tournament.matches.find(m => m.id === matchId);
    if (!match) {
        // Match not found in fixture = outside fixture
        return {
            homeTeam: '?',
            awayTeam: '?',
            category: '?',
            date: '?',
            isOutsideFixture: true,
            tournamentId,
            matchId
        };
    }

    // If tournament doesn't have teams/categories loaded, return null
    if (!tournament.teams || !tournament.categories) return null;

    // Get team names
    const homeTeam = tournament.teams.find(t => t.id === match.homeTeamId);
    const awayTeam = tournament.teams.find(t => t.id === match.awayTeamId);

    // Get category name
    const category = tournament.categories.find(c => c.id === match.categoryId);

    // Format date
    const dateStr = formatDate(new Date(match.date), "dd/MM/yy", { locale: es });

    return {
        homeTeam: homeTeam?.name || '?',
        awayTeam: awayTeam?.name || '?',
        category: category?.name || '?',
        date: dateStr,
        isOutsideFixture: false,
        tournamentId,
        matchId
    };
}

function extractPlayerPhotoInfo(filePath: string, tournaments: Tournament[]) {
    // Check if it's a player photo
    // Pattern: tournaments/{tournamentId}/players/{teamSlug}/{photoFileName}
    const photoMatch = filePath.match(/tournaments\/([^/]+)\/players\/([^/]+)\/([^/]+\.(png|jpg|jpeg|webp))$/i);
    if (!photoMatch) return null;

    const [, tournamentId, teamSlug, photoFileName] = photoMatch;

    // Early return if no tournaments
    if (!tournaments || tournaments.length === 0) return null;

    // Find the tournament
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament || !tournament.teams) {
        // Cannot determine if unreferenced without teams data
        return null;
    }

    // Check if any team references this player photo by photoFileName
    const isReferenced = tournament.teams.some(team =>
        team.players?.some(player => player.photoFileName === photoFileName)
    );

    return { isUnreferenced: !isReferenced, tournamentId, teamSlug, photoFileName };
}

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
    const [isReloadingContext, setIsReloadingContext] = useState(false);
    const [isRegeneratingManifest, setIsRegeneratingManifest] = useState(false);
    const [plan, setPlan] = useState<any>(null);
    const [selectedConflict, setSelectedConflict] = useState<any>(null);
    const [localContent, setLocalContent] = useState<string>('');
    const [remoteContent, setRemoteContent] = useState<string>('');
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [showComparison, setShowComparison] = useState(false);
    const [showMetadata, setShowMetadata] = useState(false);

    // Auto-sync configuration states
    const [autoAnalysisEnabled, setAutoAnalysisEnabled] = useState((state.config.autoSyncAnalysisIntervalMinutes || 0) > 0);
    const [autoAnalysisInterval, setAutoAnalysisInterval] = useState(state.config.autoSyncAnalysisIntervalMinutes || 5);
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(state.config.autoSyncEnabled || false);
    const [autoResolveConflicts, setAutoResolveConflicts] = useState(state.config.autoSyncResolveConflicts || false);
    const [skipSyncDuringMatch, setSkipSyncDuringMatch] = useState(state.config.autoSyncSkipDuringMatch ?? true);
    const [syncAfterSummaryEdit, setSyncAfterSummaryEdit] = useState(state.config.autoSyncAfterSummaryEdit || false);

    // File selection states (for checkboxes)
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

    // Junk files detection
    const [isDetectingJunk, setIsDetectingJunk] = useState(false);
    const [junkFiles, setJunkFiles] = useState<{
        summariesOutsideFixture: string[];
        unreferencedPhotos: string[];
        total: number;
    } | null>(null);

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

    const handleSyncAfterSummaryEditChange = (checked: boolean) => {
        setSyncAfterSummaryEdit(checked);
        dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: { autoSyncAfterSummaryEdit: checked } });
    };

    // Load existing plan on mount
    useEffect(() => {
        const loadExistingPlan = async () => {
            try {
                const response = await fetch('/api/sync/plan');
                if (response.ok) {
                    const data = await response.json();
                    if (data.plan) {
                        setPlan(data.plan);
                        console.log('[Admin] Loaded existing plan:', data.plan.status);
                    }
                }
            } catch (error) {
                // No plan exists, that's fine
                console.log('[Admin] No existing plan found');
            }
        };

        loadExistingPlan();
    }, []);

    // Initialize selected files when plan changes (all selected by default)
    useEffect(() => {
        if (plan) {
            const allFiles = new Set<string>();

            // Add all files from toUpload
            plan.toUpload?.forEach((item: any) => allFiles.add(item.filePath));

            // Add all files from toDownload
            plan.toDownload?.forEach((item: any) => allFiles.add(item.filePath));

            // Add all files from toDeleteLocally
            plan.toDeleteLocally?.forEach((item: any) => allFiles.add(item.filePath));

            // Add all files from toDeleteRemotely
            plan.toDeleteRemotely?.forEach((item: any) => allFiles.add(item.filePath));

            // Add all files from conflicts
            plan.conflicts?.forEach((item: any) => allFiles.add(item.filePath));

            setSelectedFiles(allFiles);
        } else {
            setSelectedFiles(new Set());
        }
    }, [plan]);

    // Helper to check if there are any outside-fixture files in the plan
    const hasOutsideFixtureFiles = () => {
        if (!plan) return false;

        const allItems = [
            ...(plan.toUpload || []),
            ...(plan.toDownload || []),
            ...(plan.toDeleteLocally || []),
            ...(plan.toDeleteRemotely || []),
            ...(plan.conflicts || [])
        ];

        return allItems.some((item: any) => {
            const matchInfo = extractMatchInfoFromPath(item.filePath, state?.config?.tournaments || []);
            return matchInfo?.isOutsideFixture;
        });
    };

    // Toggle file selection
    const toggleFileSelection = (filePath: string) => {
        setSelectedFiles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(filePath)) {
                newSet.delete(filePath);
            } else {
                newSet.add(filePath);
            }
            return newSet;
        });
    };

    // Uncheck all outside-fixture summaries
    const uncheckOutsideFixtureFiles = () => {
        setSelectedFiles(prev => {
            const newSet = new Set(prev);

            const allItems = [
                ...(plan.toUpload || []),
                ...(plan.toDownload || []),
                ...(plan.toDeleteLocally || []),
                ...(plan.toDeleteRemotely || []),
                ...(plan.conflicts || [])
            ];

            allItems.forEach((item: any) => {
                const matchInfo = extractMatchInfoFromPath(item.filePath, state?.config?.tournaments || []);
                if (matchInfo?.isOutsideFixture) {
                    newSet.delete(item.filePath);
                }
            });

            return newSet;
        });

        toast({
            title: "✅ Archivos Desmarcados",
            description: "Se desmarcaron todos los summaries fuera de fixture",
            className: "bg-blue-600 text-white border-blue-700",
        });
    };

    // Helper to check if there are any unreferenced photos in the plan
    const hasUnreferencedPhotos = () => {
        if (!plan) return false;

        const allItems = [
            ...(plan.toUpload || []),
            ...(plan.toDownload || []),
            ...(plan.toDeleteLocally || []),
            ...(plan.toDeleteRemotely || []),
            ...(plan.conflicts || [])
        ];

        return allItems.some((item: any) => {
            const photoInfo = extractPlayerPhotoInfo(item.filePath, state?.config?.tournaments || []);
            return photoInfo?.isUnreferenced;
        });
    };

    // Uncheck all unreferenced photos
    const uncheckUnreferencedPhotos = () => {
        setSelectedFiles(prev => {
            const newSet = new Set(prev);

            const allItems = [
                ...(plan.toUpload || []),
                ...(plan.toDownload || []),
                ...(plan.toDeleteLocally || []),
                ...(plan.toDeleteRemotely || []),
                ...(plan.conflicts || [])
            ];

            allItems.forEach((item: any) => {
                const photoInfo = extractPlayerPhotoInfo(item.filePath, state?.config?.tournaments || []);
                if (photoInfo?.isUnreferenced) {
                    newSet.delete(item.filePath);
                }
            });

            return newSet;
        });

        toast({
            title: "✅ Fotos Desmarcadas",
            description: "Se desmarcaron todas las fotos no referenciadas",
            className: "bg-orange-600 text-white border-orange-700",
        });
    };

    // Calculate selected counts
    const getSelectedCounts = () => {
        if (!plan) return { upload: 0, download: 0, deleteLocal: 0, deleteRemote: 0, conflicts: 0 };

        return {
            upload: plan.toUpload?.filter((item: any) => selectedFiles.has(item.filePath)).length || 0,
            download: plan.toDownload?.filter((item: any) => selectedFiles.has(item.filePath)).length || 0,
            deleteLocal: plan.toDeleteLocally?.filter((item: any) => selectedFiles.has(item.filePath)).length || 0,
            deleteRemote: plan.toDeleteRemotely?.filter((item: any) => selectedFiles.has(item.filePath)).length || 0,
            conflicts: plan.conflicts?.filter((item: any) => selectedFiles.has(item.filePath)).length || 0,
        };
    };

    const selectedCounts = getSelectedCounts();

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        setPlan(null);
        try {
            const response = await fetch('/api/sync/analyze');
            const data = await response.json();

            if (response.ok && data.success) {
                setPlan(data.plan);
                toast({
                    title: "✅ Plan Creado",
                    description: data.message,
                    className: "bg-green-600 text-white border-green-700",
                });
            } else {
                // Check if it's a network error
                if (data.isNetworkError) {
                    toast({
                        title: "⚠️ Sin Conexión",
                        description: "No se pudo conectar a Supabase. Verifica tu conexión a internet.",
                        variant: "destructive",
                    });
                } else {
                    throw new Error(data.error || 'Error desconocido');
                }
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

    const handleReloadContext = async () => {
        setIsReloadingContext(true);
        try {
            console.log('[Admin] Reloading context from server...');

            // First, reload cache on server
            const reloadResponse = await fetch('/api/sync/reload-cache', {
                method: 'POST',
            });

            if (!reloadResponse.ok) {
                throw new Error('Failed to reload server cache');
            }

            console.log('[Admin] Server cache reloaded, fetching fresh data...');

            // Then fetch fresh data
            const res = await fetch('/api/db');
            if (!res.ok) throw new Error('Failed to fetch initial data');
            const data = await res.json();

            console.log('[Admin] Fresh data received, hydrating state...');
            console.log('[Admin] Tournaments count:', data.config?.tournaments?.length || 0);

            // Hydrate the state with fresh data
            dispatch({ type: 'INITIALIZE_STATE', payload: data });

            toast({
                title: "✅ Contexto Recargado",
                description: `Datos actualizados. Torneos: ${data.config?.tournaments?.length || 0}`,
                className: "bg-green-600 text-white border-green-700",
            });
        } catch (error) {
            console.error('Error reloading context:', error);
            toast({
                title: "❌ Error al Recargar",
                description: error instanceof Error ? error.message : "No se pudo recargar el contexto",
                variant: "destructive",
            });
        } finally {
            setIsReloadingContext(false);
        }
    };

    const handleRegenerateManifest = async () => {
        setIsRegeneratingManifest(true);
        try {
            console.log('[Admin] Regenerating local manifest...');

            const response = await fetch('/api/regenerate-manifest', {
                method: 'POST',
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to regenerate manifest');
            }

            console.log('[Admin] Manifest regenerated:', data);

            toast({
                title: "✅ Manifest Regenerado",
                description: `Se procesaron ${data.totalFiles} archivos correctamente.`,
            });

            // Optionally re-analyze after regenerating
            await handleAnalyze();

        } catch (error) {
            console.error('Error regenerating manifest:', error);
            toast({
                title: "❌ Error al Regenerar Manifest",
                description: error instanceof Error ? error.message : "No se pudo regenerar el manifest local",
                variant: "destructive",
            });
        } finally {
            setIsRegeneratingManifest(false);
        }
    };

    // Load file content for comparison
    const loadFileContent = async (filePath: string) => {
        setIsLoadingContent(true);
        try {
            console.log('[Admin] Loading file content for:', filePath);

            // Load local content
            const localResponse = await fetch(`/api/sync/file-content?filePath=${encodeURIComponent(filePath)}&source=local`);
            const localData = await localResponse.json();

            console.log('[Admin] Local response:', localData);

            // Load remote content
            const remoteResponse = await fetch(`/api/sync/file-content?filePath=${encodeURIComponent(filePath)}&source=remote`);
            const remoteData = await remoteResponse.json();

            console.log('[Admin] Remote response:', remoteData);

            if (localData.success && remoteData.success) {
                setLocalContent(localData.content);
                setRemoteContent(remoteData.content);
                console.log('[Admin] Content loaded successfully');
            } else {
                const errorMsg = `Local: ${localData.error || 'OK'}, Remote: ${remoteData.error || 'OK'}`;
                console.error('[Admin] Failed to load content:', errorMsg);
                toast({
                    title: "⚠️ Error Cargando Contenido",
                    description: errorMsg,
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error('[Admin] Error loading file content:', error);
            toast({
                title: "❌ Error",
                description: error instanceof Error ? error.message : "No se pudo cargar el contenido de los archivos",
                variant: "destructive",
            });
        } finally {
            setIsLoadingContent(false);
        }
    };

    // Handle conflict selection
    const handleConflictClick = async (conflict: any) => {
        setSelectedConflict(conflict);
        setShowComparison(false);
        setShowMetadata(false);
        setLocalContent('');
        setRemoteContent('');

        // Load content automatically
        await loadFileContent(conflict.filePath);
    };

    const handleResolveConflict = async (filePath: string, decision: 'local-wins' | 'remote-wins' | 'skip') => {
        try {
            const response = await fetch('/api/sync/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    decisions: [{ filePath, decision }]
                })
            });

            const data = await response.json();

            if (response.ok && data.plan) {
                setPlan(data.plan);
                setSelectedConflict(null);
                setLocalContent('');
                setRemoteContent('');
                toast({
                    title: "✅ Conflicto Resuelto",
                    description: `${filePath}: ${decision === 'local-wins' ? 'Local gana' : decision === 'remote-wins' ? 'Remoto gana' : 'Omitir'}`,
                    className: "bg-green-600 text-white border-green-700",
                });
            } else {
                throw new Error(data.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('Error resolving conflict:', error);
            toast({
                title: "❌ Error",
                description: error instanceof Error ? error.message : "No se pudo resolver el conflicto",
                variant: "destructive",
            });
        }
    };

    const handleExecuteSync = async () => {
        if (!plan) {
            toast({
                title: "⚠️ Sin plan",
                description: "Crea un plan de sincronización primero",
                variant: "destructive",
            });
            return;
        }

        // Filter plan to only include selected files
        // Photos manually selected from skippedPhotoDownloads are merged into toDownload
        const selectedPhotos = (plan.skippedPhotoDownloads || []).filter((item: any) => selectedFiles.has(item.filePath));
        const filteredPlan = {
            ...plan,
            toUpload: plan.toUpload?.filter((item: any) => selectedFiles.has(item.filePath)) || [],
            toDownload: [
                ...(plan.toDownload?.filter((item: any) => selectedFiles.has(item.filePath)) || []),
                ...selectedPhotos,
            ],
            toDeleteLocally: plan.toDeleteLocally?.filter((item: any) => selectedFiles.has(item.filePath)) || [],
            toDeleteRemotely: plan.toDeleteRemotely?.filter((item: any) => selectedFiles.has(item.filePath)) || [],
            conflicts: plan.conflicts?.filter((item: any) => selectedFiles.has(item.filePath)) || [],
        };

        // Check if selected conflicts are resolved
        const selectedConflicts = filteredPlan.conflicts || [];
        const unresolvedSelectedConflicts = selectedConflicts.filter(
            (item: any) => !item.decision || item.decision === 'unresolved'
        );

        if (unresolvedSelectedConflicts.length > 0) {
            toast({
                title: "⚠️ Conflictos sin resolver",
                description: `Hay ${unresolvedSelectedConflicts.length} conflicto(s) seleccionado(s) sin resolver. Resuélvelos o desmárcalos para continuar.`,
                variant: "destructive",
            });
            return;
        }

        // Update summary counts for filtered plan
        filteredPlan.summary = {
            ...plan.summary,
            uploadCount: filteredPlan.toUpload.length,
            downloadCount: filteredPlan.toDownload.length,
            deleteLocalCount: filteredPlan.toDeleteLocally.length,
            deleteRemoteCount: filteredPlan.toDeleteRemotely.length,
            conflictCount: filteredPlan.conflicts.length,
        };

        setIsSyncing(true);
        try {
            const response = await fetch('/api/sync/execute-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trigger: 'manual', plan: filteredPlan })
            });
            const data = await response.json();

            if (response.ok && data.success) {
                const totalSynced = data.filesUploaded + data.filesDownloaded + data.conflictsResolved;

                toast({
                    title: "✅ Sincronización Completada",
                    description: `Se sincronizaron ${totalSynced} archivos`,
                    className: "bg-green-600 text-white border-green-700",
                    duration: 5000,
                });

                // Show errors if any
                if (data.errors && data.errors.length > 0) {
                    toast({
                        title: `⚠️ ${data.errors.length} Error(es) Durante Sync`,
                        description: data.errors.map((e: any) => `${e.filePath}: ${e.error}`).join('\n').substring(0, 200),
                        variant: "destructive",
                        duration: 10000,
                    });
                }

                // Clear plan after successful execution
                setPlan(null);

                // Reload page if files were downloaded
                if (data.filesDownloaded > 0) {
                    console.log('[Sync] Files downloaded, reloading page in 3 seconds...');
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
                            console.log('[Sync] Reloading page now...');
                            const currentUrl = new URL(window.location.href);
                            currentUrl.searchParams.set('_t', Date.now().toString());
                            window.location.href = currentUrl.toString();
                        }
                    }, 3000);
                }

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

    const handleRevertChanges = async () => {
        if (!plan || !plan.toUpload || plan.toUpload.length === 0) {
            toast({
                title: "⚠️ Sin cambios para revertir",
                description: "No hay archivos para subir seleccionados",
                variant: "destructive",
            });
            return;
        }

        // Get only selected upload files
        const selectedUploadFiles = plan.toUpload
            .filter((item: any) => selectedFiles.has(item.filePath))
            .map((item: any) => item.filePath);

        if (selectedUploadFiles.length === 0) {
            toast({
                title: "⚠️ Sin archivos seleccionados",
                description: "Selecciona archivos para subir que quieras revertir",
                variant: "destructive",
            });
            return;
        }

        if (!confirm(`¿Estás seguro de revertir ${selectedUploadFiles.length} archivo(s)?\n\nEsto descargará la versión de Supabase (si existe) o eliminará el archivo si es nuevo.`)) {
            return;
        }

        setIsSyncing(true);
        try {
            const response = await fetch('/api/sync/revert-uploads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePaths: selectedUploadFiles })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to revert files');
            }

            toast({
                title: "✅ Cambios Revertidos",
                description: `${data.reverted.length} archivo(s) revertidos, ${data.deleted.length} eliminados${data.errors.length > 0 ? `, ${data.errors.length} fallaron` : ''}`,
            });

            // Reload context and re-analyze
            await handleReloadContext();
            await handleAnalyze();

        } catch (error) {
            toast({
                title: "❌ Error al Revertir",
                description: error instanceof Error ? error.message : "No se pudieron revertir los cambios",
                variant: "destructive",
            });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDetectJunk = async () => {
        setIsDetectingJunk(true);
        setJunkFiles(null);
        try {
            const response = await fetch('/api/sync/detect-junk');
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to detect junk files');
            }

            setJunkFiles(data.junkFiles);

            toast({
                title: "🔍 Detección Completada",
                description: `Encontrados ${data.junkFiles.total} archivos basura: ${data.junkFiles.summariesOutsideFixture.length} summaries fuera de fixture, ${data.junkFiles.unreferencedPhotos.length} fotos no referenciadas`,
                className: "bg-orange-600 text-white border-orange-700",
            });
        } catch (error) {
            toast({
                title: "❌ Error al Detectar",
                description: error instanceof Error ? error.message : "No se pudieron detectar archivos basura",
                variant: "destructive",
            });
        } finally {
            setIsDetectingJunk(false);
        }
    };

    const handleDeleteJunk = async () => {
        if (!junkFiles || junkFiles.total === 0) return;

        const allJunkFiles = [
            ...junkFiles.summariesOutsideFixture,
            ...junkFiles.unreferencedPhotos
        ];

        if (!confirm(`¿Estás seguro de eliminar ${allJunkFiles.length} archivo(s) basura?\n\nEsto eliminará:\n- ${junkFiles.summariesOutsideFixture.length} summaries fuera de fixture\n- ${junkFiles.unreferencedPhotos.length} fotos no referenciadas\n\nEsta acción NO se puede deshacer.`)) {
            return;
        }

        setIsSyncing(true);
        try {
            const response = await fetch('/api/sync/delete-junk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePaths: allJunkFiles })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to delete junk files');
            }

            toast({
                title: "✅ Archivos Eliminados",
                description: `${data.deleted.length} archivo(s) eliminados${data.errors.length > 0 ? `, ${data.errors.length} fallaron` : ''}`,
                className: "bg-green-600 text-white border-green-700",
            });

            // Clear junk files state
            setJunkFiles(null);

            // Reload context
            await handleReloadContext();

        } catch (error) {
            toast({
                title: "❌ Error al Eliminar",
                description: error instanceof Error ? error.message : "No se pudieron eliminar los archivos",
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

                    {/* Sync al guardar torneo */}
                    <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5">
                            <Label htmlFor="sync-after-summary-edit" className="text-xs">
                                Sync al Guardar Torneo
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Ejecutar sync al guardar torneo (incluye finalizar partido y editar summaries)
                            </p>
                        </div>
                        <Switch
                            id="sync-after-summary-edit"
                            checked={syncAfterSummaryEdit}
                            onCheckedChange={handleSyncAfterSummaryEditChange}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex gap-2">
                        <Button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || isSyncing || isReloadingContext || isRegeneratingManifest}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
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

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    disabled={isAnalyzing || isSyncing || isReloadingContext || isDetectingJunk || isRegeneratingManifest}
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleReloadContext} disabled={isReloadingContext}>
                                    {isReloadingContext ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Recargando...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Recargar Contexto
                                        </>
                                    )}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleDetectJunk} disabled={isDetectingJunk}>
                                    {isDetectingJunk ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Detectando...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Detectar Files a Borrar
                                        </>
                                    )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleRegenerateManifest} disabled={isRegeneratingManifest}>
                                    {isRegeneratingManifest ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Regenerando...
                                        </>
                                    ) : (
                                        <>
                                            <FileSearch className="mr-2 h-4 w-4" />
                                            Regenerar Manifest Local
                                        </>
                                    )}
                                </DropdownMenuItem>
                                {selectedCounts.upload > 0 && selectedCounts.download === 0 && selectedCounts.conflicts === 0 && selectedCounts.deleteLocal === 0 && selectedCounts.deleteRemote === 0 && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onClick={handleRevertChanges}
                                            disabled={isSyncing || isAnalyzing}
                                            className="text-orange-700 dark:text-orange-400"
                                        >
                                            {isSyncing ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Revirtiendo...
                                                </>
                                            ) : (
                                                <>
                                                    <Undo2 className="mr-2 h-4 w-4" />
                                                    Revertir Cambios ({selectedCounts.upload})
                                                </>
                                            )}
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Show junk files results */}
                {junkFiles && junkFiles.total > 0 && (
                    <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg border border-orange-200 dark:border-orange-800 space-y-3">
                        <div className="flex items-center gap-2">
                            <Trash2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                            <h4 className="font-semibold text-orange-800 dark:text-orange-200">
                                Archivos Basura Detectados ({junkFiles.total})
                            </h4>
                        </div>

                        {junkFiles.summariesOutsideFixture.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                                    🔵 Summaries Fuera de Fixture ({junkFiles.summariesOutsideFixture.length}):
                                </p>
                                <div className="max-h-40 overflow-y-auto">
                                    <ul className="text-xs font-mono space-y-0.5 ml-4">
                                        {junkFiles.summariesOutsideFixture.map(file => (
                                            <li key={file} className="text-muted-foreground">• {file}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {junkFiles.unreferencedPhotos.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                                    🟠 Fotos No Referenciadas ({junkFiles.unreferencedPhotos.length}):
                                </p>
                                <div className="max-h-40 overflow-y-auto">
                                    <ul className="text-xs font-mono space-y-0.5 ml-4">
                                        {junkFiles.unreferencedPhotos.map(file => (
                                            <li key={file} className="text-muted-foreground">• {file}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        <p className="text-xs text-orange-700 dark:text-orange-300 italic mb-3">
                            💡 Tip: Usa "Analizar Diferencias" para sincronizar, luego usa los botones "Desmarcar..." para excluir estos archivos del sync.
                        </p>

                        <Button
                            onClick={handleDeleteJunk}
                            disabled={isSyncing}
                            variant="destructive"
                            size="sm"
                            className="w-full"
                        >
                            {isSyncing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Eliminando...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Eliminar Todos los Archivos Basura ({junkFiles.total})
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {plan && (
                    <>
                        {/* Show execute button if there are changes to sync */}
                        {(plan.summary.uploadCount > 0 || plan.summary.downloadCount > 0 ||
                          plan.summary.deleteLocalCount > 0 || plan.summary.deleteRemoteCount > 0 ||
                          plan.summary.conflictCount > 0) && (
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
                                                    {selectedCounts.upload > 0 && (
                                                        <li>Subir {selectedCounts.upload} archivo(s) a Supabase</li>
                                                    )}
                                                    {selectedCounts.download > 0 && (
                                                        <li>Descargar {selectedCounts.download} archivo(s) desde Supabase</li>
                                                    )}
                                                    {selectedCounts.deleteLocal > 0 && (
                                                        <li className="text-red-600">Eliminar {selectedCounts.deleteLocal} archivo(s) localmente (fueron eliminados en Supabase)</li>
                                                    )}
                                                    {selectedCounts.deleteRemote > 0 && (
                                                        <li className="text-red-600">Eliminar {selectedCounts.deleteRemote} archivo(s) en Supabase (fueron eliminados localmente)</li>
                                                    )}
                                                    {selectedCounts.conflicts > 0 && (
                                                        <li>
                                                            Resolver {selectedCounts.conflicts} conflicto(s):
                                                            <ul className="ml-4 mt-1 space-y-0.5">
                                                                {plan.conflicts.filter((conflict: any) => selectedFiles.has(conflict.filePath)).map((conflict: any) => {
                                                                    const decision = conflict.decision;
                                                                    if (!decision || decision === 'skip') return null;

                                                                    return (
                                                                        <li key={conflict.filePath} className="text-xs">
                                                                            {conflict.filePath.split('/').pop()} → {
                                                                                decision === 'local-wins' ? '💻 Local gana' :
                                                                                decision === 'remote-wins' ? '☁️ Remoto gana' : ''
                                                                            }
                                                                        </li>
                                                                    );
                                                                })}
                                                            </ul>
                                                        </li>
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

                {plan && (
                    <div className="mt-4 space-y-3 text-sm">
                        <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                            <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">Resumen (Archivos Seleccionados):</h4>
                            <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                                <li>📤 <strong>Subir:</strong> {selectedCounts.upload} archivos {selectedCounts.upload !== plan.summary.uploadCount && <span className="text-xs text-muted-foreground">(de {plan.summary.uploadCount})</span>}</li>
                                <li>📥 <strong>Descargar:</strong> {selectedCounts.download} archivos {selectedCounts.download !== plan.summary.downloadCount && <span className="text-xs text-muted-foreground">(de {plan.summary.downloadCount})</span>}</li>
                                {selectedCounts.deleteLocal > 0 && (
                                    <li className="text-red-600 dark:text-red-400">🗑️ <strong>Eliminar Local:</strong> {selectedCounts.deleteLocal} archivos {selectedCounts.deleteLocal !== plan.summary.deleteLocalCount && <span className="text-xs text-muted-foreground">(de {plan.summary.deleteLocalCount})</span>}</li>
                                )}
                                {selectedCounts.deleteRemote > 0 && (
                                    <li className="text-red-600 dark:text-red-400">🗑️ <strong>Eliminar Remoto:</strong> {selectedCounts.deleteRemote} archivos {selectedCounts.deleteRemote !== plan.summary.deleteRemoteCount && <span className="text-xs text-muted-foreground">(de {plan.summary.deleteRemoteCount})</span>}</li>
                                )}
                                {selectedCounts.conflicts > 0 && (
                                    <li>⚠️ <strong>Conflictos:</strong> {selectedCounts.conflicts} archivos {selectedCounts.conflicts !== plan.summary.conflictCount && <span className="text-xs text-muted-foreground">(de {plan.summary.conflictCount})</span>}</li>
                                )}
                                <li>✅ <strong>Sin cambios:</strong> {plan.summary.unchangedCount} archivos</li>
                            </ul>
                        </div>

                        {/* Button to uncheck outside-fixture files (only if they exist) */}
                        {hasOutsideFixtureFiles() && (
                            <Button
                                onClick={uncheckOutsideFixtureFiles}
                                variant="outline"
                                size="sm"
                                className="w-full border-purple-500 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950"
                            >
                                🔵 Desmarcar Summaries Fuera de Fixture
                            </Button>
                        )}

                        {/* Button to uncheck unreferenced photos (only if they exist) */}
                        {hasUnreferencedPhotos() && (
                            <Button
                                onClick={uncheckUnreferencedPhotos}
                                variant="outline"
                                size="sm"
                                className="w-full border-orange-500 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950"
                            >
                                🟠 Desmarcar Fotos No Referenciadas
                            </Button>
                        )}


                        {plan.toUpload.length > 0 && (
                            <details open className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg border border-green-200 dark:border-green-800">
                                <summary className="cursor-pointer font-semibold text-green-800 dark:text-green-200">
                                    📤 Para Subir ({selectedCounts.upload} de {plan.toUpload.length})
                                </summary>
                                <div className="mt-2 max-h-96 overflow-y-auto">
                                    <FolderFileList
                                        files={plan.toUpload}
                                        selectedFiles={selectedFiles}
                                        onToggleFile={toggleFileSelection}
                                        extractMatchInfo={extractMatchInfoFromPath}
                                        extractPlayerPhotoInfo={extractPlayerPhotoInfo}
                                        tournaments={state?.config?.tournaments || []}
                                        type="upload"
                                    />
                                </div>
                            </details>
                        )}

                        {plan.toDownload.length > 0 && (
                            <details open className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                                <summary className="cursor-pointer font-semibold text-blue-800 dark:text-blue-200">
                                    📥 Para Descargar ({selectedCounts.download} de {plan.toDownload.length})
                                </summary>
                                <div className="mt-2 max-h-96 overflow-y-auto">
                                    <FolderFileList
                                        files={plan.toDownload}
                                        selectedFiles={selectedFiles}
                                        onToggleFile={toggleFileSelection}
                                        extractMatchInfo={extractMatchInfoFromPath}
                                        extractPlayerPhotoInfo={extractPlayerPhotoInfo}
                                        tournaments={state?.config?.tournaments || []}
                                        type="download"
                                    />
                                </div>
                            </details>
                        )}

                        {plan.skippedPhotoDownloads?.length > 0 && (
                            <details className="bg-gray-50 dark:bg-gray-900/30 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                <summary className="cursor-pointer font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                    🖼️ Fotos omitidas del sync ({plan.skippedPhotoDownloads.length})
                                    <span className="text-xs font-normal text-gray-500">— se descargan bajo demanda al ver un equipo</span>
                                </summary>
                                <div className="mt-2">
                                    <button
                                        className="text-xs text-blue-600 dark:text-blue-400 underline mb-2 block"
                                        onClick={() => plan.skippedPhotoDownloads.forEach((f: any) => toggleFileSelection(f.filePath))}
                                    >
                                        Incluir todas en el sync
                                    </button>
                                    <FolderFileList
                                        files={plan.skippedPhotoDownloads.map((f: any) => ({ ...f, reason: 'photo-on-demand' }))}
                                        selectedFiles={selectedFiles}
                                        onToggleFile={toggleFileSelection}
                                        tournaments={state?.config?.tournaments || []}
                                        type="download"
                                    />
                                </div>
                            </details>
                        )}

                        {plan.toDeleteLocally && plan.toDeleteLocally.length > 0 && (
                            <details open className="bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-200 dark:border-red-800">
                                <summary className="cursor-pointer font-semibold text-red-800 dark:text-red-200">
                                    🗑️ Para Eliminar Localmente ({selectedCounts.deleteLocal} de {plan.toDeleteLocally.length})
                                </summary>
                                <div className="mt-2 max-h-96 overflow-y-auto">
                                    <FolderFileList
                                        files={plan.toDeleteLocally}
                                        selectedFiles={selectedFiles}
                                        onToggleFile={toggleFileSelection}
                                        extractMatchInfo={extractMatchInfoFromPath}
                                        extractPlayerPhotoInfo={extractPlayerPhotoInfo}
                                        tournaments={state?.config?.tournaments || []}
                                        type="deleteLocal"
                                    />
                                </div>
                            </details>
                        )}

                        {plan.toDeleteRemotely && plan.toDeleteRemotely.length > 0 && (
                            <details open className="bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-200 dark:border-red-800">
                                <summary className="cursor-pointer font-semibold text-red-800 dark:text-red-200">
                                    🗑️ Para Eliminar Remotamente ({selectedCounts.deleteRemote} de {plan.toDeleteRemotely.length})
                                </summary>
                                <div className="mt-2 max-h-96 overflow-y-auto">
                                    <FolderFileList
                                        files={plan.toDeleteRemotely}
                                        selectedFiles={selectedFiles}
                                        onToggleFile={toggleFileSelection}
                                        extractMatchInfo={extractMatchInfoFromPath}
                                        extractPlayerPhotoInfo={extractPlayerPhotoInfo}
                                        tournaments={state?.config?.tournaments || []}
                                        type="deleteRemote"
                                    />
                                </div>
                            </details>
                        )}

                        {plan.conflicts.length > 0 && (
                            <details open className="bg-yellow-50 dark:bg-yellow-950/30 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                <summary className="cursor-pointer font-semibold text-yellow-800 dark:text-yellow-200">
                                    ⚠️ Conflictos ({selectedCounts.conflicts} de {plan.conflicts.length})
                                </summary>
                                <div className="mt-2 max-h-96 overflow-y-auto">
                                    <FolderFileList
                                        files={plan.conflicts}
                                        selectedFiles={selectedFiles}
                                        onToggleFile={toggleFileSelection}
                                        onFileClick={handleConflictClick}
                                        extractMatchInfo={extractMatchInfoFromPath}
                                        extractPlayerPhotoInfo={extractPlayerPhotoInfo}
                                        tournaments={state?.config?.tournaments || []}
                                        type="conflict"
                                    />
                                </div>
                            </details>
                        )}

                        {/* Conflict Details Dialog */}
                        <AlertDialog open={!!selectedConflict} onOpenChange={(open) => !open && setSelectedConflict(null)}>
                            <AlertDialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-yellow-600">
                                        ⚠️ Conflicto: {selectedConflict?.filePath}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription asChild>
                                        <div className="space-y-4">
                                            <p className="mb-4 text-yellow-700 dark:text-yellow-300">
                                                Ambas versiones han cambiado desde la última sincronización. Elegí qué versión debe ganar o omitir el archivo.
                                            </p>

                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Local Version */}
                                                <Collapsible
                                                    open={showMetadata}
                                                    onOpenChange={setShowMetadata}
                                                    className="bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800"
                                                >
                                                    <CollapsibleTrigger asChild>
                                                        <button className="w-full p-4 text-left hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors rounded-lg">
                                                            <h4 className="font-semibold text-green-800 dark:text-green-200 flex items-center justify-between gap-2">
                                                                <span className="flex items-center gap-2">
                                                                    <span className="text-lg">💻</span>
                                                                    Versión Local
                                                                    {selectedConflict?.localMetadata && (
                                                                        <span className="text-xs font-normal text-green-600 dark:text-green-400">
                                                                            - {new Date(selectedConflict.localMetadata.lastModified).toLocaleString('es-AR', {
                                                                                day: '2-digit',
                                                                                month: '2-digit',
                                                                                year: 'numeric',
                                                                                hour: '2-digit',
                                                                                minute: '2-digit'
                                                                            })}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                <ChevronDown className={`h-4 w-4 transition-transform ${showMetadata ? 'rotate-180' : ''}`} />
                                                            </h4>
                                                        </button>
                                                    </CollapsibleTrigger>
                                                    <CollapsibleContent className="px-4 pb-4">
                                                        {selectedConflict?.localMetadata && (
                                                            <dl className="space-y-2 text-sm">
                                                                <div>
                                                                    <dt className="font-semibold text-green-700 dark:text-green-300">Hash:</dt>
                                                                    <dd className="font-mono text-xs text-green-600 dark:text-green-400 break-all">
                                                                        {selectedConflict.localMetadata.hash}
                                                                    </dd>
                                                                </div>
                                                                <div>
                                                                    <dt className="font-semibold text-green-700 dark:text-green-300">Tamaño:</dt>
                                                                    <dd className="text-green-600 dark:text-green-400">
                                                                        {selectedConflict.localMetadata.size} bytes
                                                                    </dd>
                                                                </div>
                                                                {selectedConflict.localMetadata.previousVersion && (
                                                                    <div className="mt-3 pt-3 border-t border-green-300 dark:border-green-700">
                                                                        <dt className="font-semibold text-green-700 dark:text-green-300 mb-2">Versión anterior:</dt>
                                                                        <dd className="text-xs space-y-1">
                                                                            <div>
                                                                                <span className="text-green-600 dark:text-green-400">Hash: </span>
                                                                                <span className="font-mono text-green-500 dark:text-green-500 break-all">
                                                                                    {selectedConflict.localMetadata.previousVersion.hash}
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-green-600 dark:text-green-400">
                                                                                Modificado: {new Date(selectedConflict.localMetadata.previousVersion.lastModified).toLocaleString()}
                                                                            </div>
                                                                        </dd>
                                                                    </div>
                                                                )}
                                                            </dl>
                                                        )}
                                                    </CollapsibleContent>
                                                </Collapsible>

                                                {/* Remote Version */}
                                                <Collapsible
                                                    open={showMetadata}
                                                    onOpenChange={setShowMetadata}
                                                    className="bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800"
                                                >
                                                    <CollapsibleTrigger asChild>
                                                        <button className="w-full p-4 text-left hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors rounded-lg">
                                                            <h4 className="font-semibold text-blue-800 dark:text-blue-200 flex items-center justify-between gap-2">
                                                                <span className="flex items-center gap-2">
                                                                    <span className="text-lg">☁️</span>
                                                                    Versión Remota
                                                                    {selectedConflict?.remoteMetadata && (
                                                                        <span className="text-xs font-normal text-blue-600 dark:text-blue-400">
                                                                            - {new Date(selectedConflict.remoteMetadata.lastModified).toLocaleString('es-AR', {
                                                                                day: '2-digit',
                                                                                month: '2-digit',
                                                                                year: 'numeric',
                                                                                hour: '2-digit',
                                                                                minute: '2-digit'
                                                                            })}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                <ChevronDown className={`h-4 w-4 transition-transform ${showMetadata ? 'rotate-180' : ''}`} />
                                                            </h4>
                                                        </button>
                                                    </CollapsibleTrigger>
                                                    <CollapsibleContent className="px-4 pb-4">
                                                        {selectedConflict?.remoteMetadata && (
                                                            <dl className="space-y-2 text-sm">
                                                                <div>
                                                                    <dt className="font-semibold text-blue-700 dark:text-blue-300">Hash:</dt>
                                                                    <dd className="font-mono text-xs text-blue-600 dark:text-blue-400 break-all">
                                                                        {selectedConflict.remoteMetadata.hash}
                                                                    </dd>
                                                                </div>
                                                                <div>
                                                                    <dt className="font-semibold text-blue-700 dark:text-blue-300">Tamaño:</dt>
                                                                    <dd className="text-blue-600 dark:text-blue-400">
                                                                        {selectedConflict.remoteMetadata.size} bytes
                                                                    </dd>
                                                                </div>
                                                                {selectedConflict.remoteMetadata.previousVersion && (
                                                                    <div className="mt-3 pt-3 border-t border-blue-300 dark:border-blue-700">
                                                                        <dt className="font-semibold text-blue-700 dark:text-blue-300 mb-2">Versión anterior:</dt>
                                                                        <dd className="text-xs space-y-1">
                                                                            <div>
                                                                                <span className="text-blue-600 dark:text-blue-400">Hash: </span>
                                                                                <span className="font-mono text-blue-500 dark:text-blue-500 break-all">
                                                                                    {selectedConflict.remoteMetadata.previousVersion.hash}
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-blue-600 dark:text-blue-400">
                                                                                Modificado: {new Date(selectedConflict.remoteMetadata.previousVersion.lastModified).toLocaleString()}
                                                                            </div>
                                                                        </dd>
                                                                    </div>
                                                                )}
                                                            </dl>
                                                        )}
                                                    </CollapsibleContent>
                                                </Collapsible>
                                            </div>

                                            {/* File Comparison Section */}
                                            <Collapsible
                                                open={showComparison}
                                                onOpenChange={setShowComparison}
                                                className="mt-6 border rounded-lg"
                                            >
                                                <CollapsibleTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className="w-full justify-between"
                                                        disabled={isLoadingContent}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <FileSearch className="h-4 w-4" />
                                                            {isLoadingContent ? 'Cargando contenido...' : 'Ver Comparación de Contenido'}
                                                        </span>
                                                        <ChevronDown className={`h-4 w-4 transition-transform ${showComparison ? 'rotate-180' : ''}`} />
                                                    </Button>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="p-4">
                                                    {isLoadingContent ? (
                                                        <div className="flex items-center justify-center py-8">
                                                            <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                                            <span>Cargando archivos...</span>
                                                        </div>
                                                    ) : localContent && remoteContent ? (
                                                        <div className="space-y-3">
                                                            <div className="bg-muted/50 p-3 rounded-lg">
                                                                <p className="text-sm text-muted-foreground">
                                                                    Las líneas en <span className="text-green-600 font-semibold">verde</span> son adiciones,
                                                                    las líneas en <span className="text-red-600 font-semibold">rojo</span> son eliminaciones.
                                                                    Usa los botones <span className="font-semibold">"Expand"</span> para ver más contexto.
                                                                </p>
                                                            </div>
                                                            <div className="border rounded-lg overflow-hidden">
                                                                <ReactDiffViewer
                                                                    oldValue={localContent}
                                                                    newValue={remoteContent}
                                                                    splitView={true}
                                                                    leftTitle="💻 Local"
                                                                    rightTitle="☁️ Remoto (Supabase)"
                                                                    showDiffOnly={true}
                                                                    extraLinesSurroundingDiff={5}
                                                                    useDarkTheme={false}
                                                                    styles={{
                                                                        variables: {
                                                                            light: {
                                                                                diffViewerBackground: '#fff',
                                                                                diffViewerColor: '#212529',
                                                                                addedBackground: '#e6ffed',
                                                                                addedColor: '#24292e',
                                                                                removedBackground: '#ffeef0',
                                                                                removedColor: '#24292e',
                                                                                wordAddedBackground: '#acf2bd',
                                                                                wordRemovedBackground: '#fdb8c0',
                                                                                addedGutterBackground: '#cdffd8',
                                                                                removedGutterBackground: '#ffdce0',
                                                                                gutterBackground: '#f7f7f7',
                                                                                gutterBackgroundDark: '#f3f1f1',
                                                                                highlightBackground: '#fffbdd',
                                                                                highlightGutterBackground: '#fff5b1',
                                                                            },
                                                                        },
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-center text-muted-foreground py-4">
                                                            No se pudo cargar el contenido de los archivos
                                                        </p>
                                                    )}
                                                </CollapsibleContent>
                                            </Collapsible>
                                        </div>
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                    <AlertDialogCancel>Cerrar</AlertDialogCancel>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={() => handleResolveConflict(selectedConflict?.filePath, 'local-wins')}
                                            className="bg-green-600 hover:bg-green-700"
                                        >
                                            💻 Local Gana
                                        </Button>
                                        <Button
                                            onClick={() => handleResolveConflict(selectedConflict?.filePath, 'remote-wins')}
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            ☁️ Remoto Gana
                                        </Button>
                                        <Button
                                            onClick={() => handleResolveConflict(selectedConflict?.filePath, 'skip')}
                                            variant="outline"
                                        >
                                            🚫 Omitir
                                        </Button>
                                    </div>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function SyncHistoryCard({ tournaments }: { tournaments: Tournament[] }) {
    const [syncLogs, setSyncLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});

    // Load logs
    const loadSyncLogs = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/sync/logs');
            const data = await response.json();

            if (response.ok && data.logs) {
                setSyncLogs(data.logs);
            }
        } catch (error) {
            console.error('Error loading sync logs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Toggle expand state for a log entry
    const toggleExpanded = (index: number) => {
        setExpandedLogs(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    // Load logs on mount
    useEffect(() => {
        loadSyncLogs();
    }, []);


    if (isLoading) {
        return (
            <Card className="bg-blue-500/10 border-blue-500/30">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-600">
                        📋 Historial de Sincronización
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando historial...
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (syncLogs.length === 0) {
        return (
            <Card className="bg-blue-500/10 border-blue-500/30">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-600">
                        📋 Historial de Sincronización
                    </CardTitle>
                    <CardDescription>
                        Últimas sincronizaciones realizadas
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">No hay sincronizaciones registradas</p>
                    </div>
                    <div className="flex justify-center pt-2 border-t mt-4">
                        <Button
                            onClick={() => loadSyncLogs()}
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
        <Card className="bg-blue-500/10 border-blue-500/30">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600">
                    📋 Historial de Sincronización
                </CardTitle>
                <CardDescription>
                    Últimas {syncLogs.length} sincronizaciones
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {syncLogs.map((log, index) => {
                        const uploadCount = log.files?.filter((f: any) => f.action === 'uploaded').length || 0;
                        const downloadCount = log.files?.filter((f: any) => f.action === 'downloaded').length || 0;
                        const deleteLocalCount = log.files?.filter((f: any) => f.action === 'deleted-locally').length || 0;
                        const deleteRemoteCount = log.files?.filter((f: any) => f.action === 'deleted-remotely').length || 0;
                        const conflictCount = log.files?.filter((f: any) => f.hadConflict).length || 0;
                        const isExpanded = expandedLogs[index] || false;

                        return (
                            <div
                                key={index}
                                className={`rounded-lg border ${
                                    log.result === 'success'
                                        ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                                        : log.result === 'partial'
                                        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                                        : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                                }`}
                            >
                                <button
                                    onClick={() => toggleExpanded(index)}
                                    className="w-full p-3 text-left hover:opacity-80 transition-opacity"
                                >
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                {new Date(log.timestamp).toLocaleString('es-AR', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                            {log.trigger && (
                                                <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium">
                                                    {log.trigger === 'manual' ? '👆 Manual' :
                                                     log.trigger === 'after-summary-edit' ? '💾 Auto' :
                                                     log.trigger}
                                                </span>
                                            )}
                                            <span className={`text-xs font-semibold ${
                                                log.result === 'success' ? 'text-green-700 dark:text-green-400' :
                                                log.result === 'partial' ? 'text-amber-700 dark:text-amber-400' :
                                                'text-red-700 dark:text-red-400'
                                            }`}>
                                                {log.result === 'success' ? '✅ Exitoso' :
                                                 log.result === 'partial' ? '⚠️ Parcial' :
                                                 '❌ Error'}
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {isExpanded ? '▼' : '▶'}
                                        </span>
                                    </div>

                                    <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                                        {uploadCount > 0 && `↑ ${uploadCount} subidos`}
                                        {downloadCount > 0 && (uploadCount > 0 ? ', ' : '') + `↓ ${downloadCount} descargados`}
                                        {deleteLocalCount > 0 && (uploadCount > 0 || downloadCount > 0 ? ', ' : '') + `🗑️ ${deleteLocalCount} eliminados local`}
                                        {deleteRemoteCount > 0 && (uploadCount > 0 || downloadCount > 0 || deleteLocalCount > 0 ? ', ' : '') + `🗑️ ${deleteRemoteCount} eliminados remoto`}
                                        {conflictCount > 0 && (uploadCount > 0 || downloadCount > 0 || deleteLocalCount > 0 || deleteRemoteCount > 0 ? ', ' : '') + `⚔️ ${conflictCount} conflictos`}
                                        {log.errorCount > 0 && ` ❌ ${log.errorCount} errores`}
                                    </div>
                                </button>

                                {isExpanded && log.files && log.files.length > 0 && (
                                    <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 pt-2 mt-1">
                                        <div className="space-y-1 max-h-48 overflow-y-auto">
                                            {log.files.map((file: any, fileIndex: number) => {
                                                // Extract match info from filepath if it's a summary
                                                const matchInfo = extractMatchInfoFromPath(file.filePath, tournaments);

                                                return (
                                                <div key={fileIndex} className="text-xs flex items-start gap-2 py-1">
                                                    <span className={`font-mono flex-shrink-0 ${
                                                        file.action === 'deleted-locally' || file.action === 'deleted-remotely'
                                                            ? 'text-red-600 dark:text-red-400'
                                                            : 'text-gray-600 dark:text-gray-400'
                                                    }`}>
                                                        {file.action === 'uploaded' ? '↑' :
                                                         file.action === 'downloaded' ? '↓' :
                                                         file.action === 'deleted-locally' ? '🗑️' :
                                                         file.action === 'deleted-remotely' ? '🗑️' :
                                                         file.hadConflict ? '⚔️' : '·'}
                                                    </span>
                                                    <div className="flex-1 break-all">
                                                        <span className={`font-mono ${
                                                            file.action === 'deleted-locally' || file.action === 'deleted-remotely'
                                                                ? 'text-red-700 dark:text-red-300 line-through'
                                                                : 'text-gray-800 dark:text-gray-200'
                                                        }`}>
                                                            {file.filePath}
                                                        </span>
                                                        {matchInfo && (
                                                            <span className={`ml-2 font-semibold ${
                                                                matchInfo.isOutsideFixture
                                                                    ? 'text-purple-600 dark:text-purple-400'
                                                                    : 'text-orange-600 dark:text-orange-400'
                                                            }`}>
                                                                ({matchInfo.homeTeam} vs {matchInfo.awayTeam}, {matchInfo.category}, {matchInfo.date})
                                                                {matchInfo.isOutsideFixture && <span className="ml-1">🔵 FUERA DE FIXTURE</span>}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {file.action === 'deleted-locally' && (
                                                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100 flex-shrink-0">
                                                            Eliminado Local
                                                        </span>
                                                    )}
                                                    {file.action === 'deleted-remotely' && (
                                                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100 flex-shrink-0">
                                                            Eliminado Remoto
                                                        </span>
                                                    )}
                                                    {file.hadConflict && (
                                                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 flex-shrink-0">
                                                            {file.conflictWinner === 'local' ? '💻 Local' : '☁️ Remoto'}
                                                        </span>
                                                    )}
                                                </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-center pt-2 border-t">
                    <Button
                        onClick={() => loadSyncLogs()}
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
  const { state, dispatch } = useGameState();
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
                <SyncHistoryCard tournaments={state?.config?.tournaments || []} />
                <RemoteFileManager />
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
