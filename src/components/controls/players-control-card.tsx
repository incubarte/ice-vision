"use client";

import React, { useState, useMemo } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import type { Team, PlayerData } from '@/types';
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

  // Get attendance (present players only, keyed by number)
  const attendance = state.live.attendance[team] || [];
  const attendedNames = useMemo(() => new Set(attendance.map(p => p.name)), [attendance]);

  // Get active goalkeeper
  const activeGoalkeeperNumber = team === 'home' ? state.live.homeActiveGoalkeeperNumber : state.live.awayActiveGoalkeeperNumber;

  // Local editable numbers
  const [editingNumbers, setEditingNumbers] = useState<Record<string, string>>({});

  // Add player form state
  const [showNewPlayerForm, setShowNewPlayerForm] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');
  const [newPlayerType, setNewPlayerType] = useState<'player' | 'goalkeeper'>('player');

  // Sort players: combine roster with attendance overrides
  const sortedPlayers = useMemo(() => {
    // Build a combined list from roster, with attendance overrides
    const players: { number: string; name: string; type?: 'player' | 'goalkeeper'; isAttended: boolean }[] = [];

    if (teamData?.players) {
      teamData.players.forEach(rosterPlayer => {
        // Match attendance by name (unique and immutable during a match)
        const attendanceEntry = attendance.find(a => a.name === rosterPlayer.name);

        players.push({
          number: attendanceEntry?.number || rosterPlayer.number,
          name: rosterPlayer.name,
          type: attendanceEntry?.type || rosterPlayer.type,
          isAttended: !!attendanceEntry,
        });
      });
    }

    // Also include ad-hoc attendance players not in roster
    attendance.forEach(a => {
      if (!players.some(p => p.name === a.name)) {
        players.push({
          number: a.number,
          name: a.name,
          type: a.type,
          isAttended: true,
        });
      }
    });

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
      const currentNumber = (editingNumbers[p.name] !== undefined ? editingNumbers[p.name] : p.number).trim();
      return currentNumber === trimmed;
    });
  }, [newPlayerNumber, sortedPlayers, editingNumbers]);

  // Detect duplicate numbers
  const duplicateNumbers = useMemo(() => {
    const numberCounts = new Map<string, number>();

    sortedPlayers.forEach(player => {
      const currentNumber = (editingNumbers[player.name] !== undefined ? editingNumbers[player.name] : player.number).trim();
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

  const handleAttendanceToggle = (playerName: string, playerNumber: string, currentlyAttended: boolean) => {
    // Save any pending number changes before toggling attendance
    if (editingNumbers[playerName] !== undefined) {
      handleSaveNumber(playerName, playerNumber);
    }

    // Use names as stable identifiers (unique and immutable during a match)
    const newNames = new Set(attendedNames);

    if (currentlyAttended) {
      newNames.delete(playerName);
      // If removing the active goalkeeper, clear the selection
      if (playerNumber === activeGoalkeeperNumber) {
        dispatch({
          type: 'SET_ACTIVE_GOALKEEPER',
          payload: { team, playerNumber: null }
        });
      }
    } else {
      newNames.add(playerName);
    }

    dispatch({
      type: 'SET_TEAM_ATTENDANCE',
      payload: { team, playerNames: Array.from(newNames) }
    });
  };

  const handleActiveGoalkeeperToggle = (playerName: string, playerNumber: string, isGoalkeeper: boolean) => {
    if (!isGoalkeeper) return;

    // Save any pending number changes before toggling goalkeeper
    if (editingNumbers[playerName] !== undefined) {
      handleSaveNumber(playerName, playerNumber);
    }

    const newGoalkeeperNumber = activeGoalkeeperNumber === playerNumber ? null : playerNumber;

    dispatch({
      type: 'SET_ACTIVE_GOALKEEPER',
      payload: { team, playerNumber: newGoalkeeperNumber }
    });
  };

  const handleNumberChange = (playerName: string, value: string) => {
    // Only allow numeric input
    if (/^\d*$/.test(value)) {
      setEditingNumbers(prev => ({ ...prev, [playerName]: value }));
    }
  };

  const handleSaveNumber = (playerName: string, currentNumber: string) => {
    // If the player was never edited (just focused and blurred), do nothing
    if (!(playerName in editingNumbers)) return;

    const newNumber = editingNumbers[playerName].trim();

    if (newNumber === currentNumber) {
      // No change
      setEditingNumbers(prev => {
        const copy = { ...prev };
        delete copy[playerName];
        return copy;
      });
      return;
    }

    // Update attendance only (match state), not team roster
    dispatch({
      type: 'UPDATE_ATTENDANCE_PLAYER',
      payload: {
        team,
        playerName,
        updates: { number: newNumber }
      }
    });

    setEditingNumbers(prev => {
      const copy = { ...prev };
      delete copy[playerName];
      return copy;
    });
  };

  const handleAddNewPlayer = () => {
    // Save all pending number changes before adding new player
    Object.keys(editingNumbers).forEach(pName => {
      const player = sortedPlayers.find(p => p.name === pName);
      if (player) {
        handleSaveNumber(pName, player.number);
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
      payload: { team, playerNames: [...Array.from(attendedNames), trimmedName] }
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
            {attendance.length}/{sortedPlayers.length} presentes
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {sortedPlayers.map(player => {
            const isAttended = player.isAttended;
            const isActiveGoalkeeper = activeGoalkeeperNumber === player.number;
            const isGoalkeeper = player.type === 'goalkeeper';
            const isEditing = player.name in editingNumbers;
            const displayNumber = isEditing ? editingNumbers[player.name] : player.number;
            const isDuplicate = displayNumber.trim() && duplicateNumbers.has(displayNumber.trim());

            return (
              <div
                key={player.name}
                onClick={() => handleAttendanceToggle(player.name, player.number, isAttended)}
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
                  onChange={(e) => handleNumberChange(player.name, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => handleSaveNumber(player.name, player.number)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveNumber(player.name, player.number);
                      e.currentTarget.blur();
                    }
                    if (e.key === 'Escape') {
                      setEditingNumbers(prev => {
                        const copy = { ...prev };
                        delete copy[player.name];
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
                      handleActiveGoalkeeperToggle(player.name, player.number, true);
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
