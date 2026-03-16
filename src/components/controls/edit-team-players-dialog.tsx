
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
import { useGameState } from "@/contexts/game-state-context";
import type { PlayerData, AttendedPlayerInfo, Team } from "@/types";
import { User, Shield, Save, X, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [attendedPlayerNumbers, setAttendedPlayerNumbers] = useState<Set<string>>(new Set());
  const [activeGoalkeeperNumber, setActiveGoalkeeperNumber] = useState<string | null>(null);

  // New player creation state
  const [showNewPlayerForm, setShowNewPlayerForm] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');
  const [newPlayerType, setNewPlayerType] = useState<'player' | 'goalkeeper'>('player');
  const [justAddedPlayerId, setJustAddedPlayerId] = useState<string | null>(null);

  const teamDetails = useMemo(() => {
    // Prefer matchContext roster (snapshot at game setup) for live game independence
    const mc = state.live.matchContext;
    if (mc) {
      const isHome = mc.homeTeamId === teamId;
      const isAway = mc.awayTeamId === teamId;
      if (isHome || isAway) {
        return {
          id: teamId,
          name: isHome ? state.live.homeTeamName : state.live.awayTeamName,
          players: isHome ? mc.homeRoster : mc.awayRoster,
          category: mc.categoryId,
        };
      }
    }
    // Fallback to activeTournament for backward compat
    const selectedTournament = state.config.activeTournament;
    if (!selectedTournament || !selectedTournament.teams) return null;
    return selectedTournament.teams.find(t => t.id === teamId);
  }, [state.live.matchContext, state.config.activeTournament, teamId, state.live.homeTeamName, state.live.awayTeamName]);

  // Function to refresh local state from global state
  const refreshFromGlobalState = () => {
    if (!teamDetails) return;

    const sortedPlayers = [...teamDetails.players].sort((a, b) => {
      if (a.type === 'goalkeeper' && b.type !== 'goalkeeper') return -1;
      if (a.type !== 'goalkeeper' && b.type === 'goalkeeper') return 1;
      return a.name.localeCompare(b.name);
    });

    setEditablePlayers(
      sortedPlayers.map(p => ({ ...p, localNumber: p.number, isModified: false }))
    );

    const attendedInfo = state.live?.attendance?.[teamType] || [];
    setAttendedPlayerNumbers(new Set(attendedInfo.map(p => p.number)));

    const currentActiveGoalkeeperNumber = teamType === 'home'
      ? state.live.homeActiveGoalkeeperNumber
      : state.live.awayActiveGoalkeeperNumber;
    setActiveGoalkeeperNumber(currentActiveGoalkeeperNumber);
  };

  // Track whether we've already loaded data for this dialog session
  const hasLoadedRef = useRef(false);

  // Reset the flag when dialog closes
  useEffect(() => {
    if (!isOpen) {
      hasLoadedRef.current = false;
    }
  }, [isOpen]);

  // Load data exactly once when dialog opens (and teamDetails is available)
  useEffect(() => {
    if (isOpen && teamDetails && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      refreshFromGlobalState();
    }
  }, [isOpen, teamDetails]);

  // Auto-refresh when a player is added
  useEffect(() => {
    if (justAddedPlayerId && teamDetails) {
      const addedPlayer = teamDetails.players.find(p => p.id === justAddedPlayerId);

      if (addedPlayer) {
        refreshFromGlobalState();

        setAttendedPlayerNumbers(prev => {
          const newNumbers = new Set(prev);
          newNumbers.add(addedPlayer.number);
          return newNumbers;
        });

        setJustAddedPlayerId(null);
      }
    }
  }, [justAddedPlayerId, teamDetails]);

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

  const handleAttendanceChange = (playerNumber: string, isAttending: boolean) => {
    setAttendedPlayerNumbers(prevNumbers => {
      const newNumbers = new Set(prevNumbers);
      if (isAttending) {
        newNumbers.add(playerNumber);
      } else {
        newNumbers.delete(playerNumber);
        // If removing the active goalkeeper, clear the selection
        if (playerNumber === activeGoalkeeperNumber) {
          setActiveGoalkeeperNumber(null);
        }
      }
      return newNumbers;
    });
  };

  const handleGoalkeeperClick = (playerNumber: string, playerType: string) => {
    if (playerType !== 'goalkeeper') return;
    if (!attendedPlayerNumbers.has(playerNumber)) {
      toast({
        title: "No Disponible",
        description: "Primero marca la asistencia del arquero antes de activarlo.",
        variant: "destructive"
      });
      return;
    }

    // Toggle: if already active, deactivate; otherwise activate
    if (activeGoalkeeperNumber === playerNumber) {
      setActiveGoalkeeperNumber(null);
    } else {
      setActiveGoalkeeperNumber(playerNumber);
    }
  };

  const handleAddNewPlayer = () => {
    const trimmedName = newPlayerName.trim();
    const trimmedNumber = newPlayerNumber.trim();

    // Validations
    if (!trimmedName) {
      toast({
        title: "Nombre Requerido",
        description: "Por favor ingresa el nombre del jugador.",
        variant: "destructive"
      });
      return;
    }

    if (trimmedNumber && !/^\d+$/.test(trimmedNumber)) {
      toast({
        title: "Número Inválido",
        description: "El número debe ser numérico.",
        variant: "destructive"
      });
      return;
    }

    // Check for duplicate number
    if (trimmedNumber && editablePlayers.some(p => p.localNumber === trimmedNumber)) {
      toast({
        title: "Número Duplicado",
        description: `El número #${trimmedNumber} ya está asignado a otro jugador.`,
        variant: "destructive"
      });
      return;
    }

    // Generate new player ID
    const newPlayerId = `player-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Create new player
    const newPlayer: EditablePlayer = {
      id: newPlayerId,
      name: trimmedName,
      number: trimmedNumber,
      localNumber: trimmedNumber,
      type: newPlayerType,
      isModified: true // Mark as modified so it gets saved
    };

    // Add to editable players (will be sorted on next render)
    setEditablePlayers(prev => {
      const updated = [...prev, newPlayer];
      // Sort: goalkeepers first, then by name
      return updated.sort((a, b) => {
        if (a.type === 'goalkeeper' && b.type !== 'goalkeeper') return -1;
        if (a.type !== 'goalkeeper' && b.type === 'goalkeeper') return 1;
        return a.name.localeCompare(b.name);
      });
    });

    // Dispatch ADD_PLAYER_TO_TEAM action
    dispatch({
      type: 'ADD_PLAYER_TO_TEAM',
      payload: {
        teamId,
        player: {
          id: newPlayerId,
          name: trimmedName,
          number: trimmedNumber,
          type: newPlayerType
        }
      }
    });

    // Set flag to trigger auto-refresh via useEffect
    setJustAddedPlayerId(newPlayerId);

    // Reset form
    setNewPlayerName('');
    setNewPlayerNumber('');
    setNewPlayerType('player');
    setShowNewPlayerForm(false);

    toast({
      title: "Jugador Agregado",
      description: `${trimmedName} ha sido agregado al equipo y marcado como presente.`
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
          // Update attendance only — jersey number changes are match-specific
          // and must NOT modify the roster (UPDATE_PLAYER_IN_TEAM)
          dispatch({
            type: "UPDATE_ATTENDANCE_PLAYER",
            payload: {
              team: teamType,
              playerNumber: player.number,
              updates: { number: newNumber },
            },
          });
          numberChangesCount++;
        }
      }
    });

    const originalAttendedNumbers = new Set((state.live?.attendance?.[teamType] || []).map(p => p.number));
    const attendanceChanged = !(attendedPlayerNumbers.size === originalAttendedNumbers.size && [...attendedPlayerNumbers].every(num => originalAttendedNumbers.has(num)));

    if (attendanceChanged) {
      dispatch({
        type: 'SET_TEAM_ATTENDANCE',
        payload: { team: teamType, playerNumbers: Array.from(attendedPlayerNumbers) }
      });
    }

    // Check if active goalkeeper changed
    const originalActiveGoalkeeperNumber = teamType === 'home'
      ? state.live.homeActiveGoalkeeperNumber
      : state.live.awayActiveGoalkeeperNumber;
    const activeGoalkeeperChanged = originalActiveGoalkeeperNumber !== activeGoalkeeperNumber;

    if (activeGoalkeeperChanged) {
      dispatch({
        type: 'SET_ACTIVE_GOALKEEPER',
        payload: { team: teamType, playerNumber: activeGoalkeeperNumber }
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
            Modifica los números, registra asistencia al partido y agrega nuevos jugadores si es necesario.
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
                    checked={attendedPlayerNumbers.has(player.number)}
                    onCheckedChange={(checked) => handleAttendanceChange(player.number, !!checked)}
                    className="h-5 w-5"
                  />
                </div>

                <div className="self-stretch border-l border-border/50"></div>

                <div
                  className={`flex items-center gap-3 flex-1 min-w-0 ${player.type === "goalkeeper" && attendedPlayerNumbers.has(player.number)
                    ? 'cursor-pointer'
                    : ''
                    }`}
                  onClick={() => player.type === "goalkeeper" && handleGoalkeeperClick(player.number, player.type)}
                  title={
                    player.type === "goalkeeper"
                      ? activeGoalkeeperNumber === player.number
                        ? 'Arquero activo (click para desactivar)'
                        : attendedPlayerNumbers.has(player.number)
                          ? 'Click para activar arquero'
                          : 'Marca asistencia primero'
                      : ''
                  }
                >
                  {player.type === "goalkeeper" ? (
                    <Shield
                      className={`h-5 w-5 shrink-0 transition-colors ${activeGoalkeeperNumber === player.number
                        ? 'text-green-600 fill-green-600'
                        : attendedPlayerNumbers.has(player.number)
                          ? 'text-muted-foreground hover:text-green-500'
                          : 'text-muted-foreground/30'
                        }`}
                    />
                  ) : (
                    <User className="h-5 w-5 text-primary shrink-0" />
                  )}
                  <Label htmlFor={`player-num-${player.id}`} className="flex-1 min-w-0 pointer-events-none">
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

            {/* Add New Player Section */}
            <div className="mt-4 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowNewPlayerForm(!showNewPlayerForm)}
              >
                {showNewPlayerForm ? (
                  <><ChevronUp className="mr-2 h-4 w-4" /> Ocultar Formulario</>
                ) : (
                  <><Plus className="mr-2 h-4 w-4" /> Agregar Nuevo Jugador</>
                )}
              </Button>

              {showNewPlayerForm && (
                <div className="mt-3 p-3 border rounded-md bg-muted/20 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="new-player-name">Nombre *</Label>
                    <Input
                      id="new-player-name"
                      type="text"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      placeholder="Nombre completo del jugador"
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-player-number">Número</Label>
                    <Input
                      id="new-player-number"
                      type="text"
                      inputMode="numeric"
                      value={newPlayerNumber}
                      onChange={(e) => {
                        if (/^\d*$/.test(e.target.value)) {
                          setNewPlayerNumber(e.target.value);
                        }
                      }}
                      placeholder="Ej: 10"
                      className="h-9"
                      maxLength={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-player-type">Tipo *</Label>
                    <Select value={newPlayerType} onValueChange={(value: 'player' | 'goalkeeper') => setNewPlayerType(value)}>
                      <SelectTrigger id="new-player-type" className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="player">Jugador</SelectItem>
                        <SelectItem value="goalkeeper">Arquero</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddNewPlayer}
                      className="flex-1"
                    >
                      <Plus className="mr-2 h-4 w-4" /> Agregar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setNewPlayerName('');
                        setNewPlayerNumber('');
                        setNewPlayerType('player');
                        setShowNewPlayerForm(false);
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
        {!activeGoalkeeperNumber && editablePlayers.some(p => p.type === 'goalkeeper' && attendedPlayerNumbers.has(p.number)) && (
          <div className="px-6 py-3 bg-orange-50 border-t border-orange-200">
            <p className="text-sm text-orange-700">
              ⚠️ No hay arquero activo. Clickeá el escudo del arquero para marcarlo como Activo.
            </p>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              <X className="mr-2 h-4 w-4" /> Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" /> Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
