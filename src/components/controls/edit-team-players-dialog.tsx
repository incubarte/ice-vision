
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useGameState, type Team } from "@/contexts/game-state-context";
import type { PlayerData, AttendedPlayerInfo } from "@/types";
import { User, Shield, Save, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface EditTeamPlayersDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  teamId: string;
  teamName: string;
  teamType: Team;
}

interface EditablePlayer extends PlayerData {
  localNumber: string; // For controlled input
  isModified: boolean;
}

export function EditTeamPlayersDialog({
  isOpen,
  onOpenChange,
  teamId,
  teamName,
  teamType,
}: EditTeamPlayersDialogProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const [editablePlayers, setEditablePlayers] = useState<EditablePlayer[]>([]);
  const [attendedPlayerIds, setAttendedPlayerIds] = useState<Set<string>>(new Set());
  
  const teamDetails = useMemo(() => {
    if (!state.config || !state.config.tournaments) return null;
    const selectedTournament = state.config.tournaments.find(t => t.id === state.config.selectedTournamentId);
    if (!selectedTournament || !selectedTournament.teams) return null;
    return selectedTournament.teams.find(t => t.id === teamId);
  }, [state.config.tournaments, state.config.selectedTournamentId, teamId]);

  useEffect(() => {
    if (isOpen && teamDetails) {
      const sortedPlayers = [...teamDetails.players].sort((a, b) => {
        // Rule 1: Goalkeepers come before players.
        if (a.type === 'goalkeeper' && b.type !== 'goalkeeper') return -1;
        if (a.type !== 'goalkeeper' && b.type === 'goalkeeper') return 1;

        // Rule 2: Within the same type (goalkeeper or player), sort by name alphabetically.
        return a.name.localeCompare(b.name);
      });

      setEditablePlayers(
        sortedPlayers.map(p => ({ ...p, localNumber: p.number, isModified: false }))
      );
      
      const attendedInfo = state.live?.attendance?.[teamType] || [];
      setAttendedPlayerIds(new Set(attendedInfo.map(p => p.id)));

    }
  }, [isOpen, teamDetails, state.live.attendance, teamType]);

  const handlePlayerNumberChange = (playerId: string, newNumber: string) => {
    if (/^\d*$/.test(newNumber)) {
      setEditablePlayers(prevPlayers =>
        prevPlayers.map(p =>
          p.id === playerId ? { ...p, localNumber: newNumber.trim(), isModified: true } : p
        )
      );
    }
  };

  // Detect duplicate numbers
  const duplicateNumbers = useMemo(() => {
    const numberCount = new Map<string, number>();
    editablePlayers.forEach(p => {
      const num = p.localNumber.trim();
      if (num) {
        numberCount.set(num, (numberCount.get(num) || 0) + 1);
      }
    });

    const duplicates = new Set<string>();
    numberCount.forEach((count, number) => {
      if (count > 1) {
        duplicates.add(number);
      }
    });
    return duplicates;
  }, [editablePlayers]);
  
  const handleAttendanceChange = (playerId: string, isAttending: boolean) => {
    setAttendedPlayerIds(prevIds => {
      const newIds = new Set(prevIds);
      if (isAttending) {
        newIds.add(playerId);
      } else {
        newIds.delete(playerId);
      }
      return newIds;
    });
  };

  const handleSave = () => {
    if (!state.config.selectedTournamentId) {
      toast({ title: "Error", description: "No se ha seleccionado un torneo.", variant: "destructive" });
      return;
    }

    let numberChangesCount = 0;
    let hasError = false;
    
    const finalPlayerNumbersMap = new Map<string, string[]>();

    editablePlayers.forEach(p => {
      const finalNum = p.isModified ? p.localNumber : p.number;
      if (finalNum) {
        if (!finalPlayerNumbersMap.has(finalNum)) {
          finalPlayerNumbersMap.set(finalNum, []);
        }
        finalPlayerNumbersMap.get(finalNum)!.push(p.id);
      }
    });

    for (const player of editablePlayers) {
      if (player.isModified) {
        const trimmedNumber = player.localNumber;
        if (trimmedNumber) {
          if (!/^\d+$/.test(trimmedNumber)) {
            toast({
              title: "Número Inválido",
              description: `El número "${trimmedNumber}" para ${player.name} debe ser numérico.`,
              variant: "destructive",
            });
            hasError = true;
            break;
          }
          if (finalPlayerNumbersMap.get(trimmedNumber) && finalPlayerNumbersMap.get(trimmedNumber)!.length > 1) {
            toast({
              title: "Número Duplicado",
              description: `El número #${trimmedNumber} está asignado a más de un jugador en la lista.`,
              variant: "destructive",
            });
            hasError = true;
            break;
          }
        }
      }
    }

    if (hasError) {
      return;
    }

    editablePlayers.forEach(player => {
      if (player.isModified) {
        const newNumber = player.localNumber;
        if (newNumber !== player.number) {
          dispatch({
            type: "UPDATE_PLAYER_IN_TEAM",
            payload: {
              teamId: teamId,
              playerId: player.id,
              updates: { number: newNumber },
            },
          });
          numberChangesCount++;
        }
      }
    });

    const originalAttendedIds = new Set((state.live?.attendance?.[teamType] || []).map(p => p.id));
    const attendanceChanged = !(attendedPlayerIds.size === originalAttendedIds.size && [...attendedPlayerIds].every(id => originalAttendedIds.has(id)));

    if (attendanceChanged) {
        dispatch({
          type: 'SET_TEAM_ATTENDANCE',
          payload: { team: teamType, playerIds: Array.from(attendedPlayerIds) }
        });
    }
    
    if (numberChangesCount > 0 && attendanceChanged) {
        toast({
            title: "Cambios Guardados",
            description: "Se actualizaron los números de los jugadores y la lista de asistencia.",
        });
    } else if (numberChangesCount > 0) {
        toast({
            title: "Números Actualizados",
            description: `Se actualizaron los números de ${numberChangesCount} jugador(es).`,
        });
    } else if (attendanceChanged) {
        toast({
            title: "Asistencia Guardada",
            description: `La lista de asistencia para "${teamName}" ha sido guardada.`,
        });
    } else {
        toast({
            title: "Sin Cambios",
            description: "No se detectaron modificaciones.",
            variant: "default",
        });
    }

    onOpenChange(false);
  };

  if (!isOpen || !teamDetails) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Jugadores de {teamName}</DialogTitle>
          <DialogDescription>
            Modifica los números de los jugadores y registra su asistencia al partido.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-3 py-2">
            {editablePlayers.map(player => (
              <div key={player.id} className="flex items-center gap-3 p-2 border rounded-md bg-card shadow-sm">
                 <div className="flex flex-col items-center justify-center space-y-1">
                    <Label htmlFor={`attendance-${player.id}`} className="text-xs text-muted-foreground cursor-pointer">
                        Asistió
                    </Label>
                    <Checkbox
                      id={`attendance-${player.id}`}
                      checked={attendedPlayerIds.has(player.id)}
                      onCheckedChange={(checked) => handleAttendanceChange(player.id, !!checked)}
                      className="h-5 w-5"
                    />
                </div>

                <div className="self-stretch border-l border-border/50"></div>

                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {player.type === "goalkeeper" ? (
                      <Shield className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <User className="h-5 w-5 text-primary shrink-0" />
                    )}
                    <Label htmlFor={`player-num-${player.id}`} className="flex-1 min-w-0">
                      <span className="font-medium truncate" title={player.name}>{player.name}</span>
                      <span className="text-xs text-muted-foreground ml-1">({player.type === "goalkeeper" ? "Arquero" : "Jugador"})</span>
                    </Label>
                </div>
                
                <div className="flex items-baseline gap-1 w-24">
                   <span className="text-sm text-muted-foreground self-center">#</span>
                   <Input
                    id={`player-num-${player.id}`}
                    type="text"
                    inputMode="numeric"
                    value={player.localNumber}
                    onChange={(e) => handlePlayerNumberChange(player.id, e.target.value)}
                    placeholder="S/N"
                    className={`h-8 px-1 py-0 text-sm ${duplicateNumbers.has(player.localNumber.trim()) && player.localNumber.trim() ? 'border-red-500 border-2' : ''}`}
                    maxLength={3}
                  />
                </div>
              </div>
            ))}
            {editablePlayers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Este equipo no tiene jugadores.</p>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              <X className="mr-2 h-4 w-4" /> Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={editablePlayers.length === 0}>
            <Save className="mr-2 h-4 w-4" /> Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
