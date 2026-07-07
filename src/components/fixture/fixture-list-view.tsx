
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useGameState, getCategoryNameById } from '@/contexts/game-state-context';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit, Trash2, FileText, Search, ListFilter, Calendar as CalendarIcon, X, Check as CheckIcon, Play, Eraser, Share2 } from 'lucide-react';
import { format, parseISO, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { AddEditMatchDialog } from './add-edit-match-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { type MatchData, type TeamData, isTournamentHydrated } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FixtureMatchSummaryDialog } from './fixture-match-summary-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Checkbox } from '../ui/checkbox';
import { cn } from '@/lib/utils';
import { Calendar } from '../ui/calendar';
import { calculateScoreFromSummary, hasOvertimeOrShootout } from '@/lib/match-helpers';
import { deleteMatchWithSummary, cleanMatchSummary } from '@/lib/summary-management';
import { HockeyPuckSpinner } from '@/components/ui/hockey-puck-spinner';
import { useAdminMode } from '@/hooks/use-admin-mode';

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
  // Playoffs 5to-8vo
  if (match.phase === 'playoffs-5-8') {
    if (match.playoff58Type === 'semifinal' && match.playoff58Matchup) {
      if (match.homeTeamId && match.awayTeamId) {
        return {
          home: getTeamOrPositionName(match.homeTeamId, teams),
          away: getTeamOrPositionName(match.awayTeamId, teams)
        };
      }
      const map58: Record<string, { home: string, away: string }> = {
        '5vs8': { home: '5to', away: '8vo' },
        '6vs7': { home: '6to', away: '7mo' },
      };
      return map58[match.playoff58Matchup] || { home: '?', away: '?' };
    }
    if (match.playoff58Type === 'final') {
      return {
        home: match.homeTeamId ? getTeamOrPositionName(match.homeTeamId, teams) : 'Gan. Semi 1',
        away: match.awayTeamId ? getTeamOrPositionName(match.awayTeamId, teams) : 'Gan. Semi 2'
      };
    }
    if (match.playoff58Type === '3er-puesto') {
      return {
        home: match.homeTeamId ? getTeamOrPositionName(match.homeTeamId, teams) : 'Per. Semi 1',
        away: match.awayTeamId ? getTeamOrPositionName(match.awayTeamId, teams) : 'Per. Semi 2'
      };
    }
  }

  // Relegation
  if (match.phase === 'relegation') {
    return {
      home: getTeamOrPositionName(match.homeTeamId, teams),
      away: getTeamOrPositionName(match.awayTeamId, teams)
    };
  }

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

interface FixtureListViewProps {
  teamFilter?: string; // Optional team ID to filter matches
  hideFilters?: boolean; // Hide filter controls
  hideTitle?: boolean; // Hide title
  tournamentId?: string; // Tournament ID to display
}

