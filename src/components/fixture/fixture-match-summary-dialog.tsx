
"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Edit3, Check, XCircle, ChevronLeft, ChevronRight, PlusCircle, MinusCircle } from "lucide-react";
import type { MatchData, Tournament, GameSummary, SummaryPlayerStats, PlayerData, Team, SummaryGoalEntry, SummaryPenaltyEntry, SummaryPeriodSummary, AttendedPlayerInfo } from "@/types";
import { useGameState, getCategoryNameById } from "@/contexts/game-state-context";
import { GoalsSection } from "../summary/goals-section";
import { PenaltiesSection } from "../summary/penalties-section";
import { PlayerStatsSection } from "../summary/player-stats-section";
import { ShootoutSection } from "../summary/shootout-section";
import { GoalkeeperStatsSection } from "../summary/goalkeeper-stats-section";
import { TimelineSection } from "../summary/timeline-section";
import { useMatchGoalkeeperStats } from "@/hooks/use-match-goalkeeper-stats";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "../ui/separator";
import { AddPenaltyForm } from "../shared/add-penalty-form";
import { safeUUID, cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateScoreFromSummary } from "@/lib/match-helpers";
import { useAdminMode } from '@/hooks/use-admin-mode';

interface FixtureMatchSummaryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  match: MatchData | null;
  tournament: Tournament | null;
}

type EditableStats = Record<string, Record<string, { shots: string }>>;

const REG_PERIOD_NAMES = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH'];

function getNextPeriodText(playedPeriods: string[], numRegularPeriods: number): string {
  if (!playedPeriods || playedPeriods.length === 0) return '1ST';
  const last = playedPeriods[playedPeriods.length - 1];
  if (last === 'OT') return 'OT2';
  if (last.startsWith('OT')) {
    const n = parseInt(last.substring(2), 10);
    return `OT${(isNaN(n) ? 1 : n) + 1}`;
  }
  const idx = REG_PERIOD_NAMES.indexOf(last);
  if (idx !== -1) {
    const nextNum = idx + 2; // 1-indexed period number
    if (nextNum <= numRegularPeriods) return REG_PERIOD_NAMES[idx + 1];
    return 'OT';
  }
  return 'OT';
}

