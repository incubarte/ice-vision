
"use client";

import React, { useMemo } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Info } from 'lucide-react';
import { useStandings } from '@/hooks/use-standings';
import { cn } from '@/lib/utils';

const StandingsTable = ({ categoryName, categoryId, tournament }: { categoryName: string, categoryId: string, tournament: any }) => {
    const stats = useStandings(tournament, categoryId);

    if (stats.length === 0) {
        return null; // Don't render a table if there are no teams/stats for this category
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl">
                    <Trophy className="h-6 w-6 text-amber-400" />
                    {categoryName}
                </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
        </Card>
    );
};

export function StandingsTab() {
  const { state } = useGameState();
  const { tournaments, selectedTournamentId } = state.config;

  const selectedTournament = useMemo(() => {
    return (tournaments || []).find(t => t.id === selectedTournamentId);
  }, [tournaments, selectedTournamentId]);

  const categoriesWithTeams = useMemo(() => {
    if (!selectedTournament) return [];
    return selectedTournament.categories.filter(cat => 
        (selectedTournament.teams || []).some(team => team.category === cat.id)
    );
  }, [selectedTournament]);

  if (!selectedTournament) return null;
  
  return (
    <div className="space-y-8">
        <div className="flex items-start gap-2 p-3 text-sm border rounded-lg bg-muted/50 text-muted-foreground">
            <Info className="h-5 w-5 mt-0.5 shrink-0"/>
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
    </div>
  );
}
