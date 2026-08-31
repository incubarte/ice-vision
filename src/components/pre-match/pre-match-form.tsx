"use client";

import { useState, useCallback } from 'react';
import type { MatchData, TeamData, PreMatchData, PreMatchPlayerEntry, PreMatchExtraPlayer, PlayerType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, User, Plus, Trash2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn, getTeamDisplayName } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface PreMatchFormProps {
  /** Base URL for this match's pre-match API, e.g. /api/pre-match/club/clausura2026/ClubName */
  apiBase: string;
  /** Override the full POST/DELETE URL (used when apiBase is not the club-based URL) */
  postUrl?: string;
  match: MatchData;
  team: TeamData;
  teamRole: 'home' | 'away';
  opponentName: string | null;
  initialData: PreMatchData | null;
  onSaved: () => void;
  password?: string;
}

function formatMatchTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function PreMatchForm({ apiBase, postUrl, match, team, teamRole, opponentName, initialData, onSaved, password = 'IceVision' }: PreMatchFormProps) {
  const { toast } = useToast();

  // Initialize player states from initialData or from team roster
  const [playerStates, setPlayerStates] = useState<Record<string, { isPresent: boolean; number: string }>>(() => {
    const init: Record<string, { isPresent: boolean; number: string; clearedConflict?: boolean }> = {};
    for (const p of team.players) {
      const saved = initialData?.players.find(e => e.playerId === p.id);
      init[p.id] = {
        isPresent: saved ? saved.isPresent : false,
        number: saved ? saved.number : p.number,
      };
    }
    return init;
  });

  const [extraPlayers, setExtraPlayers] = useState<PreMatchExtraPlayer[]>(
    initialData?.extraPlayers ?? []
  );

  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraNumber, setNewExtraNumber] = useState('');
  const [newExtraType, setNewExtraType] = useState<PlayerType>('player');

  const [isSaving, setIsSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(initialData !== null);
  const [currentVersion, setCurrentVersion] = useState(initialData?.version ?? 0);

  // Collect all currently used numbers (across roster + extras)
  const getAllNumbers = useCallback(() => {
    const nums: Record<string, string> = {}; // number -> playerId or 'extra-N'
    for (const p of team.players) {
      const n = playerStates[p.id]?.number?.trim();
      if (n) nums[n] = p.id;
    }
    extraPlayers.forEach((e, i) => {
      if (e.number.trim()) nums[e.number.trim()] = `extra-${i}`;
    });
    return nums;
  }, [playerStates, extraPlayers, team.players]);

  function handleNumberChange(playerId: string, newNumber: string) {
    setPlayerStates(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], number: newNumber },
    }));
  }

  function handleExtraNumberChange(index: number, newNumber: string) {
    setExtraPlayers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], number: newNumber };
      return updated;
    });
  }

  // Compute duplicate numbers for inline validation
  const duplicateNumbers = (() => {
    const seen: Record<string, number> = {};
    for (const p of team.players) {
      const n = playerStates[p.id]?.number?.trim();
      if (n) seen[n] = (seen[n] ?? 0) + 1;
    }
    extraPlayers.forEach(e => {
      const n = e.number.trim();
      if (n) seen[n] = (seen[n] ?? 0) + 1;
    });
    return new Set(Object.keys(seen).filter(n => seen[n] > 1));
  })();

  function handleAddExtra() {
    const name = newExtraName.trim();
    const number = newExtraNumber.trim();
    if (!name || !number) {
      toast({ title: 'Completá nombre y número', variant: 'destructive' });
      return;
    }
    // Check for duplicate number
    const allNums = getAllNumbers();
    if (allNums[number]) {
      toast({ title: `El número ${number} ya está en uso`, variant: 'destructive' });
      return;
    }
    setExtraPlayers(prev => [...prev, { name, number, type: newExtraType }]);
    setNewExtraName('');
    setNewExtraNumber('');
    setNewExtraType('player');
  }

  function handleRemoveExtra(index: number) {
    setExtraPlayers(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    // Validate no duplicate numbers
    const nums: Record<string, string> = {};
    let hasDuplicate = false;
    for (const p of team.players) {
      const n = playerStates[p.id]?.number?.trim();
      if (n) {
        if (nums[n]) { hasDuplicate = true; break; }
        nums[n] = p.id;
      }
    }
    if (!hasDuplicate) {
      for (const e of extraPlayers) {
        const n = e.number.trim();
        if (n) {
          if (nums[n]) { hasDuplicate = true; break; }
          nums[n] = 'extra';
        }
      }
    }
    if (hasDuplicate) {
      toast({ title: 'Hay números de casaca repetidos', variant: 'destructive' });
      return;
    }

    const data: PreMatchData = {
      tournamentId: '', // resolved server-side from tournamentCode
      matchId: match.id,
      teamId: team.id,
      submittedAt: new Date().toISOString(),
      version: currentVersion + 1,
      players: team.players.map(p => ({
        playerId: p.id,
        name: p.name,
        number: playerStates[p.id]?.number ?? p.number,
        type: p.type,
        isPresent: playerStates[p.id]?.isPresent ?? false,
      })),
      extraPlayers,
    };

    setIsSaving(true);
    try {
      const res = await fetch(
        postUrl ?? `${apiBase}/${match.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-pre-match-password': password },
          body: JSON.stringify({ data }),
        }
      );
      if (!res.ok) throw new Error('Error al guardar');
      toast({ title: 'Plantel guardado', description: 'Los datos quedarán disponibles para el operador.' });
      setSavedOnce(true);
      setCurrentVersion(prev => prev + 1);
      onSaved();
    } catch {
      toast({ title: 'Error al guardar', description: 'Intentá de nuevo.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  const sortedPlayers = [...team.players].sort((a, b) => {
    if (a.type === 'goalkeeper' && b.type !== 'goalkeeper') return -1;
    if (a.type !== 'goalkeeper' && b.type === 'goalkeeper') return 1;
    return a.name.localeCompare(b.name);
  });

  const presentCount = Object.values(playerStates).filter(s => s.isPresent).length + extraPlayers.length;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Match header */}
      <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {teamRole === 'home' ? 'Local' : 'Visitante'}
            {opponentName && <span className="normal-case"> vs {opponentName}</span>}
          </p>
          <p className="font-semibold">{getTeamDisplayName(team.name, team.subName)}</p>
          {team.category && <p className="text-xs text-muted-foreground">{team.category}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Hora</p>
          <p className="font-mono font-semibold">{formatMatchTime(match.date)}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Player list */}
        <div className="space-y-1">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Jugadores</Label>
            <Badge variant="secondary">{presentCount} confirmados</Badge>
          </div>

          {sortedPlayers.map(player => {
            const state = playerStates[player.id] ?? { isPresent: false, number: player.number };
            const isGoalkeeper = player.type === 'goalkeeper';

            return (
              <div
                key={player.id}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-md border transition-colors',
                  state.isPresent ? 'bg-background border-border' : 'bg-muted/30 border-transparent'
                )}
              >
                <Checkbox
                  checked={state.isPresent}
                  onCheckedChange={checked =>
                    setPlayerStates(prev => ({
                      ...prev,
                      [player.id]: { ...prev[player.id], isPresent: !!checked },
                    }))
                  }
                />
                {isGoalkeeper ? (
                  <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className={cn('flex-1 text-sm', !state.isPresent && 'text-muted-foreground')}>
                  {player.name}
                </span>
                <div className="flex items-center gap-1.5">
                  {duplicateNumbers.has(state.number?.trim()) && state.number?.trim() && (
                    <span title="Número repetido">
                      <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    </span>
                  )}
                  <Input
                    className={cn("w-16 h-7 text-center text-sm font-mono", duplicateNumbers.has(state.number?.trim()) && state.number?.trim() && "border-destructive text-destructive")}
                    value={state.number}
                    onChange={e => handleNumberChange(player.id, e.target.value)}
                    placeholder="Nº"
                    maxLength={3}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Extra players */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Jugadores adicionales</Label>
          <p className="text-xs text-muted-foreground">Jugadores que no están en la lista pero van a jugar</p>

          {extraPlayers.map((extra, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-md border bg-amber-500/5 border-amber-500/20">
              {extra.type === 'goalkeeper' ? (
                <Shield className="h-4 w-4 text-amber-600 shrink-0" />
              ) : (
                <User className="h-4 w-4 text-amber-600 shrink-0" />
              )}
              <span className="flex-1 text-sm">{extra.name}</span>
              <Input
                className={cn("w-16 h-7 text-center text-sm font-mono", duplicateNumbers.has(extra.number?.trim()) && extra.number?.trim() && "border-destructive text-destructive")}
                value={extra.number}
                onChange={e => handleExtraNumberChange(i, e.target.value)}
                placeholder="Nº"
                maxLength={3}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemoveExtra(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {/* Add extra player */}
          <div className="flex gap-2 items-end pt-1">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Nombre</Label>
              <Input
                className="h-8 text-sm"
                placeholder="Nombre y apellido"
                value={newExtraName}
                onChange={e => setNewExtraName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nº</Label>
              <Input
                className="w-14 h-8 text-center text-sm font-mono"
                placeholder="00"
                value={newExtraNumber}
                onChange={e => setNewExtraNumber(e.target.value)}
                maxLength={3}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={newExtraType} onValueChange={v => setNewExtraType(v as PlayerType)}>
                <SelectTrigger className="h-8 w-28 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="player">Jugador</SelectItem>
                  <SelectItem value="goalkeeper">Arquero</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleAddExtra}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3 pt-2">
          <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar plantel'
            )}
          </Button>
          {savedOnce && (
            <div className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>Guardado</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