export function FixtureMatchSummaryDialog({ isOpen, onOpenChange, match, tournament }: FixtureMatchSummaryDialogProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  
  const [localSummary, setLocalSummary] = useState<GameSummary | undefined>(undefined);
  const [isEditing, setIsEditing] = useState(false);
  const [editedShots, setEditedShots] = useState<EditableStats>({});
  
  const [isAddPenaltyOpen, setIsAddPenaltyOpen] = useState(false);
  const [addPenaltyContext, setAddPenaltyContext] = useState<{team: Team, period: string} | null>(null);

  const [isAttendanceEditing, setIsAttendanceEditing] = useState(false);
  const [localAttendance, setLocalAttendance] = useState<{ home: Set<string>, away: Set<string> }>({ home: new Set(), away: new Set() });

  const [activeTab, setActiveTab] = useState("timeline");
  const [statsPeriodIndex, setStatsPeriodIndex] = useState(0);

  const scrollToStatsPeriod = useCallback((index: number) => {
    setStatsPeriodIndex(index);
  }, []);

  const { isReadOnly, adminSecret } = useAdminMode();

  useEffect(() => {
    if (isOpen && match?.summary) {
      const summaryCopy = JSON.parse(JSON.stringify(match.summary));
      setLocalSummary(summaryCopy);
      setLocalAttendance({
        home: new Set((summaryCopy.attendance?.home || []).map((p: any) => p.id)),
        away: new Set((summaryCopy.attendance?.away || []).map((p: any) => p.id)),
      });
    } else {
      setLocalSummary(undefined);
    }
    setIsEditing(false);
    setIsAttendanceEditing(false);
    setStatsPeriodIndex(0);
    setActiveTab("timeline");
  }, [isOpen, match]);
  
  const homeTeam = useMemo(() => tournament?.teams.find(t => t.id === match?.homeTeamId), [tournament, match]);
  const awayTeam = useMemo(() => tournament?.teams.find(t => t.id === match?.awayTeamId), [tournament, match]);
  const categoryName = useMemo(() => getCategoryNameById(match?.categoryId || '', tournament?.categories), [match, tournament]);

  // Build player lists from summary attendance (includes transient players and updated numbers)
  // Falls back to tournament roster if summary attendance is not available
  const homePlayers: PlayerData[] = useMemo(() => {
    if (localSummary?.attendance?.home) {
      return localSummary.attendance.home.map(p => ({ id: p.id, number: p.number, name: p.name, type: p.type || 'player' }));
    }
    return homeTeam?.players || [];
  }, [localSummary?.attendance?.home, homeTeam]);

  const awayPlayers: PlayerData[] = useMemo(() => {
    if (localSummary?.attendance?.away) {
      return localSummary.attendance.away.map(p => ({ id: p.id, number: p.number, name: p.name, type: p.type || 'player' }));
    }
    return awayTeam?.players || [];
  }, [localSummary?.attendance?.away, awayTeam]);

  const aggregatedGoals = useMemo(() => {
    if (!localSummary?.statsByPeriod) return { home: [] as SummaryGoalEntry[], away: [] as SummaryGoalEntry[] };
    return localSummary.statsByPeriod.reduce((acc, periodSummary) => {
        acc.home.push(...(periodSummary.stats.goals.home || []));
        acc.away.push(...(periodSummary.stats.goals.away || []));
        return acc;
    }, { home: [] as SummaryGoalEntry[], away: [] as SummaryGoalEntry[] });
  }, [localSummary]);

  const aggregatedPenalties = useMemo(() => {
    if (!localSummary?.statsByPeriod) return { home: [] as SummaryPenaltyEntry[], away: [] as SummaryPenaltyEntry[] };
    return localSummary.statsByPeriod.reduce((acc, periodSummary) => {
        acc.home.push(...(periodSummary.stats.penalties.home || []));
        acc.away.push(...(periodSummary.stats.penalties.away || []));
        return acc;
    }, { home: [] as SummaryPenaltyEntry[], away: [] as SummaryPenaltyEntry[] });
  }, [localSummary]);

  const goalkeeperStats = useMatchGoalkeeperStats(localSummary, homeTeam, awayTeam);

  const aggregatedStats = useMemo(() => {
    if (!localSummary) return { home: [], away: [] };

    const statsMap: { home: Map<string, SummaryPlayerStats>, away: Map<string, SummaryPlayerStats> } = {
        home: new Map(),
        away: new Map()
    };

    homePlayers.forEach(p => statsMap.home.set(p.id, { id: p.id, shots: 0, goals: 0, assists: 0 }));
    awayPlayers.forEach(p => statsMap.away.set(p.id, { id: p.id, shots: 0, goals: 0, assists: 0 }));

    (localSummary.statsByPeriod || []).forEach(period => {
      ['home', 'away'].forEach(teamStr => {
        const team = teamStr as Team;
        const currentTeamMap = team === 'home' ? statsMap.home : statsMap.away;

        (period.stats.goals[team] || []).forEach(goal => {
            const scorerId = goal.scorer?.playerId;
            if (scorerId && currentTeamMap.has(scorerId)) currentTeamMap.get(scorerId)!.goals++;
            const assistId = goal.assist?.playerId;
            if (assistId && currentTeamMap.has(assistId)) currentTeamMap.get(assistId)!.assists++;
            const assist2Id = goal.assist2?.playerId;
            if (assist2Id && currentTeamMap.has(assist2Id)) currentTeamMap.get(assist2Id)!.assists++;
        });

         (period.stats.playerStats[team] || []).forEach(pStat => {
             if(currentTeamMap.has(pStat.id)) {
                 currentTeamMap.get(pStat.id)!.shots += pStat.shots;
             }
         });
      });
    });

    return { home: Array.from(statsMap.home.values()), away: Array.from(statsMap.away.values()) };
  }, [localSummary, homePlayers, awayPlayers]);

  const handleGoalChange = (action: 'add' | 'update' | 'delete', team: Team, periodText: string, goal: SummaryGoalEntry, originalGoalId?: string) => {
    setLocalSummary(prevSummary => {
        if (!prevSummary) return undefined;
        const newSummary = JSON.parse(JSON.stringify(prevSummary));
        let period = newSummary.statsByPeriod.find((p: SummaryPeriodSummary) => p.period === periodText);
        if (!period) {
            period = { period: periodText, stats: { goals: { home: [], away: [] }, penalties: { home: [], away: [] }, playerStats: { home: [], away: [] } }};
            newSummary.statsByPeriod.push(period);
        }

        switch (action) {
            case 'add':
                period.stats.goals[team].push(goal);
                break;
            case 'update':
                const index = period.stats.goals[team].findIndex((g: SummaryGoalEntry) => g.id === originalGoalId);
                if (index !== -1) period.stats.goals[team][index] = goal;
                break;
            case 'delete':
                period.stats.goals[team] = period.stats.goals[team].filter((g: SummaryGoalEntry) => g.id !== originalGoalId);
                break;
        }
        return newSummary;
    });
  };

  const handlePenaltyChange = (action: 'add' | 'delete', team: Team, periodText: string, penalty: SummaryPenaltyEntry) => {
    setLocalSummary(prevSummary => {
        if (!prevSummary) return undefined;
        const newSummary = JSON.parse(JSON.stringify(prevSummary));
        let period = newSummary.statsByPeriod.find((p: SummaryPeriodSummary) => p.period === periodText);
        if (!period) {
            period = { period: periodText, stats: { goals: { home: [], away: [] }, penalties: { home: [], away: [] }, playerStats: { home: [], away: [] } }};
            newSummary.statsByPeriod.push(period);
        }

        if (action === 'add') {
            period.stats.penalties[team].push(penalty);
        } else { // delete
            period.stats.penalties[team] = period.stats.penalties[team].filter((p: SummaryPenaltyEntry) => p.id !== penalty.id);
        }
        return newSummary;
    });
  };

  const handleAddPenaltyClick = (team: Team, period: string) => {
    setAddPenaltyContext({ team, period });
    setIsAddPenaltyOpen(true);
  };
  
  const handleAddPenaltySubmit = (team: Team, playerNumber: string, penaltyTypeId: string, gameTimeCs?: number, periodText?: string) => {
    if(!match || !addPenaltyContext) return;
    const penaltyDef = state.config.penaltyTypes.find(p => p.id === penaltyTypeId);
    if (!penaltyDef) return;

    // Look up player ID from number
    const teamPlayers = team === 'home' ? homePlayers : awayPlayers;
    const player = (teamPlayers ?? []).find(p => p.number === playerNumber);

    const penaltyEntry: SummaryPenaltyEntry = {
      id: `manual-${safeUUID()}`,
      team, playerId: player?.id || playerNumber, penaltyName: penaltyDef.name, initialDuration: penaltyDef.duration,
      reducesPlayerCount: penaltyDef.reducesPlayerCount, clearsOnGoal: penaltyDef.clearsOnGoal,
      isBenchPenalty: penaltyDef.isBenchPenalty, addTimestamp: new Date(match.date).getTime(),
      addGameTime: gameTimeCs || 0, addPeriodText: addPenaltyContext.period, endReason: 'completed',
      timeServed: penaltyDef.duration,
    };

    handlePenaltyChange('add', team, addPenaltyContext.period, penaltyEntry);
    toast({ title: "Penalidad Añadida", description: "La penalidad se ha añadido manualmente al resumen."});
    setIsAddPenaltyOpen(false);
  };

  const handleDeletePenalty = (team: Team, log: SummaryPenaltyEntry, periodText: string) => {
     handlePenaltyChange('delete', team, periodText, log);
     toast({ title: "Penalidad Eliminada", variant: "destructive" });
  };
  
  const handleSaveAllChanges = () => {
    if (isReadOnly || !localSummary || !match || !tournament) return;
    dispatch({ type: 'SAVE_MATCH_SUMMARY', payload: { matchId: match.id, summary: localSummary, adminSecret: adminSecret ?? undefined } });
    toast({ title: "Resumen Guardado", description: "Todos los cambios en el resumen del partido han sido guardados."});
    onOpenChange(false);
  };

  const handleEditClick = () => {
    if (isReadOnly) return;
    const initialShots: EditableStats = {};
    if (localSummary?.statsByPeriod) {
        localSummary.statsByPeriod.forEach(periodSummary => {
            initialShots[periodSummary.period] = {};
            ['home', 'away'].forEach(teamStr => {
                const team = teamStr as Team;
                (periodSummary.stats.playerStats[team] || []).forEach(pStat => {
                    initialShots[periodSummary.period][pStat.id] = { shots: String(pStat.shots || 0) };
                });
            });
        });
    }
    setEditedShots(initialShots);
    setIsEditing(true);
  };
  
  const handleCancelClick = () => setIsEditing(false);

  const lastOTPeriod = useMemo(() => {
    const played = localSummary?.playedPeriods || [];
    const lastPeriod = played[played.length - 1];
    return lastPeriod?.startsWith('OT') ? lastPeriod : null;
  }, [localSummary?.playedPeriods]);

  const handleRemovePeriod = () => {
    if (isReadOnly || !localSummary || !lastOTPeriod) return;
    setLocalSummary(prev => {
      if (!prev) return prev;
      const newPlayedPeriods = prev.playedPeriods.filter(p => p !== lastOTPeriod);
      const newStatsByPeriod = (prev.statsByPeriod || []).filter(p => p.period !== lastOTPeriod);
      const stillHasOT = newPlayedPeriods.some(p => p.startsWith('OT'));
      return {
        ...prev,
        playedPeriods: newPlayedPeriods,
        statsByPeriod: newStatsByPeriod,
        overTimeOrShootouts: stillHasOT ? prev.overTimeOrShootouts : false,
      };
    });
    toast({ title: "Período Eliminado", description: `Se eliminó el período ${lastOTPeriod} del resumen.` });
  };

  const handleAddPeriod = () => {
    if (isReadOnly || !localSummary) return;
    const numRegPeriods = state.config.numberOfRegularPeriods ?? 3;
    const nextPeriod = getNextPeriodText(localSummary.playedPeriods || [], numRegPeriods);
    const emptyHomePlayers: SummaryPlayerStats[] = homePlayers.map(p => ({ id: p.id, goals: 0, assists: 0, shots: 0 }));
    const emptyAwayPlayers: SummaryPlayerStats[] = awayPlayers.map(p => ({ id: p.id, goals: 0, assists: 0, shots: 0 }));
    const newPeriodSummary: SummaryPeriodSummary = {
      period: nextPeriod,
      stats: {
        goals: { home: [], away: [] },
        penalties: { home: [], away: [] },
        playerStats: { home: emptyHomePlayers, away: emptyAwayPlayers },
      },
    };
    setLocalSummary(prev => {
      if (!prev) return prev;
      const isOT = nextPeriod.startsWith('OT');
      return {
        ...prev,
        playedPeriods: [...(prev.playedPeriods || []), nextPeriod],
        statsByPeriod: [...(prev.statsByPeriod || []), newPeriodSummary],
        ...(isOT ? { overTimeOrShootouts: true } : {}),
      };
    });
    toast({ title: "Período Agregado", description: `Se agregó el período ${nextPeriod} al resumen.` });
  };

  const handleSaveShotsClick = () => {
    // Validate shots >= goals per player per period before saving
    if (localSummary) {
      for (const periodSummary of localSummary.statsByPeriod) {
        if (editedShots[periodSummary.period]) {
          for (const teamStr of ['home', 'away'] as Team[]) {
            for (const pStat of (periodSummary.stats.playerStats[teamStr] || [])) {
              const editedVal = editedShots[periodSummary.period]?.[pStat.id];
              if (editedVal) {
                const shots = parseInt(editedVal.shots, 10) || 0;
                if (shots < (pStat.goals || 0)) {
                  toast({ title: "Error en tiros", description: "Los tiros de un jugador no pueden ser menores a sus goles en el mismo período.", variant: "destructive" });
                  return;
                }
              }
            }
          }
        }
      }
    }

    setLocalSummary(prevSummary => {
      if (!prevSummary) return undefined;
      const newSummary = JSON.parse(JSON.stringify(prevSummary));
      
      newSummary.statsByPeriod.forEach((periodSummary: SummaryPeriodSummary) => {
        if(editedShots[periodSummary.period]) {
            ['home', 'away'].forEach(teamStr => {
                const team = teamStr as Team;
                periodSummary.stats.playerStats[team] = (periodSummary.stats.playerStats[team] || []).map((pStat: SummaryPlayerStats) => {
                    if (editedShots[periodSummary.period]?.[pStat.id]) {
                        return { ...pStat, shots: parseInt(editedShots[periodSummary.period][pStat.id].shots, 10) || 0 };
                    }
                    return pStat;
                });
            });
        }
      });
      return newSummary;
    });

    toast({ title: "Tiros Actualizados", description: "Se han guardado los cambios en los tiros por período." });
    setIsEditing(false);
  };

  const handleShotInputChange = (period: string, playerId: string, value: string) => {
    if (/^\d*$/.test(value)) {
        setEditedShots(prev => ({
            ...prev,
            [period]: {
                ...prev[period],
                [playerId]: { ...prev[period]?.[playerId], shots: value },
            }
        }));
    }
  };

  const handleToggleAttendance = (team: 'home' | 'away', playerId: string) => {
    if (!isAttendanceEditing || isReadOnly) return;
    setLocalAttendance(prev => {
      const newSet = new Set(prev[team]);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return { ...prev, [team]: newSet };
    });
  };

  const handleSaveAttendance = () => {
    if (isReadOnly || !localSummary) return;

    setLocalSummary(prevSummary => {
        if (!prevSummary) return undefined;
        const newSummary = JSON.parse(JSON.stringify(prevSummary));
        
        const homeAttendedInfo: AttendedPlayerInfo[] = homePlayers
            .filter(p => localAttendance.home.has(p.id))
            .map(p => ({ id: p.id, number: p.number, name: p.name }));

        const awayAttendedInfo: AttendedPlayerInfo[] = awayPlayers
            .filter(p => localAttendance.away.has(p.id))
            .map(p => ({ id: p.id, number: p.number, name: p.name }));

        newSummary.attendance = {
            home: homeAttendedInfo,
            away: awayAttendedInfo
        };
        return newSummary;
    });

    toast({ title: "Asistencia Actualizada", description: "La lista de asistencia ha sido actualizada en esta vista. Guarda todos los cambios para persistir." });
    setIsAttendanceEditing(false);
  };
  
  if (!match || !tournament || !localSummary) return null;

  const { statsByPeriod, playedPeriods } = localSummary;

  // Calculate score from summary (single source of truth)
  const { home: finalHomeScore, away: finalAwayScore } = calculateScoreFromSummary(localSummary);


  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[96vh] flex flex-col py-3 gap-2" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="pb-0">
          <DialogTitle className="flex items-center justify-between text-lg pr-8">
            <span>Resumen</span>
            <div className="flex items-center gap-4 text-xl">
              <span className="font-bold text-primary">{homeTeam?.name} - <span className="text-accent">{finalHomeScore}</span></span>
              <span className="font-bold text-primary">{awayTeam?.name} - <span className="text-accent">{finalAwayScore}</span></span>
            </div>
            <span className="text-sm font-normal text-muted-foreground">Cat: {categoryName}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {homeTeam?.name || '?'} vs {awayTeam?.name || '?'} - Cat: {categoryName}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-grow flex flex-col overflow-hidden">
          <TabsList className={`grid w-full gap-1 ${state.config.showShotsData ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-3 sm:grid-cols-4'}`}>
            <TabsTrigger value="timeline" className="text-xs sm:text-sm">Cronología</TabsTrigger>
            <TabsTrigger value="general" className="text-xs sm:text-sm">General</TabsTrigger>
            <TabsTrigger value="goalsByPeriod" className="text-xs sm:text-sm">Goles</TabsTrigger>
            <TabsTrigger value="penaltiesByPeriod" className="text-xs sm:text-sm">Faltas</TabsTrigger>
            {state.config.showShotsData && <TabsTrigger value="statsByPeriod" className="text-xs sm:text-sm">Estadísticas</TabsTrigger>}
          </TabsList>

          <TabsContent value="timeline" className="flex-grow overflow-hidden mt-4 px-4">
            <div className="h-full overflow-y-auto">
              <TimelineSection
                summary={localSummary}
                homeTeam={homeTeam || undefined}
                awayTeam={awayTeam || undefined}
              />
            </div>
          </TabsContent>

          <TabsContent value="general" className="flex-grow overflow-hidden mt-4">
             <ScrollArea className="h-full pr-6 -mr-6">
                {/* Desktop: lado a lado */}
                <div className="hidden md:block space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <GoalsSection teamName={homeTeam?.name || ''} goals={aggregatedGoals.home} editable={false} players={homePlayers} />
                      <GoalsSection teamName={awayTeam?.name || ''} goals={aggregatedGoals.away} editable={false} players={awayPlayers} />
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-6">
                      <PenaltiesSection team="home" teamName={homeTeam?.name || ''} penalties={aggregatedPenalties.home} players={homePlayers} />
                      <PenaltiesSection team="away" teamName={awayTeam?.name || ''} penalties={aggregatedPenalties.away} players={awayPlayers} />
                    </div>
                    {state.config.showShotsData && (
                      <>
                        <Separator />
                        <div className="grid grid-cols-2 gap-6">
                            <PlayerStatsSection
                              team="home"
                              teamName={homeTeam?.name || ''}
                              allPlayers={homePlayers}
                              playerStats={aggregatedStats.home}
                              attendance={localSummary.attendance.home}
                              editingAttendanceSet={localAttendance.home}
                              editable={false}
                              showAttendanceControls={!isReadOnly}
                              isAttendanceEditing={isAttendanceEditing}
                              onToggleAttendance={handleToggleAttendance}
                              onEditToggle={setIsAttendanceEditing}
                              onSave={handleSaveAttendance}
                            />
                            <PlayerStatsSection
                              team="away"
                              teamName={awayTeam?.name || ''}
                              allPlayers={awayPlayers}
                              playerStats={aggregatedStats.away}
                              attendance={localSummary.attendance.away}
                              editingAttendanceSet={localAttendance.away}
                              editable={false}
                              showAttendanceControls={!isReadOnly}
                              isAttendanceEditing={isAttendanceEditing}
                              onToggleAttendance={handleToggleAttendance}
                              onEditToggle={setIsAttendanceEditing}
                              onSave={handleSaveAttendance}
                            />
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-6">
                          <GoalkeeperStatsSection teamName={homeTeam?.name || 'Local'} goalkeeperStats={goalkeeperStats.home} attendance={localSummary.attendance.home} />
                          <GoalkeeperStatsSection teamName={awayTeam?.name || 'Visitante'} goalkeeperStats={goalkeeperStats.away} attendance={localSummary.attendance.away} />
                        </div>
                      </>
                    )}
                    {localSummary.shootout && (localSummary.shootout.homeAttempts.length > 0 || localSummary.shootout.awayAttempts.length > 0) && (
                        <>
                          <Separator />
                          <div className="grid grid-cols-2 gap-6">
                              <ShootoutSection teamName={homeTeam?.name || ''} attempts={localSummary.shootout.homeAttempts} players={homePlayers} />
                              <ShootoutSection teamName={awayTeam?.name || ''} attempts={localSummary.shootout.awayAttempts} players={awayPlayers} />
                          </div>
                        </>
                    )}
                 </div>

                 {/* Mobile: tabs por equipo */}
                 <div className="md:hidden">
                   <Tabs defaultValue="home" className="w-full">
                     <TabsList className="grid w-full grid-cols-2">
                       <TabsTrigger value="home">{homeTeam?.name || 'Local'}</TabsTrigger>
                       <TabsTrigger value="away">{awayTeam?.name || 'Visitante'}</TabsTrigger>
                     </TabsList>
                     <TabsContent value="home" className="space-y-6 mt-4">
                       <GoalsSection teamName={homeTeam?.name || ''} goals={aggregatedGoals.home} editable={false} players={homePlayers} />
                       <Separator />
                       <PenaltiesSection team="home" teamName={homeTeam?.name || ''} penalties={aggregatedPenalties.home} players={homePlayers} />
                       {state.config.showShotsData && (
                         <>
                           <Separator />
                           <PlayerStatsSection
                             team="home"
                             teamName={homeTeam?.name || ''}
                             allPlayers={homePlayers}
                             playerStats={aggregatedStats.home}
                             attendance={localSummary.attendance.home}
                             editingAttendanceSet={localAttendance.home}
                             editable={false}
                             showAttendanceControls={!isReadOnly}
                             isAttendanceEditing={isAttendanceEditing}
                             onToggleAttendance={handleToggleAttendance}
                             onEditToggle={setIsAttendanceEditing}
                             onSave={handleSaveAttendance}
                           />
                           <Separator />
                           <GoalkeeperStatsSection teamName={homeTeam?.name || 'Local'} goalkeeperStats={goalkeeperStats.home} attendance={localSummary.attendance.home} />
                         </>
                       )}
                       {localSummary.shootout && localSummary.shootout.homeAttempts.length > 0 && (
                         <>
                           <Separator />
                           <ShootoutSection teamName={homeTeam?.name || ''} attempts={localSummary.shootout.homeAttempts} players={homePlayers} />
                         </>
                       )}
                     </TabsContent>
                     <TabsContent value="away" className="space-y-6 mt-4">
                       <GoalsSection teamName={awayTeam?.name || ''} goals={aggregatedGoals.away} editable={false} players={awayPlayers} />
                       <Separator />
                       <PenaltiesSection team="away" teamName={awayTeam?.name || ''} penalties={aggregatedPenalties.away} players={awayPlayers} />
                       {state.config.showShotsData && (
                         <>
                           <Separator />
                           <PlayerStatsSection
                             team="away"
                             teamName={awayTeam?.name || ''}
                             allPlayers={awayPlayers}
                             playerStats={aggregatedStats.away}
                             attendance={localSummary.attendance.away}
                             editingAttendanceSet={localAttendance.away}
                             editable={false}
                             showAttendanceControls={!isReadOnly}
                             isAttendanceEditing={isAttendanceEditing}
                             onToggleAttendance={handleToggleAttendance}
                             onEditToggle={setIsAttendanceEditing}
                             onSave={handleSaveAttendance}
                           />
                           <Separator />
                           <GoalkeeperStatsSection teamName={awayTeam?.name || 'Visitante'} goalkeeperStats={goalkeeperStats.away} attendance={localSummary.attendance.away} />
                         </>
                       )}
                       {localSummary.shootout && localSummary.shootout.awayAttempts.length > 0 && (
                         <>
                           <Separator />
                           <ShootoutSection teamName={awayTeam?.name || ''} attempts={localSummary.shootout.awayAttempts} players={awayPlayers} />
                         </>
                       )}
                     </TabsContent>
                   </Tabs>
                 </div>
             </ScrollArea>
          </TabsContent>
          
          <TabsContent value="goalsByPeriod" className="flex-grow overflow-hidden mt-4">
            <ScrollArea className="h-full pr-6 -mr-6">
              {/* Desktop */}
              <div className="hidden md:block space-y-8">
                  {(playedPeriods || []).map(periodText => {
                    const periodData = statsByPeriod?.find(p => p.period === periodText);
                    return (
                      <div key={`goals-${periodText}`} className="space-y-4">
                        <h3 className="text-xl font-semibold text-center text-primary-foreground border-b pb-2 mb-4">{periodText}</h3>
                        <div className="grid grid-cols-2 gap-6">
                          <GoalsSection teamName={homeTeam?.name || ''} goals={periodData?.stats.goals.home} onGoalChange={(action, goal, id) => handleGoalChange(action, 'home', periodText, goal, id)} editable={!isReadOnly} players={homePlayers} />
                          <GoalsSection teamName={awayTeam?.name || ''} goals={periodData?.stats.goals.away} onGoalChange={(action, goal, id) => handleGoalChange(action, 'away', periodText, goal, id)} editable={!isReadOnly} players={awayPlayers} />
                        </div>
                      </div>
                    );
                  })}
              </div>
              {/* Mobile */}
              <div className="md:hidden">
                <Tabs defaultValue="home" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="home">{homeTeam?.name || 'Local'}</TabsTrigger>
                    <TabsTrigger value="away">{awayTeam?.name || 'Visitante'}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="home" className="space-y-8 mt-4">
                    {(playedPeriods || []).map(periodText => {
                      const periodData = statsByPeriod?.find(p => p.period === periodText);
                      return (
                        <div key={`goals-home-${periodText}`}>
                          <h3 className="text-lg font-semibold text-center text-primary-foreground border-b pb-2 mb-4">{periodText}</h3>
                          <GoalsSection teamName={homeTeam?.name || ''} goals={periodData?.stats.goals.home} onGoalChange={(action, goal, id) => handleGoalChange(action, 'home', periodText, goal, id)} editable={!isReadOnly} players={homePlayers} />
                        </div>
                      );
                    })}
                  </TabsContent>
                  <TabsContent value="away" className="space-y-8 mt-4">
                    {(playedPeriods || []).map(periodText => {
                      const periodData = statsByPeriod?.find(p => p.period === periodText);
                      return (
                        <div key={`goals-away-${periodText}`}>
                          <h3 className="text-lg font-semibold text-center text-primary-foreground border-b pb-2 mb-4">{periodText}</h3>
                          <GoalsSection teamName={awayTeam?.name || ''} goals={periodData?.stats.goals.away} onGoalChange={(action, goal, id) => handleGoalChange(action, 'away', periodText, goal, id)} editable={!isReadOnly} players={awayPlayers} />
                        </div>
                      );
                    })}
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="penaltiesByPeriod" className="flex-grow overflow-hidden mt-4">
             <ScrollArea className="h-full pr-6 -mr-6">
                 {/* Desktop */}
                 <div className="hidden md:block space-y-8">
                  {(playedPeriods || []).map(periodText => {
                    const periodData = statsByPeriod?.find(p => p.period === periodText);
                    return (
                      <div key={`penalties-${periodText}`} className="space-y-4">
                        <h3 className="text-xl font-semibold text-center text-primary-foreground border-b pb-2 mb-4">{periodText}</h3>
                        <div className="grid grid-cols-2 gap-6">
                           <PenaltiesSection team="home" teamName={homeTeam?.name || ''} penalties={periodData?.stats.penalties.home} onDelete={isReadOnly ? undefined : (id) => handleDeletePenalty('home', {id} as SummaryPenaltyEntry, periodText)} onAdd={isReadOnly ? undefined : () => handleAddPenaltyClick('home', periodText)} players={homePlayers} />
                           <PenaltiesSection team="away" teamName={awayTeam?.name || ''} penalties={periodData?.stats.penalties.away} onDelete={isReadOnly ? undefined : (id) => handleDeletePenalty('away', {id} as SummaryPenaltyEntry, periodText)} onAdd={isReadOnly ? undefined : () => handleAddPenaltyClick('away', periodText)} players={awayPlayers} />
                        </div>
                      </div>
                    );
                  })}
                 </div>
                 {/* Mobile */}
                 <div className="md:hidden">
                   <Tabs defaultValue="home" className="w-full">
                     <TabsList className="grid w-full grid-cols-2">
                       <TabsTrigger value="home">{homeTeam?.name || 'Local'}</TabsTrigger>
                       <TabsTrigger value="away">{awayTeam?.name || 'Visitante'}</TabsTrigger>
                     </TabsList>
                     <TabsContent value="home" className="space-y-8 mt-4">
                       {(playedPeriods || []).map(periodText => {
                         const periodData = statsByPeriod?.find(p => p.period === periodText);
                         return (
                           <div key={`penalties-home-${periodText}`}>
                             <h3 className="text-lg font-semibold text-center text-primary-foreground border-b pb-2 mb-4">{periodText}</h3>
                             <PenaltiesSection team="home" teamName={homeTeam?.name || ''} penalties={periodData?.stats.penalties.home} onDelete={isReadOnly ? undefined : (id) => handleDeletePenalty('home', {id} as SummaryPenaltyEntry, periodText)} onAdd={isReadOnly ? undefined : () => handleAddPenaltyClick('home', periodText)} players={homePlayers} />
                           </div>
                         );
                       })}
                     </TabsContent>
                     <TabsContent value="away" className="space-y-8 mt-4">
                       {(playedPeriods || []).map(periodText => {
                         const periodData = statsByPeriod?.find(p => p.period === periodText);
                         return (
                           <div key={`penalties-away-${periodText}`}>
                             <h3 className="text-lg font-semibold text-center text-primary-foreground border-b pb-2 mb-4">{periodText}</h3>
                             <PenaltiesSection team="away" teamName={awayTeam?.name || ''} penalties={periodData?.stats.penalties.away} onDelete={isReadOnly ? undefined : (id) => handleDeletePenalty('away', {id} as SummaryPenaltyEntry, periodText)} onAdd={isReadOnly ? undefined : () => handleAddPenaltyClick('away', periodText)} players={awayPlayers} />
                           </div>
                         );
                       })}
                     </TabsContent>
                   </Tabs>
                 </div>
              </ScrollArea>
          </TabsContent>

          {state.config.showShotsData && (
            <TabsContent value="statsByPeriod" className="flex-grow overflow-hidden mt-2 flex flex-col">
                    {/* Carousel with side arrows */}
                    <div className="flex-grow overflow-hidden flex items-stretch">
                      {/* Left arrow */}
                      <button
                        className="flex-shrink-0 px-1 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                        disabled={statsPeriodIndex === 0}
                        onClick={() => scrollToStatsPeriod(statsPeriodIndex - 1)}
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>

                      {/* Slides */}
                      <div
                        className="flex-grow overflow-hidden"
                        onScroll={(e) => { e.currentTarget.scrollLeft = 0; e.currentTarget.scrollTop = 0; }}
                      >
                        <div
                          className="flex h-full transition-transform duration-300 ease-in-out"
                          style={{ transform: `translateX(-${statsPeriodIndex * 100}%)` }}
                          onFocus={(e) => {
                            const slide = (e.target as HTMLElement).closest('[data-period-index]');
                            if (slide) {
                              const idx = Number(slide.getAttribute('data-period-index'));
                              if (!isNaN(idx) && idx !== statsPeriodIndex) {
                                setStatsPeriodIndex(idx);
                              }
                            }
                          }}
                        >
                        {(playedPeriods || []).map((periodText, periodIdx) => {
                          const periodData = statsByPeriod?.find(p => p.period === periodText);
                          const isEvenPeriod = periodIdx % 2 === 0;
                          const periodGKStats = {
                            home: goalkeeperStats.home.map(gk => ({
                              ...gk,
                              totalShotsAgainst: gk.periodStats.find(p => p.period === periodText)?.shotsAgainst || 0,
                              totalGoalsAgainst: gk.periodStats.find(p => p.period === periodText)?.goalsAgainst || 0,
                              totalSaves: gk.periodStats.find(p => p.period === periodText)?.saves || 0,
                              savePercentage: gk.periodStats.find(p => p.period === periodText)?.savePercentage || 0,
                              totalTimeOnIce: gk.periodStats.find(p => p.period === periodText)?.timeOnIce || 0,
                              periodStats: []
                            })),
                            away: goalkeeperStats.away.map(gk => ({
                              ...gk,
                              totalShotsAgainst: gk.periodStats.find(p => p.period === periodText)?.shotsAgainst || 0,
                              totalGoalsAgainst: gk.periodStats.find(p => p.period === periodText)?.goalsAgainst || 0,
                              totalSaves: gk.periodStats.find(p => p.period === periodText)?.saves || 0,
                              savePercentage: gk.periodStats.find(p => p.period === periodText)?.savePercentage || 0,
                              totalTimeOnIce: gk.periodStats.find(p => p.period === periodText)?.timeOnIce || 0,
                              periodStats: []
                            }))
                          };
                          const periodBg = periodIdx % 2 === 0 ? 'bg-sky-400/30' : 'bg-indigo-500/30';
                          const periodCardAccent = periodIdx % 2 === 0 ? 'border-t-2 border-t-sky-400' : 'border-t-2 border-t-indigo-500';
                          return (
                            <div
                              key={`stats-${periodText}`}
                              data-period-index={periodIdx}
                              className="w-full flex-shrink-0 overflow-y-auto px-2"
                            >
                              {/* Desktop: period strip left, then two team columns */}
                              <div className="hidden md:block space-y-3">
                                <div className={cn("flex items-center justify-center py-1 rounded-lg", periodBg)}>
                                  <span className="font-bold text-sm">{periodText}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="flex-1"><PlayerStatsSection className={periodCardAccent} team="home" teamName={homeTeam?.name || ''} allPlayers={homePlayers} playerStats={periodData?.stats.playerStats.home} attendance={localSummary.attendance.home} editable={isEditing && !isReadOnly} editedStats={editedShots[periodText]} onStatChange={(playerId, field, value) => handleShotInputChange(periodText, playerId, value)} /></div>
                                  <div className="flex-1"><PlayerStatsSection className={periodCardAccent} team="away" teamName={awayTeam?.name || ''} allPlayers={awayPlayers} playerStats={periodData?.stats.playerStats.away} attendance={localSummary.attendance.away} editable={isEditing && !isReadOnly} editedStats={editedShots[periodText]} onStatChange={(playerId, field, value) => handleShotInputChange(periodText, playerId, value)} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <GoalkeeperStatsSection className={periodCardAccent} goalkeeperStats={periodGKStats.home} attendance={localSummary.attendance.home} showOnlyPresent={true} />
                                  <GoalkeeperStatsSection className={periodCardAccent} goalkeeperStats={periodGKStats.away} attendance={localSummary.attendance.away} showOnlyPresent={true} />
                                </div>
                              </div>
                              {/* Mobile: stacked with period title */}
                              <div className="md:hidden space-y-3">
                                <h3 className={cn("text-lg font-bold text-center py-1 rounded-lg", periodBg)}>{periodText}</h3>
                                <PlayerStatsSection className={periodCardAccent} team="home" teamName={homeTeam?.name || ''} allPlayers={homePlayers} playerStats={periodData?.stats.playerStats.home} attendance={localSummary.attendance.home} editable={isEditing && !isReadOnly} editedStats={editedShots[periodText]} onStatChange={(playerId, field, value) => handleShotInputChange(periodText, playerId, value)} />
                                <GoalkeeperStatsSection className={periodCardAccent} goalkeeperStats={periodGKStats.home} attendance={localSummary.attendance.home} showOnlyPresent={true} />
                                <Separator />
                                <PlayerStatsSection className={periodCardAccent} team="away" teamName={awayTeam?.name || ''} allPlayers={awayPlayers} playerStats={periodData?.stats.playerStats.away} attendance={localSummary.attendance.away} editable={isEditing && !isReadOnly} editedStats={editedShots[periodText]} onStatChange={(playerId, field, value) => handleShotInputChange(periodText, playerId, value)} />
                                <GoalkeeperStatsSection className={periodCardAccent} goalkeeperStats={periodGKStats.away} attendance={localSummary.attendance.away} showOnlyPresent={true} />
                              </div>
                            </div>
                          );
                        })}
                        </div>
                      </div>

                      {/* Right arrow */}
                      <button
                        className="flex-shrink-0 px-1 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                        disabled={statsPeriodIndex >= (playedPeriods || []).length - 1}
                        onClick={() => scrollToStatsPeriod(statsPeriodIndex + 1)}
                      >
                        <ChevronRight className="h-6 w-6" />
                      </button>
                    </div>
          </TabsContent>
          )}
        </Tabs>

        <DialogFooter className="border-t pt-2 mt-auto">
          {isEditing && activeTab === 'statsByPeriod' ? (
            <>
              <Button type="button" size="sm" variant="destructive" onClick={handleCancelClick}><XCircle className="mr-1.5 h-3.5 w-3.5" />Abortar</Button>
              {lastOTPeriod && (
                <Button type="button" size="sm" variant="outline" onClick={handleRemovePeriod}>
                  <MinusCircle className="mr-1.5 h-3.5 w-3.5" />Eliminar {lastOTPeriod}
                </Button>
              )}
              <Button type="button" size="sm" variant="outline" onClick={handleAddPeriod}>
                <PlusCircle className="mr-1.5 h-3.5 w-3.5" />Agregar Período
              </Button>
              <Button type="button" size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleSaveShotsClick}><Check className="mr-1.5 h-3.5 w-3.5" />Confirmar</Button>
            </>
          ) : (
            <>
              <DialogClose asChild>
                <Button type="button" size="sm" variant="outline"><X className="mr-1.5 h-3.5 w-3.5" />Cerrar</Button>
              </DialogClose>
              {!isReadOnly && activeTab === 'statsByPeriod' && (
                <Button type="button" size="sm" variant="outline" onClick={e => { e.stopPropagation(); handleEditClick(); }}>
                  <Edit3 className="mr-1.5 h-3.5 w-3.5" />Editar Tiros
                </Button>
              )}
              {!isReadOnly && <Button type="button" size="sm" onClick={handleSaveAllChanges}><Check className="mr-1.5 h-3.5 w-3.5" />Guardar Cambios</Button>}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {addPenaltyContext && (
       <Dialog open={isAddPenaltyOpen} onOpenChange={setIsAddPenaltyOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Añadir Penalidad Manual</DialogTitle>
              <DialogDescription>Añadiendo una penalidad para {addPenaltyContext.team === 'home' ? homeTeam?.name : awayTeam?.name} en el período {addPenaltyContext.period}.</DialogDescription>
            </DialogHeader>
            <AddPenaltyForm
              homeTeamName={homeTeam?.name || 'Local'}
              awayTeamName={awayTeam?.name || 'Visitante'}
              penaltyTypes={state.config.penaltyTypes || []}
              defaultPenaltyTypeId={state.config.defaultPenaltyTypeId || null}
              onPenaltySent={handleAddPenaltySubmit}
              preselectedTeam={addPenaltyContext.team}
              showTimeInput={true}
              availablePeriods={localSummary.playedPeriods}
              preselectedPeriod={addPenaltyContext.period}
            />
          </DialogContent>
       </Dialog>
    )}
    </>
  );
}
