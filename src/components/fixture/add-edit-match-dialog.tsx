

"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import type { MatchData, Tournament, TeamData, CategoryData, MatchPhase, PlayoffMatchType, PlayoffMatchup } from '@/types';
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
import { cn, generateMatchId } from '@/lib/utils';

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

    const teamsInCategory = useMemo(() => {
        if (!categoryId || !tournament?.teams) return [];
        return tournament.teams.filter(t => t.category === categoryId);
    }, [categoryId, tournament]);

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

        const matchData: Omit<MatchData, 'id'> = {
            date: finalDate.toISOString(),
            categoryId,
            ...(homeTeamId && { homeTeamId }),
            ...(awayTeamId && { awayTeamId }),
            playersPerTeam: parseInt(playersPerTeam, 10),
            phase,
            ...(phase === 'playoffs' && { playoffType }),
            ...(phase === 'playoffs' && playoffType === 'semifinal' && { playoffMatchup })
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
                            </SelectContent>
                        </Select>
                    </div>
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
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="homeTeam" className="text-right">
                            Local {phase === 'playoffs' && <span className="text-xs text-muted-foreground">(opcional)</span>}
                        </Label>
                        <Select value={homeTeamId} onValueChange={(val) => setHomeTeamId(val === 'none' ? '' : val)} disabled={!categoryId}>
                            <SelectTrigger id="homeTeam" className="col-span-3">
                                <SelectValue placeholder={phase === 'playoffs' ? 'Equipo no definido...' : 'Seleccionar equipo local...'} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Equipo no seleccionado</SelectItem>
                                {teamsInCategory.map(team => (
                                    <SelectItem key={team.id} value={team.id} disabled={team.id === awayTeamId}>{team.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="awayTeam" className="text-right">
                            Visitante {phase === 'playoffs' && <span className="text-xs text-muted-foreground">(opcional)</span>}
                        </Label>
                        <Select value={awayTeamId} onValueChange={(val) => setAwayTeamId(val === 'none' ? '' : val)} disabled={!categoryId}>
                            <SelectTrigger id="awayTeam" className="col-span-3">
                                <SelectValue placeholder={phase === 'playoffs' ? 'Equipo no definido...' : 'Seleccionar equipo visitante...'} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Equipo no seleccionado</SelectItem>
                                {teamsInCategory.map(team => (
                                    <SelectItem key={team.id} value={team.id} disabled={team.id === homeTeamId}>{team.name}</SelectItem>
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
