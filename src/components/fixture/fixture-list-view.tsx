
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useGameState, getCategoryNameById } from '@/contexts/game-state-context';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit, Trash2, FileText, Search, ListFilter, Calendar as CalendarIcon, X, Check as CheckIcon, Play } from 'lucide-react';
import { format, parseISO, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { AddEditMatchDialog } from './add-edit-match-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import type { MatchData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FixtureMatchSummaryDialog } from './fixture-match-summary-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Checkbox } from '../ui/checkbox';
import { cn } from '@/lib/utils';
import { Calendar } from '../ui/calendar';
import { calculateScoreFromSummary, hasOvertimeOrShootout } from '@/lib/match-helpers';

export function FixtureListView() {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { selectedTournamentId, tournaments } = state.config;

  const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY === 'true';
  
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [matchToEdit, setMatchToEdit] = useState<MatchData | null>(null);
  const [matchToDelete, setMatchToDelete] = useState<MatchData | null>(null);
  const [matchToShowSummary, setMatchToShowSummary] = useState<MatchData | null>(null);

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<Date | undefined>();

  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
        try {
            const parsedDate = parseISO(dateParam);
            setDateFilter(parsedDate);
        } catch (e) {
            console.warn("Invalid date in URL parameter", e);
        }
    }
  }, [searchParams]);

  const selectedTournament = useMemo(() => {
    return tournaments.find(t => t.id === selectedTournamentId);
  }, [tournaments, selectedTournamentId]);

  const sortedMatches = useMemo(() => {
    if (!selectedTournament?.matches) return [];
    
    let filtered = [...selectedTournament.matches];

    if (categoryFilter.length > 0) {
        filtered = filtered.filter(match => categoryFilter.includes(match.categoryId));
    }

    if (teamSearch.trim()) {
        const lowerCaseSearch = teamSearch.toLowerCase();
        filtered = filtered.filter(match => {
            const homeTeam = selectedTournament.teams.find(t => t.id === match.homeTeamId);
            const awayTeam = selectedTournament.teams.find(t => t.id === match.awayTeamId);
            return homeTeam?.name.toLowerCase().includes(lowerCaseSearch) || awayTeam?.name.toLowerCase().includes(lowerCaseSearch);
        });
    }
    
    if (dateFilter) {
        filtered = filtered.filter(match => isSameDay(new Date(match.date), dateFilter));
    }

    return filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedTournament, categoryFilter, teamSearch, dateFilter]);

  const handleEditMatch = (match: MatchData) => {
    if (isReadOnly) return;
    setMatchToEdit(match);
    setIsAddEditDialogOpen(true);
  };
  
  const handleDeleteMatch = () => {
    if (isReadOnly || !matchToDelete || !selectedTournamentId) return;
    dispatch({ type: 'DELETE_MATCH_FROM_TOURNAMENT', payload: { tournamentId: selectedTournamentId, matchId: matchToDelete.id }});
    toast({ title: 'Partido Eliminado', description: 'El partido ha sido eliminado del fixture.' });
    setMatchToDelete(null);
  };

  const handlePlayMatch = (match: MatchData) => {
    if (isReadOnly) return;
    // Navigate to setup page with step 2 and match ID
    router.push(`/setup?step=2&matchId=${match.id}`);
  };

  const clearFilters = () => {
    setCategoryFilter([]);
    setTeamSearch('');
    setDateFilter(undefined);
  };
  
  const isAnyFilterActive = categoryFilter.length > 0 || teamSearch.trim() !== '' || dateFilter;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Lista de Partidos</h2>
      
      <div className="flex flex-col sm:flex-row gap-2">
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto justify-start">
                    <ListFilter className="mr-2 h-4 w-4" />
                    Categorías ({categoryFilter.length || 'Todas'})
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start">
                <Command>
                    <CommandInput placeholder="Buscar categoría..." />
                    <CommandList>
                        <CommandEmpty>No se encontraron categorías.</CommandEmpty>
                        <CommandGroup>
                        {(selectedTournament?.categories || []).map(cat => (
                            <CommandItem key={cat.id} onSelect={() => {
                                setCategoryFilter(prev => 
                                    prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                                );
                            }}>
                                <Checkbox checked={categoryFilter.includes(cat.id)} className="mr-2" />
                                <span>{cat.name}</span>
                            </CommandItem>
                        ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
        <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Buscar por equipo..." 
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="pl-10"
            />
        </div>
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full sm:w-auto justify-start text-left font-normal", !dateFilter && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFilter ? format(dateFilter, "PPP", { locale: es }) : <span>Filtrar por fecha</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={dateFilter} onSelect={setDateFilter} initialFocus locale={es} />
            </PopoverContent>
        </Popover>
         {isAnyFilterActive && (
            <Button variant="ghost" onClick={clearFilters} className="text-destructive hover:text-destructive">
                <X className="mr-2 h-4 w-4" /> Limpiar Filtros
            </Button>
         )}
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha y Hora</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Equipo Local</TableHead>
              <TableHead>Equipo Visitante</TableHead>
              <TableHead className="text-center">Resultado</TableHead>
              <TableHead className="text-center">OT/Penales</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMatches.length > 0 ? (
              sortedMatches.map(match => {
                const homeTeam = selectedTournament?.teams.find(t => t.id === match.homeTeamId);
                const awayTeam = selectedTournament?.teams.find(t => t.id === match.awayTeamId);

                // Calculate score from summary (single source of truth)
                const score = match.summary
                    ? (() => {
                        const { home, away } = calculateScoreFromSummary(match.summary);
                        return `${home} - ${away}`;
                      })()
                    : '-';

                const wentToOTOrSO = match.summary ? hasOvertimeOrShootout(match.summary) : false;

                return (
                  <TableRow key={match.id}>
                    <TableCell>{format(new Date(match.date), "dd/MM/yy HH:mm", { locale: es })}</TableCell>
                    <TableCell>{getCategoryNameById(match.categoryId, selectedTournament?.categories) || 'N/A'}</TableCell>
                    <TableCell>{homeTeam?.name || 'Equipo no encontrado'}</TableCell>
                    <TableCell>{awayTeam?.name || 'Equipo no encontrado'}</TableCell>
                    <TableCell className="text-center font-mono font-bold">{score}</TableCell>
                    <TableCell className="text-center">{wentToOTOrSO && <CheckIcon className="h-4 w-4 mx-auto text-green-500"/>}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {match.summary && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMatchToShowSummary(match)}>
                                <FileText className="h-4 w-4 text-blue-400" />
                            </Button>
                        )}
                        {!isReadOnly && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-600" onClick={() => handlePlayMatch(match)} title="Jugar partido">
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditMatch(match)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setMatchToDelete(match)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  {isAnyFilterActive ? "No se encontraron partidos con los filtros aplicados." : "No hay partidos programados."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {!isReadOnly && (
        <AddEditMatchDialog
          isOpen={isAddEditDialogOpen}
          onOpenChange={setIsAddEditDialogOpen}
          tournament={selectedTournament}
          matchToEdit={matchToEdit}
        />
      )}
      
      {matchToShowSummary && (
        <FixtureMatchSummaryDialog
          isOpen={!!matchToShowSummary}
          onOpenChange={() => setMatchToShowSummary(null)}
          match={matchToShowSummary}
          tournament={selectedTournament}
        />
      )}

       {!isReadOnly && matchToDelete && (
        <AlertDialog open={!!matchToDelete} onOpenChange={() => setMatchToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que quieres eliminar este partido? Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setMatchToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteMatch} className="bg-destructive hover:bg-destructive/90">
                Eliminar Partido
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
