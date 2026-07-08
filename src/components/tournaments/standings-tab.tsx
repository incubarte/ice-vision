
"use client";

import React, { useMemo, useState } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Info, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { useStandings, useRelegationStandings, type TeamStats } from '@/hooks/use-standings';
import { cn } from '@/lib/utils';
import { type Tournament, type MatchData, type Playoff58Matchup, isTournamentHydrated } from '@/types';
import { calculateScoreFromSummary } from '@/lib/match-helpers';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { HockeyPuckSpinner } from '@/components/ui/hockey-puck-spinner';

const StandingsTable = ({ categoryName, categoryId, tournament }: { categoryName: string, categoryId: string, tournament: any }) => {
    const stats = useStandings(tournament, categoryId);
    const [isExpanded, setIsExpanded] = useState(false);

    if (stats.length === 0) {
        return null; // Don't render a table if there are no teams/stats for this category
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-2xl">
                    <div className="flex items-center gap-3">
                        <Trophy className="h-6 w-6 text-amber-400" />
                        <div className="flex flex-col">
                            <span>{categoryName}</span>
                            <span className="text-sm font-normal text-muted-foreground">Fase de Clasificación</span>
                        </div>
                    </div>
                    {/* Botón para expandir/contraer en mobile */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="md:hidden"
                    >
                        {isExpanded ? (
                            <>
                                <ChevronUp className="h-4 w-4 mr-1" />
                                Reducir
                            </>
                        ) : (
                            <>
                                <ChevronDown className="h-4 w-4 mr-1" />
                                Ver más
                            </>
                        )}
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* Tabla Desktop - siempre completa */}
                <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-center">Puesto</TableHead>
                                <TableHead className="w-1/2">Equipo</TableHead>
                                <TableHead className="text-center">PJ</TableHead>
                                <TableHead className="text-center">PG</TableHead>
                                <TableHead className="text-center">PG <span className="text-xs opacity-80">(OT)</span></TableHead>
                                <TableHead className="text-center">PP <span className="text-xs opacity-80">(OT)</span></TableHead>
                                <TableHead className="text-center">PE</TableHead>
                                <TableHead className="text-center">PP</TableHead>
                                <TableHead className="text-center border-l">GF</TableHead>
                                <TableHead className="text-center">GC</TableHead>
                                <TableHead className="text-center">DIF</TableHead>
                                <TableHead className="text-center font-bold border-l">Puntos</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.map((team, index) => (
                                <TableRow
                                    key={team.id}
                                    className={cn(index === 3 ? "border-b border-blue-50 dark:border-blue-950" : "")}
                                >
                                    <TableCell className="text-center font-bold">{team.rank}</TableCell>
                                    <TableCell className="font-medium">{team.name}</TableCell>
                                    <TableCell className="text-center">{team.pj}</TableCell>
                                    <TableCell className="text-center">{team.pg}</TableCell>
                                    <TableCell className="text-center">{team.pg_ot}</TableCell>
                                    <TableCell className="text-center">{team.pp_ot}</TableCell>
                                    <TableCell className="text-center">{team.pe}</TableCell>
                                    <TableCell className="text-center">{team.pp}</TableCell>
                                    <TableCell className="text-center border-l">{team.gf}</TableCell>
                                    <TableCell className="text-center">{team.gc}</TableCell>
                                    <TableCell className="text-center font-semibold">{team.dif > 0 ? `+${team.dif}` : team.dif}</TableCell>
                                    <TableCell className="text-center font-bold text-lg border-l">{team.puntos}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Tabla Mobile - reducida o expandida */}
                <div className="md:hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-center text-xs">Puesto</TableHead>
                                <TableHead className="text-xs">Equipo</TableHead>
                                <TableHead className="text-center text-xs">PJ</TableHead>
                                <TableHead className="text-center text-xs">PG</TableHead>
                                <TableHead className="text-center text-xs">DIF</TableHead>
                                <TableHead className="text-center font-bold text-xs">Pts</TableHead>
                                {isExpanded && (
                                    <>
                                        <TableHead className="text-center text-xs">PG<br />(OT)</TableHead>
                                        <TableHead className="text-center text-xs">PP<br />(OT)</TableHead>
                                        <TableHead className="text-center text-xs">PE</TableHead>
                                        <TableHead className="text-center text-xs">PP</TableHead>
                                        <TableHead className="text-center text-xs">GF</TableHead>
                                        <TableHead className="text-center text-xs">GC</TableHead>
                                    </>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.map((team, index) => (
                                <TableRow
                                    key={team.id}
                                    className={cn(index === 3 ? "border-b border-blue-50 dark:border-blue-950" : "")}
                                >
                                    <TableCell className="text-center font-bold text-sm">{team.rank}</TableCell>
                                    <TableCell className="font-medium text-sm truncate max-w-[120px]">{team.name}</TableCell>
                                    <TableCell className="text-center text-sm">{team.pj}</TableCell>
                                    <TableCell className="text-center text-sm">{team.pg}</TableCell>
                                    <TableCell className="text-center font-semibold text-sm">{team.dif > 0 ? `+${team.dif}` : team.dif}</TableCell>
                                    <TableCell className="text-center font-bold text-sm">{team.puntos}</TableCell>
                                    {isExpanded && (
                                        <>
                                            <TableCell className="text-center text-sm">{team.pg_ot}</TableCell>
                                            <TableCell className="text-center text-sm">{team.pp_ot}</TableCell>
                                            <TableCell className="text-center text-sm">{team.pe}</TableCell>
                                            <TableCell className="text-center text-sm">{team.pp}</TableCell>
                                            <TableCell className="text-center text-sm">{team.gf}</TableCell>
                                            <TableCell className="text-center text-sm">{team.gc}</TableCell>
                                        </>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

// Helper para verificar si la fase de clasificación está completa para una categoría
function isClassificationComplete(tournament: Tournament, categoryId: string): { complete: boolean, played: number, expected: number } {
    const categoryTeams = tournament.teams?.filter(t => t.category === categoryId) || [];
    const numTeams = categoryTeams.length;

    if (numTeams < 2) return { complete: false, played: 0, expected: 0 }; // No hay suficientes equipos

    // Obtener las vueltas de la categoría específica
    const category = tournament.categories?.find(c => c.id === categoryId);
    const rounds = category?.classificationRounds || 1;

    // Calcular partidos esperados: cada equipo juega contra cada otro (n-1) equipos, por número de vueltas
    // Total de partidos = (n * (n-1) / 2) * rounds
    const expectedMatches = (numTeams * (numTeams - 1) / 2) * rounds;

    // Contar partidos de clasificación jugados (con summary) para esta categoría
    const playedMatches = tournament.matches?.filter(m =>
        m.categoryId === categoryId &&
        m.phase === 'clasificacion' &&
        m.summary
    ).length || 0;

    const result = {
        complete: playedMatches >= expectedMatches,
        played: playedMatches,
        expected: expectedMatches
    };

    // Debug log
    console.log(`[${category?.name || categoryId}] Teams: ${numTeams}, Rounds: ${rounds}, Expected: ${expectedMatches}, Played: ${playedMatches}, Complete: ${result.complete}`);

    return result;
}

// Helper para obtener el nombre del equipo basado en posición y tabla de standings
function getTeamNameFromPosition(position: string, standings: any[]) {
    const positionIndex = parseInt(position.replace('position-', '')) - 1;
    return standings[positionIndex]?.name || position.replace('position-', '') + 'ero';
}

// Helper para obtener el nombre de un equipo (de ID real o posición)
function getTeamName(teamId: string | undefined, tournament: Tournament, standings: any[]): string {
    if (!teamId) return '?';

    // Si es una posición, obtener el equipo desde la tabla de standings
    if (teamId.startsWith('position-')) {
        return getTeamNameFromPosition(teamId, standings);
    }

    // Si no, buscar el equipo por ID en el torneo
    const team = tournament.teams?.find(t => t.id === teamId);
    return team?.name || teamId;
}

// Helper para obtener los nombres de equipos de una semifinal según matchup
function getSemiMatchupNames(matchup: string, standings: any[], classificationComplete: boolean): { home: string, away: string } {
    const matchupMap: Record<string, { home: number, away: number, homeLabel: string, awayLabel: string }> = {
        '1vs4': { home: 0, away: 3, homeLabel: '1ero', awayLabel: '4to' },
        '2vs3': { home: 1, away: 2, homeLabel: '2do', awayLabel: '3ero' },
        '1vs2': { home: 0, away: 1, homeLabel: '1ero', awayLabel: '2do' },
        '1vs3': { home: 0, away: 2, homeLabel: '1ero', awayLabel: '3ero' },
        '2vs4': { home: 1, away: 3, homeLabel: '2do', awayLabel: '4to' },
        '3vs4': { home: 2, away: 3, homeLabel: '3ero', awayLabel: '4to' }
    };

    const positions = matchupMap[matchup];
    if (!positions) return { home: '?', away: '?' };

    // Si la clasificación no está completa, solo mostrar posiciones genéricas
    if (!classificationComplete) {
        return {
            home: positions.homeLabel,
            away: positions.awayLabel
        };
    }

    // Si está completa, usar los nombres reales de la tabla
    return {
        home: standings[positions.home]?.name || positions.homeLabel,
        away: standings[positions.away]?.name || positions.awayLabel
    };
}

// Helper para obtener ganador de un partido
function getWinnerTeam(match: MatchData, tournament: Tournament, standings: any[]): string | null {
    if (!match.summary) return null;

    const { home, away } = calculateScoreFromSummary(match.summary);

    if (home > away) {
        return getTeamName(match.homeTeamId, tournament, standings);
    } else if (away > home) {
        return getTeamName(match.awayTeamId, tournament, standings);
    }

    return null;
}

const PlayoffBracket = ({ categoryName, categoryId, tournament }: { categoryName: string, categoryId: string, tournament: Tournament }) => {
    const standings = useStandings(tournament, categoryId);

    // Verificar si la clasificación está completa
    const classificationStatus = useMemo(() =>
        isClassificationComplete(tournament, categoryId),
        [tournament, categoryId]
    );

    const classificationComplete = classificationStatus.complete;

    // Obtener partidos de playoffs para esta categoría
    const playoffMatches = useMemo(() => {
        return (tournament.matches || []).filter(m =>
            m.categoryId === categoryId && m.phase === 'playoffs'
        );
    }, [tournament.matches, categoryId]);

    // Encontrar semifinales por playoffMatchup (1vs4, 2vs3, etc.)
    const semis = playoffMatches.filter(m => m.playoffType === 'semifinal');
    const semi1 = semis[0]; // Primera semifinal encontrada
    const semi2 = semis[1]; // Segunda semifinal encontrada
    const final = playoffMatches.find(m => m.playoffType === 'final');
    const thirdPlace = playoffMatches.find(m => m.playoffType === '3er-puesto');

    const semi1Winner = semi1 ? getWinnerTeam(semi1, tournament, standings) : null;
    const semi2Winner = semi2 ? getWinnerTeam(semi2, tournament, standings) : null;
    const finalWinner = final ? getWinnerTeam(final, tournament, standings) : null;

    // Helper para obtener perdedor de una semi
    const getLoserTeam = (match: MatchData | undefined): string | null => {
        if (!match?.summary) return null;
        const { home, away } = calculateScoreFromSummary(match.summary);
        if (home > away) {
            return getTeamName(match.awayTeamId, tournament, standings);
        } else if (away > home) {
            return getTeamName(match.homeTeamId, tournament, standings);
        }
        return null;
    };

    const semi1Loser = semi1 ? getLoserTeam(semi1) : null;
    const semi2Loser = semi2 ? getLoserTeam(semi2) : null;
    const thirdPlaceWinner = thirdPlace ? getWinnerTeam(thirdPlace, tournament, standings) : null;

    // Obtener los nombres de los equipos para cada semifinal
    // Para semis no jugadas: siempre derivar del matchup + standings (evita mostrar equipos
    // asignados incorrectamente antes de que la clasificación estuviera completa).
    // Para semis jugadas: usar los equipos reales del partido.
    const getSemiTeamNames = (semi: MatchData | undefined) => {
        if (!semi) return { home: '?', away: '?' };

        // Si el partido ya fue jugado, usar los equipos que realmente jugaron
        if (semi.summary && semi.homeTeamId && semi.awayTeamId) {
            return {
                home: getTeamName(semi.homeTeamId, tournament, standings),
                away: getTeamName(semi.awayTeamId, tournament, standings)
            };
        }

        // Antes de jugarse: derivar del matchup para garantizar equipos correctos según standings
        if (semi.playoffMatchup) {
            return getSemiMatchupNames(semi.playoffMatchup, standings, classificationComplete);
        }

        // Fallback: equipos explícitos si no hay matchup
        if (semi.homeTeamId && semi.awayTeamId) {
            return {
                home: getTeamName(semi.homeTeamId, tournament, standings),
                away: getTeamName(semi.awayTeamId, tournament, standings)
            };
        }

        return { home: '?', away: '?' };
    };

    const semi1Teams = getSemiTeamNames(semi1);
    const semi2Teams = getSemiTeamNames(semi2);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl">
                    <Trophy className="h-6 w-6 text-amber-400" />
                    <span>{categoryName}</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {!classificationComplete && (() => {
                    const category = tournament.categories?.find(c => c.id === categoryId);
                    const rounds = category?.classificationRounds || 1;
                    return (
                        <div className="mb-6 p-3 text-sm border rounded-lg bg-muted/50 text-muted-foreground flex items-start gap-2">
                            <Info className="h-5 w-5 mt-0.5 shrink-0" />
                            <div>
                                <p className="mb-1">
                                    La fase de clasificación aún no ha finalizado. Los equipos que participarán en playoffs se determinarán cuando todos los partidos de clasificación hayan sido jugados.
                                </p>
                                <p className="text-xs">
                                    Partidos jugados: {classificationStatus.played} de {classificationStatus.expected} ({rounds} {rounds === 1 ? 'vuelta' : 'vueltas'})
                                </p>
                            </div>
                        </div>
                    );
                })()}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                    {/* Semifinales */}
                    <div className="space-y-6">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide text-center">
                            Semifinales
                        </h3>

                        {/* Semi 1 */}
                        <div className={cn(
                            "border-2 rounded-lg p-4 space-y-2",
                            semi1Winner ? "border-green-500" : "border-border"
                        )}>
                            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                {semi1?.playoffMatchup ? `Semi 1 (${semi1.playoffMatchup.replace('vs', ' vs ')})` : 'Semi 1'}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium">
                                    {semi1Teams.home}
                                </span>
                                {semi1?.summary && (
                                    <span className="font-bold">
                                        {calculateScoreFromSummary(semi1.summary).home}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center justify-between border-t pt-2">
                                <span className="font-medium">
                                    {semi1Teams.away}
                                </span>
                                {semi1?.summary && (
                                    <span className="font-bold">
                                        {calculateScoreFromSummary(semi1.summary).away}
                                    </span>
                                )}
                            </div>
                            {semi1 && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(semi1.date), "dd/MM/yy HH:mm", { locale: es })}
                                </div>
                            )}
                            {!semi1 && (
                                <div className="text-xs text-muted-foreground pt-2 border-t">
                                    Partido no programado
                                </div>
                            )}
                        </div>

                        {/* Semi 2 */}
                        <div className={cn(
                            "border-2 rounded-lg p-4 space-y-2",
                            semi2Winner ? "border-green-500" : "border-border"
                        )}>
                            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                {semi2?.playoffMatchup ? `Semi 2 (${semi2.playoffMatchup.replace('vs', ' vs ')})` : 'Semi 2'}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium">
                                    {semi2Teams.home}
                                </span>
                                {semi2?.summary && (
                                    <span className="font-bold">
                                        {calculateScoreFromSummary(semi2.summary).home}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center justify-between border-t pt-2">
                                <span className="font-medium">
                                    {semi2Teams.away}
                                </span>
                                {semi2?.summary && (
                                    <span className="font-bold">
                                        {calculateScoreFromSummary(semi2.summary).away}
                                    </span>
                                )}
                            </div>
                            {semi2 && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(semi2.date), "dd/MM/yy HH:mm", { locale: es })}
                                </div>
                            )}
                            {!semi2 && (
                                <div className="text-xs text-muted-foreground pt-2 border-t">
                                    Partido no programado
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Conectores visuales */}
                    <div className="hidden md:flex flex-col items-center justify-center">
                        <div className="h-20 w-px bg-border"></div>
                        <div className="w-full h-px bg-border"></div>
                        <div className="h-20 w-px bg-border"></div>
                    </div>

                    {/* Columna derecha: 3er Puesto y Final */}
                    <div className="space-y-6">
                        {/* Partido por el 3er Puesto */}
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide text-center">
                            3er Puesto
                        </h3>
                        <div className={cn(
                            "border-2 rounded-lg p-4 space-y-2",
                            thirdPlaceWinner ? "border-orange-500" : "border-border"
                        )}>
                            <div className="text-xs font-semibold text-orange-600 dark:text-orange-400">3er Puesto</div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium">
                                    {thirdPlace?.homeTeamId
                                        ? getTeamName(thirdPlace.homeTeamId, tournament, standings)
                                        : (semi1Loser || 'Perdedor Semi 1')}
                                </span>
                                {thirdPlace?.summary && (
                                    <span className="font-bold">
                                        {calculateScoreFromSummary(thirdPlace.summary).home}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center justify-between border-t pt-2">
                                <span className="font-medium">
                                    {thirdPlace?.awayTeamId
                                        ? getTeamName(thirdPlace.awayTeamId, tournament, standings)
                                        : (semi2Loser || 'Perdedor Semi 2')}
                                </span>
                                {thirdPlace?.summary && (
                                    <span className="font-bold">
                                        {calculateScoreFromSummary(thirdPlace.summary).away}
                                    </span>
                                )}
                            </div>
                            {thirdPlace && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(thirdPlace.date), "dd/MM/yy HH:mm", { locale: es })}
                                </div>
                            )}
                            {!thirdPlace && (
                                <div className="text-xs text-muted-foreground pt-2 border-t">
                                    Partido no programado
                                </div>
                            )}
                            {thirdPlaceWinner && (
                                <div className="mt-4 pt-4 border-t">
                                    <div className="flex items-center justify-center gap-2 text-orange-600 dark:text-orange-400 font-bold">
                                        <Trophy className="h-5 w-5" />
                                        <span>3er Lugar: {thirdPlaceWinner}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Final */}
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide text-center">
                            Final
                        </h3>

                        <div className={cn(
                            "border-2 rounded-lg p-4 space-y-2",
                            finalWinner ? "border-amber-500" : "border-border"
                        )}>
                            <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">Final</div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium">
                                    {final?.homeTeamId
                                        ? getTeamName(final.homeTeamId, tournament, standings)
                                        : (semi1Winner || 'Ganador Semi 1')}
                                </span>
                                {final?.summary && (
                                    <span className="font-bold">
                                        {calculateScoreFromSummary(final.summary).home}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center justify-between border-t pt-2">
                                <span className="font-medium">
                                    {final?.awayTeamId
                                        ? getTeamName(final.awayTeamId, tournament, standings)
                                        : (semi2Winner || 'Ganador Semi 2')}
                                </span>
                                {final?.summary && (
                                    <span className="font-bold">
                                        {calculateScoreFromSummary(final.summary).away}
                                    </span>
                                )}
                            </div>
                            {final && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(final.date), "dd/MM/yy HH:mm", { locale: es })}
                                </div>
                            )}
                            {!final && (
                                <div className="text-xs text-muted-foreground pt-2 border-t">
                                    Partido no programado
                                </div>
                            )}
                            {finalWinner && (
                                <div className="mt-4 pt-4 border-t">
                                    <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
                                        <Trophy className="h-5 w-5" />
                                        <span>Campeón: {finalWinner}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// Helper para detectar fase secundaria activa de una categoría
function getSecondaryPhaseInfo(tournament: Tournament, categoryId: string): {
    phase: 'playoffs-5-8' | 'relegation' | null;
    playoff58Name: string | null;
} {
    const match = tournament.matches?.find(
        m => m.categoryId === categoryId &&
             (m.phase === 'playoffs-5-8' || m.phase === 'relegation')
    );
    return {
        phase: (match?.phase as 'playoffs-5-8' | 'relegation') ?? null,
        playoff58Name: match?.playoff58Name ?? null,
    };
}

// Bracket para el mini-torneo Playoffs 5to-8vo
const Playoff58Bracket = ({ categoryId, tournament, miniTournamentName }: {
    categoryId: string;
    tournament: Tournament;
    miniTournamentName: string;
}) => {
    const standings = useStandings(tournament, categoryId);

    const classificationStatus = useMemo(() =>
        isClassificationComplete(tournament, categoryId),
        [tournament, categoryId]
    );
    const classificationComplete = classificationStatus.complete;

    const playoff58Matches = useMemo(() =>
        (tournament.matches || []).filter(m =>
            m.categoryId === categoryId && m.phase === 'playoffs-5-8'
        ),
        [tournament.matches, categoryId]
    );

    const semis = playoff58Matches.filter(m => m.playoff58Type === 'semifinal');
    const semi1 = semis[0];
    const semi2 = semis[1];
    const final58 = playoff58Matches.find(m => m.playoff58Type === 'final');
    const thirdPlace58 = playoff58Matches.find(m => m.playoff58Type === '3er-puesto');

    // Resolución de nombres de equipo para posiciones 5-8
    const get58Name = (teamId: string | undefined, matchup: Playoff58Matchup | undefined, isHome: boolean): string => {
        if (teamId) {
            const team = tournament.teams?.find(t => t.id === teamId);
            if (team) return team.name;
        }
        if (matchup) {
            const labels: Record<string, { home: string; away: string }> = {
                '5vs8': {
                    home: classificationComplete ? (standings[4]?.name || '5to') : '5to',
                    away: classificationComplete ? (standings[7]?.name || '8vo') : '8vo',
                },
                '6vs7': {
                    home: classificationComplete ? (standings[5]?.name || '6to') : '6to',
                    away: classificationComplete ? (standings[6]?.name || '7mo') : '7mo',
                },
            };
            return isHome ? (labels[matchup]?.home || '?') : (labels[matchup]?.away || '?');
        }
        return '?';
    };

    const getSemi58Teams = (semi: MatchData | undefined) => {
        if (!semi) return { home: '?', away: '?' };

        // Si el partido ya fue jugado, usar los equipos reales
        if (semi.summary) {
            return {
                home: get58Name(semi.homeTeamId, semi.playoff58Matchup, true),
                away: get58Name(semi.awayTeamId, semi.playoff58Matchup, false),
            };
        }

        // Antes de jugarse: derivar del matchup para garantizar equipos correctos según standings
        if (semi.playoff58Matchup) {
            const matchupPositions: Record<string, { home: number; away: number; homeLabel: string; awayLabel: string }> = {
                '5vs8': { home: 4, away: 7, homeLabel: '5to', awayLabel: '8vo' },
                '6vs7': { home: 5, away: 6, homeLabel: '6to', awayLabel: '7mo' },
            };
            const pos = matchupPositions[semi.playoff58Matchup];
            if (pos) {
                return {
                    home: classificationComplete ? (standings[pos.home]?.name || pos.homeLabel) : pos.homeLabel,
                    away: classificationComplete ? (standings[pos.away]?.name || pos.awayLabel) : pos.awayLabel,
                };
            }
        }

        // Fallback
        return {
            home: get58Name(semi.homeTeamId, semi.playoff58Matchup, true),
            away: get58Name(semi.awayTeamId, semi.playoff58Matchup, false),
        };
    };

    const getWinner58 = (match: MatchData | undefined): string | null => {
        if (!match?.summary) return null;
        const { home, away } = calculateScoreFromSummary(match.summary);
        if (home > away) return get58Name(match.homeTeamId, match.playoff58Matchup, true);
        if (away > home) return get58Name(match.awayTeamId, match.playoff58Matchup, false);
        return null;
    };

    const getLoser58 = (match: MatchData | undefined): string | null => {
        if (!match?.summary) return null;
        const { home, away } = calculateScoreFromSummary(match.summary);
        if (home > away) return get58Name(match.awayTeamId, match.playoff58Matchup, false);
        if (away > home) return get58Name(match.homeTeamId, match.playoff58Matchup, true);
        return null;
    };

    const semi1Teams = getSemi58Teams(semi1);
    const semi2Teams = getSemi58Teams(semi2);
    const semi1Winner = getWinner58(semi1);
    const semi2Winner = getWinner58(semi2);
    const semi1Loser = getLoser58(semi1);
    const semi2Loser = getLoser58(semi2);
    const finalWinner = getWinner58(final58);
    const thirdPlaceWinner = getWinner58(thirdPlace58);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                    <Trophy className="h-5 w-5 text-orange-400" />
                    <div className="flex flex-col">
                        <span>{miniTournamentName || 'Playoffs 5to-8vo'}</span>
                        <span className="text-sm font-normal text-muted-foreground">Posiciones 5° al 8°</span>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {!classificationComplete && (
                    <div className="mb-6 p-3 text-sm border rounded-lg bg-muted/50 text-muted-foreground flex items-start gap-2">
                        <Info className="h-5 w-5 mt-0.5 shrink-0" />
                        <p>
                            La clasificación aún no finalizó. Los equipos 5° al 8° se determinarán al completarse todos los partidos.
                            {' '}Jugados: {classificationStatus.played} de {classificationStatus.expected}
                        </p>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                    {/* Semifinales */}
                    <div className="space-y-6">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide text-center">Semifinales</h3>
                        {/* Semi 1 */}
                        <div className={cn("border-2 rounded-lg p-4 space-y-2", semi1Winner ? "border-green-500" : "border-border")}>
                            <div className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                                {semi1?.playoff58Matchup ? `Semi 1 (${semi1.playoff58Matchup.replace('vs', ' vs ')})` : 'Semi 1'}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium">{semi1Teams.home}</span>
                                {semi1?.summary && <span className="font-bold">{calculateScoreFromSummary(semi1.summary).home}</span>}
                            </div>
                            <div className="flex items-center justify-between border-t pt-2">
                                <span className="font-medium">{semi1Teams.away}</span>
                                {semi1?.summary && <span className="font-bold">{calculateScoreFromSummary(semi1.summary).away}</span>}
                            </div>
                            {semi1 ? (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(semi1.date), "dd/MM/yy HH:mm", { locale: es })}
                                </div>
                            ) : (
                                <div className="text-xs text-muted-foreground pt-2 border-t">Partido no programado</div>
                            )}
                        </div>
                        {/* Semi 2 */}
                        <div className={cn("border-2 rounded-lg p-4 space-y-2", semi2Winner ? "border-green-500" : "border-border")}>
                            <div className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                                {semi2?.playoff58Matchup ? `Semi 2 (${semi2.playoff58Matchup.replace('vs', ' vs ')})` : 'Semi 2'}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium">{semi2Teams.home}</span>
                                {semi2?.summary && <span className="font-bold">{calculateScoreFromSummary(semi2.summary).home}</span>}
                            </div>
                            <div className="flex items-center justify-between border-t pt-2">
                                <span className="font-medium">{semi2Teams.away}</span>
                                {semi2?.summary && <span className="font-bold">{calculateScoreFromSummary(semi2.summary).away}</span>}
                            </div>
                            {semi2 ? (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(semi2.date), "dd/MM/yy HH:mm", { locale: es })}
                                </div>
                            ) : (
                                <div className="text-xs text-muted-foreground pt-2 border-t">Partido no programado</div>
                            )}
                        </div>
                    </div>

                    {/* Conectores */}
                    <div className="hidden md:flex flex-col items-center justify-center">
                        <div className="h-20 w-px bg-border"></div>
                        <div className="w-full h-px bg-border"></div>
                        <div className="h-20 w-px bg-border"></div>
                    </div>

                    {/* 3er Puesto y Final */}
                    <div className="space-y-6">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide text-center">3er Puesto</h3>
                        <div className={cn("border-2 rounded-lg p-4 space-y-2", thirdPlaceWinner ? "border-orange-500" : "border-border")}>
                            <div className="text-xs font-semibold text-orange-600 dark:text-orange-400">3er Puesto</div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium">{thirdPlace58?.homeTeamId ? get58Name(thirdPlace58.homeTeamId, undefined, true) : (semi1Loser || 'Perdedor Semi 1')}</span>
                                {thirdPlace58?.summary && <span className="font-bold">{calculateScoreFromSummary(thirdPlace58.summary).home}</span>}
                            </div>
                            <div className="flex items-center justify-between border-t pt-2">
                                <span className="font-medium">{thirdPlace58?.awayTeamId ? get58Name(thirdPlace58.awayTeamId, undefined, false) : (semi2Loser || 'Perdedor Semi 2')}</span>
                                {thirdPlace58?.summary && <span className="font-bold">{calculateScoreFromSummary(thirdPlace58.summary).away}</span>}
                            </div>
                            {thirdPlace58 ? (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(thirdPlace58.date), "dd/MM/yy HH:mm", { locale: es })}
                                </div>
                            ) : (
                                <div className="text-xs text-muted-foreground pt-2 border-t">Partido no programado</div>
                            )}
                            {thirdPlaceWinner && (
                                <div className="mt-4 pt-4 border-t">
                                    <div className="flex items-center justify-center gap-2 text-orange-600 dark:text-orange-400 font-bold">
                                        <Trophy className="h-5 w-5" />
                                        <span>3er Lugar: {thirdPlaceWinner}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide text-center">Final</h3>
                        <div className={cn("border-2 rounded-lg p-4 space-y-2", finalWinner ? "border-amber-500" : "border-border")}>
                            <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">Final {miniTournamentName || ''}</div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium">{final58?.homeTeamId ? get58Name(final58.homeTeamId, undefined, true) : (semi1Winner || 'Ganador Semi 1')}</span>
                                {final58?.summary && <span className="font-bold">{calculateScoreFromSummary(final58.summary).home}</span>}
                            </div>
                            <div className="flex items-center justify-between border-t pt-2">
                                <span className="font-medium">{final58?.awayTeamId ? get58Name(final58.awayTeamId, undefined, false) : (semi2Winner || 'Ganador Semi 2')}</span>
                                {final58?.summary && <span className="font-bold">{calculateScoreFromSummary(final58.summary).away}</span>}
                            </div>
                            {final58 ? (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(final58.date), "dd/MM/yy HH:mm", { locale: es })}
                                </div>
                            ) : (
                                <div className="text-xs text-muted-foreground pt-2 border-t">Partido no programado</div>
                            )}
                            {finalWinner && (
                                <div className="mt-4 pt-4 border-t">
                                    <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
                                        <Trophy className="h-5 w-5" />
                                        <span>Campeón {miniTournamentName}: {finalWinner}</span>
                                    </div>
                                </div>
            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// Tabla de posiciones para Relegation (puestos desde el 5° en adelante)
const RelegationTable = ({ categoryName, categoryId, tournament }: {
    categoryName: string;
    categoryId: string;
    tournament: Tournament;
}) => {
    const stats = useRelegationStandings(tournament, categoryId, 4);
    const [isExpanded, setIsExpanded] = useState(false);

    if (stats.length === 0) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-xl">
                    <div className="flex items-center gap-3">
                        <Trophy className="h-5 w-5 text-red-400" />
                        <div className="flex flex-col">
                            <span>{categoryName} — Relegation</span>
                            <span className="text-sm font-normal text-muted-foreground">Tabla de posiciones (desde el 5°)</span>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="md:hidden">
                        {isExpanded ? <><ChevronUp className="h-4 w-4 mr-1" />Reducir</> : <><ChevronDown className="h-4 w-4 mr-1" />Ver más</>}
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* Desktop */}
                <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-center">Puesto</TableHead>
                                <TableHead className="w-1/2">Equipo</TableHead>
                                <TableHead className="text-center">PJ</TableHead>
                                <TableHead className="text-center">PG</TableHead>
                                <TableHead className="text-center">PG <span className="text-xs opacity-80">(OT)</span></TableHead>
                                <TableHead className="text-center">PP <span className="text-xs opacity-80">(OT)</span></TableHead>
                                <TableHead className="text-center">PE</TableHead>
                                <TableHead className="text-center">PP</TableHead>
                                <TableHead className="text-center border-l">GF</TableHead>
                                <TableHead className="text-center">GC</TableHead>
                                <TableHead className="text-center">DIF</TableHead>
                                <TableHead className="text-center font-bold border-l">Puntos</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.map(team => (
                                <TableRow key={team.id}>
                                    <TableCell className="text-center font-bold">{team.displayRank}°</TableCell>
                                    <TableCell className="font-medium">{team.name}</TableCell>
                                    <TableCell className="text-center">{team.pj}</TableCell>
                                    <TableCell className="text-center">{team.pg}</TableCell>
                                    <TableCell className="text-center">{team.pg_ot}</TableCell>
                                    <TableCell className="text-center">{team.pp_ot}</TableCell>
                                    <TableCell className="text-center">{team.pe}</TableCell>
                                    <TableCell className="text-center">{team.pp}</TableCell>
                                    <TableCell className="text-center border-l">{team.gf}</TableCell>
                                    <TableCell className="text-center">{team.gc}</TableCell>
                                    <TableCell className="text-center font-semibold">{team.dif > 0 ? `+${team.dif}` : team.dif}</TableCell>
                                    <TableCell className="text-center font-bold text-lg border-l">{team.puntos}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {/* Mobile */}
                <div className="md:hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-center text-xs">Puesto</TableHead>
                                <TableHead className="text-xs">Equipo</TableHead>
                                <TableHead className="text-center text-xs">PJ</TableHead>
                                <TableHead className="text-center text-xs">PG</TableHead>
                                <TableHead className="text-center text-xs">DIF</TableHead>
                                <TableHead className="text-center font-bold text-xs">Pts</TableHead>
                                {isExpanded && (
                                    <>
                                        <TableHead className="text-center text-xs">PG<br />(OT)</TableHead>
                                        <TableHead className="text-center text-xs">PP<br />(OT)</TableHead>
                                        <TableHead className="text-center text-xs">PE</TableHead>
                                        <TableHead className="text-center text-xs">PP</TableHead>
                                        <TableHead className="text-center text-xs">GF</TableHead>
                                        <TableHead className="text-center text-xs">GC</TableHead>
                                    </>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.map(team => (
                                <TableRow key={team.id}>
                                    <TableCell className="text-center font-bold text-sm">{team.displayRank}°</TableCell>
                                    <TableCell className="font-medium text-sm truncate max-w-[120px]">{team.name}</TableCell>
                                    <TableCell className="text-center text-sm">{team.pj}</TableCell>
                                    <TableCell className="text-center text-sm">{team.pg}</TableCell>
                                    <TableCell className="text-center font-semibold text-sm">{team.dif > 0 ? `+${team.dif}` : team.dif}</TableCell>
                                    <TableCell className="text-center font-bold text-sm">{team.puntos}</TableCell>
                                    {isExpanded && (
                                        <>
                                            <TableCell className="text-center text-sm">{team.pg_ot}</TableCell>
                                            <TableCell className="text-center text-sm">{team.pp_ot}</TableCell>
                                            <TableCell className="text-center text-sm">{team.pe}</TableCell>
                                            <TableCell className="text-center text-sm">{team.pp}</TableCell>
                                            <TableCell className="text-center text-sm">{team.gf}</TableCell>
                                            <TableCell className="text-center text-sm">{team.gc}</TableCell>
                                        </>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

interface StandingsTabProps {
    tournamentId?: string;
}

export function StandingsTab({ tournamentId }: StandingsTabProps = {}) {
    const { state } = useGameState();
    const { tournaments, selectedTournamentId, activeTournament } = state.config;

    // Use tournamentId prop if provided, otherwise fall back to selectedTournamentId from state
    const activeTournamentId = tournamentId || selectedTournamentId;

    const selectedTournament = useMemo(() => {
        if (activeTournament && activeTournament.id === activeTournamentId) {
            return activeTournament;
        }
        return (tournaments || []).find(t => t.id === activeTournamentId);
    }, [tournaments, activeTournamentId, activeTournament]);

    const isHydrated = isTournamentHydrated(selectedTournament);

    const categoriesWithTeams = useMemo(() => {
        if (!isHydrated || !selectedTournament) return [];
        return selectedTournament.categories.filter(cat =>
            (selectedTournament.teams || []).some(team => team.category === cat.id)
        );
    }, [selectedTournament, isHydrated]);

    if (!isHydrated) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <HockeyPuckSpinner />
                <p className="text-muted-foreground animate-pulse">Cargando posiciones...</p>
            </div>
        );
    }

    if (!selectedTournament) return null;

    return (
        <Tabs defaultValue="clasificacion" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="clasificacion">Clasificación</TabsTrigger>
                <TabsTrigger value="playoffs">Playoffs</TabsTrigger>
            </TabsList>

            <TabsContent value="clasificacion" className="space-y-8">
                <div className="flex items-start gap-2 p-3 text-sm border rounded-lg bg-muted/50 text-muted-foreground">
                    <Info className="h-5 w-5 mt-0.5 shrink-0" />
                    <p>El sistema de puntos es: 3 por victoria, 2 por victoria en OT/Penales, 1 por derrota en OT/Penales, y 1 por empate.</p>
                </div>

                {categoriesWithTeams.map(category => (
                    <StandingsTable
                        key={category.id}
                        categoryName={category.name}
                        categoryId={category.id}
                        tournament={selectedTournament}
                    />
                ))}

                {categoriesWithTeams.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">No hay datos de posiciones para mostrar. Juega y finaliza partidos para empezar.</p>
                    </div>
                )}
            </TabsContent>

            <TabsContent value="playoffs" className="space-y-8">
                {categoriesWithTeams.map(category => {
                    const secondaryInfo = getSecondaryPhaseInfo(selectedTournament, category.id);
                    return (
                        <React.Fragment key={category.id}>
                            <PlayoffBracket
                                categoryName={category.name}
                                categoryId={category.id}
                                tournament={selectedTournament}
                            />
                            {secondaryInfo.phase === 'playoffs-5-8' && (
                                <Playoff58Bracket
                                    categoryId={category.id}
                                    tournament={selectedTournament}
                                    miniTournamentName={secondaryInfo.playoff58Name || ''}
                                />
                            )}
                            {secondaryInfo.phase === 'relegation' && (
                                <RelegationTable
                                    categoryName={category.name}
                                    categoryId={category.id}
                                    tournament={selectedTournament}
                                />
                            )}
                        </React.Fragment>
                    );
                })}

                {categoriesWithTeams.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">No hay categorías disponibles.</p>
                    </div>
                )}
            </TabsContent>
        </Tabs>
    );
}