export function FixtureListView({ teamFilter, hideFilters = false, hideTitle = false, tournamentId }: FixtureListViewProps = {}) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { selectedTournamentId, tournaments, activeTournament } = state.config;

  const { isReadOnly, adminSecret } = useAdminMode();

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [matchToEdit, setMatchToEdit] = useState<MatchData | null>(null);
  const [matchToDelete, setMatchToDelete] = useState<MatchData | null>(null);
  const [matchToClean, setMatchToClean] = useState<MatchData | null>(null);
  const [matchToShowSummary, setMatchToShowSummary] = useState<MatchData | null>(null);

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [statusFilter, setStatusFilter] = useState<'all' | 'played' | 'pending'>('all');

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

  // Use tournamentId prop if provided, otherwise fall back to selectedTournamentId from state
  const activeTournamentId = tournamentId || selectedTournamentId;

  const selectedTournament = useMemo(() => {
    if (activeTournament && activeTournament.id === activeTournamentId) {
      return activeTournament;
    }
    return tournaments.find(t => t.id === activeTournamentId);
  }, [tournaments, activeTournamentId, activeTournament]);

  const isHydrated = isTournamentHydrated(selectedTournament);

  const sortedMatches = useMemo(() => {
    if (!isHydrated || !selectedTournament?.matches) return [];

    let filtered = [...selectedTournament.matches];

    // Apply team filter if provided (for team-specific view)
    if (teamFilter) {
        filtered = filtered.filter(match => {
            // Check if team is directly playing
            const isDirectlyPlaying = match.homeTeamId === teamFilter || match.awayTeamId === teamFilter;

            // For playoffs, include undetermined matches (semis, finals, 3er puesto)
            let couldPlayInPlayoff = false;
            if (match.phase === 'playoffs' && !match.homeTeamId && !match.awayTeamId) {
                if (match.playoffType === 'semifinal' || match.playoffType === 'final' || match.playoffType === '3er-puesto') {
                    couldPlayInPlayoff = true;
                }
            }

            return isDirectlyPlaying || couldPlayInPlayoff;
        });
    }

    if (categoryFilter.length > 0) {
        filtered = filtered.filter(match => categoryFilter.includes(match.categoryId));
    }

    if (teamSearch.trim()) {
        const lowerCaseSearch = teamSearch.toLowerCase();
        filtered = filtered.filter(match => {
            const { home: homeName, away: awayName } = getMatchupDisplay(match, selectedTournament.teams);
            return homeName.toLowerCase().includes(lowerCaseSearch) || awayName.toLowerCase().includes(lowerCaseSearch);
        });
    }

    if (dateFilter) {
        filtered = filtered.filter(match => isSameDay(new Date(match.date), dateFilter));
    }

    if (statusFilter !== 'all') {
        filtered = filtered.filter(match => {
            const hasBeenPlayed = !!match.summary;
            return statusFilter === 'played' ? hasBeenPlayed : !hasBeenPlayed;
        });
    }

    return filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedTournament, categoryFilter, teamSearch, dateFilter, statusFilter, teamFilter, isHydrated]);

  if (!isHydrated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <HockeyPuckSpinner />
        <p className="text-muted-foreground animate-pulse">Cargando fixture...</p>
      </div>
    );
  }

  const handleEditMatch = (match: MatchData) => {
    if (isReadOnly) return;
    setMatchToEdit(match);
    setIsAddEditDialogOpen(true);
  };
  
  const handleDeleteMatch = async () => {
    if (isReadOnly || !matchToDelete || !activeTournamentId) return;

    try {
      // Move summary to deleted-matches folder (server-side)
      await deleteMatchWithSummary(activeTournamentId, matchToDelete.id, adminSecret ?? undefined);

      // Update state
      dispatch({ type: 'DELETE_MATCH_FROM_TOURNAMENT', payload: { tournamentId: activeTournamentId, matchId: matchToDelete.id }});
      toast({ title: 'Partido Eliminado', description: 'El partido ha sido eliminado del fixture.' });
    } catch (error) {
      console.error('[DELETE_MATCH] Error:', error);
      toast({ title: 'Error', description: 'No se pudo eliminar el partido.', variant: 'destructive' });
    }

    setMatchToDelete(null);
  };

  const handleCleanMatch = async () => {
    if (isReadOnly || !matchToClean || !activeTournamentId) return;

    try {
      // Move summary to deleted-summaries folder (server-side)
      await cleanMatchSummary(activeTournamentId, matchToClean.id, adminSecret ?? undefined);

      // Update state
      dispatch({ type: 'CLEAN_MATCH_SUMMARY', payload: { tournamentId: activeTournamentId, matchId: matchToClean.id }});
      toast({ title: 'Partido Limpiado', description: 'El resumen del partido ha sido eliminado.' });
    } catch (error) {
      console.error('[CLEAN_MATCH] Error:', error);
      toast({ title: 'Error', description: 'No se pudo limpiar el partido.', variant: 'destructive' });
    }

    setMatchToClean(null);
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
    setStatusFilter('all');
  };

  const isAnyFilterActive = categoryFilter.length > 0 || teamSearch.trim() !== '' || dateFilter || statusFilter !== 'all';

  const handleShareWhatsApp = () => {
    if (sortedMatches.length === 0) {
      toast({ title: 'No hay partidos', description: 'No hay partidos para compartir con los filtros aplicados.', variant: 'destructive' });
      return;
    }

    // Generate text message
    let message = `📋 *FIXTURE${selectedTournament?.name ? ` - ${selectedTournament.name}` : ''}*\n\n`;

    sortedMatches.forEach((match, index) => {
      const { home: homeName, away: awayName } = getMatchupDisplay(match, selectedTournament?.teams);
      const categoryName = getCategoryNameById(match.categoryId, selectedTournament?.categories) || 'N/A';
      const dateStr = format(new Date(match.date), "dd/MM/yy HH:mm", { locale: es });

      // Add match info
      message += `📅 ${dateStr}\n`;
      message += `Categoría: ${categoryName}`;

      // Add playoff type if applicable
      if (match.phase === 'playoffs' && match.playoffType) {
        const playoffLabel = match.playoffType === 'semifinal' ? 'Semifinal' : match.playoffType === 'final' ? 'FINAL' : '3er Puesto';
        message += ` - ${playoffLabel}`;
      } else if (match.phase === 'playoffs-5-8') {
        const name = match.playoff58Name || 'Play. 5-8';
        const typeLabel = match.playoff58Type === 'semifinal' ? 'Semifinal' : match.playoff58Type === 'final' ? 'Final' : '3er Puesto';
        message += ` - ${name} (${typeLabel})`;
      } else if (match.phase === 'relegation') {
        message += ` - Relegation`;
      }

      message += `\n${homeName} vs ${awayName}\n`;

      // Add score if available
      if (match.summary) {
        const { home, away } = calculateScoreFromSummary(match.summary);
        message += `Resultado: ${home} - ${away}`;

        // Check for OT/Shootout
        if (hasOvertimeOrShootout(match.summary)) {
          if (match.summary.shootout) {
            message += ' (Penales)';
          } else {
            message += ' (OT)';
          }
        }
        message += '\n';
      } else {
        message += `Resultado: Pendiente\n`;
      }

      // Add separator between matches (but not after the last one)
      if (index < sortedMatches.length - 1) {
        message += '\n';
      }
    });

    message += `\n---\n_Total: ${sortedMatches.length} partido${sortedMatches.length !== 1 ? 's' : ''}_`;

    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);

    // Open WhatsApp Web
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {!hideTitle && (
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Lista de Partidos</h2>
          <Button variant="outline" onClick={handleShareWhatsApp} disabled={sortedMatches.length === 0} className="gap-2 border-green-600 hover:bg-green-50 dark:hover:bg-green-950">
            <svg className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            <span className="hidden sm:inline text-green-600">Compartir Partidos</span>
            <span className="sm:hidden text-green-600">Compartir</span>
          </Button>
        </div>
      )}

      {hideTitle && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={handleShareWhatsApp} disabled={sortedMatches.length === 0} className="gap-2 border-green-600 hover:bg-green-50 dark:hover:bg-green-950">
            <svg className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            <span className="hidden sm:inline text-green-600">Compartir Partidos</span>
            <span className="sm:hidden text-green-600">Compartir</span>
          </Button>
        </div>
      )}

      {!hideFilters && (
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
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto justify-start">
                    <CheckIcon className="mr-2 h-4 w-4" />
                    {statusFilter === 'all' ? 'Todos' : statusFilter === 'played' ? 'Jugados' : 'Pendientes'}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-0" align="start">
                <Command>
                    <CommandList>
                        <CommandGroup>
                            <CommandItem onSelect={() => setStatusFilter('all')}>
                                <CheckIcon className={cn("mr-2 h-4 w-4", statusFilter === 'all' ? "opacity-100" : "opacity-0")} />
                                Todos
                            </CommandItem>
                            <CommandItem onSelect={() => setStatusFilter('played')}>
                                <CheckIcon className={cn("mr-2 h-4 w-4", statusFilter === 'played' ? "opacity-100" : "opacity-0")} />
                                Jugados
                            </CommandItem>
                            <CommandItem onSelect={() => setStatusFilter('pending')}>
                                <CheckIcon className={cn("mr-2 h-4 w-4", statusFilter === 'pending' ? "opacity-100" : "opacity-0")} />
                                Pendientes
                            </CommandItem>
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
      )}

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha y Hora</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Fase</TableHead>
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
                const { home: homeName, away: awayName } = getMatchupDisplay(match, selectedTournament?.teams);

                // Calculate score from summary (single source of truth)
                const score = match.summary
                    ? (() => {
                        const { home, away } = calculateScoreFromSummary(match.summary);
                        return `${home} - ${away}`;
                      })()
                    : '-';

                const wentToOTOrSO = match.summary ? hasOvertimeOrShootout(match.summary) : false;
                const isPlayoff = match.phase === 'playoffs';
                const isFinal = isPlayoff && match.playoffType === 'final';
                const is3erPuesto = isPlayoff && match.playoffType === '3er-puesto';
                const is58 = match.phase === 'playoffs-5-8';
                const is58Final = is58 && match.playoff58Type === 'final';
                const isRelegation = match.phase === 'relegation';

                return (
                  <TableRow key={match.id} className={cn(
                    isFinal && "border-l-2 border-l-amber-400",
                    is3erPuesto && "border-l-2 border-l-orange-400",
                    is58Final && "border-l-2 border-l-orange-300",
                    isRelegation && "border-l-2 border-l-red-400"
                  )}>
                    <TableCell>{format(new Date(match.date), "dd/MM/yy HH:mm", { locale: es })}</TableCell>
                    <TableCell>{getCategoryNameById(match.categoryId, selectedTournament?.categories) || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>
                          {match.phase === 'clasificacion' ? 'Clasificación'
                            : match.phase === 'playoffs' ? 'Playoffs'
                            : match.phase === 'playoffs-5-8' ? (match.playoff58Name || 'Play. 5-8')
                            : 'Relegation'}
                        </span>
                        {isPlayoff && match.playoffType && (
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-medium",
                            isFinal
                              ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400"
                              : is3erPuesto
                              ? "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400"
                              : "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
                          )}>
                            {match.playoffType === 'semifinal' ? 'SF' : match.playoffType === 'final' ? 'F' : '3°'}
                          </span>
                        )}
                        {is58 && match.playoff58Type && (
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-medium",
                            is58Final
                              ? "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400"
                              : match.playoff58Type === '3er-puesto'
                              ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400"
                              : "bg-orange-50 dark:bg-orange-900 text-orange-600 dark:text-orange-300"
                          )}>
                            {match.playoff58Type === 'semifinal' ? 'SF' : match.playoff58Type === 'final' ? 'F' : '3°'}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{homeName}</TableCell>
                    <TableCell>{awayName}</TableCell>
                    <TableCell className="text-center font-mono font-bold">{score}</TableCell>
                    <TableCell className="text-center">{wentToOTOrSO && <CheckIcon className="h-4 w-4 mx-auto text-green-500"/>}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {match.summary && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMatchToShowSummary(match)} title="Ver resumen">
                                <FileText className="h-4 w-4 text-blue-400" />
                            </Button>
                        )}
                        {!isReadOnly && match.summary && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-500 hover:text-orange-600" onClick={() => setMatchToClean(match)} title="Limpiar resumen del partido">
                                <Eraser className="h-4 w-4" />
                            </Button>
                        )}
                        {!isReadOnly && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-600" onClick={() => handlePlayMatch(match)} title="Jugar partido">
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditMatch(match)} title="Editar partido">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setMatchToDelete(match)} title="Eliminar partido">
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
                <TableCell colSpan={8} className="h-24 text-center">
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
                ¿Estás seguro de que quieres eliminar este partido? Esta acción moverá el partido y su resumen a la carpeta de eliminados.
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

      {!isReadOnly && matchToClean && (
        <AlertDialog open={!!matchToClean} onOpenChange={() => setMatchToClean(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Limpieza de Resumen</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que quieres limpiar el resumen de este partido? El resumen se moverá a la carpeta de eliminados, pero el partido permanecerá en el fixture.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setMatchToClean(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleCleanMatch} className="bg-orange-600 hover:bg-orange-700">
                Limpiar Resumen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
