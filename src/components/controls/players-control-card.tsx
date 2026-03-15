"use client";

import React, { useState, useMemo } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import type { Team, PlayerData, AttendedPlayerInfo } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Shield, User, Plus, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PlayersControlCardProps {
  team: Team;
  teamName: string;
}

export function PlayersControlCard({ team, teamName }: PlayersControlCardProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();

  // Get team data from match context roster (for full player info like type)
  const matchContext = state.live.matchContext;
  const teamData = useMemo(() => {
    if (!matchContext) return null;
    const roster = team === 'home' ? matchContext.homeRoster : matchContext.awayRoster;
    const teamName = state.live[`${team}TeamName`];
    return {
      id: team === 'home' ? matchContext.homeTeamId : matchContext.awayTeamId,
      name: teamName,
      players: roster,
      category: matchContext.categoryId,
    };
  }, [matchContext, team, state.live]);

  // Get attendance
  const attendance = state.live.attendance[team] || [];
  const attendedIds = useMemo(() => new Set(attendance.filter(p => p.isPresent !== false).map(p => p.id)), [attendance]);

  // Get active goalkeeper
  const activeGoalkeeperId = team === 'home' ? state.live.homeActiveGoalkeeperId : state.live.awayActiveGoalkeeperId;

  // Local editable numbers
  const [editingNumbers, setEditingNumbers] = useState<Record<string, string>>({});

  // Add player form state
  const [showNewPlayerForm, setShowNewPlayerForm] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');
  const [newPlayerType, setNewPlayerType] = useState<'player' | 'goalkeeper'>('player');

  // Sort players: use attendance (match roster) as primary source
  const sortedPlayers = useMemo(() => {
    // Start with match attendance
    const players = [...attendance];

    // Also include any players from the team roster that aren't in attendance yet
    if (teamData?.players) {
      teamData.players.forEach(rosterPlayer => {
        if (!players.some(p => p.id === rosterPlayer.id)) {
          players.push({
            id: rosterPlayer.id,
            number: rosterPlayer.number,
            name: rosterPlayer.name,
            type: rosterPlayer.type,
            isPresent: false
          });
        }
      });
    }

    return players.sort((a, b) => {
      if (a.type === 'goalkeeper' && b.type !== 'goalkeeper') return -1;
      if (a.type !== 'goalkeeper' && b.type === 'goalkeeper') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [teamData, attendance]);

  // Check if new player number is duplicate
  const isNewPlayerNumberDuplicate = useMemo(() => {
    const trimmed = newPlayerNumber.trim();
    if (!trimmed) return false;

    return sortedPlayers.some(p => {
      const currentNumber = (editingNumbers[p.id] !== undefined ? editingNumbers[p.id] : p.number).trim();
      return currentNumber === trimmed;
    });
  }, [newPlayerNumber, sortedPlayers, editingNumbers]);

  // Detect duplicate numbers
  const duplicateNumbers = useMemo(() => {
    const numberCounts = new Map<string, number>();

    sortedPlayers.forEach(player => {
      const currentNumber = (editingNumbers[player.id] !== undefined ? editingNumbers[player.id] : player.number).trim();
      if (currentNumber) {
        numberCounts.set(currentNumber, (numberCounts.get(currentNumber) || 0) + 1);
      }
    });

    return new Set(
      Array.from(numberCounts.entries())
        .filter(([_, count]) => count > 1)
        .map(([number]) => number)
    );
  }, [sortedPlayers, editingNumbers]);

  const handleAttendanceToggle = (playerId: string, currentlyAttended: boolean) => {
    // Save any pending number changes before toggling attendance
    if (editingNumbers[playerId] !== undefined) {
      const player = sortedPlayers.find(p => p.id === playerId);
      if (player) {
        handleSaveNumber(playerId, player.number);
      }
    }

    const newAttendedIds = new Set(attendedIds);

    if (currentlyAttended) {
      newAttendedIds.delete(playerId);
      // If removing the active goalkeeper, clear the selection
      if (playerId === activeGoalkeeperId) {
        dispatch({
          type: 'SET_ACTIVE_GOALKEEPER',
          payload: { team, playerId: null }
        });
      }
    } else {
      newAttendedIds.add(playerId);
    }

    dispatch({
      type: 'SET_TEAM_ATTENDANCE',
      payload: { team, playerIds: Array.from(newAttendedIds) }
    });
  };

  const handleActiveGoalkeeperToggle = (playerId: string, isGoalkeeper: boolean) => {
    if (!isGoalkeeper) return;

    // Save any pending number changes before toggling goalkeeper
    if (editingNumbers[playerId] !== undefined) {
      const player = sortedPlayers.find(p => p.id === playerId);
      if (player) {
        handleSaveNumber(playerId, player.number);
      }
    }

    const newGoalkeeperId = activeGoalkeeperId === playerId ? null : playerId;

    dispatch({
      type: 'SET_ACTIVE_GOALKEEPER',
      payload: { team, playerId: newGoalkeeperId }
    });
  };

  const handleNumberChange = (playerId: string, value: string) => {
    // Only allow numeric input
    if (/^\d*$/.test(value)) {
      setEditingNumbers(prev => ({ ...prev, [playerId]: value }));
    }
  };

  const handleSaveNumber = (playerId: string, currentNumber: string) => {
    // If the player was never edited (just focused and blurred), do nothing
    if (!(playerId in editingNumbers)) return;

    const newNumber = editingNumbers[playerId].trim();

    if (newNumber === currentNumber) {
      // No change
      setEditingNumbers(prev => {
        const copy = { ...prev };
        delete copy[playerId];
        return copy;
      });
      return;
    }

    // Update attendance only (match state), not team roster
    dispatch({
      type: 'UPDATE_ATTENDANCE_PLAYER',
      payload: {
        team,
        playerId,
        updates: { number: newNumber }
      }
    });

    setEditingNumbers(prev => {
      const copy = { ...prev };
      delete copy[playerId];
      return copy;
    });
  };

  const handleAddNewPlayer = () => {
    // Save all pending number changes before adding new player
    Object.keys(editingNumbers).forEach(playerId => {
      const player = sortedPlayers.find(p => p.id === playerId);
      if (player) {
        handleSaveNumber(playerId, player.number);
      }
    });

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

    // Check for duplicate number (considering both saved and editing numbers)
    if (isNewPlayerNumberDuplicate) {
      toast({
        title: "Número Duplicado",
        description: `El número #${trimmedNumber} ya está asignado a otro jugador.`,
        variant: "destructive"
      });
      return;
    }

    if (!teamData) return;

    // Generate new player ID
    const newPlayerId = `player-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Dispatch ADD_PLAYER_TO_TEAM action
    dispatch({
      type: 'ADD_PLAYER_TO_TEAM',
      payload: {
        teamId: teamData.id,
        player: {
          id: newPlayerId,
          name: trimmedName,
          number: trimmedNumber,
          type: newPlayerType
        }
      }
    });

    // Add to attendance automatically
    dispatch({
      type: 'SET_TEAM_ATTENDANCE',
      payload: { team, playerIds: [...Array.from(attendedIds), newPlayerId] }
    });

    toast({
      title: "Jugador Agregado",
      description: `${trimmedName} ha sido agregado al equipo.`
    });

    // Reset form
    setNewPlayerName('');
    setNewPlayerNumber('');
    setNewPlayerType('player');
    setShowNewPlayerForm(false);
  };

  if (!teamData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{teamName}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No hay equipo configurado
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          {teamName}
          <Badge variant="outline" className="ml-auto">
            {attendedIds.size}/{sortedPlayers.length} presentes
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {sortedPlayers.map(player => {
            const isAttended = attendedIds.has(player.id);
            const isActiveGoalkeeper = activeGoalkeeperId === player.id;
            const isGoalkeeper = player.type === 'goalkeeper';
            const isEditing = player.id in editingNumbers;
            const displayNumber = isEditing ? editingNumbers[player.id] : player.number;
            const isDuplicate = displayNumber.trim() && duplicateNumbers.has(displayNumber.trim());

            return (
              <div
                key={player.id}
                onClick={() => handleAttendanceToggle(player.id, isAttended)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                  isAttended ? "bg-primary/5 border-primary/20 hover:bg-primary/10" : "bg-muted/30 border-muted hover:bg-muted/50",
                  !isAttended && "opacity-60"
                )}
              >
                {/* Player icon */}
                <div className="flex-shrink-0">
                  {isGoalkeeper ? (
                    <Shield className={cn(
                      "h-5 w-5",
                      isActiveGoalkeeper ? "text-primary fill-primary" : "text-muted-foreground"
                    )} />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                {/* Number input */}
                <Input
                  type="text"
                  value={displayNumber}
                  onChange={(e) => handleNumberChange(player.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => handleSaveNumber(player.id, player.number)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveNumber(player.id, player.number);
                      e.currentTarget.blur();
                    }
                    if (e.key === 'Escape') {
                      setEditingNumbers(prev => {
                        const copy = { ...prev };
                        delete copy[player.id];
                        return copy;
                      });
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="#"
                  className={cn(
                    "w-16 h-9 text-center font-semibold",
                    isDuplicate && "border-red-500 border-2"
                  )}
                  disabled={!isAttended}
                />

                {/* Player name */}
                <span className={cn(
                  "flex-1 font-medium",
                  !isAttended && "text-muted-foreground"
                )}>
                  {player.name}
                </span>

                {/* Active goalkeeper toggle (only for goalkeepers) */}
                {isGoalkeeper && isAttended && (
                  <Button
                    variant={isActiveGoalkeeper ? "default" : "outline"}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleActiveGoalkeeperToggle(player.id, true);
                    }}
                    className="flex-shrink-0"
                  >
                    {isActiveGoalkeeper ? "Activo" : "Activar"}
                  </Button>
                )}
              </div>
            );
          })}

          {sortedPlayers.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No hay jugadores en el roster
            </p>
          )}

          {/* Add New Player Section */}
          <div className="mt-4 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                setShowNewPlayerForm(!showNewPlayerForm);
              }}
            >
              {showNewPlayerForm ? (
                <><ChevronUp className="mr-2 h-4 w-4" /> Ocultar Formulario</>
              ) : (
                <><Plus className="mr-2 h-4 w-4" /> Agregar Nuevo Jugador</>
              )}
            </Button>

            {showNewPlayerForm && (
              <div className="mt-3 p-3 border rounded-md bg-muted/20 space-y-3" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-2">
                  <Label htmlFor={`new-player-name-${team}`}>Nombre *</Label>
                  <Input
                    id={`new-player-name-${team}`}
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="Nombre completo del jugador"
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`new-player-number-${team}`}>Número</Label>
                  <Input
                    id={`new-player-number-${team}`}
                    type="text"
                    inputMode="numeric"
                    value={newPlayerNumber}
                    onChange={(e) => {
                      if (/^\d*$/.test(e.target.value)) {
                        setNewPlayerNumber(e.target.value);
                      }
                    }}
                    placeholder="Ej: 10"
                    className={cn(
                      "h-9",
                      isNewPlayerNumberDuplicate && "border-red-500 border-2"
                    )}
                    maxLength={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`new-player-type-${team}`}>Tipo *</Label>
                  <Select value={newPlayerType} onValueChange={(value: 'player' | 'goalkeeper') => setNewPlayerType(value)}>
                    <SelectTrigger id={`new-player-type-${team}`} className="h-9" suppressHydrationWarning>
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
      </CardContent>
    </Card>
  );
}
