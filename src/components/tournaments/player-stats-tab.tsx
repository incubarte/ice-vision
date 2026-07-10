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

// --- Sortable column helpers ---
type SortDir = 'asc' | 'desc';
type SortState = { key: string; dir: SortDir };

function sortData<T>(data: T[], key: string, dir: SortDir): T[] {
  return [...data].sort((a, b) => {
    const av = (a as Record<string, unknown>)[key];
    const bv = (b as Record<string, unknown>)[key];
    if (typeof av === 'string' && typeof bv === 'string') {
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    const an = Number(av ?? 0);
    const bn = Number(bv ?? 0);
    return dir === 'asc' ? an - bn : bn - an;
  });
}

function SortHead({ children, sortKey, sort, onSort, className, title }: {
  children: React.ReactNode;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  className?: string;
  title?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:bg-muted/50 transition-colors", className)}
      title={title}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
        {children}
        {active
          ? (sort.dir === 'asc' ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />)
          : <ChevronDown className="h-3 w-3 shrink-0 opacity-20" />}
      </span>
    </TableHead>
  );
}

function makeToggle(setState: React.Dispatch<React.SetStateAction<SortState>>) {
  return (key: string) => setState(prev => ({
    key,
    dir: prev.key === key ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'desc',
  }));
}
// --- end sort helpers ---

interface PlayerStatsTabProps {
  tournamentId?: string;
}

export function PlayerStatsTab({ tournamentId }: PlayerStatsTabProps = {}) {
  const { state } = useGameState();
  const { tournaments, selectedTournamentId, activeTournament } = state.config;

  const activeTournamentId = tournamentId || selectedTournamentId;

  const selectedTournament = useMemo((): Tournament | TournamentMetadata | undefined => {
    if (activeTournament && activeTournament.id === activeTournamentId) {
      return activeTournament;
    }
    return (tournaments || []).find(t => t.id === activeTournamentId);
  }, [tournaments, activeTournamentId, activeTournament]);

  const isHydrated = isTournamentHydrated(selectedTournament);
  const hydratedTournament = isHydrated ? selectedTournament : null;

  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);
  const [activeStatsTab, setActiveStatsTab] = useState('players');
  const [expandedGoalkeepers, setExpandedGoalkeepers] = useState<Set<string>>(new Set());
  const [selectedPlayerInfo, setSelectedPlayerInfo] = useState<{ playerId: string; playerName: string } | null>(null);

  // Sort states
  const [playerSort, setPlayerSort] = useState<SortState>({ key: 'points', dir: 'desc' });
  const [gkSort, setGkSort] = useState<SortState>({ key: 'savePercentage', dir: 'desc' });
  const [refSort, setRefSort] = useState<SortState>({ key: 'totalMatches', dir: 'desc' });
  const [mesaSort, setMesaSort] = useState<SortState>({ key: 'totalMatches', dir: 'desc' });
  const [teamSort, setTeamSort] = useState<SortState>({ key: 'goalsFor', dir: 'desc' });

  const playerStats = usePlayerStats(hydratedTournament, categoryFilter === ALL_CATEGORIES ? null : categoryFilter);
  const goalkeeperStats = useGoalkeeperStats(hydratedTournament, categoryFilter === ALL_CATEGORIES ? null : categoryFilter);
  const refereeStats = useRefereeStats(hydratedTournament, categoryFilter === ALL_CATEGORIES ? undefined : categoryFilter);
  const mesaStats = useMesaStats(hydratedTournament, categoryFilter === ALL_CATEGORIES ? undefined : categoryFilter);
  const teamStats = useTeamStats(hydratedTournament, categoryFilter === ALL_CATEGORIES ? null : categoryFilter);

  // Sorted data
  const sortedPlayers = useMemo(() => sortData(playerStats, playerSort.key, playerSort.dir), [playerStats, playerSort]);
  const sortedGk = useMemo(() => sortData(goalkeeperStats, gkSort.key, gkSort.dir), [goalkeeperStats, gkSort]);
  const sortedReferees = useMemo(() => sortData(refereeStats, refSort.key, refSort.dir), [refereeStats, refSort]);
  const sortedMesa = useMemo(() => sortData(mesaStats, mesaSort.key, mesaSort.dir), [mesaStats, mesaSort]);
  const sortedTeams = useMemo(() => sortData(teamStats, teamSort.key, teamSort.dir), [teamStats, teamSort]);

  const togglePlayer = makeToggle(setPlayerSort);
  const toggleGk = makeToggle(setGkSort);
  const toggleRef = makeToggle(setRefSort);
  const toggleMesa = makeToggle(setMesaSort);
  const toggleTeam = makeToggle(setTeamSort);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 p-3 text-sm border rounded-lg bg-muted/50 text-muted-foreground sm:flex-1">
          <Info className="h-5 w-5 mt-0.5 shrink-0"/>
          <p>Sistema de puntos (jugadores): 1 punto por gol, 1 punto por asistencia.</p>
        </div>
        <div className="w-full sm:w-56 shrink-0">
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
        <TabsList className="flex w-full overflow-x-auto justify-start h-auto p-1 gap-1">
          <TabsTrigger value="players" className="shrink-0">Jugadores</TabsTrigger>
          <TabsTrigger value="goalkeepers" className="shrink-0">Arqueros</TabsTrigger>
          <TabsTrigger value="staff" className="shrink-0">Staff</TabsTrigger>
          <TabsTrigger value="equipos" className="shrink-0">Equipos</TabsTrigger>
        </TabsList>

        {/* Players Tab */}
        <TabsContent value="players" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl">
                <Trophy className="h-6 w-6 text-amber-400" />
                Estadísticas de Jugadores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead sortKey="rank" sort={playerSort} onSort={togglePlayer} className="text-center w-16">Puesto</SortHead>
                    <SortHead sortKey="playerName" sort={playerSort} onSort={togglePlayer}>Jugador</SortHead>
                    <SortHead sortKey="categoryName" sort={playerSort} onSort={togglePlayer}>Categoría</SortHead>
                    <SortHead sortKey="teamName" sort={playerSort} onSort={togglePlayer}>Equipo</SortHead>
                    <SortHead sortKey="goals" sort={playerSort} onSort={togglePlayer} className="text-center">G</SortHead>
                    <SortHead sortKey="assists" sort={playerSort} onSort={togglePlayer} className="text-center">A</SortHead>
                    <SortHead sortKey="shots" sort={playerSort} onSort={togglePlayer} className="text-center">Tiros</SortHead>
                    <SortHead sortKey="shootingPercentage" sort={playerSort} onSort={togglePlayer} className="text-center">Efect. %</SortHead>
                    <SortHead sortKey="penaltyCount" sort={playerSort} onSort={togglePlayer} className="text-center"># Pen.</SortHead>
                    <SortHead sortKey="penaltyMinutes" sort={playerSort} onSort={togglePlayer} className="text-center">T. Pen. (min)</SortHead>
                    <SortHead sortKey="points" sort={playerSort} onSort={togglePlayer} className="text-center font-bold">Puntos</SortHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPlayers.map(stat => (
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
                  {sortedPlayers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="h-24 text-center">No hay estadísticas para mostrar.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Goalkeepers Tab */}
        <TabsContent value="goalkeepers" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl">
                <Shield className="h-6 w-6 text-blue-400" />
                Estadísticas de Arqueros
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* GK sort controls */}
              {sortedGk.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-4 text-xs text-muted-foreground items-center">
                  <span className="font-medium">Ordenar por:</span>
                  {[
                    { key: 'playerName', label: 'Nombre' },
                    { key: 'teamName', label: 'Equipo' },
                    { key: 'matchesPlayed', label: 'Partidos' },
                    { key: 'totalShotsAgainst', label: 'Tiros' },
                    { key: 'totalSaves', label: 'Atajados' },
                    { key: 'totalGoalsAgainst', label: 'Goles en Contra' },
                    { key: 'savePercentage', label: '% Efect.' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => toggleGk(key)}
                      className={cn(
                        "px-2 py-1 rounded border text-xs transition-colors",
                        gkSort.key === key
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border hover:border-muted-foreground"
                      )}
                    >
                      <span className="inline-flex items-center gap-0.5">
                        {label}
                        {gkSort.key === key && (gkSort.dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-8">
                {sortedGk.map(gkStat => (
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
                {sortedGk.length === 0 && (
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
                            <SortHead sortKey="staffName" sort={refSort} onSort={toggleRef}>Nombre</SortHead>
                            <SortHead sortKey="totalMatches" sort={refSort} onSort={toggleRef} className="text-center">Partidos</SortHead>
                            <SortHead sortKey="asPrincipal" sort={refSort} onSort={toggleRef} className="text-center">Principal/2º</SortHead>
                            <SortHead sortKey="asThird" sort={refSort} onSort={toggleRef} className="text-center">3º</SortHead>
                            <SortHead sortKey="totalGoals" sort={refSort} onSort={toggleRef} className="text-center">Goles</SortHead>
                            <SortHead sortKey="totalPenalties" sort={refSort} onSort={toggleRef} className="text-center">Faltas</SortHead>
                            <SortHead sortKey="avgGoalsPerMatch" sort={refSort} onSort={toggleRef} className="text-center">Goles/Partido</SortHead>
                            <SortHead sortKey="avgPenaltiesPerMatch" sort={refSort} onSort={toggleRef} className="text-center">Faltas/Partido</SortHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedReferees.map((stat) => (
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
                            <SortHead sortKey="staffName" sort={mesaSort} onSort={toggleMesa}>Nombre</SortHead>
                            <SortHead sortKey="totalMatches" sort={mesaSort} onSort={toggleMesa} className="text-center">Partidos</SortHead>
                            <SortHead sortKey="asPrincipal" sort={mesaSort} onSort={toggleMesa} className="text-center">Principal</SortHead>
                            <SortHead sortKey="asSecond" sort={mesaSort} onSort={toggleMesa} className="text-center">2º/3º</SortHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedMesa.map((stat) => (
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
        <TabsContent value="equipos" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl">
                  <BarChart3 className="h-6 w-6 text-blue-400" />
                  Estadísticas por Equipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortHead sortKey="teamName" sort={teamSort} onSort={toggleTeam}>Equipo</SortHead>
                        <SortHead sortKey="categoryName" sort={teamSort} onSort={toggleTeam}>Categoría</SortHead>
                        <SortHead sortKey="avgSkaters" sort={teamSort} onSort={toggleTeam} className="text-center" title="Promedio de jugadores presentes (sin arqueros)">Prom. Jug.</SortHead>
                        <SortHead sortKey="matchesPlayed" sort={teamSort} onSort={toggleTeam} className="text-center">PJ</SortHead>
                        <SortHead sortKey="goalsFor" sort={teamSort} onSort={toggleTeam} className="text-center">GF</SortHead>
                        <SortHead sortKey="goalsAgainst" sort={teamSort} onSort={toggleTeam} className="text-center">GC</SortHead>
                        <SortHead sortKey="goalDiff" sort={teamSort} onSort={toggleTeam} className="text-center">Dif.</SortHead>
                        <SortHead sortKey="penaltiesCommitted" sort={teamSort} onSort={toggleTeam} className="text-center" title="Penalidades cometidas por el equipo"># Pen. Hechas</SortHead>
                        <SortHead sortKey="penaltiesReceived" sort={teamSort} onSort={toggleTeam} className="text-center" title="Penalidades recibidas (del oponente, genera PP)"># Pen. Recibidas</SortHead>
                        <SortHead sortKey="pkTimeSeconds" sort={teamSort} onSort={toggleTeam} className="text-center" title="Tiempo en inferioridad numérica (PK)">T. PK</SortHead>
                        <SortHead sortKey="ppTimeSeconds" sort={teamSort} onSort={toggleTeam} className="text-center" title="Tiempo en superioridad numérica (PP)">T. PP</SortHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedTeams.map(stat => (
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
                      {sortedTeams.length === 0 && (
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
      </Tabs>
      {/* Player Match Breakdown Dialog */}
      <Dialog open={!!selectedPlayerInfo} onOpenChange={(open) => { if (!open) setSelectedPlayerInfo(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
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
