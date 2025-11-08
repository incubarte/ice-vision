
"use client";

import React, { useState, useMemo } from 'react';
import { useGameState, getCategoryNameById } from '@/contexts/game-state-context';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, ChevronLeft, ChevronRight, FileText, ListFilter, Search, X } from 'lucide-react';
import { addMonths, subMonths, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { AddEditMatchDialog } from './add-edit-match-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import type { MatchData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { FixtureMatchSummaryDialog } from './fixture-match-summary-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';

export function FixtureCalendarView() {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const { selectedTournamentId, tournaments } = state.config;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [matchToEdit, setMatchToEdit] = useState<MatchData | null>(null);
  const [matchToDelete, setMatchToDelete] = useState<MatchData | null>(null);
  const [dialogSelectedDate, setDialogSelectedDate] = useState<Date | undefined>(undefined);
  const [matchToShowSummary, setMatchToShowSummary] = useState<MatchData | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [teamSearch, setTeamSearch] = useState('');

  const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY === 'true';

  const selectedTournament = useMemo(() => {
    return tournaments.find(t => t.id === selectedTournamentId);
  }, [tournaments, selectedTournamentId]);

  const matches = useMemo(() => {
    return selectedTournament?.matches || [];
  }, [selectedTournament]);

  const filteredMatchIds = useMemo(() => {
    const isAnyFilterActive = categoryFilter.length > 0 || teamSearch.trim() !== '';
    if (!isAnyFilterActive) return null; // Return null if no filters are active

    const lowerCaseSearch = teamSearch.toLowerCase();
    
    return new Set(
      matches
        .filter(match => {
          const categoryMatch = categoryFilter.length === 0 || categoryFilter.includes(match.categoryId);
          
          const homeTeam = selectedTournament?.teams.find(t => t.id === match.homeTeamId);
          const awayTeam = selectedTournament?.teams.find(t => t.id === match.awayTeamId);
          const teamMatch = !lowerCaseSearch ||
            homeTeam?.name.toLowerCase().includes(lowerCaseSearch) ||
            awayTeam?.name.toLowerCase().includes(lowerCaseSearch);

          return categoryMatch && teamMatch;
        })
        .map(match => match.id)
    );
  }, [matches, categoryFilter, teamSearch, selectedTournament?.teams]);

  const handleDayClick = (day: Date) => {
    if (isReadOnly) return;
    setDialogSelectedDate(day);
    setMatchToEdit(null);
    setIsAddEditDialogOpen(true);
  };

  const handleEditMatch = (match: MatchData) => {
    if (isReadOnly) return;
    setMatchToEdit(match);
    setDialogSelectedDate(new Date(match.date));
    setIsAddEditDialogOpen(true);
  };
  
  const handleDeleteMatch = () => {
    if (isReadOnly || !matchToDelete || !selectedTournamentId) return;
    dispatch({ type: 'DELETE_MATCH_FROM_TOURNAMENT', payload: { tournamentId: selectedTournamentId, matchId: matchToDelete.id }});
    toast({ title: 'Partido Eliminado', description: 'El partido ha sido eliminado del fixture.' });
    setMatchToDelete(null);
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  const clearFilters = () => {
    setCategoryFilter([]);
    setTeamSearch('');
  };
  
  const isAnyFilterActive = categoryFilter.length > 0 || teamSearch.trim() !== '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-2">
        <h3 className="text-xl font-semibold">{format(currentMonth, "MMMM yyyy", { locale: es })}</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      
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
         {isAnyFilterActive && (
            <Button variant="ghost" onClick={clearFilters} className="text-destructive hover:text-destructive">
                <X className="mr-2 h-4 w-4" /> Limpiar Filtros
            </Button>
         )}
      </div>
      
      <div className="grid grid-cols-7 border-t border-l">
        {daysOfWeek.map(day => (
          <div key={day} className="text-center font-bold p-2 border-b border-r bg-muted/50">{day}</div>
        ))}
        {days.map(day => {
          const matchesForDay = matches
            .filter(match => isSameDay(new Date(match.date), day))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          return (
            <div 
              key={day.toString()}
              className={cn(
                "relative p-2 border-b border-r min-h-[120px] flex flex-col", 
                !isSameMonth(day, currentMonth) && "bg-muted/20 text-muted-foreground"
              )}
            >
              <div 
                className={cn("font-medium", !isReadOnly && "cursor-pointer hover:text-blue-500", isSameDay(day, new Date()) && "text-blue-500 font-bold")}
                onClick={() => handleDayClick(day)}
              >
                {format(day, "d")}
              </div>
              <ScrollArea className="flex-grow mt-1">
                <div className="space-y-1 pr-1">
                  {matchesForDay.map(match => {
                    const homeTeam = selectedTournament?.teams.find(t => t.id === match.homeTeamId);
                    const awayTeam = selectedTournament?.teams.find(t => t.id === match.awayTeamId);
                    const hasSummary = !!match.summary;
                    
                    const isHighlighted = filteredMatchIds ? filteredMatchIds.has(match.id) : true;

                    return (
                      <div
                        key={match.id}
                        onClick={() => setSelectedMatch(match)}
                        className={cn(
                          "text-xs p-1.5 rounded-md bg-background/50 border border-border/50 transition-all duration-300 cursor-pointer hover:bg-accent/50 hover:border-accent",
                          !isHighlighted && "opacity-30",
                          hasSummary && "border-l-2 border-l-blue-400"
                        )}
                      >
                        <div className="font-semibold text-[10px] leading-tight mb-0.5">{format(new Date(match.date), 'HH:mm')}</div>
                        <div className="font-medium text-[11px] leading-tight">{homeTeam?.name || '?'}</div>
                        <div className="text-muted-foreground text-[10px] leading-tight">vs</div>
                        <div className="font-medium text-[11px] leading-tight">{awayTeam?.name || '?'}</div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>

      {!isReadOnly && (
        <AddEditMatchDialog
          isOpen={isAddEditDialogOpen}
          onOpenChange={setIsAddEditDialogOpen}
          tournament={selectedTournament}
          matchToEdit={matchToEdit}
          selectedDate={dialogSelectedDate}
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

      {selectedMatch && (
        <Dialog open={!!selectedMatch} onOpenChange={() => setSelectedMatch(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Detalles del Partido</DialogTitle>
              <DialogDescription>
                {format(new Date(selectedMatch.date), "PPP 'a las' HH:mm", { locale: es })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Equipos</div>
                <div className="text-lg font-semibold">
                  {selectedTournament?.teams.find(t => t.id === selectedMatch.homeTeamId)?.name || 'Equipo Local'}
                </div>
                <div className="text-center text-muted-foreground">vs</div>
                <div className="text-lg font-semibold">
                  {selectedTournament?.teams.find(t => t.id === selectedMatch.awayTeamId)?.name || 'Equipo Visitante'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Categoría</div>
                <div className="font-medium">{getCategoryNameById(selectedMatch.categoryId, selectedTournament?.categories) || 'N/A'}</div>
              </div>

              {selectedMatch.summary && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Resultado</div>
                  <div className="font-medium text-lg">
                    {selectedMatch.homeScore} - {selectedMatch.awayScore}
                    {selectedMatch.overTimeOrShootouts && (
                      <span className="text-sm text-muted-foreground ml-2">({selectedMatch.overTimeOrShootouts})</span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-4">
                {selectedMatch.summary && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setMatchToShowSummary(selectedMatch);
                      setSelectedMatch(null);
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Ver Resumen Completo
                  </Button>
                )}
                {!isReadOnly && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        handleEditMatch(selectedMatch);
                        setSelectedMatch(null);
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Editar Partido
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => {
                        setMatchToDelete(selectedMatch);
                        setSelectedMatch(null);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar Partido
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {!isReadOnly && matchToDelete && (
        <AlertDialog open={!!matchToDelete} onOpenChange={() => setMatchToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que quieres eliminar este partido del fixture? Esta acción no se puede deshacer.
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
