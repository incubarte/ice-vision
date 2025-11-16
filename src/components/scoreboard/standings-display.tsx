"use client";

import React, { useMemo } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Info } from 'lucide-react';
import type { Team } from '@/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { useStandings } from '@/hooks/use-standings';

export function StandingsDisplay() {
  const { state } = useGameState();
  const { tournaments, selectedTournamentId, selectedMatchCategory, scoreboardLayout } = state.config;
  const { matchId, homeTeamName, awayTeamName, homeTeamSubName, awayTeamSubName } = state.live;

  const currentTournament = useMemo(() => {
    return (tournaments || []).find(t => t.id === selectedTournamentId);
  }, [tournaments, selectedTournamentId]);

  const currentMatch = useMemo(() => {
    if (!currentTournament || !matchId || !currentTournament.matches) return null;
    return currentTournament.matches.find(m => m.id === matchId);
  }, [currentTournament, matchId]);

  // Find team IDs from team names (fallback when currentMatch is not found)
  const teamIds = useMemo(() => {
    if (currentMatch) {
      return { homeTeamId: currentMatch.homeTeamId, awayTeamId: currentMatch.awayTeamId };
    }

    if (!currentTournament?.teams) return null;

    const homeTeam = currentTournament.teams.find(t =>
      t.name === homeTeamName &&
      (t.subName || undefined) === (homeTeamSubName || undefined) &&
      t.category === selectedMatchCategory
    );

    const awayTeam = currentTournament.teams.find(t =>
      t.name === awayTeamName &&
      (t.subName || undefined) === (awayTeamSubName || undefined) &&
      t.category === selectedMatchCategory
    );

    if (!homeTeam || !awayTeam) return null;

    return { homeTeamId: homeTeam.id, awayTeamId: awayTeam.id };
  }, [currentMatch, currentTournament, homeTeamName, awayTeamName, homeTeamSubName, awayTeamSubName, selectedMatchCategory]);
  
  const standings = useStandings(currentTournament, selectedMatchCategory);

  const displayedStandings = useMemo(() => {
    if (!teamIds) {
      return standings;
    }

    if (standings.length <= 5) {
      return standings;
    }

    const { homeTeamId, awayTeamId } = teamIds;

    const homeIndex = standings.findIndex(s => s.id === homeTeamId);
    const awayIndex = standings.findIndex(s => s.id === awayTeamId);
    
    if (homeIndex === -1 || awayIndex === -1) {
        return standings.slice(0, 5);
    }
    
    const indicesToShow = new Set<number>();
    
    indicesToShow.add(homeIndex > 0 ? homeIndex - 1 : homeIndex);
    indicesToShow.add(homeIndex);
    if(homeIndex < standings.length - 1) indicesToShow.add(homeIndex + 1);

    indicesToShow.add(awayIndex > 0 ? awayIndex - 1 : awayIndex);
    indicesToShow.add(awayIndex);
    if(awayIndex < standings.length - 1) indicesToShow.add(awayIndex + 1);
    
    const sortedIndices = Array.from(indicesToShow).sort((a,b) => a - b);
    
    const finalRows: (any | { isEllipsis: true, id: string })[] = [];
    let lastIndex = -1;

    sortedIndices.forEach(index => {
        if (lastIndex !== -1 && index > lastIndex + 1) {
            finalRows.push({ isEllipsis: true, id: `ellipsis-${lastIndex}` });
        }
        finalRows.push(standings[index]);
        lastIndex = index;
    });

    return finalRows;

  }, [standings, teamIds]);


  if (!scoreboardLayout) {
    return null;
  }

  if (!teamIds) {
    return null;
  }

  const { homeTeamId, awayTeamId } = teamIds;

  // Base font size from config
  const baseFontSizeRem = scoreboardLayout.standingsTableFontSize || 1;
  const rowHeightRem = scoreboardLayout.standingsTableRowHeight || 3;

  // Proportional sizes based on the base
  const titleSize = baseFontSizeRem * 2 * 0.85; // 15% más chico
  const headerSize = baseFontSizeRem * 1.1;
  const cellSize = baseFontSizeRem;
  const pointsSize = baseFontSizeRem * 1.25;
  const ellipsisRowHeight = rowHeightRem * 0.7; // Make ellipsis row a bit shorter
  const ellipsisFontSize = baseFontSizeRem * 2.5;

  const statColumnWidth = `${baseFontSizeRem * 5}rem`;

  return (
    <Card className="bg-card/60 backdrop-blur-md shadow-lg flex flex-col" style={{ maxHeight: '80vh' }}>
      <CardHeader>
        <CardTitle 
          className="flex items-center gap-3"
          style={{ fontSize: `${titleSize}rem` }}
        >
          <Trophy className="h-[1em] w-[1em] text-amber-400" />
          Tabla de Posiciones
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center" style={{ fontSize: `${headerSize}rem`, height: `${rowHeightRem}rem`, width: statColumnWidth }}>Puesto</TableHead>
                <TableHead className="w-1/2" style={{ fontSize: `${headerSize}rem` }}>Equipo</TableHead>
                <TableHead className="text-center" style={{ fontSize: `${headerSize}rem`, width: statColumnWidth }}>PJ</TableHead>
                <TableHead className="text-center" style={{ fontSize: `${headerSize}rem`, width: statColumnWidth }}>PG</TableHead>
                <TableHead className="text-center" style={{ fontSize: `${headerSize}rem`, width: statColumnWidth }}>PG<span className="text-[0.7em] opacity-80"> (OT)</span></TableHead>
                <TableHead className="text-center" style={{ fontSize: `${headerSize}rem`, width: statColumnWidth }}>PP<span className="text-[0.7em] opacity-80"> (OT)</span></TableHead>
                <TableHead className="text-center" style={{ fontSize: `${headerSize}rem`, width: statColumnWidth }}>PE</TableHead>
                <TableHead className="text-center" style={{ fontSize: `${headerSize}rem`, width: statColumnWidth }}>PP</TableHead>
                <TableHead className="text-center border-l" style={{ fontSize: `${headerSize}rem`, width: statColumnWidth }}>GF</TableHead>
                <TableHead className="text-center" style={{ fontSize: `${headerSize}rem`, width: statColumnWidth }}>GC</TableHead>
                <TableHead className="text-center font-bold border-l" style={{ fontSize: `${headerSize}rem`, width: statColumnWidth }}>Puntos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedStandings.map(teamStat => {
                if (teamStat.isEllipsis) {
                    return (
                        <TableRow key={teamStat.id}>
                            <TableCell colSpan={11} className="p-0" style={{ height: `${ellipsisRowHeight}rem` }}>
                                <div className="relative flex items-center justify-center h-full text-muted-foreground/50 tracking-widest" style={{ fontSize: `${ellipsisFontSize}rem`, bottom: '0.2em' }}>
                                    ...
                                </div>
                            </TableCell>
                        </TableRow>
                    );
                }
                
                const isMatchTeam = teamStat.id === homeTeamId || teamStat.id === awayTeamId;
                
                return (
                    <TableRow
                      key={teamStat.id}
                      className={cn(isMatchTeam ? "bg-primary/20 font-bold" : "")}
                      style={{
                        fontSize: `${cellSize}rem`,
                        height: `${rowHeightRem}rem`,
                        ...(isMatchTeam ? {} : {
                          color: 'hsl(var(--muted-foreground))',
                          textShadow: '0 1px 3px rgba(0, 0, 0, 0.8), 0 0 8px rgba(0, 0, 0, 0.6)',
                          opacity: 0.85
                        })
                      }}
                    >
                        <TableCell className="text-center font-bold">{teamStat.rank}</TableCell>
                        <TableCell className="font-medium">{teamStat.name}</TableCell>
                        <TableCell className="text-center">{teamStat.pj}</TableCell>
                        <TableCell className="text-center">{teamStat.pg}</TableCell>
                        <TableCell className="text-center">{teamStat.pg_ot}</TableCell>
                        <TableCell className="text-center">{teamStat.pp_ot}</TableCell>
                        <TableCell className="text-center">{teamStat.pe}</TableCell>
                        <TableCell className="text-center">{teamStat.pp}</TableCell>
                        <TableCell className="text-center border-l">{teamStat.gf}</TableCell>
                        <TableCell className="text-center">{teamStat.gc}</TableCell>
                        <TableCell className="text-center font-bold border-l" style={{ fontSize: `${pointsSize}rem`}}>{teamStat.puntos}</TableCell>
                    </TableRow>
                )
              })}
              {displayedStandings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center">No hay datos de posiciones.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
