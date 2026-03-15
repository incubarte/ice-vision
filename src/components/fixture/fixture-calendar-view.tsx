
"use client";

import React, { useState, useMemo } from 'react';
import { useGameState, getCategoryNameById } from '@/contexts/game-state-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, ChevronLeft, ChevronRight, FileText, ListFilter, Search, X, Play } from 'lucide-react';
import { addMonths, subMonths, addDays, subDays, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMediaQuery } from '@/hooks/use-media-query';
import { AddEditMatchDialog } from './add-edit-match-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { type MatchData, type TeamData, type Tournament, isTournamentHydrated } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { FixtureMatchSummaryDialog } from './fixture-match-summary-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { calculateScoreFromSummary } from '@/lib/match-helpers';
import { HockeyPuckSpinner } from '@/components/ui/hockey-puck-spinner';

// Helper para obtener el nombre del equipo o posición
function getTeamOrPositionName(teamId: string | undefined, teams: TeamData[] | undefined): string {
  if (!teamId) return '?';

  if (teamId.startsWith('position-')) {
    const positionMap: Record<string, string> = {
      'position-1': '1ero',
      'position-2': '2do',
      'position-3': '3ero',
      'position-4': '4to'
    };
    return positionMap[teamId] || '?';
  }
  return teams?.find(t => t.id === teamId)?.name || '?';
}

// Helper para obtener el matchup readable
function getMatchupDisplay(match: MatchData, teams: TeamData[] | undefined): { home: string, away: string } {
  // Para partidos de playoffs, manejar casos con equipos parcialmente definidos
  if (match.phase === 'playoffs') {
    // Semifinales
    if (match.playoffType === 'semifinal' && match.playoffMatchup) {
      // Si ambos equipos están definidos, usarlos
      if (match.homeTeamId && match.awayTeamId) {
        return {
          home: getTeamOrPositionName(match.homeTeamId, teams),
          away: getTeamOrPositionName(match.awayTeamId, teams)
        };
      }
      // Si no hay equipos, mostrar matchup
      const matchupMap: Record<string, { home: string, away: string }> = {
        '1vs4': { home: '1ero', away: '4to' },
        '2vs3': { home: '2do', away: '3ero' },
        '1vs2': { home: '1ero', away: '2do' },
        '1vs3': { home: '1ero', away: '3ero' },
        '2vs4': { home: '2do', away: '4to' },
        '3vs4': { home: '3ero', away: '4to' }
      };
      return matchupMap[match.playoffMatchup] || { home: '?', away: '?' };
    }

    // Final
    if (match.playoffType === 'final') {
      return {
        home: match.homeTeamId ? getTeamOrPositionName(match.homeTeamId, teams) : 'Ganador Semi 1',
        away: match.awayTeamId ? getTeamOrPositionName(match.awayTeamId, teams) : 'Ganador Semi 2'
      };
    }

    // 3er Puesto
    if (match.playoffType === '3er-puesto') {
      return {
        home: match.homeTeamId ? getTeamOrPositionName(match.homeTeamId, teams) : 'Perdedor Semi 1',
        away: match.awayTeamId ? getTeamOrPositionName(match.awayTeamId, teams) : 'Perdedor Semi 2'
      };
    }
  }

  // Partidos normales o fallback
  return {
    home: getTeamOrPositionName(match.homeTeamId, teams),
    away: getTeamOrPositionName(match.awayTeamId, teams)
  };
}

interface FixtureCalendarViewProps {
  tournamentId?: string;
}

