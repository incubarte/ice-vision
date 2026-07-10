"use client";

import React, { useMemo, useState } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import { useAdminMode } from '@/hooks/use-admin-mode';
import { isTournamentHydrated } from '@/types';
import type { DisciplinarySanction, SanctionType } from '@/types';
import { calculateReinstatementDate, isSanctionActive, formatSanctionDate } from '@/lib/discipline-helpers';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ShieldAlert, Plus, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const ALL_CATEGORIES = '__ALL__';

interface SanctionFormState {
  teamId: string;
  playerId: string;
  playerName: string;
  playerNumber: string;
  categoryId: string;
  reason: string;
  startDate: string;
  sanctionType: SanctionType;
  sanctionValue: string;
  notes: string;
}

const EMPTY_FORM: SanctionFormState = {
  teamId: '',
  playerId: '',
  playerName: '',
  playerNumber: '',
  categoryId: '',
  reason: '',
  startDate: new Date().toISOString().split('T')[0],
  sanctionType: 'pending_review',
  sanctionValue: '',
  notes: '',
};

interface DisciplineTabProps {
  tournamentId: string;
}

export function DisciplineTab({ tournamentId }: DisciplineTabProps) {
  const { state, dispatch } = useGameState();
  const { isAdminMode } = useAdminMode();

  const tournament = state.config.activeTournament;
  const isHydrated = isTournamentHydrated(tournament);
  const allMatches = isHydrated ? tournament.matches : [];

  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SanctionFormState>(EMPTY_FORM);

  const today = new Date().toISOString().split('T')[0];

  const sanctions = useMemo(
    () => (isHydrated ? tournament.disciplinarySanctions ?? [] : []),
    [isHydrated, tournament]
  );

  const filtered = useMemo(
    () => sanctions.filter(s => categoryFilter === ALL_CATEGORIES || s.categoryId === categoryFilter),
    [sanctions, categoryFilter]
  );

  // Teams grouped by category for the player selector in the dialog
  const teamsByCategory = useMemo(() => {
    if (!isHydrated) return [];
    return (tournament.categories || []).map(cat => ({
      category: cat,
      teams: (tournament.teams || []).filter(t => t.category === cat.id),
    }));
  }, [isHydrated, tournament]);

  // Players from selected team in form
  const playersForSelectedTeam = useMemo(() => {
    if (!isHydrated || !form.teamId) return [];
    const team = tournament.teams.find(t => t.id === form.teamId);
    return team?.players ?? [];
  }, [isHydrated, tournament, form.teamId]);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(s: DisciplinarySanction) {
    setEditingId(s.id);
    setForm({
      teamId: s.teamId,
      playerId: s.playerId,
      playerName: s.playerName,
      playerNumber: s.playerNumber,
      categoryId: s.categoryId,
      reason: s.reason ?? '',
      startDate: s.startDate,
      sanctionType: s.sanctionType,
      sanctionValue: s.sanctionValue?.toString() ?? '',
      notes: s.notes ?? '',
    });
    setDialogOpen(true);
  }

  function handleTeamChange(teamId: string) {
    if (!isHydrated) return;
    const team = tournament.teams.find(t => t.id === teamId);
    const cat = tournament.categories?.find(c => c.id === team?.category);
    setForm(prev => ({
      ...prev,
      teamId,
      categoryId: cat?.id ?? '',
      playerId: '',
      playerName: '',
      playerNumber: '',
    }));
  }

  function handlePlayerChange(playerId: string) {
    const player = playersForSelectedTeam.find(p => p.id === playerId);
    if (!player) return;
    setForm(prev => ({
      ...prev,
      playerId: player.id,
      playerName: player.name,
      playerNumber: player.number,
    }));
  }

  function handleSave() {
    if (!form.teamId || !form.playerId || !form.startDate) return;
    if (form.sanctionType !== 'pending_review' && !form.sanctionValue) return;

    const sanctionPayload = {
      playerId: form.playerId,
      playerName: form.playerName,
      playerNumber: form.playerNumber,
      teamId: form.teamId,
      categoryId: form.categoryId,
      reason: form.reason || undefined,
      startDate: form.startDate,
      sanctionType: form.sanctionType,
      sanctionValue: form.sanctionType !== 'pending_review' ? Number(form.sanctionValue) : undefined,
      notes: form.notes || undefined,
    };

    if (editingId) {
      dispatch({
        type: 'UPDATE_SANCTION_IN_TOURNAMENT',
        payload: { tournamentId, sanctionId: editingId, updates: sanctionPayload },
      });
    } else {
      dispatch({
        type: 'ADD_SANCTION_TO_TOURNAMENT',
        payload: { tournamentId, sanction: sanctionPayload },
      });
    }
    setDialogOpen(false);
  }

  function handleDelete(sanctionId: string) {
    dispatch({ type: 'REMOVE_SANCTION_FROM_TOURNAMENT', payload: { tournamentId, sanctionId } });
  }

  function getSanctionLabel(s: DisciplinarySanction): string {
    if (s.sanctionType === 'pending_review') return 'En Revisión';
    if (s.sanctionType === 'calendar_days') return `${s.sanctionValue} día${s.sanctionValue === 1 ? '' : 's'}`;
    return `${s.sanctionValue} fecha${s.sanctionValue === 1 ? '' : 's'}`;
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-56 shrink-0">
          <Label>Filtrar por Categoría</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>Todas las Categorías</SelectItem>
              {(isHydrated ? tournament.categories : []).map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isAdminMode && (
          <Button onClick={openAdd} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" /> Agregar Sanción
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            Sanciones Disciplinarias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jugador</TableHead>
                  <TableHead>Equipo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-center">Inicio</TableHead>
                  <TableHead className="text-center">Sanción</TableHead>
                  <TableHead className="text-center">Reincorporación</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  {isAdminMode && <TableHead className="text-center">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(s => {
                  const teamName = isHydrated
                    ? tournament.teams.find(t => t.id === s.teamId)?.name ?? s.teamId
                    : s.teamId;
                  const categoryName = isHydrated
                    ? tournament.categories?.find(c => c.id === s.categoryId)?.name ?? s.categoryId
                    : s.categoryId;
                  const reinstatement = calculateReinstatementDate(s, allMatches);
                  const active = isSanctionActive(s, allMatches, today);

                  return (
                    <TableRow key={s.id} className={cn(active && "bg-destructive/5")}>
                      <TableCell className="font-medium">
                        <div>{s.playerName}</div>
                        {s.playerNumber && (
                          <div className="text-xs text-muted-foreground">#{s.playerNumber}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{teamName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{categoryName}</TableCell>
                      <TableCell className="text-sm max-w-[160px]">
                        {s.reason ? (
                          <span title={s.reason} className="line-clamp-2">{s.reason}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {formatSanctionDate(s.startDate)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "text-sm font-medium",
                          s.sanctionType === 'pending_review' && "text-amber-600 dark:text-amber-400"
                        )}>
                          {getSanctionLabel(s)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {s.sanctionType === 'pending_review'
                          ? <span className="text-muted-foreground text-xs">En Revisión</span>
                          : reinstatement
                            ? formatSanctionDate(reinstatement)
                            : <span className="text-muted-foreground text-xs">TBD</span>
                        }
                      </TableCell>
                      <TableCell className="text-center">
                        {active ? (
                          <Badge variant="destructive">En Progreso</Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-700 border-green-700 dark:text-green-400 dark:border-green-400">
                            Cumplida
                          </Badge>
                        )}
                      </TableCell>
                      {isAdminMode && (
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar sanción?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Se eliminará la sanción de {s.playerName}. Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(s.id)} className="bg-destructive hover:bg-destructive/90">
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdminMode ? 9 : 8} className="h-24 text-center text-muted-foreground">
                      No hay sanciones registradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Sanción' : 'Nueva Sanción'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Team selector */}
            <div className="space-y-1">
              <Label>Equipo *</Label>
              <Select value={form.teamId} onValueChange={handleTeamChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar equipo..." />
                </SelectTrigger>
                <SelectContent>
                  {teamsByCategory.map(({ category, teams }) =>
                    teams.map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}{team.subName ? ` (${team.subName})` : ''} — {category.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Player selector */}
            <div className="space-y-1">
              <Label>Jugador *</Label>
              <Select
                value={form.playerId}
                onValueChange={handlePlayerChange}
                disabled={!form.teamId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.teamId ? 'Seleccionar jugador...' : 'Primero elegí un equipo'} />
                </SelectTrigger>
                <SelectContent>
                  {playersForSelectedTeam.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      #{p.number} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reason */}
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Input
                value={form.reason}
                onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Ej: Expulsión por conducta violenta"
              />
            </div>

            {/* Start date */}
            <div className="space-y-1">
              <Label>Fecha de inicio *</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            {/* Sanction type */}
            <div className="space-y-1">
              <Label>Tipo de sanción *</Label>
              <Select
                value={form.sanctionType}
                onValueChange={(v) => setForm(prev => ({ ...prev, sanctionType: v as SanctionType, sanctionValue: '' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_review">En Revisión</SelectItem>
                  <SelectItem value="calendar_days">Días calendario</SelectItem>
                  <SelectItem value="matches">Cantidad de fechas (partidos)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sanction value (only if not pending_review) */}
            {form.sanctionType !== 'pending_review' && (
              <div className="space-y-1">
                <Label>
                  {form.sanctionType === 'calendar_days' ? 'Cantidad de días *' : 'Cantidad de fechas *'}
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={form.sanctionValue}
                  onChange={e => setForm(prev => ({ ...prev, sanctionValue: e.target.value }))}
                  placeholder={form.sanctionType === 'calendar_days' ? 'Ej: 30' : 'Ej: 3'}
                />
                {form.sanctionType === 'matches' && (
                  <p className="text-xs text-muted-foreground">
                    La fecha de reincorporación se calcula automáticamente en base al fixture del equipo.
                  </p>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Información adicional..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={
                !form.teamId || !form.playerId || !form.startDate ||
                (form.sanctionType !== 'pending_review' && !form.sanctionValue)
              }
            >
              {editingId ? 'Guardar cambios' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
