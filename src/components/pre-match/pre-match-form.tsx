"use client";

import { useState, useCallback } from 'react';
import type { MatchData, TeamData, PreMatchData, PreMatchPlayerEntry, PreMatchExtraPlayer, PlayerType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Shield, User, Plus, Trash2, AlertCircle, CheckCircle2, Loader2, UserCog, FileCheck } from 'lucide-react';
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
  /** Show consent send buttons (only for ACEMHH club) */
  showConsent?: boolean;
}

function formatMatchTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function splitName(fullName: string): { first: string; last: string } {
  const trimmed = fullName.trim();
  if (trimmed.includes(',')) {
    const [last, first] = trimmed.split(',').map(s => s.trim());
    return { first: first ?? '', last };
  }
  const parts = trimmed.split(' ');
  if (parts.length === 1) return { first: '', last: trimmed };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

export function PreMatchForm({ apiBase, postUrl, match, team, teamRole, opponentName, initialData, onSaved, password = 'IceVision', showConsent = false }: PreMatchFormProps) {
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

  const [coachName, setCoachName] = useState(initialData?.coach ?? team.coach ?? '');
  const [assistant1Name, setAssistant1Name] = useState(initialData?.assistant1 ?? team.assistant1 ?? '');
  const [assistant2Name, setAssistant2Name] = useState(initialData?.assistant2 ?? team.assistant2 ?? '');

  const [isSaving, setIsSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(initialData !== null);
  const [currentVersion, setCurrentVersion] = useState(initialData?.version ?? 0);

  // Consent state — keyed by playerId, value is ISO timestamp when sent
  const [consentSentAt, setConsentSentAt] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of initialData?.players ?? []) {
      if (p.consentSentAt) init[p.playerId] = p.consentSentAt;
    }
    return init;
  });
  const [bulkConsentSending, setBulkConsentSending] = useState(false);
  const [bulkConsentProgress, setBulkConsentProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [sendingConsentIds, setSendingConsentIds] = useState<Set<string>>(new Set());

  // Dialog for filling in missing data before sending
  const [consentDialog, setConsentDialog] = useState<{
    playerId: string; firstName: string; lastName: string;
    docNumber: string; email: string; phone: string;
  } | null>(null);
  const [consentDialogSending, setConsentDialogSending] = useState(false);

  const consentPostUrl = postUrl ?? `${apiBase}/${match.id}`;

  // Saves the full current form state with the given consentSentAt map so consent marks persist on reload.
  async function saveWithConsent(updatedConsentSentAt: Record<string, string>): Promise<void> {
    const data: PreMatchData = {
      tournamentId: '',
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
        ...(updatedConsentSentAt[p.id] ? { consentSentAt: updatedConsentSentAt[p.id] } : {}),
      })),
      extraPlayers,
      coach: coachName.trim(),
      assistant1: assistant1Name.trim() || undefined,
      assistant2: assistant2Name.trim() || undefined,
    };
    try {
      await fetch(consentPostUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-pre-match-password': password },
        body: JSON.stringify({ data }),
      });
      setCurrentVersion(v => v + 1);
      setSavedOnce(true);
    } catch {
      // Non-fatal
    }
  }

  async function markConsentSent(playerId: string): Promise<void> {
    const sentAt = new Date().toISOString();
    const updated = { ...consentSentAt, [playerId]: sentAt };
    setConsentSentAt(updated);
    await saveWithConsent(updated);
  }

  async function sendConsent(player: { id: string; firstName: string; lastName: string; docNumber: string; email?: string; phone?: string }): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/consent/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: player.firstName, lastName: player.lastName, docNumber: player.docNumber, email: player.email ?? '', phone: player.phone ?? '' }),
      });
      const data = await res.json();
      console.log(`[consent/pre-match] ${player.firstName} ${player.lastName}:`, data);
      if (data.success) {
        return { success: true, message: data.message ?? 'Consentimiento enviado' };
      }
      return { success: false, message: data.message ?? 'Error al enviar el consentimiento' };
    } catch (err) {
      console.error(`[consent/pre-match] Error de red:`, err);
      return { success: false, message: 'No se pudo conectar con el servidor' };
    }
  }

  async function handleSendConsent(playerId: string) {
    const rp = team.players.find(p => p.id === playerId);
    if (!rp) return;
    // If missing docNumber → open dialog to complete data
    if (!rp.docNumber?.trim()) {
      const { first, last } = splitName(rp.name);
      setConsentDialog({ playerId, firstName: first, lastName: last, docNumber: '', email: rp.email ?? '', phone: rp.phone ?? '' });
      return;
    }
    // Has all required data → send directly
    setSendingConsentIds(prev => new Set(prev).add(playerId));
    const { first, last } = splitName(rp.name);
    const result = await sendConsent({ id: playerId, firstName: first, lastName: last, docNumber: rp.docNumber, email: rp.email, phone: rp.phone });
    setSendingConsentIds(prev => { const s = new Set(prev); s.delete(playerId); return s; });
    if (result.success) await markConsentSent(playerId);
    toast(result.success
      ? { title: 'Consentimiento enviado', description: rp.name }
      : { title: 'Error al enviar', description: result.message, variant: 'destructive' }
    );
  }

  async function handleConsentDialogSend() {
    if (!consentDialog) return;
    if (!consentDialog.docNumber.trim()) {
      toast({ title: 'El DNI es obligatorio', variant: 'destructive' });
      return;
    }
    setConsentDialogSending(true);
    const result = await sendConsent({
      id: consentDialog.playerId,
      firstName: consentDialog.firstName,
      lastName: consentDialog.lastName,
      docNumber: consentDialog.docNumber,
      email: consentDialog.email,
      phone: consentDialog.phone,
    });
    setConsentDialogSending(false);
    if (result.success) {
      await markConsentSent(consentDialog.playerId);
      toast({ title: 'Consentimiento enviado' });
      setConsentDialog(null);
    } else {
      toast({ title: 'Error al enviar', description: result.message, variant: 'destructive' });
    }
  }

  async function handleBulkConsent() {
    const presentPlayerIds = Object.entries(playerStates)
      .filter(([, s]) => s.isPresent)
      .map(([id]) => id);
    const pending = presentPlayerIds.filter(id => !consentSentAt[id]);
    if (!pending.length || bulkConsentSending) return;
    setBulkConsentSending(true);
    let successCount = 0;
    const errorMessages: string[] = [];
    const bulkUpdated = { ...consentSentAt };
    for (let i = 0; i < pending.length; i++) {
      const rp = team.players.find(p => p.id === pending[i]);
      if (!rp) continue;
      // Skip players without docNumber — they need manual entry
      if (!rp.docNumber?.trim()) {
        errorMessages.push(`${rp.name}: falta DNI`);
        continue;
      }
      setBulkConsentProgress({ current: i + 1, total: pending.length, name: rp.name });
      const { first, last } = splitName(rp.name);
      // Don't call markConsentSent here — accumulate and save once at the end
      const result = await sendConsent({ id: rp.id, firstName: first, lastName: last, docNumber: rp.docNumber, email: rp.email, phone: rp.phone });
      if (result.success) {
        successCount++;
        bulkUpdated[rp.id] = new Date().toISOString();
      } else {
        errorMessages.push(`${rp.name}: ${result.message}`);
      }
      if (i < pending.length - 1) await new Promise(r => setTimeout(r, 1000));
    }
    // Update state and save file once with all marks
    setConsentSentAt(bulkUpdated);
    if (successCount > 0) await saveWithConsent(bulkUpdated);
    setBulkConsentSending(false);
    setBulkConsentProgress(null);
    if (errorMessages.length > 0) {
      toast({ title: `${successCount} enviados, ${errorMessages.length} con error`, description: errorMessages.join(' · '), variant: errorMessages.length === pending.length ? 'destructive' : 'default', duration: Infinity });
    } else {
      toast({ title: `${successCount}/${pending.length} consentimientos enviados`, duration: Infinity });
    }
  }

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

    if (!coachName.trim()) {
      toast({ title: 'El coach/responsable es obligatorio', variant: 'destructive' });
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
        ...(consentSentAt[p.id] ? { consentSentAt: consentSentAt[p.id] } : {}),
      })),
      extraPlayers,
      coach: coachName.trim(),
      assistant1: assistant1Name.trim() || undefined,
      assistant2: assistant2Name.trim() || undefined,
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
    <>
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
                  {showConsent && state.isPresent && (
                    <button
                      type="button"
                      onClick={() => handleSendConsent(player.id)}
                      disabled={!!consentSentAt[player.id] || sendingConsentIds.has(player.id) || bulkConsentSending}
                      title={consentSentAt[player.id] ? 'Consentimiento enviado' : 'Enviar consentimiento'}
                      className={cn(
                        'h-7 w-7 flex items-center justify-center rounded transition-colors',
                        consentSentAt[player.id]
                          ? 'text-green-500 cursor-default'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      {consentSentAt[player.id]
                        ? <CheckCircle2 className="h-4 w-4" />
                        : sendingConsentIds.has(player.id)
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <FileCheck className="h-4 w-4" />
                      }
                    </button>
                  )}
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

        {/* Coaching staff */}
        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center gap-2">
            <UserCog className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Cuerpo Técnico</Label>
          </div>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Coach / Responsable <span className="text-destructive">*</span>
              </Label>
              <Input
                className={cn('h-8 text-sm', !coachName.trim() && 'border-destructive')}
                placeholder="Nombre completo (obligatorio)"
                value={coachName}
                onChange={e => setCoachName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">1er Asistente</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="Opcional"
                  value={assistant1Name}
                  onChange={e => setAssistant1Name(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">2do Asistente</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="Opcional"
                  value={assistant2Name}
                  onChange={e => setAssistant2Name(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bulk consent button — ACEMHH only */}
        {showConsent && (() => {
          const presentIds = Object.entries(playerStates).filter(([, s]) => s.isPresent).map(([id]) => id);
          const pendingCount = presentIds.filter(id => !consentSentAt[id]).length;
          if (presentIds.length === 0) return null;
          return (
            <div className="border-t pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs h-9"
                onClick={handleBulkConsent}
                disabled={bulkConsentSending || pendingCount === 0}
              >
                {bulkConsentSending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    {bulkConsentProgress
                      ? `${bulkConsentProgress.current}/${bulkConsentProgress.total} — ${bulkConsentProgress.name}`
                      : 'Enviando...'}
                  </>
                ) : (
                  <>
                    <FileCheck className="h-3.5 w-3.5 mr-2" />
                    {pendingCount === 0
                      ? 'Consentimientos enviados ✓'
                      : `Enviar consentimientos (${pendingCount} pendientes)`}
                  </>
                )}
              </Button>
            </div>
          );
        })()}

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

    {/* Consent fill-in dialog — shown when player is missing docNumber */}
    <Dialog open={!!consentDialog} onOpenChange={open => { if (!open && !consentDialogSending) setConsentDialog(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Datos para consentimiento</DialogTitle>
        </DialogHeader>
        {consentDialog && (
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Nombre</Label>
                <Input
                  value={consentDialog.firstName}
                  onChange={e => setConsentDialog(d => d ? { ...d, firstName: e.target.value } : d)}
                  placeholder="Nombre"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Apellido</Label>
                <Input
                  value={consentDialog.lastName}
                  onChange={e => setConsentDialog(d => d ? { ...d, lastName: e.target.value } : d)}
                  placeholder="Apellido"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">DNI <span className="text-destructive">*</span></Label>
              <Input
                value={consentDialog.docNumber}
                onChange={e => setConsentDialog(d => d ? { ...d, docNumber: e.target.value } : d)}
                placeholder="12345678"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Email</Label>
              <Input
                type="email"
                value={consentDialog.email}
                onChange={e => setConsentDialog(d => d ? { ...d, email: e.target.value } : d)}
                placeholder="jugador@mail.com"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Teléfono</Label>
              <Input
                value={consentDialog.phone}
                onChange={e => setConsentDialog(d => d ? { ...d, phone: e.target.value } : d)}
                placeholder="+54 11 1234-5678"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setConsentDialog(null)} disabled={consentDialogSending}>
            Cancelar
          </Button>
          <Button onClick={handleConsentDialogSend} disabled={consentDialogSending || !consentDialog?.docNumber.trim()}>
            {consentDialogSending
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
              : <><FileCheck className="h-4 w-4 mr-2" />Enviar</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
