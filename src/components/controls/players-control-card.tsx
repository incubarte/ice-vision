"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import type { Team, PlayerData, PreMatchData, PreMatchExtraPlayer } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Shield, User, Plus, ChevronUp, ShieldAlert, ClipboardCheck, Info, X, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isSanctionActive } from '@/lib/discipline-helpers';


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

  // Get attendance as Set<string> of jersey numbers
  const attendanceNumbers = useMemo(
    () => new Set(state.live.attendance[team] || []),
    [state.live.attendance, team]
  );

  // Get active goalkeeper
  const activeGoalkeeperNumber = team === 'home' ? state.live.homeActiveGoalkeeperNumber : state.live.awayActiveGoalkeeperNumber;

  // Sanctioned player IDs for this team today
  const sanctionedPlayerIds = useMemo(() => {
    const tournament = state.config.activeTournament;
    const sanctions = tournament?.disciplinarySanctions;
    if (!sanctions?.length || !teamData?.id) return new Set<string>();
    const matchDate = tournament!.matches?.find(m => m.id === state.live.matchId)?.date?.split('T')[0]
      ?? new Date().toISOString().split('T')[0];
    const allMatches = tournament!.matches ?? [];
    return new Set(
      sanctions
        .filter(s => s.teamId === teamData.id && isSanctionActive(s, allMatches, matchDate))
        .map(s => s.playerId)
    );
  }, [state.config.activeTournament, state.live.matchId, teamData]);

  // Pre-match data integration
  const tournamentId = matchContext?.tournamentId;
  const matchId = state.live.matchId ?? undefined;
  const teamId = teamData?.id;

  const preMatchPassword = useMemo(() => {
    if (!teamId) return 'IceVision';
    const teamRecord = (state.config.activeTournament?.teams ?? []).find(t => t.id === teamId);
    if (!teamRecord?.clubId) return 'IceVision';
    const club = (state.config.activeTournament?.clubs ?? []).find(c => c.id === teamRecord.clubId);
    return club?.password || 'IceVision';
  }, [teamId, state.config.activeTournament]);

  const [preMatchData, setPreMatchData] = useState<PreMatchData | null>(null);
  const [preMatchChecked, setPreMatchChecked] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pendingExtras, setPendingExtras] = useState<PreMatchExtraPlayer[]>([]);
  const [extrasApplied, setExtrasApplied] = useState(false);

  const fetchPreMatchData = useCallback(async (showToast = false) => {
    if (!tournamentId || !matchId || !teamId) return;
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/pre-match/${tournamentId}/${teamId}/${matchId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.exists) {
          setPreMatchData(json.data);
          if (showToast) toast({ title: 'Pre-partido descargado', description: `v${json.data.version ?? 1} — ${json.data.players.filter((p: { isPresent: boolean }) => p.isPresent).length} confirmados` });
        } else {
          setPreMatchData(null);
          if (showToast) toast({ title: 'Sin datos de pre-partido', description: 'No hay planilla cargada en la nube.' });
        }
      }
    } catch {
      if (showToast) toast({ title: 'Error al descargar', description: 'No se pudo conectar.', variant: 'destructive' });
    } finally {
      setPreMatchChecked(true);
      setIsDownloading(false);
    }
  }, [tournamentId, matchId, teamId, toast]);

  // Initial fetch
  useEffect(() => {
    fetchPreMatchData();
  }, [fetchPreMatchData]);

  // Auto-fetch when warmup starts
  const periodOverride = state.live.clock.periodDisplayOverride;
  const prevPeriodRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevPeriodRef.current !== undefined && prevPeriodRef.current !== 'Warm-up' && periodOverride === 'Warm-up') {
      fetchPreMatchData();
    }
    prevPeriodRef.current = periodOverride;
  }, [periodOverride, fetchPreMatchData]);

  const handleApplyPreMatchData = async () => {
    if (!preMatchData || !teamData) return;

    // 1. Apply attendance
    const presentNumbers = preMatchData.players
      .filter(p => p.isPresent)
      .map(p => p.number)
      .filter(Boolean);
    dispatch({ type: 'SET_TEAM_ATTENDANCE', payload: { team, playerNumbers: presentNumbers } });

    // 2. Apply number corrections (only for players whose number changed)
    for (const entry of preMatchData.players) {
      const rosterPlayer = teamData.players.find(p => p.id === entry.playerId);
      if (rosterPlayer && entry.number && entry.number !== rosterPlayer.number) {
        dispatch({
          type: 'UPDATE_ATTENDANCE_PLAYER',
          payload: { team, playerName: rosterPlayer.name, updates: { number: entry.number } },
        });
      }
    }

    // 3. Apply coach info to matchContext
    if (preMatchData.coach && matchContext) {
      const coachKey = team === 'home' ? 'homeCoach' : 'awayCoach';
      const asst1Key = team === 'home' ? 'homeAssistant1' : 'awayAssistant1';
      const asst2Key = team === 'home' ? 'homeAssistant2' : 'awayAssistant2';
      dispatch({
        type: 'UPDATE_LIVE_STATE',
        payload: {
          matchContext: {
            ...matchContext,
            [coachKey]: preMatchData.coach,
            [asst1Key]: preMatchData.assistant1 ?? undefined,
            [asst2Key]: preMatchData.assistant2 ?? undefined,
          },
        },
      });
    }

    // 4. Store extra players for display (operator adds them manually)
    if (preMatchData.extraPlayers.length > 0) {
      setPendingExtras(preMatchData.extraPlayers);
      setExtrasApplied(true);
    }

    // 4. Delete the temp file
    try {
      await fetch(`/api/pre-match/${tournamentId}/${teamId}/${matchId}`, {
        method: 'DELETE',
        headers: { 'x-pre-match-password': preMatchPassword },
      });
    } catch {
      // Non-critical
    }

    setPreMatchData(null);
    toast({
      title: 'Pre-partido aplicado',
      description: preMatchData.extraPlayers.length > 0
        ? `${preMatchData.extraPlayers.length} jugador(es) adicional(es) no se agregaron automáticamente — revisá el aviso.`
        : 'Asistencia y números aplicados correctamente.',
    });
  };

  // Local editable numbers (keyed by player name since names are unique)
  const [editingNumbers, setEditingNumbers] = useState<Record<string, string>>({});

  // Add player form state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showNewPlayerForm, setShowNewPlayerForm] = useState(false);
  useEffect(() => {
    if (showNewPlayerForm && scrollContainerRef.current) {
      setTimeout(() => {
        scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  }, [showNewPlayerForm]);

  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');
  const [newPlayerType, setNewPlayerType] = useState<'player' | 'goalkeeper'>('player');

  // Sort players from roster directly
  const sortedPlayers = useMemo(() => {
    if (!teamData?.players) return [];

    return [...teamData.players]
      .map(rosterPlayer => ({
        id: rosterPlayer.id,
        number: rosterPlayer.number,
        name: rosterPlayer.name,
        type: rosterPlayer.type,
        isAttended: rosterPlayer.number ? attendanceNumbers.has(rosterPlayer.number) : false,
      }))
      .sort((a, b) => {
        if (a.type === 'goalkeeper' && b.type !== 'goalkeeper') return -1;
        if (a.type !== 'goalkeeper' && b.type === 'goalkeeper') return 1;
        return a.name.localeCompare(b.name);
      });
  }, [teamData, attendanceNumbers]);

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

  const handleAttendanceToggle = (player: { name: string; number: string }, currentlyAttended: boolean) => {
    // Save any pending number changes before toggling attendance
    if (editingNumbers[player.name] !== undefined) {
      handleSaveNumber(player.name, player.number);
    }

    if (!currentlyAttended && !player.number) {
      toast({
        title: "Sin número",
        description: "No se puede activar un jugador sin número de camiseta.",
        variant: "destructive"
      });
      return;
    }

    const newNumbers = new Set(attendanceNumbers);

    if (currentlyAttended) {
      newNumbers.delete(player.number);
      // If removing the active goalkeeper, clear the selection
      if (player.number === activeGoalkeeperNumber) {
        dispatch({
          type: 'SET_ACTIVE_GOALKEEPER',
          payload: { team, playerNumber: null }
        });
      }
    } else {
      newNumbers.add(player.number);
    }

    dispatch({
      type: 'SET_TEAM_ATTENDANCE',
      payload: { team, playerNumbers: Array.from(newNumbers) }
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

    // Update roster number (and handle collisions) via reducer
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

    // Dispatch ADD_PLAYER_TO_TEAM action (also adds to attendance)
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
            {attendanceNumbers.size}/{sortedPlayers.length} presentes
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Pre-match data banner — always visible once IDs are available */}
        {(tournamentId && matchId && teamId) && (
          <div className={`mb-3 flex items-start gap-2 rounded-md border p-3 ${preMatchData ? 'border-blue-500/30 bg-blue-500/5' : 'border-border bg-muted/30'}`}>
            <ClipboardCheck className={`h-4 w-4 mt-0.5 shrink-0 ${preMatchData ? 'text-blue-500' : 'text-muted-foreground'}`} />
            <div className="flex-1 min-w-0">
              {preMatchData ? (
                <>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                    Datos de pre-partido disponibles
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {preMatchData.players.filter(p => p.isPresent).length} confirmados
                    {preMatchData.extraPlayers.length > 0 && ` · ${preMatchData.extraPlayers.length} adicional(es)`}
                    {` · v${preMatchData.version ?? 1}`}
                    {preMatchData.submittedAt && ` · ${new Date(preMatchData.submittedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {preMatchChecked ? 'Sin planilla pre-partido' : 'Buscando planilla...'}
                </p>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-2"
                onClick={() => fetchPreMatchData(true)}
                disabled={isDownloading}
                title="Descargar desde la nube"
              >
                {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              </Button>
              {preMatchData && (
                <Button size="sm" className="h-7 text-xs" onClick={handleApplyPreMatchData}>
                  Precargar
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Extra players advisory banner (shown after apply) */}
        {extrasApplied && pendingExtras.length > 0 && (
          <div className="mb-3 flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Jugadores adicionales reportados
              </p>
              <ul className="mt-1 space-y-0.5">
                {pendingExtras.map((e, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    {e.type === 'goalkeeper' ? '🥅' : '👤'} {e.name} — #{e.number}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-1">Agregálos manualmente si van a jugar.</p>
            </div>
            <button
              onClick={() => setExtrasApplied(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div ref={scrollContainerRef} className="space-y-2 max-h-[600px] overflow-y-auto">
          {sortedPlayers.map(player => {
            const isAttended = player.isAttended;
            const isActiveGoalkeeper = activeGoalkeeperNumber === player.number;
            const isGoalkeeper = player.type === 'goalkeeper';
            const isEditing = player.name in editingNumbers;
            const displayNumber = isEditing ? editingNumbers[player.name] : player.number;
            const hasNoNumber = !player.number;
            const isDuplicate = displayNumber.trim() && duplicateNumbers.has(displayNumber.trim());
            const isSanctioned = sanctionedPlayerIds.has(player.id);

            return (
              <div
                key={player.id}
                onClick={() => handleAttendanceToggle(player, isAttended)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                  isSanctioned ? "border-destructive/50 bg-destructive/5 hover:bg-destructive/10" :
                    isAttended ? "bg-primary/5 border-primary/20 hover:bg-primary/10" : "bg-muted/30 border-muted hover:bg-muted/50",
                  !isAttended && !isSanctioned && "opacity-60"
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
                    (hasNoNumber || isDuplicate) && "border-red-500 border-2"
                  )}
                />

                {/* Player name */}
                <span className={cn(
                  "flex-1 font-medium flex items-center gap-1.5",
                  isSanctioned ? "text-destructive" : !isAttended && "text-muted-foreground"
                )}>
                  {player.name}
                  {isSanctioned && (
                    <span title="Jugador con sanción disciplinaria vigente">
                      <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
                    </span>
                  )}
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
