"use client";

import React, { useMemo, useState } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Info, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { usePlayerStats } from '@/hooks/use-player-stats';
import { useGoalkeeperStats } from '@/hooks/use-goalkeeper-stats';
import { useRefereeStats, useMesaStats } from '@/hooks/use-staff-stats';
import type { StaffMatchStats } from '@/hooks/use-staff-stats';
import { useTeamStats } from '@/hooks/use-team-stats';
import { useAdminMode } from '@/hooks/use-admin-mode';
import { cn } from '@/lib/utils';
import { isTournamentHydrated, type Tournament, type TournamentMetadata } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Flag, Users, BarChart3 } from 'lucide-react';
import { HockeyPuckSpinner } from '@/components/ui/hockey-puck-spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const ALL_CATEGORIES = "__ALL__";

interface PlayerStatsTabProps {
  tournamentId?: string;
}

export function PlayerStatsTab({ tournamentId }: PlayerStatsTabProps = {}) {
  const { state } = useGameState();
  const { tournaments, selectedTournamentId, activeTournament } = state.config;

  // Use tournamentId prop if provided, otherwise fall back to selectedTournamentId from state
  const activeTournamentId = tournamentId || selectedTournamentId;

  const selectedTournament = useMemo((): Tournament | TournamentMetadata | undefined => {
    if (activeTournament && activeTournament.id === activeTournamentId) {
      return activeTournament;
    }
    return (tournaments || []).find(t => t.id === activeTournamentId);
  }, [tournaments, activeTournamentId, activeTournament]);

  const isHydrated = isTournamentHydrated(selectedTournament);
  const hydratedTournament = isHydrated ? selectedTournament : null;

  const { isAdminMode } = useAdminMode();
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);
  const [activeStatsTab, setActiveStatsTab] = useState('players');
  const [expandedGoalkeepers, setExpandedGoalkeepers] = useState<Set<string>>(new Set());
  const [selectedPlayerInfo, setSelectedPlayerInfo] = useState<{ playerId: string; playerName: string } | null>(null);

  const playerStats = usePlayerStats(hydratedTournament, categoryFilter === ALL_CATEGORIES ? null : categoryFilter);
  const goalkeeperStats = useGoalkeeperStats(hydratedTournament, categoryFilter === ALL_CATEGORIES ? null : categoryFilter);
  const refereeStats = useRefereeStats(hydratedTournament, categoryFilter === ALL_CATEGORIES ? undefined : categoryFilter);
  const mesaStats = useMesaStats(hydratedTournament, categoryFilter === ALL_CATEGORIES ? undefined : categoryFilter);
  const teamStats = useTeamStats(hydratedTournament, categoryFilter === ALL_CATEGORIES ? null : categoryFilter);

  const toggleGoalkeeperExpanded = (playerId: string) => {
    setExpandedGoalkeepers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  const playerMatchBreakdown = useMemo(() => {
    if (!selectedPlayerInfo || !hydratedTournament) return [];
    const { playerId } = selectedPlayerInfo;
    const allTeams = hydratedTournament.teams || [];

    return (hydratedTournament.matches || [])
      .filter(m => m.summary && m.summary.statsByPeriod)
      .map(match => {
        let goals = 0;
        let assists = 0;
        let shots = 0;
        let playerTeamId: string | null = null;

        match.summary!.statsByPeriod!.forEach(period => {
          (['home', 'away'] as const).forEach(side => {
            const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId;
            if (!teamId) return;
            const team = allTeams.find(t => t.id === teamId);
            if (!team) return;
            const isPlayerOnTeam = team.players.some(p => p.id === playerId);
            if (!isPlayerOnTeam) return;
            playerTeamId = teamId;

            (period.stats.goals[side] || []).forEach(goal => {
              if (goal.scorer?.playerId === playerId) goals++;
              if (goal.assist?.playerId === playerId) assists++;
              if (goal.assist2?.playerId === playerId) assists++;
            });

            (period.stats.playerStats[side] || []).forEach(ps => {
              if (ps.id === playerId) shots += ps.shots;
            });
          });
        });

        if (goals === 0 && assists === 0 && shots === 0) return null;

        const opponentId = playerTeamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
        const opponentName = allTeams.find(t => t.id === opponentId)?.name || 'Desconocido';
        const date = match.date ? new Date(match.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

        return { matchId: match.id, date, opponentName, goals, assists, shots };
      })
      .filter(Boolean) as { matchId: string; date: string; opponentName: string; goals: number; assists: number; shots: number }[];
  }, [selectedPlayerInfo, hydratedTournament]);

  if (!isHydrated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <HockeyPuckSpinner />
        <p className="text-muted-foreground animate-pulse">Cargando estadísticas...</p>
      </div>
    );
  }

  // Helper to format centiseconds to MM:SS
  const formatTime = (centiseconds: number) => {
    const totalSeconds = Math.floor(centiseconds / 100);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  // Helper to format seconds to MM:SS (usado para tiempos de PK/PP)
  const formatSeconds = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Category Filter - shared across both tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-2 p-3 text-sm border rounded-lg bg-muted/50 text-muted-foreground flex-1 mr-4">
          <Info className="h-5 w-5 mt-0.5 shrink-0"/>
          <p>Sistema de puntos (jugadores): 1 punto por gol, 1 punto por asistencia.</p>
        </div>
        <div className="w-56">
          <Label>Filtrar por Categoría</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>Todas las Categorías</SelectItem>
              {(hydratedTournament?.categories || []).map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs for Players and Goalkeepers */}
      <Tabs value={activeStatsTab} onValueChange={setActiveStatsTab} className="w-full">
        <TabsList className={cn("grid w-full", isAdminMode ? "grid-cols-4" : "grid-cols-3")}>
          <TabsTrigger value="players">Jugadores</TabsTrigger>
          <TabsTrigger value="goalkeepers">Arqueros</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          {isAdminMode && <TabsTrigger value="equipos">Equipos</TabsTrigger>}
        </TabsList>

        {/* Players Tab */}
        <TabsContent value="players" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Trophy className="h-6 w-6 text-amber-400" />
                Estadísticas de Jugadores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center w-16">Puesto</TableHead>
                    <TableHead>Jugador</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Equipo</TableHead>
                    <TableHead className="text-center">G</TableHead>
                    <TableHead className="text-center">A</TableHead>
                    <TableHead className="text-center">Tiros</TableHead>
                    <TableHead className="text-center">Efect. %</TableHead>
                    <TableHead className="text-center"># Pen.</TableHead>
                    <TableHead className="text-center">T. Pen. (min)</TableHead>
                    <TableHead className="text-center font-bold">Puntos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {playerStats.map(stat => (
                    <TableRow key={stat.playerId}>
                      <TableCell className="text-center font-bold">{stat.rank}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {stat.playerName}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-foreground"
                            onClick={() => setSelectedPlayerInfo({ playerId: stat.playerId, playerName: stat.playerName })}
                          >
                            <Info className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{stat.categoryName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{stat.teamName}</TableCell>
                      <TableCell className="text-center font-mono">{stat.goals}</TableCell>
                      <TableCell className="text-center font-mono">{stat.assists}</TableCell>
                      <TableCell className="text-center font-mono">{stat.shots}</TableCell>
                      <TableCell className="text-center font-mono text-primary font-semibold">{stat.shootingPercentage}%</TableCell>
                      <TableCell className="text-center font-mono">{stat.penaltyCount}</TableCell>
                      <TableCell className="text-center font-mono">{stat.penaltyMinutes}</TableCell>
                      <TableCell className="text-center font-bold text-lg">{stat.points}</TableCell>
                    </TableRow>
                  ))}
                  {playerStats.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="h-24 text-center">No hay estadísticas para mostrar.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Goalkeepers Tab */}
        <TabsContent value="goalkeepers" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Shield className="h-6 w-6 text-blue-400" />
                Estadísticas de Arqueros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {goalkeeperStats.map(gkStat => (
                  <div key={gkStat.playerId} className="border rounded-lg p-4 space-y-4">
                    {/* Goalkeeper Header */}
                    <div className="flex items-start justify-between border-b pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Shield className="h-5 w-5 text-blue-400" />
                          <h3 className="text-xl font-bold">{gkStat.playerName}</h3>
                          <span className="text-sm text-muted-foreground">#{gkStat.playerNumber}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {gkStat.teamName} • {gkStat.categoryName}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{formatTime(gkStat.totalTimeOnIce)}</div>
                        <div className="text-xs text-muted-foreground">Tiempo Total</div>
                      </div>
                    </div>

                    {/* Totals Summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold">{gkStat.matchesPlayed}</div>
                        <div className="text-xs text-muted-foreground">Partidos</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold">{gkStat.totalShotsAgainst}</div>
                        <div className="text-xs text-muted-foreground">Tiros Recibidos</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {gkStat.totalShotsAgainst === 0 ? '-' : gkStat.totalSaves}
                        </div>
                        <div className="text-xs text-muted-foreground">Atajados</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-destructive">{gkStat.totalGoalsAgainst}</div>
                        <div className="text-xs text-muted-foreground">Goles en Contra</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {gkStat.totalShotsAgainst === 0 ? '-' : `${gkStat.savePercentage}%`}
                        </div>
                        <div className="text-xs text-muted-foreground">% Efectividad</div>
                      </div>
                    </div>

                    {/* Period Breakdown - Collapsible */}
                    {gkStat.periodStats.length > 0 && (
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleGoalkeeperExpanded(gkStat.playerId)}
                          className="w-full flex items-center justify-between text-sm font-semibold text-muted-foreground hover:text-foreground"
                        >
                          <span>Desglose por Período</span>
                          {expandedGoalkeepers.has(gkStat.playerId) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        {expandedGoalkeepers.has(gkStat.playerId) && (
                          <div className="mt-2">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Período</TableHead>
                                  <TableHead className="text-center">Tiempo</TableHead>
                                  <TableHead className="text-center">Tiros</TableHead>
                                  <TableHead className="text-center">Atajados</TableHead>
                                  <TableHead className="text-center">Goles</TableHead>
                                  <TableHead className="text-center">% Efect.</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {gkStat.periodStats.map(periodStat => (
                                  <TableRow key={periodStat.period}>
                                    <TableCell className="font-medium">{periodStat.period}</TableCell>
                                    <TableCell className="text-center font-mono">{formatTime(periodStat.timeOnIce)}</TableCell>
                                    <TableCell className="text-center font-mono">{periodStat.shotsAgainst}</TableCell>
                                    <TableCell className="text-center font-mono text-green-600">
                                      {periodStat.shotsAgainst === 0 ? '-' : periodStat.saves}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-destructive">{periodStat.goalsAgainst}</TableCell>
                                    <TableCell className="text-center font-mono text-blue-600">
                                      {periodStat.shotsAgainst === 0 ? '-' : `${periodStat.savePercentage}%`}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {goalkeeperStats.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    No hay estadísticas de arqueros para mostrar.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff" className="mt-6 space-y-6">
          {!hydratedTournament?.staff || hydratedTournament.staff.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  No hay staff registrado en este torneo. Agrega staff desde la pestaña "Staff".
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Referee Stats Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Flag className="h-5 w-5" />
                    Estadísticas de Árbitros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {refereeStats.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No hay datos disponibles{categoryFilter !== ALL_CATEGORIES ? " para la categoría seleccionada" : ""}.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead className="text-center">Partidos</TableHead>
                            <TableHead className="text-center">Principal/2º</TableHead>
                            <TableHead className="text-center">3º</TableHead>
                            <TableHead className="text-center">Goles</TableHead>
                            <TableHead className="text-center">Faltas</TableHead>
                            <TableHead className="text-center">Goles/Partido</TableHead>
                            <TableHead className="text-center">Faltas/Partido</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {refereeStats.map((stat) => (
                            <TableRow key={stat.staffId}>
                              <TableCell className="font-medium">{stat.staffName}</TableCell>
                              <TableCell className="text-center">{stat.totalMatches}</TableCell>
                              <TableCell className="text-center">{stat.asPrincipal + stat.asSecond}</TableCell>
                              <TableCell className="text-center">{stat.asThird}</TableCell>
                              <TableCell className="text-center">{stat.totalGoals}</TableCell>
                              <TableCell className="text-center">{stat.totalPenalties}</TableCell>
                              <TableCell className="text-center">{stat.avgGoalsPerMatch.toFixed(1)}</TableCell>
                              <TableCell className="text-center">{stat.avgPenaltiesPerMatch.toFixed(1)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Mesa Stats Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Estadísticas de Mesa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {mesaStats.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No hay datos disponibles{categoryFilter !== ALL_CATEGORIES ? " para la categoría seleccionada" : ""}.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead className="text-center">Partidos</TableHead>
                            <TableHead className="text-center">Principal</TableHead>
                            <TableHead className="text-center">2º/3º</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mesaStats.map((stat) => (
                            <TableRow key={stat.staffId}>
                              <TableCell className="font-medium">{stat.staffName}</TableCell>
                              <TableCell className="text-center">{stat.totalMatches}</TableCell>
                              <TableCell className="text-center">{stat.asPrincipal}</TableCell>
                              <TableCell className="text-center">{stat.asSecond + stat.asThird}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Equipos Tab (solo admin) */}
        {isAdminMode && (
          <TabsContent value="equipos" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <BarChart3 className="h-6 w-6 text-blue-400" />
                  Estadísticas por Equipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipo</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-center" title="Promedio de jugadores presentes (sin arqueros)">Prom. Jug.</TableHead>
                        <TableHead className="text-center">PJ</TableHead>
                        <TableHead className="text-center">GF</TableHead>
                        <TableHead className="text-center">GC</TableHead>
                        <TableHead className="text-center">Dif.</TableHead>
                        <TableHead className="text-center" title="Penalidades cometidas por el equipo"># Pen. Hechas</TableHead>
                        <TableHead className="text-center" title="Penalidades recibidas (del oponente, genera PP)"># Pen. Recibidas</TableHead>
                        <TableHead className="text-center" title="Tiempo en inferioridad numérica (PK)">T. PK</TableHead>
                        <TableHead className="text-center" title="Tiempo en superioridad numérica (PP)">T. PP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamStats.map(stat => (
                        <TableRow key={stat.teamId}>
                          <TableCell className="font-medium">
                            <div>{stat.teamName}</div>
                            {stat.teamSubName && (
                              <div className="text-xs text-muted-foreground">{stat.teamSubName}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{stat.categoryName}</TableCell>
                          <TableCell className="text-center font-mono">
                            {stat.avgSkaters > 0 ? stat.avgSkaters.toFixed(1) : '—'}
                          </TableCell>
                          <TableCell className="text-center font-mono">{stat.matchesPlayed}</TableCell>
                          <TableCell className="text-center font-mono font-semibold text-green-600 dark:text-green-400">{stat.goalsFor}</TableCell>
                          <TableCell className="text-center font-mono font-semibold text-red-600 dark:text-red-400">{stat.goalsAgainst}</TableCell>
                          <TableCell className={cn(
                            "text-center font-mono font-bold",
                            stat.goalDiff > 0 ? "text-green-600 dark:text-green-400" :
                            stat.goalDiff < 0 ? "text-red-600 dark:text-red-400" : ""
                          )}>
                            {stat.goalDiff > 0 ? `+${stat.goalDiff}` : stat.goalDiff}
                          </TableCell>
                          <TableCell className="text-center font-mono">{stat.penaltiesCommitted}</TableCell>
                          <TableCell className="text-center font-mono">{stat.penaltiesReceived}</TableCell>
                          <TableCell className="text-center font-mono text-orange-600 dark:text-orange-400">
                            {stat.pkTimeSeconds > 0 ? formatSeconds(stat.pkTimeSeconds) : '0:00'}
                          </TableCell>
                          <TableCell className="text-center font-mono text-blue-600 dark:text-blue-400">
                            {stat.ppTimeSeconds > 0 ? formatSeconds(stat.ppTimeSeconds) : '0:00'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {teamStats.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                            No hay partidos jugados para mostrar estadísticas.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
      {/* Player Match Breakdown Dialog */}
      <Dialog open={!!selectedPlayerInfo} onOpenChange={(open) => { if (!open) setSelectedPlayerInfo(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-muted-foreground" />
              Detalle de {selectedPlayerInfo?.playerName}
            </DialogTitle>
          </DialogHeader>
          {playerMatchBreakdown.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">
              No hay goles ni asistencias registradas.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vs.</TableHead>
                  <TableHead className="text-center">G</TableHead>
                  <TableHead className="text-center">A</TableHead>
                  <TableHead className="text-center">Tiros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {playerMatchBreakdown.map(row => (
                  <TableRow key={row.matchId}>
                    <TableCell className="font-mono text-sm">{row.date}</TableCell>
                    <TableCell className="text-sm">{row.opponentName}</TableCell>
                    <TableCell className="text-center font-mono font-semibold">{row.goals}</TableCell>
                    <TableCell className="text-center font-mono font-semibold">{row.assists}</TableCell>
                    <TableCell className="text-center font-mono">{row.shots}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
