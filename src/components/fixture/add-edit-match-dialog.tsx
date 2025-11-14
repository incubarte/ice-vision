

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import type { MatchData, Tournament, TeamData, CategoryData } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, setHours, setMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { safeUUID } from '@/lib/utils';

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

    const isEditing = !!matchToEdit;

    useEffect(() => {
        if (isOpen) {
            const initialDate = matchToEdit ? new Date(matchToEdit.date) : (selectedDate || new Date());
            setDate(initialDate);
            setTime(format(initialDate, 'HH:mm'));
            setCategoryId(matchToEdit?.categoryId || tournament?.categories?.[0]?.id || '');
            setHomeTeamId(matchToEdit?.homeTeamId || '');
            setAwayTeamId(matchToEdit?.awayTeamId || '');
            setPlayersPerTeam(String(matchToEdit?.playersPerTeam || '5'));
        }
    }, [isOpen, matchToEdit, tournament, selectedDate]);

    useEffect(() => {
        if (!isEditing || (matchToEdit && categoryId !== matchToEdit.categoryId)) {
          setHomeTeamId('');
          setAwayTeamId('');
        }
    }, [categoryId, isEditing, matchToEdit]);

    const teamsInCategory = useMemo(() => {
        if (!categoryId || !tournament?.teams) return [];
        return tournament.teams.filter(t => t.category === categoryId);
    }, [categoryId, tournament]);

    const handleSubmit = () => {
        if (!tournament?.id || !date || !categoryId || !homeTeamId || !awayTeamId || !playersPerTeam || !time) {
            toast({ title: 'Error', description: 'Todos los campos son requeridos.', variant: 'destructive' });
            return;
        }

        if (homeTeamId === awayTeamId) {
            toast({ title: 'Error', description: 'El equipo local y visitante no pueden ser el mismo.', variant: 'destructive' });
            return;
        }

        const [hours, minutes] = time.split(':').map(Number);
        const finalDate = setMinutes(setHours(date, hours), minutes);

        const matchData: Omit<MatchData, 'id'> = {
            date: finalDate.toISOString(),
            categoryId,
            homeTeamId,
            awayTeamId,
            playersPerTeam: parseInt(playersPerTeam, 10)
        };

        if (isEditing && matchToEdit) {
            dispatch({ type: 'UPDATE_MATCH_IN_TOURNAMENT', payload: { tournamentId: tournament.id, match: { ...matchToEdit, ...matchData } } });
            toast({ title: 'Partido Actualizado', description: 'El partido ha sido actualizado correctamente.' });
        } else {
            dispatch({ type: 'ADD_MATCH_TO_TOURNAMENT', payload: { tournamentId: tournament.id, match: { ...matchData, id: safeUUID() } } });
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
                        <Select value={categoryId} onValueChange={setCategoryId}>
                            <SelectTrigger id="category" className="col-span-3">
                                <SelectValue placeholder="Seleccionar categoría..." />
                            </SelectTrigger>
                            <SelectContent>
                                {tournament?.categories?.map(cat => (
                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="homeTeam" className="text-right">Local</Label>
                        <Select value={homeTeamId} onValueChange={setHomeTeamId} disabled={!categoryId}>
                            <SelectTrigger id="homeTeam" className="col-span-3">
                                <SelectValue placeholder="Seleccionar equipo local..." />
                            </SelectTrigger>
                            <SelectContent>
                                {teamsInCategory.map(team => (
                                    <SelectItem key={team.id} value={team.id} disabled={team.id === awayTeamId}>{team.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="awayTeam" className="text-right">Visitante</Label>
                        <Select value={awayTeamId} onValueChange={setAwayTeamId} disabled={!categoryId}>
                            <SelectTrigger id="awayTeam" className="col-span-3">
                                <SelectValue placeholder="Seleccionar equipo visitante..." />
                            </SelectTrigger>
                            <SelectContent>
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