export function FixtureCalendarView({ tournamentId }: FixtureCalendarViewProps = {}) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const router = useRouter();
  const { selectedTournamentId, tournaments, activeTournament } = state.config;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentCenterDate, setCurrentCenterDate] = useState(startOfDay(new Date())); // Para vista mobile de 3 días

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
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Use tournamentId prop if provided, otherwise fall back to selectedTournamentId from state
  const activeTournamentId = tournamentId || selectedTournamentId;

  const selectedTournament = useMemo(() => {
    if (activeTournament && activeTournament.id === activeTournamentId) {
      return activeTournament;
    }
    return (tournaments || []).find(t => t.id === activeTournamentId);
  }, [tournaments, activeTournamentId, activeTournament]);

  const isHydrated = isTournamentHydrated(selectedTournament);

  const matches = useMemo(() => {
    return isHydrated ? (selectedTournament as Tournament).matches : [];
  }, [selectedTournament, isHydrated]);

  const filteredMatchIds = useMemo(() => {
    const isAnyFilterActive = categoryFilter.length > 0 || teamSearch.trim() !== '';
    if (!isAnyFilterActive || !isHydrated) return null; // Return null if no filters are active

    const lowerCaseSearch = teamSearch.toLowerCase();

    return new Set(
      matches
        .filter((match: MatchData) => {
          const categoryMatch = categoryFilter.length === 0 || categoryFilter.includes(match.categoryId);

          const { home: homeName, away: awayName } = getMatchupDisplay(match, (selectedTournament as Tournament).teams);
          const teamMatch = !lowerCaseSearch ||
            homeName.toLowerCase().includes(lowerCaseSearch) ||
            awayName.toLowerCase().includes(lowerCaseSearch);

          return categoryMatch && teamMatch;
        })
        .map((match: MatchData) => match.id)
    );
  }, [matches, categoryFilter, teamSearch, selectedTournament, isHydrated]);

  if (!selectedTournament) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Selecciona un torneo para ver el calendario.</p>
      </div>
    );
  }

  if (!isHydrated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <HockeyPuckSpinner />
        <p className="text-muted-foreground animate-pulse">Cargando calendario...</p>
      </div>
    );
  }

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
    if (isReadOnly || !matchToDelete || !activeTournamentId) return;
    dispatch({ type: 'DELETE_MATCH_FROM_TOURNAMENT', payload: { tournamentId: activeTournamentId, matchId: matchToDelete.id }});
    toast({ title: 'Partido Eliminado', description: 'El partido ha sido eliminado del fixture.' });
    setMatchToDelete(null);
  };

  const handlePlayMatch = (match: MatchData) => {
    if (isReadOnly) return;
    setSelectedMatch(null);
    // Navigate to setup page with step 2 and match ID
    router.push(`/setup?step=2&matchId=${match.id}`);
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  // Navegación para vista mobile de 7 días (una semana)
  const nextWeek = () => setCurrentCenterDate(addDays(currentCenterDate, 7));
  const prevWeek = () => setCurrentCenterDate(subDays(currentCenterDate, 7));

  const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // Calcular días a mostrar según el tamaño de pantalla
  const days = useMemo(() => {
    if (isMobile) {
      // Vista mobile: 7 días consecutivos empezando desde currentCenterDate
      return eachDayOfInterval({
        start: currentCenterDate,
        end: addDays(currentCenterDate, 6)
      });
    } else {
      // Vista desktop: semana completa del mes
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
      const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: startDate, end: endDate });
    }
  }, [isMobile, currentMonth, currentCenterDate]);
  
  const clearFilters = () => {
    setCategoryFilter([]);
    setTeamSearch('');
  };

  const isAnyFilterActive = categoryFilter.length > 0 || teamSearch.trim() !== '';

  // Check if we're in the current week (for mobile view)
  const isInCurrentWeek = useMemo(() => {
    const today = startOfDay(new Date());
    const weekEnd = addDays(currentCenterDate, 6);
    return today >= currentCenterDate && today <= weekEnd;
  }, [currentCenterDate]);

  const goToCurrentWeek = () => {
    setCurrentCenterDate(startOfDay(new Date()));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-2">
        {isMobile ? (
          <div className="w-full flex flex-col gap-2">
            <h3 className="text-base font-semibold text-center">
              {format(currentCenterDate, "d", { locale: es })} - {format(addDays(currentCenterDate, 6), "d 'de' MMMM yyyy", { locale: es })}
            </h3>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={prevWeek}>
                <ChevronLeft className="h-4 w-4" />
                <span className="ml-1">Semana</span>
              </Button>
              <Button variant="outline" size="sm" onClick={nextWeek}>
                <span className="mr-1">Semana</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {!isInCurrentWeek && (
              <div className="flex justify-center">
                <Button variant="default" size="sm" onClick={goToCurrentWeek} className="bg-blue-500 hover:bg-blue-600">
                  Semana Actual
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <h3 className="text-xl font-semibold">{format(currentMonth, "MMMM yyyy", { locale: es })}</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </>
        )}
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
      
      <div className={cn("grid border-t border-l", isMobile ? "grid-cols-3" : "grid-cols-7")}>
        {!isMobile && (
          // Header desktop: mostrar días de la semana completos
          daysOfWeek.map(day => (
            <div key={day} className="text-center font-bold p-2 border-b border-r bg-muted/50">{day}</div>
          ))
        )}
        {days.map((day, index) => {
          const matchesForDay = matches
            .filter(match => isSameDay(new Date(match.date), day))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          return (
            <div
              key={day.toString()}
              className={cn(
                "relative p-2 border-b border-r min-h-[120px] flex flex-col",
                // En desktop, marcar días fuera del mes. En mobile, siempre mostrar normal
                !isMobile && !isSameMonth(day, currentMonth) && "bg-muted/20 text-muted-foreground"
              )}
            >
              <div
                className={cn("font-medium", !isReadOnly && "cursor-pointer hover:text-blue-500")}
                onClick={() => handleDayClick(day)}
              >
                {isMobile ? (
                  // Mobile: mostrar día de semana + número
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground uppercase">{format(day, "EEE", { locale: es })}</div>
                    <div className={cn(
                      "text-sm font-bold",
                      isSameDay(day, new Date()) && "text-blue-500 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center mx-auto"
                    )}>
                      {format(day, "d")}
                    </div>
                  </div>
                ) : (
                  // Desktop: solo número
                  <div className={cn(
                    isSameDay(day, new Date()) && "text-blue-500 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold"
                  )}>
                    {format(day, "d")}
                  </div>
                )}
              </div>
              <ScrollArea className="flex-grow mt-1">
                <div className="space-y-1 pr-1">
                  {matchesForDay.map(match => {
                    const { home: homeName, away: awayName } = getMatchupDisplay(match, selectedTournament?.teams);
                    const hasSummary = !!match.summary;
                    const isPlayoff = match.phase === 'playoffs';
                    const isFinal = isPlayoff && match.playoffType === 'final';
                    const isSemifinal = isPlayoff && match.playoffType === 'semifinal';
                    const is3erPuesto = isPlayoff && match.playoffType === '3er-puesto';
                    const scores = hasSummary ? calculateScoreFromSummary(match.summary) : null;

                    const isHighlighted = filteredMatchIds ? filteredMatchIds.has(match.id) : true;

                    return (
                      <div
                        key={match.id}
                        onClick={() => setSelectedMatch(match)}
                        className={cn(
                          "relative text-xs p-1.5 rounded-md bg-background/50 transition-all duration-300 cursor-pointer hover:bg-accent/50 hover:border-accent",
                          !isHighlighted && "opacity-30",
                          // Border base
                          isFinal ? "border-2 border-amber-400 dark:border-amber-500 shadow-sm" :
                          is3erPuesto ? "border-2 border-orange-400 dark:border-orange-500 shadow-sm" :
                          "border border-border/50"
                        )}
                      >
                        {/* Category badge - top right corner */}
                        <div className="absolute top-0.5 right-0.5 bg-muted px-1 py-0.5 rounded text-[8px] font-semibold text-foreground leading-none">
                          {getCategoryNameById(match.categoryId, selectedTournament?.categories)?.substring(0, 8) || 'N/A'}
                        </div>

                        {/* Score badge - bottom right corner */}
                        {scores && (
                          <div className="absolute bottom-0.5 right-0.5 text-muted-foreground px-1 py-0.5 rounded text-[9px] font-bold leading-none">
                            {scores.home}-{scores.away}
                          </div>
                        )}

                        {isSemifinal && (
                          <div className="text-[9px] font-semibold text-blue-600 dark:text-blue-400 mb-0.5 uppercase tracking-wide">
                            Semifinal
                          </div>
                        )}
                        {isFinal && (
                          <div className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 mb-0.5 uppercase tracking-wide">
                            Final
                          </div>
                        )}
                        {is3erPuesto && (
                          <div className="text-[9px] font-semibold text-orange-600 dark:text-orange-400 mb-0.5 uppercase tracking-wide">
                            3er Puesto
                          </div>
                        )}
                        <div className="font-semibold text-[10px] leading-tight mb-0.5">
                          {format(new Date(match.date), 'HH:mm')}
                        </div>
                        <div className="font-medium text-[11px] leading-tight">{homeName}</div>
                        <div className="text-muted-foreground text-[10px] leading-tight">vs</div>
                        <div className="font-medium text-[11px] leading-tight">{awayName}</div>
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
                  {getMatchupDisplay(selectedMatch, selectedTournament?.teams).home}
                </div>
                <div className="text-center text-muted-foreground">vs</div>
                <div className="text-lg font-semibold">
                  {getMatchupDisplay(selectedMatch, selectedTournament?.teams).away}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Categoría</div>
                <div className="font-medium">{getCategoryNameById(selectedMatch.categoryId, selectedTournament?.categories) || 'N/A'}</div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Fase</div>
                <div className="font-medium">
                  {selectedMatch.phase === 'clasificacion' ? 'Clasificación' : 'Playoffs'}
                  {selectedMatch.phase === 'playoffs' && selectedMatch.playoffType && (
                    <span className="text-amber-600 dark:text-amber-400 ml-2">
                      ({selectedMatch.playoffType === 'semifinal' ? 'Semifinal' : 'Final'})
                    </span>
                  )}
                </div>
              </div>

              {selectedMatch.summary && (() => {
                const scores = calculateScoreFromSummary(selectedMatch.summary);
                return (
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Resultado</div>
                    <div className="font-medium text-lg">
                      {scores.home} - {scores.away}
                      {selectedMatch.overTimeOrShootouts && (
                        <span className="text-sm text-muted-foreground ml-2">({selectedMatch.overTimeOrShootouts})</span>
                      )}
                    </div>
                  </div>
                );
              })()}

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
                      variant="default"
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => handlePlayMatch(selectedMatch)}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Jugar Partido
                    </Button>
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
