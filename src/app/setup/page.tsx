
"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameState, type FormatAndTimingsProfileData } from '@/contexts/game-state-context';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { TeamData, MatchData } from '@/types';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, CalendarCheck, ArrowLeft, AlertTriangle, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DurationSettingsCard } from '@/components/config/duration-settings-card';
import { PenaltySettingsCard } from '@/components/config/penalty-settings-card';
import { StoppedTimeAlertCard } from '@/components/config/stopped-time-alert-card';
import { isToday, format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { safeUUID } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';

const TeamSelector = ({
    label,
    teams,
    selectedTeamId,
    onSelectTeam,
    disabledTeamId,
    disabled
}: {
    label: string;
    teams: TeamData[];
    selectedTeamId: string;
    onSelectTeam: (teamId: string) => void;
    disabledTeamId?: string;
    disabled?: boolean;
}) => {
    const [open, setOpen] = useState(false);
    const selectedTeam = teams.find(t => t.id === selectedTeamId);

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-11"
                        disabled={disabled || teams.length === 0}
                    >
                        <span className="truncate">
                          {selectedTeam
                            ? `${selectedTeam.name}${selectedTeam.subName ? ` (${selectedTeam.subName})` : ''}`
                            : (teams.length > 0 ? "Seleccionar equipo..." : "Sin equipos en categoría")}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput placeholder="Buscar equipo..." />
                        <CommandList>
                            <CommandEmpty>No se encontró el equipo.</CommandEmpty>
                            <CommandGroup>
                                {teams.map((team) => (
                                    <CommandItem
                                        key={team.id}
                                        value={`${team.name}${team.subName || ''}`}
                                        onSelect={() => {
                                            onSelectTeam(team.id);
                                            setOpen(false);
                                        }}
                                        disabled={team.id === disabledTeamId}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", selectedTeamId === team.id ? "opacity-100" : "opacity-0")} />
                                        <span className="truncate">{team.name}{team.subName ? ` (${team.subName})` : ''}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
};

function SetupPageContent() {
    const { state, dispatch } = useGameState();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const [activeTab, setActiveTab] = useState('teams');
    
    const { selectedTournamentId, tournaments } = state.config;
    const selectedTournament = useMemo(() => tournaments.find(t => t.id === selectedTournamentId), [tournaments, selectedTournamentId]);
    
    const [isTournamentMatch, setIsTournamentMatch] = useState(true);
    const [manualHomeTeamName, setManualHomeTeamName] = useState('Local');
    const [manualAwayTeamName, setManualAwayTeamName] = useState('Visitante');
    const [localCategoryId, setLocalCategoryId] = useState('');
    const [homeTeamId, setHomeTeamId] = useState('');
    const [awayTeamId, setAwayTeamId] = useState('');
    
    const [tempFormatSettings, setTempFormatSettings] = useState<Partial<FormatAndTimingsProfileData>>({});

    const [todaysMatches, setTodaysMatches] = useState<MatchData[]>([]);
    const [pendingMatchConfig, setPendingMatchConfig] = useState<{ matchId: string } | null>(null);
    const [selectedMatchDate, setSelectedMatchDate] = useState<Date>(new Date());


    const availableCategories = useMemo(() => selectedTournament?.categories || [], [selectedTournament]);

    const teamsInCategory = useMemo(() => {
        if (!selectedTournament || !selectedTournament.teams || !localCategoryId) return [];
        return selectedTournament.teams.filter(t => t.category === localCategoryId);
    }, [selectedTournament, localCategoryId]);

    useEffect(() => {
        const selectedTournament = (state.config.tournaments || []).find(t => t.id === state.config.selectedTournamentId);
        if (!selectedTournament || !selectedTournament.matches || selectedTournament.matches.length === 0) {
            setTodaysMatches([]);
            return;
        }

        const matchesForDate = selectedTournament.matches.filter(match =>
            isSameDay(new Date(match.date), selectedMatchDate)
        );
        setTodaysMatches(matchesForDate);
    }, [state.config.tournaments, state.config.selectedTournamentId, selectedMatchDate]);

     useEffect(() => {
        setLocalCategoryId(state.config.selectedMatchCategory || availableCategories[0]?.id || '');
        const currentProfile = state.config.formatAndTimingsProfiles.find(p => p.id === state.config.selectedFormatAndTimingsProfileId) || state.config;
        setTempFormatSettings(currentProfile);
    }, [state.config.selectedTournamentId, state.config.selectedMatchCategory, state.config.formatAndTimingsProfiles, state.config.selectedFormatAndTimingsProfileId, availableCategories]);

    const handleLoadMatchConfig = useCallback((match: MatchData) => {
        // Al cargar un partido existente, siempre es de torneo
        setIsTournamentMatch(true);
        setLocalCategoryId(match.categoryId);
        setHomeTeamId(match.homeTeamId);
        setAwayTeamId(match.awayTeamId);
        setPendingMatchConfig({ matchId: match.id });
        setActiveTab('rules');
    }, []);

    // Handle URL parameters for direct match loading
    useEffect(() => {
        const matchId = searchParams.get('matchId');
        const step = searchParams.get('step');

        // If matchId is provided, load that match
        if (matchId && selectedTournament?.matches) {
            const match = selectedTournament.matches.find(m => m.id === matchId);
            if (match) {
                handleLoadMatchConfig(match);

                // If step is provided, navigate to that step after loading
                if (step === '2') {
                    // Step 2 = rules tab
                    setActiveTab('rules');
                } else if (step === '3') {
                    setActiveTab('summary');
                }
            }
        } else if (step === '2') {
            // If only step is provided without matchId, just navigate to that step
            setActiveTab('rules');
        } else if (step === '3') {
            setActiveTab('summary');
        }
    }, [searchParams, selectedTournament?.matches, handleLoadMatchConfig]);
    
    const handleNextStep = (nextTab: 'rules' | 'summary') => {
        if (activeTab === 'teams') {
            if (!isTournamentMatch) {
                const homeName = manualHomeTeamName.trim() || 'Local';
                const awayName = manualAwayTeamName.trim() || 'Visitante';
                if (homeName.toLowerCase() === awayName.toLowerCase()) {
                    toast({ title: "Nombres Iguales", description: "Los nombres de los equipos no pueden ser el mismo.", variant: "destructive" });
                    return;
                }
                setPendingMatchConfig(null);
            } else {
                 if (!homeTeamId || !awayTeamId || !localCategoryId) {
                    toast({ title: "Datos Incompletos", description: "Por favor, selecciona una categoría y ambos equipos para continuar.", variant: "destructive" });
                    return;
                }
                const newMatch: MatchData = {
                    id: safeUUID(),
                    date: new Date().toISOString(),
                    categoryId: localCategoryId,
                    homeTeamId: homeTeamId,
                    awayTeamId: awayTeamId,
                    playersPerTeam: parseInt(String(tempFormatSettings.playersPerTeamOnIce) || '5', 10)
                };
                if (selectedTournamentId) {
                    dispatch({ type: 'ADD_MATCH_TO_TOURNAMENT', payload: { tournamentId: selectedTournamentId, match: newMatch } });
                }
                
                setPendingMatchConfig({ matchId: newMatch.id });
            }
        }
        setActiveTab(nextTab);
    };
  
    const handleConfirmAndStart = () => {
        dispatch({ type: 'RESET_GAME_STATE' });
        
        let matchIdToSet: string | null = null;
        
        if (!isTournamentMatch) {
            const homeName = manualHomeTeamName.trim() || 'Local';
            const awayName = manualAwayTeamName.trim() || 'Visitante';
            dispatch({ type: 'SET_HOME_TEAM_NAME', payload: homeName });
            dispatch({ type: 'SET_AWAY_TEAM_NAME', payload: awayName });
            dispatch({ type: 'SET_HOME_TEAM_SUB_NAME', payload: undefined });
            dispatch({ type: 'SET_AWAY_TEAM_SUB_NAME', payload: undefined });
            dispatch({ type: 'SET_TEAM_ATTENDANCE', payload: { team: 'home', playerIds: [] }});
            dispatch({ type: 'SET_TEAM_ATTENDANCE', payload: { team: 'away', playerIds: [] }});
        } else {
            const homeTeam = teamsInCategory.find(t => t.id === homeTeamId);
            const awayTeam = teamsInCategory.find(t => t.id === awayTeamId);

            if (!homeTeam || !awayTeam) {
                toast({ title: "Error", description: "No se pudieron encontrar los datos de los equipos.", variant: "destructive" });
                return;
            }

            dispatch({ type: 'SET_SELECTED_MATCH_CATEGORY', payload: localCategoryId });
            dispatch({ type: 'SET_HOME_TEAM_NAME', payload: homeTeam.name });
            dispatch({ type: 'SET_HOME_TEAM_SUB_NAME', payload: homeTeam.subName });
            dispatch({ type: 'SET_AWAY_TEAM_NAME', payload: awayTeam.name });
            dispatch({ type: 'SET_AWAY_TEAM_SUB_NAME', payload: awayTeam.subName });
            dispatch({ type: 'SET_TEAM_ATTENDANCE', payload: { team: 'home', playerIds: homeTeam.players.map(p => p.id) }});
            dispatch({ type: 'SET_TEAM_ATTENDANCE', payload: { team: 'away', playerIds: awayTeam.players.map(p => p.id) }});
            
            if (pendingMatchConfig) {
              matchIdToSet = pendingMatchConfig.matchId;
            }
        }

        dispatch({ type: 'UPDATE_SELECTED_FT_PROFILE_DATA', payload: tempFormatSettings });
        dispatch({ type: 'UPDATE_LIVE_STATE', payload: { matchId: matchIdToSet } });

        
        toast({ title: "¡Partido Listo!", description: "Se ha configurado un nuevo partido. Redirigiendo a controles..." });
        
        router.push('/controls');
    }

    return (
        <div className="w-full max-w-4xl mx-auto py-8 space-y-6">
            <Button variant="outline" onClick={() => router.push('/controls')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Controles
            </Button>
            <div className="border bg-card rounded-lg p-6">
                <div className="mb-4">
                    <h1 className="text-3xl font-bold">Configurar Nuevo Partido</h1>
                    <p className="text-muted-foreground">Configura los equipos y las reglas para el próximo partido.</p>
                </div>
                
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="teams">Paso 1: Equipos</TabsTrigger>
                        <TabsTrigger value="rules">Paso 2: Reglas</TabsTrigger>
                        <TabsTrigger value="summary">Paso 3: Resumen</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="teams" className="py-4 space-y-6">
                        <div className="space-y-3 p-4 border-2 border-dashed rounded-lg bg-muted/30">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <CalendarCheck className="h-5 w-5 text-primary"/>
                                    Partidos de la Fecha
                                </h3>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className={cn("text-xs", !selectedMatchDate && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-1 h-3 w-3" />
                                            {selectedMatchDate ? format(selectedMatchDate, "dd/MM/yy", { locale: es }) : <span>Seleccionar</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="end">
                                        <Calendar mode="single" selected={selectedMatchDate} onSelect={(date) => date && setSelectedMatchDate(date)} initialFocus locale={es} />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            {todaysMatches.length > 0 ? (
                                <div className="grid grid-cols-1 gap-2">
                                    {todaysMatches.map(match => {
                                        const homeTeam = selectedTournament?.teams.find(t => t.id === match.homeTeamId);
                                        const awayTeam = selectedTournament?.teams.find(t => t.id === match.awayTeamId);

                                        return (
                                            <Button
                                                key={match.id}
                                                variant="outline"
                                                className="w-full justify-start h-auto text-left py-2"
                                                onClick={() => handleLoadMatchConfig(match)}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-semibold">{format(new Date(match.date), 'HH:mm')}hs - {homeTeam?.name || '?'} vs {awayTeam?.name || '?'}</span>
                                                    <span className="text-xs text-muted-foreground">Cat: {availableCategories.find(c => c.id === match.categoryId)?.name || 'N/A'}</span>
                                                </div>
                                            </Button>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-muted-foreground text-sm">
                                    No hay partidos programados para el {format(selectedMatchDate, "dd/MM/yyyy", { locale: es })}
                                </div>
                            )}
                        </div>
                        
                        <Separator />
                        
                        <div className="space-y-4">
                             <h3 className="text-lg font-semibold flex items-center gap-2">
                                Configurar Partido Manualmente
                            </h3>
                            <div className="flex items-center space-x-2 pt-2">
                                <Switch id="is-tournament-match-switch" checked={isTournamentMatch} onCheckedChange={setIsTournamentMatch} />
                                <Label htmlFor="is-tournament-match-switch">Es un Partido de Torneo</Label>
                            </div>
                            
                            {!isTournamentMatch && (
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive-foreground">
                                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0"/>
                                    <div>
                                        <p className="text-sm font-semibold text-destructive">Los partidos que NO son de torneo no generan un resumen de estadísticas.</p>
                                    </div>
                                </div>
                            )}

                            {isTournamentMatch ? (
                                <div className="space-y-4 pt-2 border-t mt-4">
                                    <div className="space-y-2">
                                        <Label>Categoría</Label>
                                        <Select value={localCategoryId} onValueChange={setLocalCategoryId}>
                                            <SelectTrigger className="w-full h-11">
                                                <SelectValue placeholder={availableCategories.length > 0 ? "Seleccionar categoría..." : "Sin categorías"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableCategories.map(cat => (
                                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <TeamSelector label="Equipo Local" teams={teamsInCategory} selectedTeamId={homeTeamId} onSelectTeam={setHomeTeamId} disabledTeamId={awayTeamId} disabled={!localCategoryId} />
                                    <TeamSelector label="Equipo Visitante" teams={teamsInCategory} selectedTeamId={awayTeamId} onSelectTeam={setAwayTeamId} disabledTeamId={homeTeamId} disabled={!localCategoryId} />
                                </div>
                            ) : (
                                <div className="space-y-4 pt-2 border-t mt-4">
                                    <div className="grid w-full items-center gap-1.5">
                                        <Label htmlFor="manual-home-name">Nombre del Equipo Local</Label>
                                        <Input id="manual-home-name" value={manualHomeTeamName} onChange={(e) => setManualHomeTeamName(e.target.value)} />
                                    </div>
                                    <div className="grid w-full items-center gap-1.5">
                                        <Label htmlFor="manual-away-name">Nombre del Equipo Visitante</Label>
                                        <Input id="manual-away-name" value={manualAwayTeamName} onChange={(e) => setManualAwayTeamName(e.target.value)} />
                                    </div>
                                </div>
                            )}
                        </div>

                    </TabsContent>

                    <TabsContent value="rules" className="py-4 max-h-[60vh] overflow-y-auto">
                        <div className="space-y-6">
                            {/* Match Info Summary - Readonly */}
                            <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                                <h3 className="text-lg font-semibold">Información del Partido</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground font-medium">Equipo Local:</span>
                                        <p className="font-semibold">
                                            {!isTournamentMatch
                                                ? manualHomeTeamName
                                                : (teamsInCategory.find(t => t.id === homeTeamId)?.name || 'N/A')}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground font-medium">Equipo Visitante:</span>
                                        <p className="font-semibold">
                                            {!isTournamentMatch
                                                ? manualAwayTeamName
                                                : (teamsInCategory.find(t => t.id === awayTeamId)?.name || 'N/A')}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground font-medium">Tipo de Partido:</span>
                                        <p className="font-semibold">{isTournamentMatch ? 'Partido de Torneo' : 'Partido Amistoso'}</p>
                                    </div>
                                    {isTournamentMatch && (
                                        <div>
                                            <span className="text-muted-foreground font-medium">Categoría:</span>
                                            <p className="font-semibold">{availableCategories.find(c => c.id === localCategoryId)?.name || 'N/A'}</p>
                                        </div>
                                    )}
                                    {pendingMatchConfig && (
                                        <>
                                            <div>
                                                <span className="text-muted-foreground font-medium">ID del Partido:</span>
                                                <p className="font-mono text-xs">{pendingMatchConfig.matchId}</p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground font-medium">Fecha:</span>
                                                <p className="font-semibold">
                                                    {(() => {
                                                        const match = selectedTournament?.matches?.find(m => m.id === pendingMatchConfig.matchId);
                                                        return match ? format(new Date(match.date), "PPP 'a las' HH:mm", { locale: es }) : 'N/A';
                                                    })()}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <Separator />

                            <DurationSettingsCard isDialogMode={true} tempSettings={tempFormatSettings} onSettingsChange={setTempFormatSettings} />
                            <Separator />
                            <div className="flex flex-col gap-6">
                                <PenaltySettingsCard isDialogMode={true} tempSettings={tempFormatSettings} onSettingsChange={setTempFormatSettings} />
                                <StoppedTimeAlertCard isDialogMode={true} tempSettings={tempFormatSettings} onSettingsChange={setTempFormatSettings} />
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="summary" className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold">Resumen de Configuración</h3>

                        {!isTournamentMatch && (
                            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive-foreground">
                                <AlertTriangle className="h-6 w-6 text-destructive mt-1"/>
                                <div>
                                    <h4 className="font-bold text-destructive">¡ATENCIÓN!</h4>
                                    <p className="text-sm">Este es un partido amistoso (no de torneo). <strong className="font-semibold">NO SE GENERARÁ UN ARCHIVO DE RESUMEN</strong> al finalizar. Si es un partido oficial, vuelve al paso anterior y selecciona "Es un Partido de Torneo".</p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4 rounded-md border p-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-medium">Equipo Local</h4>
                                    <p className="text-muted-foreground">{!isTournamentMatch ? manualHomeTeamName : teamsInCategory.find(t => t.id === homeTeamId)?.name || 'N/A'}</p>
                                </div>
                                <div>
                                    <h4 className="font-medium">Equipo Visitante</h4>
                                    <p className="text-muted-foreground">{!isTournamentMatch ? manualAwayTeamName : teamsInCategory.find(t => t.id === awayTeamId)?.name || 'N/A'}</p>
                                </div>
                            </div>
                            {isTournamentMatch && (
                                <div>
                                    <h4 className="font-medium">Categoría</h4>
                                    <p className="text-muted-foreground">{availableCategories.find(c => c.id === localCategoryId)?.name || 'N/A'}</p>
                                </div>
                            )}
                            <Separator />
                            <div>
                                <h4 className="font-medium">Reglas del Partido</h4>
                                <ul className="list-disc list-inside text-muted-foreground text-sm mt-2 space-y-1">
                                    <li>Períodos: {tempFormatSettings.numberOfRegularPeriods} de {tempFormatSettings.defaultPeriodDuration! / 6000} min</li>
                                    <li>Overtime: {tempFormatSettings.numberOfOvertimePeriods} de {tempFormatSettings.defaultOTPeriodDuration! / 6000} min</li>
                                    <li>Jugadores en cancha: {tempFormatSettings.playersPerTeamOnIce}</li>
                                    <li>Penalidades concurrentes: {tempFormatSettings.maxConcurrentPenalties}</li>
                                    <li>Modo de Tiempo: {tempFormatSettings.gameTimeMode === 'running' ? 'Corrido' : 'Pausado'}</li>
                                </ul>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            
                <div className="flex justify-end mt-4">
                    {activeTab === "teams" && <Button onClick={() => handleNextStep('rules')}>Siguiente</Button>}
                    {activeTab === "rules" && <Button onClick={() => handleNextStep('summary')}>Ir a Resumen</Button>}
                    {activeTab === "summary" && <Button onClick={handleConfirmAndStart}>Confirmar e Iniciar Partido</Button>}
                </div>
            </div>
        </div>
    );
}

export default function SetupPage() {
    return (
        <Suspense fallback={<div className="w-full max-w-4xl mx-auto py-8 text-center">Cargando...</div>}>
            <SetupPageContent />
        </Suspense>
    );
}

