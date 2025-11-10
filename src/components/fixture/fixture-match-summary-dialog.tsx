
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Edit3, Check, XCircle } from "lucide-react";
import type { MatchData, Tournament, GameSummary, SummaryPlayerStats, PlayerData, PeriodStats, Team, GoalLog, PenaltyLog, PeriodSummary, AttendedPlayerInfo } from "@/types";
import { useGameState, getCategoryNameById } from "@/contexts/game-state-context";
import { GoalsSection } from "../summary/goals-section";
import { PenaltiesSection } from "../summary/penalties-section";
import { PlayerStatsSection } from "../summary/player-stats-section";
import { ShootoutSection } from "../summary/shootout-section";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "../ui/separator";
import { AddPenaltyForm } from "../shared/add-penalty-form";
import { safeUUID } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FixtureMatchSummaryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  match: MatchData | null;
  tournament: Tournament | null;
}

type EditableStats = Record<string, Record<string, { shots: string }>>;

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

  const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY === 'true';

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
  }, [isOpen, match]);
  
  const homeTeam = useMemo(() => tournament?.teams.find(t => t.id === match?.homeTeamId), [tournament, match]);
  const awayTeam = useMemo(() => tournament?.teams.find(t => t.id === match?.awayTeamId), [tournament, match]);
  const categoryName = useMemo(() => getCategoryNameById(match?.categoryId || '', tournament?.categories), [match, tournament]);

  const aggregatedGoals = useMemo(() => {
    if (!localSummary?.statsByPeriod) return { home: [], away: [] };
    return localSummary.statsByPeriod.reduce((acc, periodSummary) => {
        acc.home.push(...(periodSummary.stats.goals.home || []));
        acc.away.push(...(periodSummary.stats.goals.away || []));
        return acc;
    }, { home: [] as GoalLog[], away: [] as GoalLog[] });
  }, [localSummary]);

  const aggregatedPenalties = useMemo(() => {
    if (!localSummary?.statsByPeriod) return { home: [], away: [] };
    return localSummary.statsByPeriod.reduce((acc, periodSummary) => {
        acc.home.push(...(periodSummary.stats.penalties.home || []));
        acc.away.push(...(periodSummary.stats.penalties.away || []));
        return acc;
    }, { home: [] as PenaltyLog[], away: [] as PenaltyLog[] });
  }, [localSummary]);

  const aggregatedStats = useMemo(() => {
    if (!localSummary || !homeTeam || !awayTeam) return { home: [], away: [] };
    
    const statsMap: { home: Map<string, SummaryPlayerStats>, away: Map<string, SummaryPlayerStats> } = {
        home: new Map(),
        away: new Map()
    };

    homeTeam.players.forEach(p => statsMap.home.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));
    awayTeam.players.forEach(p => statsMap.away.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));

    (localSummary.statsByPeriod || []).forEach(period => {
      ['home', 'away'].forEach(teamStr => {
        const team = teamStr as Team;
        const currentTeamRoster = team === 'home' ? homeTeam.players : awayTeam.players;
        const currentTeamMap = team === 'home' ? statsMap.home : statsMap.away;

        (period.stats.goals[team] || []).forEach(goal => {
            const scorerId = currentTeamRoster.find(p => p.number === goal.scorer?.playerNumber)?.id;
            if (scorerId && currentTeamMap.has(scorerId)) currentTeamMap.get(scorerId)!.goals++;
            const assistId = currentTeamRoster.find(p => p.number === goal.assist?.playerNumber)?.id;
            if (assistId && currentTeamMap.has(assistId)) currentTeamMap.get(assistId)!.assists++;
        });

         (period.stats.playerStats[team] || []).forEach(pStat => {
             if(currentTeamMap.has(pStat.id)) {
                 currentTeamMap.get(pStat.id)!.shots += pStat.shots;
             }
         });
      });
    });

    return { home: Array.from(statsMap.home.values()), away: Array.from(statsMap.away.values()) };
  }, [localSummary, homeTeam, awayTeam]);

  const handleGoalChange = (action: 'add' | 'update' | 'delete', team: Team, periodText: string, goal: GoalLog, originalGoalId?: string) => {
    setLocalSummary(prevSummary => {
        if (!prevSummary) return undefined;
        const newSummary = JSON.parse(JSON.stringify(prevSummary));
        let period = newSummary.statsByPeriod.find((p: PeriodSummary) => p.period === periodText);
        if (!period) {
            period = { period: periodText, stats: { goals: { home: [], away: [] }, penalties: { home: [], away: [] }, playerStats: { home: [], away: [] } }};
            newSummary.statsByPeriod.push(period);
        }

        switch (action) {
            case 'add':
                period.stats.goals[team].push(goal);
                break;
            case 'update':
                const index = period.stats.goals[team].findIndex((g: GoalLog) => g.id === originalGoalId);
                if (index !== -1) period.stats.goals[team][index] = goal;
                break;
            case 'delete':
                period.stats.goals[team] = period.stats.goals[team].filter((g: GoalLog) => g.id !== originalGoalId);
                break;
        }
        return newSummary;
    });
  };

  const handlePenaltyChange = (action: 'add' | 'delete', team: Team, periodText: string, penalty: PenaltyLog) => {
    setLocalSummary(prevSummary => {
        if (!prevSummary) return undefined;
        const newSummary = JSON.parse(JSON.stringify(prevSummary));
        let period = newSummary.statsByPeriod.find((p: PeriodSummary) => p.period === periodText);
        if (!period) {
            period = { period: periodText, stats: { goals: { home: [], away: [] }, penalties: { home: [], away: [] }, playerStats: { home: [], away: [] } }};
            newSummary.statsByPeriod.push(period);
        }

        if (action === 'add') {
            period.stats.penalties[team].push(penalty);
        } else { // delete
            period.stats.penalties[team] = period.stats.penalties[team].filter((p: PenaltyLog) => p.id !== penalty.id);
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

    const penaltyLog: PenaltyLog = {
      id: `manual-${safeUUID()}`,
      team, playerNumber, penaltyName: penaltyDef.name, initialDuration: penaltyDef.duration,
      reducesPlayerCount: penaltyDef.reducesPlayerCount, clearsOnGoal: penaltyDef.clearsOnGoal,
      isBenchPenalty: penaltyDef.isBenchPenalty, addTimestamp: new Date(match.date).getTime(),
      addGameTime: gameTimeCs || 0, addPeriodText: addPenaltyContext.period, endReason: 'completed',
      timeServed: penaltyDef.duration,
    };
    
    handlePenaltyChange('add', team, addPenaltyContext.period, penaltyLog);
    toast({ title: "Penalidad Añadida", description: "La penalidad se ha añadido manualmente al resumen."});
    setIsAddPenaltyOpen(false);
  };

  const handleDeletePenalty = (team: Team, log: PenaltyLog, periodText: string) => {
     handlePenaltyChange('delete', team, periodText, log);
     toast({ title: "Penalidad Eliminada", variant: "destructive" });
  };
  
  const handleSaveAllChanges = () => {
    if (isReadOnly || !localSummary || !match || !tournament) return;
    dispatch({ type: 'SAVE_MATCH_SUMMARY', payload: { matchId: match.id, summary: localSummary } });
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
  
  const handleSaveShotsClick = () => {
    setLocalSummary(prevSummary => {
      if (!prevSummary) return undefined;
      const newSummary = JSON.parse(JSON.stringify(prevSummary));
      
      newSummary.statsByPeriod.forEach((periodSummary: PeriodSummary) => {
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
        
        const homeAttendedInfo: AttendedPlayerInfo[] = (homeTeam?.players || [])
            .filter(p => localAttendance.home.has(p.id))
            .map(p => ({ id: p.id, number: p.number, name: p.name }));
        
        const awayAttendedInfo: AttendedPlayerInfo[] = (awayTeam?.players || [])
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
  const finalHomeScore = (match.homeScore === undefined) ? aggregatedGoals.home.length : match.homeScore;
  const finalAwayScore = (match.awayScore === undefined) ? aggregatedGoals.away.length : match.awayScore;


  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">Resumen de Partido Jugado</DialogTitle>
          <DialogDescription>
            {homeTeam?.name || '?'} vs {awayTeam?.name || '?'} - Cat: {categoryName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 text-center my-2">
            <h3 className="text-2xl font-bold text-primary">{homeTeam?.name} - <span className="text-accent">{finalHomeScore}</span></h3>
            <h3 className="text-2xl font-bold text-primary">{awayTeam?.name} - <span className="text-accent">{finalAwayScore}</span></h3>
        </div>

        <Tabs defaultValue="general" className="w-full flex-grow flex flex-col overflow-hidden">
          <TabsList className={`grid w-full gap-1 ${state.config.showShotsData ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
            <TabsTrigger value="general" className="text-xs sm:text-sm">General</TabsTrigger>
            <TabsTrigger value="goalsByPeriod" className="text-xs sm:text-sm">Goles</TabsTrigger>
            <TabsTrigger value="penaltiesByPeriod" className="text-xs sm:text-sm">Faltas</TabsTrigger>
            {state.config.showShotsData && <TabsTrigger value="statsByPeriod" className="text-xs sm:text-sm">Estadísticas</TabsTrigger>}
          </TabsList>
          
          <TabsContent value="general" className="flex-grow overflow-hidden mt-4">
             <ScrollArea className="h-full pr-6 -mr-6">
                {/* Desktop: lado a lado */}
                <div className="hidden md:block space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <GoalsSection teamName={homeTeam?.name || ''} goals={aggregatedGoals.home} editable={false} />
                      <GoalsSection teamName={awayTeam?.name || ''} goals={aggregatedGoals.away} editable={false} />
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-6">
                      <PenaltiesSection team="home" teamName={homeTeam?.name || ''} penalties={aggregatedPenalties.home} />
                      <PenaltiesSection team="away" teamName={awayTeam?.name || ''} penalties={aggregatedPenalties.away} />
                    </div>
                    {state.config.showShotsData && (
                      <>
                        <Separator />
                        <div className="grid grid-cols-2 gap-6">
                            <PlayerStatsSection
                              team="home"
                              teamName={homeTeam?.name || ''}
                              allPlayers={homeTeam?.players}
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
                              allPlayers={awayTeam?.players}
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
                      </>
                    )}
                    {localSummary.shootout && (localSummary.shootout.homeAttempts.length > 0 || localSummary.shootout.awayAttempts.length > 0) && (
                        <>
                          <Separator />
                          <div className="grid grid-cols-2 gap-6">
                              <ShootoutSection teamName={homeTeam?.name || ''} attempts={localSummary.shootout.homeAttempts} />
                              <ShootoutSection teamName={awayTeam?.name || ''} attempts={localSummary.shootout.awayAttempts} />
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
                       <GoalsSection teamName={homeTeam?.name || ''} goals={aggregatedGoals.home} editable={false} />
                       <Separator />
                       <PenaltiesSection team="home" teamName={homeTeam?.name || ''} penalties={aggregatedPenalties.home} />
                       {state.config.showShotsData && (
                         <>
                           <Separator />
                           <PlayerStatsSection
                             team="home"
                             teamName={homeTeam?.name || ''}
                             allPlayers={homeTeam?.players}
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
                         </>
                       )}
                       {localSummary.shootout && localSummary.shootout.homeAttempts.length > 0 && (
                         <>
                           <Separator />
                           <ShootoutSection teamName={homeTeam?.name || ''} attempts={localSummary.shootout.homeAttempts} />
                         </>
                       )}
                     </TabsContent>
                     <TabsContent value="away" className="space-y-6 mt-4">
                       <GoalsSection teamName={awayTeam?.name || ''} goals={aggregatedGoals.away} editable={false} />
                       <Separator />
                       <PenaltiesSection team="away" teamName={awayTeam?.name || ''} penalties={aggregatedPenalties.away} />
                       {state.config.showShotsData && (
                         <>
                           <Separator />
                           <PlayerStatsSection
                             team="away"
                             teamName={awayTeam?.name || ''}
                             allPlayers={awayTeam?.players}
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
                         </>
                       )}
                       {localSummary.shootout && localSummary.shootout.awayAttempts.length > 0 && (
                         <>
                           <Separator />
                           <ShootoutSection teamName={awayTeam?.name || ''} attempts={localSummary.shootout.awayAttempts} />
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
                          <GoalsSection teamName={homeTeam?.name || ''} goals={periodData?.stats.goals.home} onGoalChange={(action, goal, id) => handleGoalChange(action, 'home', periodText, goal, id)} editable={!isReadOnly} players={homeTeam?.players} />
                          <GoalsSection teamName={awayTeam?.name || ''} goals={periodData?.stats.goals.away} onGoalChange={(action, goal, id) => handleGoalChange(action, 'away', periodText, goal, id)} editable={!isReadOnly} players={awayTeam?.players} />
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
                          <GoalsSection teamName={homeTeam?.name || ''} goals={periodData?.stats.goals.home} onGoalChange={(action, goal, id) => handleGoalChange(action, 'home', periodText, goal, id)} editable={!isReadOnly} players={homeTeam?.players} />
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
                          <GoalsSection teamName={awayTeam?.name || ''} goals={periodData?.stats.goals.away} onGoalChange={(action, goal, id) => handleGoalChange(action, 'away', periodText, goal, id)} editable={!isReadOnly} players={awayTeam?.players} />
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
                           <PenaltiesSection team="home" teamName={homeTeam?.name || ''} penalties={periodData?.stats.penalties.home} onDelete={(id) => handleDeletePenalty('home', {id} as PenaltyLog, periodText)} onAdd={isReadOnly ? undefined : () => handleAddPenaltyClick('home', periodText)} />
                           <PenaltiesSection team="away" teamName={awayTeam?.name || ''} penalties={periodData?.stats.penalties.away} onDelete={(id) => handleDeletePenalty('away', {id} as PenaltyLog, periodText)} onAdd={isReadOnly ? undefined : () => handleAddPenaltyClick('away', periodText)} />
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
                             <PenaltiesSection team="home" teamName={homeTeam?.name || ''} penalties={periodData?.stats.penalties.home} onDelete={(id) => handleDeletePenalty('home', {id} as PenaltyLog, periodText)} onAdd={isReadOnly ? undefined : () => handleAddPenaltyClick('home', periodText)} />
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
                             <PenaltiesSection team="away" teamName={awayTeam?.name || ''} penalties={periodData?.stats.penalties.away} onDelete={(id) => handleDeletePenalty('away', {id} as PenaltyLog, periodText)} onAdd={isReadOnly ? undefined : () => handleAddPenaltyClick('away', periodText)} />
                           </div>
                         );
                       })}
                     </TabsContent>
                   </Tabs>
                 </div>
              </ScrollArea>
          </TabsContent>

          {state.config.showShotsData && (
            <TabsContent value="statsByPeriod" className="flex-grow overflow-hidden mt-4">
             <ScrollArea className="h-full pr-6 -mr-6">
                {!isReadOnly && (
                    <div className="flex justify-end pr-2 mb-4">
                        {isEditing ? (
                            <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500" onClick={handleSaveShotsClick}><Check className="h-5 w-5" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleCancelClick}><XCircle className="h-5 w-5" /></Button>
                            </div>
                        ) : (
                            <Button variant="outline" size="sm" onClick={e => {e.stopPropagation(); handleEditClick();}}>
                                <Edit3 className="mr-2 h-4 w-4"/>Editar Tiros
                            </Button>
                        )}
                    </div>
                )}
                 {/* Desktop */}
                 <div className="hidden md:block space-y-8">
                  {(playedPeriods || []).map(periodText => {
                    const periodData = statsByPeriod?.find(p => p.period === periodText);
                    return (
                      <div key={`stats-${periodText}`} className="space-y-4">
                        <h3 className="text-xl font-semibold text-center text-primary-foreground border-b pb-2 mb-4">{periodText}</h3>
                        <div className="grid grid-cols-2 gap-6">
                            <PlayerStatsSection team="home" teamName={homeTeam?.name || ''} allPlayers={homeTeam?.players} playerStats={periodData?.stats.playerStats.home} attendance={localSummary.attendance.home} editable={isEditing && !isReadOnly} editedStats={editedShots[periodText]} onStatChange={(playerId, field, value) => handleShotInputChange(periodText, playerId, value)} />
                            <PlayerStatsSection team="away" teamName={awayTeam?.name || ''} allPlayers={awayTeam?.players} playerStats={periodData?.stats.playerStats.away} attendance={localSummary.attendance.away} editable={isEditing && !isReadOnly} editedStats={editedShots[periodText]} onStatChange={(playerId, field, value) => handleShotInputChange(periodText, playerId, value)} />
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
                           <div key={`stats-home-${periodText}`}>
                             <h3 className="text-lg font-semibold text-center text-primary-foreground border-b pb-2 mb-4">{periodText}</h3>
                             <PlayerStatsSection team="home" teamName={homeTeam?.name || ''} allPlayers={homeTeam?.players} playerStats={periodData?.stats.playerStats.home} attendance={localSummary.attendance.home} editable={isEditing && !isReadOnly} editedStats={editedShots[periodText]} onStatChange={(playerId, field, value) => handleShotInputChange(periodText, playerId, value)} />
                           </div>
                         );
                       })}
                     </TabsContent>
                     <TabsContent value="away" className="space-y-8 mt-4">
                       {(playedPeriods || []).map(periodText => {
                         const periodData = statsByPeriod?.find(p => p.period === periodText);
                         return (
                           <div key={`stats-away-${periodText}`}>
                             <h3 className="text-lg font-semibold text-center text-primary-foreground border-b pb-2 mb-4">{periodText}</h3>
                             <PlayerStatsSection team="away" teamName={awayTeam?.name || ''} allPlayers={awayTeam?.players} playerStats={periodData?.stats.playerStats.away} attendance={localSummary.attendance.away} editable={isEditing && !isReadOnly} editedStats={editedShots[periodText]} onStatChange={(playerId, field, value) => handleShotInputChange(periodText, playerId, value)} />
                           </div>
                         );
                       })}
                     </TabsContent>
                   </Tabs>
                 </div>
              </ScrollArea>
          </TabsContent>
          )}
        </Tabs>

        <DialogFooter className="border-t pt-4 mt-auto">
          <DialogClose asChild>
            <Button type="button" variant="outline"><X className="mr-2 h-4 w-4" />Cerrar</Button>
          </DialogClose>
          {!isReadOnly && <Button type="button" onClick={handleSaveAllChanges}><Check className="mr-2 h-4 w-4" />Guardar Cambios</Button>}
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
