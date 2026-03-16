"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useGameState, type FormatAndTimingsProfileData } from "@/contexts/game-state-context";
import type { TeamData, MatchContext } from "@/types";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DurationSettingsCard } from "../config/duration-settings-card";
import { PenaltySettingsCard } from "../config/penalty-settings-card";
import { StoppedTimeAlertCard } from "../config/stopped-time-alert-card";
import { useRouter } from "next/navigation";


interface GameSetupDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onGameReset: () => void;
  startTab?: 'teams' | 'rules';
}

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


export function GameSetupDialog({ isOpen, onOpenChange, onGameReset, startTab = 'teams' }: GameSetupDialogProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState(startTab);
  
  const { selectedTournamentId, tournaments, activeTournament } = state.config;
  const selectedTournament = activeTournament;
  
  // Team selection state
  const [useManualTeamNames, setUseManualTeamNames] = useState(false);
  const [manualHomeTeamName, setManualHomeTeamName] = useState('Local');
  const [manualAwayTeamName, setManualAwayTeamName] = useState('Visitante');
  const [localCategoryId, setLocalCategoryId] = useState('');
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  
  // Game rules state
  const [tempFormatSettings, setTempFormatSettings] = useState<Partial<FormatAndTimingsProfileData>>({});
  
  const availableCategories = useMemo(() => selectedTournament?.categories || [], [selectedTournament]);

  const teamsInCategory = useMemo(() => {
    if (!selectedTournament || !localCategoryId) return [];
    return selectedTournament.teams.filter(t => t.category === localCategoryId);
  }, [selectedTournament, localCategoryId]);
  
  useEffect(() => {
    if (isOpen) {
        setActiveTab(startTab);

        const pendingConfig = state.live.pendingMatchConfig;
        if (pendingConfig) {
          setUseManualTeamNames(false);
          setLocalCategoryId(pendingConfig.categoryId);
          setHomeTeamId(pendingConfig.homeTeamId);
          setAwayTeamId(pendingConfig.awayTeamId);
        } else {
            setUseManualTeamNames(false);
            setLocalCategoryId(state.config.selectedMatchCategory || availableCategories[0]?.id || '');
            setHomeTeamId('');
            setAwayTeamId('');
        }
        
        const currentProfile = state.config.formatAndTimingsProfiles.find(p => p.id === state.config.selectedFormatAndTimingsProfileId) || state.config;
        setTempFormatSettings(currentProfile);

    }
  }, [isOpen, startTab, state.live.pendingMatchConfig, state.config.selectedMatchCategory, state.config.formatAndTimingsProfiles, state.config.selectedFormatAndTimingsProfileId, availableCategories]);

  useEffect(() => {
    if (!useManualTeamNames) {
        const pendingConfig = state.live.pendingMatchConfig;
        if (!pendingConfig || (pendingConfig && pendingConfig.categoryId !== localCategoryId)) {
            setHomeTeamId('');
            setAwayTeamId('');
        }
    }
  }, [localCategoryId, useManualTeamNames, state.live.pendingMatchConfig]);


  const handleNextStep = (nextTab: 'rules' | 'summary') => {
    if (activeTab === 'teams') {
        if (useManualTeamNames) {
            const homeName = manualHomeTeamName.trim() || 'Local';
            const awayName = manualAwayTeamName.trim() || 'Visitante';
            if (homeName.toLowerCase() === awayName.toLowerCase()) {
                toast({ title: "Nombres Iguales", description: "Los nombres de los equipos no pueden ser el mismo.", variant: "destructive" });
                return;
            }
        } else {
            if (!homeTeamId || !awayTeamId || !localCategoryId) {
            toast({
                title: "Datos Incompletos",
                description: "Por favor, selecciona una categoría y ambos equipos para continuar.",
                variant: "destructive",
            });
            return;
            }
        }
    }
    setActiveTab(nextTab);
  };
  
  const handleConfirmAndStart = () => {
    onGameReset();
    
    if (useManualTeamNames) {
        const homeName = manualHomeTeamName.trim() || 'Local';
        const awayName = manualAwayTeamName.trim() || 'Visitante';
        
        dispatch({ type: 'SET_HOME_TEAM_NAME', payload: homeName });
        dispatch({ type: 'SET_AWAY_TEAM_NAME', payload: awayName });
        dispatch({ type: 'SET_HOME_TEAM_SUB_NAME', payload: undefined });
        dispatch({ type: 'SET_AWAY_TEAM_SUB_NAME', payload: undefined });
        dispatch({ type: 'SET_TEAM_ATTENDANCE', payload: { team: 'home', playerNumbers: [] }});
        dispatch({ type: 'SET_TEAM_ATTENDANCE', payload: { team: 'away', playerNumbers: [] }});
        
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
        dispatch({ type: 'SET_TEAM_ATTENDANCE', payload: { team: 'home', playerNumbers: homeTeam.players.map(p => p.number) }});
        dispatch({ type: 'SET_TEAM_ATTENDANCE', payload: { team: 'away', playerNumbers: awayTeam.players.map(p => p.number) }});
    }

    dispatch({ type: 'UPDATE_SELECTED_FT_PROFILE_DATA', payload: tempFormatSettings });

    const matchIdToSet = state.live.pendingMatchConfig?.matchId || null;
    dispatch({ type: 'UPDATE_LIVE_STATE', payload: { matchId: matchIdToSet } });

    // Set match context snapshot for tournament matches
    if (!useManualTeamNames && selectedTournament && selectedTournamentId) {
        const homeTeam = teamsInCategory.find(t => t.id === homeTeamId);
        const awayTeam = teamsInCategory.find(t => t.id === awayTeamId);
        const matchData = matchIdToSet ? selectedTournament.matches?.find(m => m.id === matchIdToSet) : null;
        const categoryName = selectedTournament.categories?.find(c => c.id === localCategoryId)?.name || '';

        if (homeTeam && awayTeam) {
            const matchContext: MatchContext = {
                tournamentId: selectedTournamentId,
                tournamentName: selectedTournament.name,
                categoryId: localCategoryId,
                categoryName,
                matchPhase: matchData?.phase || null,
                matchPlayoffType: matchData?.playoffType || null,
                homeTeamId: homeTeam.id,
                awayTeamId: awayTeam.id,
                homeTeamLogoDataUrl: homeTeam.logoDataUrl || null,
                awayTeamLogoDataUrl: awayTeam.logoDataUrl || null,
                homeRoster: homeTeam.players,
                awayRoster: awayTeam.players,
                staff: selectedTournament.staff || [],
            };
            dispatch({ type: 'UPDATE_LIVE_STATE', payload: { matchContext } });
        }
    }

    toast({ title: "¡Partido Listo!", description: "Se ha configurado un nuevo partido. Redirigiendo a controles..." });
    onOpenChange(false);
    router.push('/controls');
  }


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Configurar Nuevo Partido</DialogTitle>
          <DialogDescription>
            Configura los equipos y las reglas para el próximo partido.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="teams">Paso 1: Equipos</TabsTrigger>
                <TabsTrigger value="rules">Paso 2: Reglas</TabsTrigger>
                <TabsTrigger value="summary">Paso 3: Resumen</TabsTrigger>
            </TabsList>
            
            <TabsContent value="teams" className="py-4 space-y-4">
                <div className="flex items-center space-x-2">
                    <Switch 
                        id="manual-team-names-switch"
                        checked={useManualTeamNames}
                        onCheckedChange={setUseManualTeamNames}
                    />
                    <Label htmlFor="manual-team-names-switch">Ingresar nombres de equipo manualmente</Label>
                </div>
                
                <Separator />

                {useManualTeamNames ? (
                    <div className="space-y-4">
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="manual-home-name">Nombre del Equipo Local</Label>
                            <Input id="manual-home-name" value={manualHomeTeamName} onChange={(e) => setManualHomeTeamName(e.target.value)} />
                        </div>
                         <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="manual-away-name">Nombre del Equipo Visitante</Label>
                            <Input id="manual-away-name" value={manualAwayTeamName} onChange={(e) => setManualAwayTeamName(e.target.value)} />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
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
                       
                       <TeamSelector
                            label="Equipo Local"
                            teams={teamsInCategory}
                            selectedTeamId={homeTeamId}
                            onSelectTeam={setHomeTeamId}
                            disabledTeamId={awayTeamId}
                            disabled={!localCategoryId}
                       />

                       <TeamSelector
                            label="Equipo Visitante"
                            teams={teamsInCategory}
                            selectedTeamId={awayTeamId}
                            onSelectTeam={setAwayTeamId}
                            disabledTeamId={homeTeamId}
                            disabled={!localCategoryId}
                       />
                    </div>
                )}
            </TabsContent>

            <TabsContent value="rules" className="py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <DurationSettingsCard 
                        isDialogMode={true} 
                        tempSettings={tempFormatSettings}
                        onSettingsChange={setTempFormatSettings}
                    />
                    <div className="flex flex-col gap-4">
                        <PenaltySettingsCard
                            isDialogMode={true}
                            tempSettings={tempFormatSettings}
                            onSettingsChange={setTempFormatSettings}
                        />
                        <StoppedTimeAlertCard
                            isDialogMode={true}
                            tempSettings={tempFormatSettings}
                            onSettingsChange={setTempFormatSettings}
                        />
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="summary" className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                 <h3 className="text-lg font-semibold">Resumen de Configuración</h3>
                 <div className="space-y-4 rounded-md border p-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h4 className="font-medium">Equipo Local</h4>
                            <p className="text-muted-foreground">{useManualTeamNames ? manualHomeTeamName : teamsInCategory.find(t => t.id === homeTeamId)?.name || 'N/A'}</p>
                        </div>
                        <div>
                            <h4 className="font-medium">Equipo Visitante</h4>
                            <p className="text-muted-foreground">{useManualTeamNames ? manualAwayTeamName : teamsInCategory.find(t => t.id === awayTeamId)?.name || 'N/A'}</p>
                        </div>
                    </div>
                     {!useManualTeamNames && (
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
                            <li>Modo de Tiempo: {tempFormatSettings.gameTimeMode === 'running' ? 'Corrido' : 'Pausado'}</li>
                        </ul>
                     </div>
                 </div>
            </TabsContent>
        </Tabs>
       
        <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            {activeTab === "teams" && <Button onClick={() => handleNextStep('rules')}>Siguiente</Button>}
            {activeTab === "rules" && <Button onClick={() => handleNextStep('summary')}>Ir a Resumen</Button>}
            {activeTab === "summary" && <Button onClick={handleConfirmAndStart}>Confirmar e Iniciar Partido</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
