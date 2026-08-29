

"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import type { MatchData, Tournament, TeamData, CategoryData, MatchPhase, PlayoffMatchType, PlayoffMatchup, Playoff58MatchType, Playoff58Matchup } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Star } from 'lucide-react';
import { format, setHours, setMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useStandings } from '@/hooks/use-standings';
import { cn, generateMatchId, getTeamDisplayName } from '@/lib/utils';

interface AddEditMatchDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    tournament: Tournament | null;
    matchToEdit: MatchData | null;
    selectedDate?: Date;
}

export function AddEditMatchDialog({ isOpen, onOpenChange, tournament, matchToEdit, selectedDate }: AddEditMatchDialogProps) {
    const { state, dispatch } = useGameState();
    const { toast } = useToast();

    const [date, setDate] = useState<Date | undefined>(new Date());
    const [categoryId, setCategoryId] = useState<string>('');
    const [homeTeamId, setHomeTeamId] = useState<string>('');
    const [awayTeamId, setAwayTeamId] = useState<string>('');
    const [playersPerTeam, setPlayersPerTeam] = useState<string>('5');
    const [time, setTime] = useState('12:00');
    const [phase, setPhase] = useState<MatchPhase>('clasificacion');
    const [playoffType, setPlayoffType] = useState<PlayoffMatchType>('semifinal');
    const [playoffMatchup, setPlayoffMatchup] = useState<PlayoffMatchup>('1vs4');
    const [playoff58Type, setPlayoff58Type] = useState<Playoff58MatchType>('semifinal');
    const [playoff58Matchup, setPlayoff58Matchup] = useState<Playoff58Matchup>('5vs8');
    const [playoff58Name, setPlayoff58Name] = useState<string>('');
    const initialCategoryRef = useRef<string>('');

    const isEditing = !!matchToEdit;

    useEffect(() => {
        if (isOpen) {
            const initialDate = matchToEdit ? new Date(matchToEdit.date) : (selectedDate || new Date());
            setDate(initialDate);
            setTime(format(initialDate, 'HH:mm'));
            
            // Priority: matchToEdit -> already set state (if valid) -> first tournament category -> empty
            const currentCat = categoryId && tournament?.categories?.some(c => c.id === categoryId) ? categoryId : '';
            const cat = matchToEdit?.categoryId || currentCat || tournament?.categories?.[0]?.id || '';
            
            const home = matchToEdit?.homeTeamId || '';
            const away = matchToEdit?.awayTeamId || '';

            // Guardar la categoría inicial para compararla después
            initialCategoryRef.current = cat;

            setCategoryId(cat);
            setHomeTeamId(home);
            setAwayTeamId(away);
            setPlayersPerTeam(String(matchToEdit?.playersPerTeam || '5'));
            setPhase(matchToEdit?.phase || 'clasificacion');
            setPlayoffType(matchToEdit?.playoffType || 'semifinal');
            setPlayoffMatchup(matchToEdit?.playoffMatchup || '1vs4');
            setPlayoff58Type(matchToEdit?.playoff58Type || 'semifinal');
            setPlayoff58Matchup(matchToEdit?.playoff58Matchup || '5vs8');
            setPlayoff58Name(matchToEdit?.playoff58Name || '');
        } else {
            // Reset initial category ref when dialog closes
            initialCategoryRef.current = '';
        }
    }, [isOpen, matchToEdit, tournament, selectedDate]);

    // Manejar cambio de categoría manualmente (no con useEffect)
    const handleCategoryChange = (newCategoryId: string) => {
        setCategoryId(newCategoryId);
        // Limpiar equipos cuando el usuario cambia la categoría manualmente
        setHomeTeamId('');
        setAwayTeamId('');
    };

    // Todos los equipos de la categoría (para contar y para standings)
    const allTeamsInCategory = useMemo(() => {
        if (!categoryId || !tournament?.teams) return [];
        return tournament.teams.filter(t => t.category === categoryId);
    }, [categoryId, tournament]);

    // Standings de clasificación — necesarios para filtrar equipos por posición
    const standings = useStandings(tournament, categoryId);

    // ¿Hay partidos de clasificación jugados? Si no, no podemos derivar posiciones
    const hasClassificationData = standings.length > 0 && standings.some(s => s.pj > 0);

    // Equipos filtrados según la fase seleccionada
    // playoffs (ganadores): top 4 | playoffs-5-8: posiciones 5-8 | relegation: posición 5+
    // Si no hay datos de clasificación, muestra todos los equipos de la categoría
    const teamsInCategory = useMemo(() => {
        if (!hasClassificationData || standings.length === 0) return allTeamsInCategory;

        if (phase === 'playoffs') {
            const top4Ids = new Set(standings.slice(0, 4).map(s => s.id));
            return allTeamsInCategory.filter(t => top4Ids.has(t.id));
        }
        if (phase === 'playoffs-5-8') {
            const pos5to8Ids = new Set(standings.slice(4, 8).map(s => s.id));
            return allTeamsInCategory.filter(t => pos5to8Ids.has(t.id));
        }
        if (phase === 'relegation') {
            const pos5plusIds = new Set(standings.slice(4).map(s => s.id));
            return allTeamsInCategory.filter(t => pos5plusIds.has(t.id));
        }
        return allTeamsInCategory;
    }, [phase, allTeamsInCategory, standings, hasClassificationData]);

    // Playoffs 5-8 requiere mínimo 8 equipos (para tener posiciones 5°-8°)
    const hasEnoughTeamsFor58 = allTeamsInCategory.length >= 8;
    // Relegation requiere mínimo 6 equipos (para que quede al menos un partido entre equipos del 5° en adelante)
    const hasEnoughTeamsForRelegation = allTeamsInCategory.length >= 6;

    // Obtener partidos de playoffs existentes en esta categoría
    const existingPlayoffMatches = useMemo(() => {
        if (!tournament?.matches || !categoryId) return [];
        return tournament.matches.filter(m =>
            m.categoryId === categoryId &&
            m.phase === 'playoffs' &&
            // Excluir el partido que estamos editando
            (!isEditing || m.id !== matchToEdit?.id)
        );
    }, [tournament, categoryId, isEditing, matchToEdit]);

    // Contar partidos de playoffs por tipo
    const playoffCounts = useMemo(() => {
        const counts = {
            semifinal: 0,
            final: 0,
            '3er-puesto': 0
        };
        existingPlayoffMatches.forEach(m => {
            if (m.playoffType) {
                counts[m.playoffType]++;
            }
        });
        return counts;
    }, [existingPlayoffMatches]);

    // Obtener equipos que ya están jugando en semifinales
    const teamsInSemifinals = useMemo(() => {
        const teams = new Set<string>();
        existingPlayoffMatches
            .filter(m => m.playoffType === 'semifinal' && m.playoffMatchup)
            .forEach(m => {
                // Extraer los números de equipo del matchup (ej: "1vs4" -> [1, 4])
                const [team1, team2] = m.playoffMatchup!.split('vs');
                teams.add(team1);
                teams.add(team2);
            });
        return teams;
    }, [existingPlayoffMatches]);

    // Función para verificar si un matchup está disponible
    const isMatchupAvailable = (matchup: string): boolean => {
        const [team1, team2] = matchup.split('vs');
        // Un matchup está disponible si ninguno de sus equipos ya está jugando
        return !teamsInSemifinals.has(team1) && !teamsInSemifinals.has(team2);
    };

    // Obtener matchups usados (para mostrar en el mensaje informativo)
    const usedSemifinalMatchups = useMemo(() => {
        return existingPlayoffMatches
            .filter(m => m.playoffType === 'semifinal' && m.playoffMatchup)
            .map(m => m.playoffMatchup!);
    }, [existingPlayoffMatches]);

    // Detectar fase secundaria activa para esta categoría (playoffs-5-8 o relegation)
    const secondaryPhaseInfo = useMemo(() => {
        if (!tournament?.matches || !categoryId) return { phase: null as MatchPhase | null, playoff58Name: null as string | null };
        const match = tournament.matches.find(
            m => m.categoryId === categoryId &&
                 (m.phase === 'playoffs-5-8' || m.phase === 'relegation') &&
                 (!isEditing || m.id !== matchToEdit?.id)
        );
        return {
            phase: (match?.phase ?? null) as MatchPhase | null,
            playoff58Name: match?.playoff58Name ?? null,
        };
    }, [tournament, categoryId, isEditing, matchToEdit]);

    // Partidos de playoffs-5-8 existentes para validación de límites
    const existing58Matches = useMemo(() => {
        if (!tournament?.matches || !categoryId) return [];
        return tournament.matches.filter(
            m => m.categoryId === categoryId &&
                 m.phase === 'playoffs-5-8' &&
                 (!isEditing || m.id !== matchToEdit?.id)
        );
    }, [tournament, categoryId, isEditing, matchToEdit]);

    const playoff58Counts = useMemo(() => ({
        semifinal: existing58Matches.filter(m => m.playoff58Type === 'semifinal').length,
        final: existing58Matches.filter(m => m.playoff58Type === 'final').length,
        '3er-puesto': existing58Matches.filter(m => m.playoff58Type === '3er-puesto').length,
    }), [existing58Matches]);

    const usedSemifinal58Matchups = useMemo(() =>
        existing58Matches
            .filter(m => m.playoff58Type === 'semifinal' && m.playoff58Matchup)
            .map(m => m.playoff58Matchup!),
        [existing58Matches]
    );

    const isMatchup58Available = (matchup: string): boolean =>
        !usedSemifinal58Matchups.includes(matchup as Playoff58Matchup);

    // Auto-seleccionar el matchup disponible o limpiar si no es válido
    useEffect(() => {
        if (phase === 'playoffs' && playoffType === 'semifinal') {
            const availableMatchups: PlayoffMatchup[] = ['1vs4', '2vs3', '1vs2', '1vs3', '2vs4', '3vs4'];
            const validMatchups = availableMatchups.filter(m => isMatchupAvailable(m));

            // Si el matchup actual no está disponible, limpiar o auto-seleccionar
            if (!isMatchupAvailable(playoffMatchup)) {
                if (validMatchups.length === 1) {
                    // Auto-seleccionar el único matchup válido
                    setPlayoffMatchup(validMatchups[0]);
                } else if (validMatchups.length > 1) {
                    // Si hay múltiples opciones, limpiar para que el usuario elija
                    setPlayoffMatchup('1vs4'); // Default, pero estará deshabilitado si no es válido
                }
            }
        }
    }, [phase, playoffType, teamsInSemifinals, playoffMatchup]);

    const handleSubmit = () => {
        // Validaciones básicas
        if (!tournament?.id || !date || !categoryId || !playersPerTeam || !time) {
            toast({ title: 'Error', description: 'Debes completar fecha, hora, categoría y jugadores por equipo.', variant: 'destructive' });
            return;
        }

        // Para partidos de clasificación, los equipos son obligatorios
        if (phase === 'clasificacion') {
            if (!homeTeamId || !awayTeamId) {
                toast({ title: 'Error', description: 'Para partidos de clasificación debes seleccionar ambos equipos.', variant: 'destructive' });
                return;
            }
            if (homeTeamId === awayTeamId) {
                toast({ title: 'Error', description: 'El equipo local y visitante no pueden ser el mismo.', variant: 'destructive' });
                return;
            }
        }

        // Para relegation, equipos obligatorios
        if (phase === 'relegation') {
            if (!homeTeamId || !awayTeamId) {
                toast({ title: 'Error', description: 'Para partidos de Relegation debes seleccionar ambos equipos.', variant: 'destructive' });
                return;
            }
            if (homeTeamId === awayTeamId) {
                toast({ title: 'Error', description: 'El equipo local y visitante no pueden ser el mismo.', variant: 'destructive' });
                return;
            }
        }

        // Para playoffs-5-8
        if (phase === 'playoffs-5-8') {
            const nameToUse = secondaryPhaseInfo.playoff58Name || playoff58Name.trim();
            if (!nameToUse) {
                toast({ title: 'Error', description: 'Debes ingresar un nombre para el mini-torneo (ej: Copa Plata).', variant: 'destructive' });
                return;
            }
            if (playoff58Type === 'semifinal' && playoff58Counts.semifinal >= 2) {
                toast({ title: 'Error', description: 'Ya existen 2 semifinales para esta categoría.', variant: 'destructive' });
                return;
            }
            if (playoff58Type === 'final' && playoff58Counts.final >= 1) {
                toast({ title: 'Error', description: 'Ya existe una final para esta categoría.', variant: 'destructive' });
                return;
            }
            if (playoff58Type === '3er-puesto' && playoff58Counts['3er-puesto'] >= 1) {
                toast({ title: 'Error', description: 'Ya existe un partido de 3er puesto para esta categoría.', variant: 'destructive' });
                return;
            }
            if (playoff58Type === 'semifinal' && !isMatchup58Available(playoff58Matchup)) {
                toast({ title: 'Error', description: `El enfrentamiento ${playoff58Matchup} ya está definido.`, variant: 'destructive' });
                return;
            }
            if (homeTeamId && awayTeamId && homeTeamId === awayTeamId) {
                toast({ title: 'Error', description: 'Los equipos no pueden ser el mismo.', variant: 'destructive' });
                return;
            }
        }

        // Para partidos de playoffs
        if (phase === 'playoffs') {
            // Validar límites de partidos de playoffs por tipo
            if (playoffType === 'semifinal' && playoffCounts.semifinal >= 2) {
                toast({
                    title: 'Error',
                    description: 'Ya existen 2 semifinales para esta categoría. No puedes agregar más.',
                    variant: 'destructive'
                });
                return;
            }
            if (playoffType === 'final' && playoffCounts.final >= 1) {
                toast({
                    title: 'Error',
                    description: 'Ya existe una final para esta categoría. No puedes agregar otra.',
                    variant: 'destructive'
                });
                return;
            }
            if (playoffType === '3er-puesto' && playoffCounts['3er-puesto'] >= 1) {
                toast({
                    title: 'Error',
                    description: 'Ya existe un partido de 3er puesto para esta categoría. No puedes agregar otro.',
                    variant: 'destructive'
                });
                return;
            }

            // Validar que si se definen ambos equipos, sean diferentes
            if (homeTeamId && awayTeamId && homeTeamId === awayTeamId) {
                toast({ title: 'Error', description: 'Los equipos no pueden ser el mismo.', variant: 'destructive' });
                return;
            }
            // Para semifinales, el matchup es obligatorio
            if (playoffType === 'semifinal' && !playoffMatchup) {
                toast({ title: 'Error', description: 'Debes seleccionar el enfrentamiento (1vs4, 2vs3, etc).', variant: 'destructive' });
                return;
            }

            // Validar que el matchup de semifinal esté disponible (equipos no estén jugando)
            if (playoffType === 'semifinal' && !isMatchupAvailable(playoffMatchup)) {
                toast({
                    title: 'Error',
                    description: `Los equipos del enfrentamiento ${playoffMatchup} ya están participando en otra semifinal. Selecciona un enfrentamiento válido.`,
                    variant: 'destructive'
                });
                return;
            }
        }

        const [hours, minutes] = time.split(':').map(Number);
        const finalDate = setMinutes(setHours(date, hours), minutes);

        const resolved58Name = secondaryPhaseInfo.playoff58Name || playoff58Name.trim();

        const matchData: Omit<MatchData, 'id'> = {
            date: finalDate.toISOString(),
            categoryId,
            ...(homeTeamId && { homeTeamId }),
            ...(awayTeamId && { awayTeamId }),
            playersPerTeam: parseInt(playersPerTeam, 10),
            phase,
            ...(phase === 'playoffs' && { playoffType }),
            ...(phase === 'playoffs' && playoffType === 'semifinal' && { playoffMatchup }),
            ...(phase === 'playoffs-5-8' && { playoff58Type }),
            ...(phase === 'playoffs-5-8' && playoff58Type === 'semifinal' && { playoff58Matchup }),
            ...(phase === 'playoffs-5-8' && { playoff58Name: resolved58Name }),
        };

        if (isEditing && matchToEdit) {
            // Al editar, combinar datos y luego eliminar equipos si fueron deseleccionados
            const updatedMatch = { ...matchToEdit, ...matchData };

            // Si el usuario deseleccionó un equipo (homeTeamId o awayTeamId están vacíos),
            // eliminar la propiedad del objeto final
            if (!homeTeamId && matchToEdit.homeTeamId) {
                delete updatedMatch.homeTeamId;
            }
            if (!awayTeamId && matchToEdit.awayTeamId) {
                delete updatedMatch.awayTeamId;
            }

            dispatch({ type: 'UPDATE_MATCH_IN_TOURNAMENT', payload: { tournamentId: tournament.id, match: updatedMatch } });
            toast({ title: 'Partido Actualizado', description: 'El partido ha sido actualizado correctamente.' });
        } else {
            dispatch({ type: 'ADD_MATCH_TO_TOURNAMENT', payload: { tournamentId: tournament.id, match: { ...matchData, id: generateMatchId(finalDate) } } });
            toast({ title: 'Partido Añadido', description: 'El nuevo partido ha sido añadido al fixture.' });
        }
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent 
              className="sm:max-w-lg"
              onInteractOutside={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('.rdp')) {
                  e.preventDefault();
                }
              }}
            >
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Editar Partido' : 'Añadir Nuevo Partido'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category" className="text-right">Categoría</Label>
                        <Select value={categoryId} onValueChange={handleCategoryChange}>
                            <SelectTrigger id="category" className="col-span-3">
                                <SelectValue placeholder="Seleccionar categoría..." />
                            </SelectTrigger>
                            <SelectContent>
                                {tournament?.categories && tournament.categories.length > 0 ? (
                                    tournament.categories.map(cat => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                    ))
                                ) : (
                                    <SelectItem value="none" disabled>No hay categorías definidas</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="phase" className="text-right">Fase</Label>
                        <Select value={phase} onValueChange={(value) => setPhase(value as MatchPhase)}>
                            <SelectTrigger id="phase" className="col-span-3">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="clasificacion">Clasificación</SelectItem>
                                <SelectItem value="playoffs">Playoffs</SelectItem>
                                <SelectItem
                                    value="playoffs-5-8"
                                    disabled={!hasEnoughTeamsFor58 || secondaryPhaseInfo.phase === 'relegation'}
                                >
                                    Playoffs 5to-8vo
                                    {!hasEnoughTeamsFor58 ? ' (mín. 8 equipos)' : secondaryPhaseInfo.phase === 'relegation' ? ' (usa Relegation)' : ''}
                                </SelectItem>
                                <SelectItem
                                    value="relegation"
                                    disabled={!hasEnoughTeamsForRelegation || secondaryPhaseInfo.phase === 'playoffs-5-8'}
                                >
                                    Relegation
                                    {!hasEnoughTeamsForRelegation ? ' (mín. 6 equipos)' : secondaryPhaseInfo.phase === 'playoffs-5-8' ? ' (usa Playoffs 5-8)' : ''}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {secondaryPhaseInfo.phase && (phase === 'playoffs-5-8' || phase === 'relegation') && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <div className="col-span-4 flex justify-end">
                                <span className="text-xs bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 px-2 py-1 rounded">
                                    Fase fijada para esta categoría: {secondaryPhaseInfo.phase === 'playoffs-5-8' ? 'Playoffs 5to-8vo' : 'Relegation'}
                                </span>
                            </div>
                        </div>
                    )}
                    {phase === 'playoffs-5-8' && (
                        <>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="playoff58Name" className="text-right">Nombre</Label>
                                {secondaryPhaseInfo.playoff58Name ? (
                                    <div className="col-span-3 flex items-center gap-2">
                                        <span className="font-medium">{secondaryPhaseInfo.playoff58Name}</span>
                                        <span className="text-xs bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded">Fijado</span>
                                    </div>
                                ) : (
                                    <Input
                                        id="playoff58Name"
                                        value={playoff58Name}
                                        onChange={(e) => setPlayoff58Name(e.target.value)}
                                        placeholder="ej. Copa Plata"
                                        className="col-span-3"
                                    />
                                )}
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="playoff58Type" className="text-right">Tipo</Label>
                                <Select value={playoff58Type} onValueChange={(v) => setPlayoff58Type(v as Playoff58MatchType)}>
                                    <SelectTrigger id="playoff58Type" className="col-span-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="semifinal">Semifinal</SelectItem>
                                        <SelectItem value="final">Final</SelectItem>
                                        <SelectItem value="3er-puesto">3er Puesto</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {playoff58Type === 'semifinal' && (
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="playoff58Matchup" className="text-right">Enfrentamiento</Label>
                                    <div className="col-span-3 space-y-2">
                                        <Select value={playoff58Matchup} onValueChange={(v) => setPlayoff58Matchup(v as Playoff58Matchup)}>
                                            <SelectTrigger id="playoff58Matchup">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="5vs8" disabled={!isMatchup58Available('5vs8')}>5to vs 8vo</SelectItem>
                                                <SelectItem value="6vs7" disabled={!isMatchup58Available('6vs7')}>6to vs 7mo</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {usedSemifinal58Matchups.length > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                Ya definido: {usedSemifinal58Matchups.map(m => m === '5vs8' ? '5° vs 8°' : '6° vs 7°').join(', ')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    {phase === 'playoffs' && (
                        <>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="playoffType" className="text-right">Tipo</Label>
                                <Select value={playoffType} onValueChange={(value) => setPlayoffType(value as PlayoffMatchType)}>
                                    <SelectTrigger id="playoffType" className="col-span-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="semifinal">Semifinal</SelectItem>
                                        <SelectItem value="final">Final</SelectItem>
                                        <SelectItem value="3er-puesto">3er Puesto</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {playoffType === 'semifinal' && (
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="playoffMatchup" className="text-right">Enfrentamiento</Label>
                                    <div className="col-span-3 space-y-2">
                                        <Select value={playoffMatchup} onValueChange={(value) => setPlayoffMatchup(value as PlayoffMatchup)}>
                                            <SelectTrigger id="playoffMatchup">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1vs4" disabled={!isMatchupAvailable('1vs4')}>
                                                    <div className="flex items-center gap-2">
                                                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                                        <span>1ero vs 4to</span>
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="2vs3" disabled={!isMatchupAvailable('2vs3')}>
                                                    <div className="flex items-center gap-2">
                                                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                                        <span>2do vs 3ero</span>
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="1vs2" disabled={!isMatchupAvailable('1vs2')}>1ero vs 2do</SelectItem>
                                                <SelectItem value="1vs3" disabled={!isMatchupAvailable('1vs3')}>1ero vs 3ero</SelectItem>
                                                <SelectItem value="2vs4" disabled={!isMatchupAvailable('2vs4')}>2do vs 4to</SelectItem>
                                                <SelectItem value="3vs4" disabled={!isMatchupAvailable('3vs4')}>3ero vs 4to</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {usedSemifinalMatchups.length > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                Ya definido: {usedSemifinalMatchups.map(m => {
                                                    const matchupLabels: Record<string, string> = {
                                                        '1vs4': '1° vs 4°',
                                                        '2vs3': '2° vs 3°',
                                                        '1vs2': '1° vs 2°',
                                                        '1vs3': '1° vs 3°',
                                                        '2vs4': '2° vs 4°',
                                                        '3vs4': '3° vs 4°'
                                                    };
                                                    return matchupLabels[m] || m;
                                                }).join(', ')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    {hasClassificationData && (phase === 'playoffs' || phase === 'playoffs-5-8' || phase === 'relegation') && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <div className="col-span-4">
                                <p className="text-xs text-muted-foreground text-right">
                                    {phase === 'playoffs' && `Mostrando top ${Math.min(4, allTeamsInCategory.length)} equipos por clasificación`}
                                    {phase === 'playoffs-5-8' && `Mostrando equipos del 5° al 8° por clasificación`}
                                    {phase === 'relegation' && `Mostrando equipos del 5° en adelante por clasificación`}
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="homeTeam" className="text-right">
                            Local {(phase === 'playoffs' || phase === 'playoffs-5-8') && <span className="text-xs text-muted-foreground">(opcional)</span>}
                        </Label>
                        <Select value={homeTeamId} onValueChange={(val) => setHomeTeamId(val === 'none' ? '' : val)} disabled={!categoryId}>
                            <SelectTrigger id="homeTeam" className="col-span-3">
                                <SelectValue placeholder={(phase === 'playoffs' || phase === 'playoffs-5-8') ? 'Equipo no definido...' : 'Seleccionar equipo local...'} />
                            </SelectTrigger>
                            <SelectContent>
                                {(phase === 'playoffs' || phase === 'playoffs-5-8') && (
                                    <SelectItem value="none">Equipo no seleccionado</SelectItem>
                                )}
                                {teamsInCategory.map(team => (
                                    <SelectItem key={team.id} value={team.id} disabled={team.id === awayTeamId}>{getTeamDisplayName(team.name, team.subName)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="awayTeam" className="text-right">
                            Visitante {(phase === 'playoffs' || phase === 'playoffs-5-8') && <span className="text-xs text-muted-foreground">(opcional)</span>}
                        </Label>
                        <Select value={awayTeamId} onValueChange={(val) => setAwayTeamId(val === 'none' ? '' : val)} disabled={!categoryId}>
                            <SelectTrigger id="awayTeam" className="col-span-3">
                                <SelectValue placeholder={(phase === 'playoffs' || phase === 'playoffs-5-8') ? 'Equipo no definido...' : 'Seleccionar equipo visitante...'} />
                            </SelectTrigger>
                            <SelectContent>
                                {(phase === 'playoffs' || phase === 'playoffs-5-8') && (
                                    <SelectItem value="none">Equipo no seleccionado</SelectItem>
                                )}
                                {teamsInCategory.map(team => (
                                    <SelectItem key={team.id} value={team.id} disabled={team.id === homeTeamId}>{getTeamDisplayName(team.name, team.subName)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="date" className="text-right">Fecha</Label>
                        <Popover modal={true}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("col-span-3 justify-start text-left font-normal", !date && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? format(date, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={es} />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="time" className="text-right">Hora</Label>
                        <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="playersPerTeam" className="text-right">Jugadores</Label>
                        <Select value={playersPerTeam} onValueChange={setPlayersPerTeam}>
                            <SelectTrigger id="playersPerTeam" className="col-span-3">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 5 }, (_, i) => i + 1).map(num => (
                                    <SelectItem key={num} value={String(num)}>{num} vs {num}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                    <Button type="button" onClick={handleSubmit}>{isEditing ? 'Guardar Cambios' : 'Crear Partido'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
