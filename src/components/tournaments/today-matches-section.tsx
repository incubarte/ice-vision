"use client";

import React, { useMemo } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Clock, Info } from 'lucide-react';
import { type MatchData, type TeamData, isTournamentHydrated } from '@/types';
import { formatTime } from '@/lib/game-helpers';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from 'lucide-react';
import { HockeyPuckSpinner } from '@/components/ui/hockey-puck-spinner';

interface TodayMatchesSectionProps {
  tournamentId: string;
}

export const TodayMatchesSection: React.FC<TodayMatchesSectionProps> = ({ tournamentId }) => {
  const { state } = useGameState();
  const { activeTournament, tournaments } = state.config;

  const tournament = useMemo(() => {
    if (activeTournament && activeTournament.id === tournamentId) {
      return activeTournament;
    }
    return (tournaments || []).find(t => t.id === tournamentId);
  }, [tournaments, activeTournament, tournamentId]);

  const isHydrated = isTournamentHydrated(tournament);

  const todayMatches = useMemo(() => {
    if (!isHydrated || !tournament) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return (tournament.matches || []).filter(match => {
      const matchDate = new Date(match.date);
      matchDate.setHours(0, 0, 0, 0);
      return matchDate >= today && matchDate < tomorrow;
    });
  }, [tournament, isHydrated]);

  const liveMatch = useMemo(() => {
    // Check if there's a live match (matchId in live state matches one of today's matches)
    if (!state.live.matchId) return null;
    const match = todayMatches.find(m => m.id === state.live.matchId);
    // Only consider it live if it doesn't have a summary (not finished yet)
    if (match && match.summary) return null;
    return match;
  }, [state.live.matchId, todayMatches]);

  const finishedMatches = useMemo(() => {
    return todayMatches.filter(m => m.summary);
  }, [todayMatches]);

  const getTeamName = (teamId: string | undefined) => {
    if (!teamId) return 'TBD';
    const team = (tournament as any)?.teams?.find((t: TeamData) => t.id === teamId);
    return team?.name || 'TBD';
  };

  const getScore = (match: MatchData): { home: number; away: number } | null => {
    if (!match.summary) return null;

    // Calculate total goals from all periods
    let homeGoals = 0;
    let awayGoals = 0;

    if (match.summary.statsByPeriod) {
      match.summary.statsByPeriod.forEach(periodSummary => {
        homeGoals += periodSummary.stats.goals.home.length;
        awayGoals += periodSummary.stats.goals.away.length;
      });
    }

    return { home: homeGoals, away: awayGoals };
  };

  const getLiveScore = () => {
    return { home: state.live.score.home, away: state.live.score.away };
  };

  const getCurrentTime = () => {
    const { currentTime, isClockRunning, clockStartTimeMs, remainingTimeAtStartCs } = state.live.clock;

    let displayTime = currentTime;
    if (isClockRunning && clockStartTimeMs && remainingTimeAtStartCs !== null) {
      const elapsedCs = Math.floor((Date.now() - clockStartTimeMs) / 10);
      displayTime = Math.max(0, remainingTimeAtStartCs - elapsedCs);
    }

    return formatTime(displayTime, { showTenths: displayTime < 6000, includeMinutesForTenths: true });
  };

  const getPeriodText = () => {
    const { currentPeriod, periodDisplayOverride } = state.live.clock;
    if (periodDisplayOverride) return periodDisplayOverride;
    if (currentPeriod === 0) return 'Warm-up';
    return `${currentPeriod}° Período`;
  };

  const getLivePenalties = (team: 'home' | 'away') => {
    const penalties = state.live.penalties[team];
    const runningPenalties = penalties.filter(p => p._status === 'running' || p._status === 'pending_puck');
    return runningPenalties;
  };

  const getCategoryName = (categoryId: string | undefined) => {
    if (!categoryId) return null;
    const category = (tournament as any)?.categories?.find((c: any) => c.id === categoryId);
    return category?.name || null;
  };

  if (!isHydrated) {
    return (
      <div className="flex justify-center py-8">
        <HockeyPuckSpinner />
      </div>
    );
  }

  // Don't render if there are no matches today
  if (todayMatches.length === 0) return null;

  const liveMatchCategoryName = liveMatch ? getCategoryName(liveMatch.categoryId) : null;

  return (
    <div className="space-y-4 mb-6">
      {/* Live Match */}
      {liveMatch && (
        <>
          <div className="flex items-start gap-2 p-3 text-sm border rounded-lg bg-muted/50 text-muted-foreground mb-4">
            <Info className="h-5 w-5 mt-0.5 shrink-0" />
            <p>La vista del partido en vivo no se actualiza automáticamente por el momento.</p>
          </div>
          <Card className="border-2 border-primary shadow-lg bg-gradient-to-r from-primary/10 to-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span>Partido en Curso</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {liveMatchCategoryName && (
                <div className="text-xs font-medium text-primary/80 mb-1">
                  Categoría {liveMatchCategoryName}
                </div>
              )}
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <div className="text-lg font-semibold">{state.live.homeTeamName}</div>
                  <div className="text-sm text-muted-foreground">{state.live.homeTeamSubName}</div>
                </div>
                <div className="text-4xl font-bold mx-6">{getLiveScore().home}</div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <div className="text-lg font-semibold">{state.live.awayTeamName}</div>
                  <div className="text-sm text-muted-foreground">{state.live.awayTeamSubName}</div>
                </div>
                <div className="text-4xl font-bold mx-6">{getLiveScore().away}</div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  <span className="font-mono">{getCurrentTime()}</span>
                  <span className="text-muted-foreground">-</span>
                  <span>{getPeriodText()}</span>
                </div>
              </div>

              {/* Penalties collapsible */}
              {(state.live.penaltiesLog.home.length > 0 || state.live.penaltiesLog.away.length > 0) && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
                    <ChevronDown className="h-4 w-4" />
                    <span>Ver Penalidades ({state.live.penaltiesLog.home.length + state.live.penaltiesLog.away.length})</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    {state.live.penaltiesLog.home.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-1">{state.live.homeTeamName}</div>
                        {state.live.penaltiesLog.home.filter(p => p.endReason !== 'deleted').map((penaltyLog) => {
                          let statusText = "Activa";
                          let statusColor = "text-green-600";

                          // Check if it's currently active to confirm status
                          const activePenalty = state.live.penalties.home.find(p => p.id === penaltyLog.id);

                          if (!activePenalty) {
                            // It's finished
                            if (penaltyLog.endReason === 'goal_on_pp') {
                              statusText = "Terminada (Gol)";
                              statusColor = "text-muted-foreground";
                            } else if (penaltyLog.endReason === 'completed') {
                              statusText = "Terminada (Tiempo)";
                              statusColor = "text-muted-foreground";
                            }
                          }

                          // Determine classification
                          const minutes = Math.floor(penaltyLog.initialDuration / 6000);
                          let classification = null;
                          if (minutes === 2) classification = "Menor";
                          else if (minutes === 5) classification = "Mayor";
                          else if (minutes === 10) classification = "Mala Conducta";
                          else if (minutes === 4) classification = "Doble Menor";

                          let penaltyNameDisplay = penaltyLog.penaltyName || classification || `${minutes} min`;
                          if (penaltyLog.penaltyName && classification && !penaltyLog.penaltyName.toLowerCase().includes(classification.toLowerCase())) {
                            penaltyNameDisplay = `${penaltyLog.penaltyName} (${classification})`;
                          }

                          return (
                            <div key={penaltyLog.id} className="text-sm flex justify-between items-center py-1 px-2 bg-muted/30 rounded mb-1 last:mb-0">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold">#{penaltyLog.playerNumber}</span>
                                  {penaltyLog.playerName && <span className="font-medium">{penaltyLog.playerName}</span>}
                                  <span className="text-xs text-muted-foreground">
                                    {formatTime(penaltyLog.addGameTime, { showTenths: false })} {penaltyLog.addPeriodText}
                                  </span>
                                </div>
                                <span className="text-xs font-medium text-muted-foreground/80">
                                  {penaltyNameDisplay}
                                </span>
                              </div>
                              <span className={`text-xs font-medium ${statusColor}`}>
                                {statusText}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {state.live.penaltiesLog.away.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs font-semibold text-muted-foreground mb-1">{state.live.awayTeamName}</div>
                        {state.live.penaltiesLog.away.filter(p => p.endReason !== 'deleted').map((penaltyLog) => {
                          let statusText = "Activa";
                          let statusColor = "text-green-600";

                          // Check if it's currently active
                          const activePenalty = state.live.penalties.away.find(p => p.id === penaltyLog.id);

                          if (!activePenalty) {
                            // It's finished
                            if (penaltyLog.endReason === 'goal_on_pp') {
                              statusText = "Terminada (Gol)";
                              statusColor = "text-muted-foreground";
                            } else if (penaltyLog.endReason === 'completed') {
                              statusText = "Terminada (Tiempo)";
                              statusColor = "text-muted-foreground";
                            }
                          }

                          // Determine classification
                          const minutes = Math.floor(penaltyLog.initialDuration / 6000);
                          let classification = null;
                          if (minutes === 2) classification = "Menor";
                          else if (minutes === 5) classification = "Mayor";
                          else if (minutes === 10) classification = "Mala Conducta";
                          else if (minutes === 4) classification = "Doble Menor";

                          let penaltyNameDisplay = penaltyLog.penaltyName || classification || `${minutes} min`;
                          if (penaltyLog.penaltyName && classification && !penaltyLog.penaltyName.toLowerCase().includes(classification.toLowerCase())) {
                            penaltyNameDisplay = `${penaltyLog.penaltyName} (${classification})`;
                          }

                          return (
                            <div key={penaltyLog.id} className="text-sm flex justify-between items-center py-1 px-2 bg-muted/30 rounded mb-1 last:mb-0">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold">#{penaltyLog.playerNumber}</span>
                                  {penaltyLog.playerName && <span className="font-medium">{penaltyLog.playerName}</span>}
                                  <span className="text-xs text-muted-foreground">
                                    {formatTime(penaltyLog.addGameTime, { showTenths: false })} {penaltyLog.addPeriodText}
                                  </span>
                                </div>
                                <span className="text-xs font-medium text-muted-foreground/80">
                                  {penaltyNameDisplay}
                                </span>
                              </div>
                              <span className={`text-xs font-medium ${statusColor}`}>
                                {statusText}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Finished Matches */}
      {finishedMatches.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5" />
              <span>Resultados de Hoy</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {finishedMatches.map((match) => {
              const score = getScore(match);
              if (!score) return null;
              const categoryName = getCategoryName(match.categoryId);

              return (
                <div key={match.id} className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  {categoryName && (
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      Categoría {categoryName}
                    </div>
                  )}
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">{getTeamName(match.homeTeamId)}</span>
                    <span className="text-xl font-bold">{score.home}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{getTeamName(match.awayTeamId)}</span>
                    <span className="text-xl font-bold">{score.away}</span>
                  </div>
                  {match.summary?.overTimeOrShootouts && (
                    <div className="mt-1 text-xs text-muted-foreground text-center">
                      {match.summary.shootout ? 'Definido por Shootout' : 'Overtime'}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
