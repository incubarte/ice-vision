
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MiniScoreboard } from '@/components/controls/mini-scoreboard';
import { PenaltyControlCard } from '@/components/controls/penalty-control-card';
import { GoalManagementDialog } from '@/components/controls/goal-management-dialog';
import { GoldenGoalDialog } from '@/components/controls/golden-goal-dialog';
import { ShootoutControl } from '@/components/controls/shootout-control';
import { PenaltyNotifications } from '@/components/scoreboard/penalty-notifications';
import { useGameState, type Team, type GoalLog, type PenaltyLog, getCategoryNameById, getActualPeriodText, formatTime, type GameState } from '@/contexts/game-state-context';
import type { PlayerData, RemoteCommand, AccessRequest, TunnelState, MatchData } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, AlertTriangle, PlayCircle, Trophy, Wifi, Power, PowerOff, Loader2, Copy, ShieldAlert, LogIn, Swords, PlusCircle, Check, X, Fingerprint, FileText, Flag, MessageSquare, CalendarCheck, Trash2, Info, Edit3, CheckCircle, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { HockeyPuckSpinner } from '@/components/ui/hockey-puck-spinner';
import { safeUUID } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/hooks/use-auth';
import { format as formatDate } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CONTROLS_LOCK_KEY = 'icevision-controls-lock-id';
const CONTROLS_CHANNEL_NAME = 'icevision-controls-channel';

type PageDisplayState = 'Checking' | 'Primary' | 'Secondary';

// Component to display goals for a team
const GoalsDisplayCard = ({ team, teamName, goals, onAddGoal }: { team: Team; teamName: string; goals: GoalLog[]; onAddGoal: () => void }) => {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);

  // Sort goals by timestamp, newest first
  const sortedGoals = useMemo(() => {
    return [...goals].sort((a, b) => b.timestamp - a.timestamp);
  }, [goals]);

  const handleDeleteGoal = (goalId: string) => {
    dispatch({ type: 'DELETE_GOAL', payload: { goalId } });
    toast({ title: "Gol Eliminado", description: "El gol ha sido eliminado." });
    setGoalToDelete(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Goles - {teamName}</CardTitle>
          <Button variant="outline" size="sm" onClick={onAddGoal}>
            <PlusCircle className="mr-1 h-4 w-4" /> Agregar Gol
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sortedGoals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="mx-auto h-12 w-12 mb-2 opacity-50" />
            <p>No hay goles registrados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedGoals.map((goal, index) => {
              // Calculate goal number (reversed, so newest is #1, #2, etc.)
              const goalNumber = sortedGoals.length - index;

              if (editingGoalId === goal.id) {
                return (
                  <div key={`${goal.id}-editing`} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center font-bold text-lg text-primary">
                      {goalNumber}
                    </div>
                    <div className="flex-1">
                      <EditableGoalRow
                        key={`edit-${goal.id}-${goal.scorer?.playerNumber}-${goal.assist?.playerNumber}`}
                        goal={goal}
                        onCancel={() => setEditingGoalId(null)}
                        onSave={() => setEditingGoalId(null)}
                      />
                    </div>
                  </div>
                );
              }

              const timestamp = new Date(goal.timestamp);
              const displayTime = formatDate(timestamp, 'HH:mm:ss');

              return (
                <div key={goal.id} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center font-bold text-lg text-primary">
                    {goalNumber}
                  </div>
                  <Card className="bg-muted/30 flex-1">
                    <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold">#{goal.scorer?.playerNumber || 'S/N'}</span>
                          {goal.scorer?.playerName && (
                            <span className="text-sm text-muted-foreground truncate">
                              {goal.scorer.playerName}
                            </span>
                          )}
                        </div>

                        {(goal.assist || goal.assist2) && (
                          <div className="text-sm text-muted-foreground space-y-1 ml-6">
                            {goal.assist && (
                              <div>Asist. 1: #{goal.assist.playerNumber} {goal.assist.playerName}</div>
                            )}
                            {goal.assist2 && (
                              <div>Asist. 2: #{goal.assist2.playerNumber} {goal.assist2.playerName}</div>
                            )}
                          </div>
                        )}

                        {goal.positives && goal.positives.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-2 ml-6">
                            <span className="font-semibold">Positivas:</span>{' '}
                            {goal.positives.map(p => `#${p?.playerNumber}${p?.playerName ? ` ${p.playerName}` : ''}`).join(', ')}
                          </div>
                        )}

                        {goal.negatives && goal.negatives.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1 ml-6">
                            <span className="font-semibold">Negativas:</span>{' '}
                            {goal.negatives.map(n => `#${n?.playerNumber}${n?.playerName ? ` ${n.playerName}` : ''}`).join(', ')}
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground mt-2">
                          <div>{goal.periodText} - {formatTime(goal.gameTime)}</div>
                          <div className="opacity-70">{displayTime}</div>
                        </div>
                      </div>

                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-primary hover:text-primary/80 h-8 w-8"
                          onClick={() => setEditingGoalId(goal.id)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive/80 h-8 w-8"
                          onClick={() => setGoalToDelete(goal.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!goalToDelete} onOpenChange={(open) => !open && setGoalToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar este gol? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => goalToDelete && handleDeleteGoal(goalToDelete)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar Gol
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

// Editable goal row component
const EditableGoalRow = ({ goal, onCancel, onSave }: { goal: GoalLog; onCancel: () => void; onSave: () => void; }) => {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();

  const [scorerNumber, setScorerNumber] = useState(goal.scorer?.playerNumber || '');
  const [assistNumber, setAssistNumber] = useState(goal.assist?.playerNumber || '');
  const [assist2Number, setAssist2Number] = useState(goal.assist2?.playerNumber || '');
  const [positives, setPositives] = useState<string[]>(
    goal.positives?.map(p => p?.playerNumber || '') || ['', '', '', '', '']
  );
  const [negatives, setNegatives] = useState<string[]>(
    goal.negatives?.map(n => n?.playerNumber || '') || ['', '', '', '', '']
  );

  // Ensure arrays have 5 elements
  while (positives.length < 5) positives.push('');
  while (negatives.length < 5) negatives.push('');

  // Get team data
  const teamData = useMemo(() => {
    if (!state.config || !state.live || !state.config.tournaments) return null;
    const selectedTournament = state.config.tournaments.find(t => t.id === state.config.selectedTournamentId);
    if (!selectedTournament || !selectedTournament.teams) return null;

    const teamName = goal.team === 'home' ? state.live.homeTeamName : state.live.awayTeamName;
    const teamSubName = goal.team === 'home' ? state.live.homeTeamSubName : state.live.awayTeamSubName;
    return selectedTournament.teams.find(t => t.name === teamName && (t.subName || undefined) === (teamSubName || undefined) && t.category === state.config.selectedMatchCategory);
  }, [goal.team, state.live, state.config]);

  const opposingTeamData = useMemo(() => {
    if (!state.config || !state.live || !state.config.tournaments) return null;
    const selectedTournament = state.config.tournaments.find(t => t.id === state.config.selectedTournamentId);
    if (!selectedTournament || !selectedTournament.teams) return null;

    const opposingTeamName = goal.team === 'home' ? state.live.awayTeamName : state.live.homeTeamName;
    const opposingTeamSubName = goal.team === 'home' ? state.live.awayTeamSubName : state.live.homeTeamSubName;
    return selectedTournament.teams.find(t => t.name === opposingTeamName && (t.subName || undefined) === (opposingTeamSubName || undefined) && t.category === state.config.selectedMatchCategory);
  }, [goal.team, state.live, state.config]);

  // Get selected players
  const selectedPlayer = useMemo(() =>
    teamData?.players.find(p => p.number === scorerNumber.trim()),
    [teamData, scorerNumber]
  );

  const selectedAssistPlayer = useMemo(() =>
    teamData?.players.find(p => p.number === assistNumber.trim()),
    [teamData, assistNumber]
  );

  const selectedAssist2Player = useMemo(() =>
    teamData?.players.find(p => p.number === assist2Number.trim()),
    [teamData, assist2Number]
  );

  const selectedPositivePlayers = useMemo(() =>
    positives.map(num => num.trim() ? teamData?.players.find(p => p.number === num.trim()) : null),
    [teamData, positives]
  );

  const selectedNegativePlayers = useMemo(() =>
    negatives.map(num => num.trim() ? opposingTeamData?.players.find(p => p.number === num.trim()) : null),
    [opposingTeamData, negatives]
  );

  // Auto-sync positives when goleador/asistentes change
  useEffect(() => {
    setPositives(prev => {
      const newPositives = [...prev];
      // Sincronizar goleador en posición 0 solo si hay valor
      if (scorerNumber.trim()) {
        newPositives[0] = scorerNumber.trim();
      }
      // Sincronizar asistencia 1 en posición 1 solo si hay valor
      if (assistNumber.trim()) {
        newPositives[1] = assistNumber.trim();
      }
      // Sincronizar asistencia 2 en posición 2 solo si hay valor
      if (assist2Number.trim()) {
        newPositives[2] = assist2Number.trim();
      }
      return newPositives;
    });
  }, [scorerNumber, assistNumber, assist2Number]);

  // Detect duplicates
  const duplicateChecker = useMemo(() => {
    const goleadorAsistentes = [scorerNumber.trim(), assistNumber.trim(), assist2Number.trim()].filter(n => n);
    const hasDuplicateGA = goleadorAsistentes.length !== new Set(goleadorAsistentes).size;

    const positivesNumbers = positives.map(p => p.trim()).filter(n => n);
    const hasDuplicatePositives = positivesNumbers.length !== new Set(positivesNumbers).size;

    const negativesNumbers = negatives.map(n => n.trim()).filter(n => n);
    const hasDuplicateNegatives = negativesNumbers.length !== new Set(negativesNumbers).size;

    return {
      scorer: scorerNumber.trim() && goleadorAsistentes.filter(n => n === scorerNumber.trim()).length > 1,
      assist: assistNumber.trim() && goleadorAsistentes.filter(n => n === assistNumber.trim()).length > 1,
      assist2: assist2Number.trim() && goleadorAsistentes.filter(n => n === assist2Number.trim()).length > 1,
      positives: positives.map((p) => {
        const trimmed = p.trim();
        if (!trimmed) return false;
        return positivesNumbers.filter(n => n === trimmed).length > 1;
      }),
      negatives: negatives.map((n) => {
        const trimmed = n.trim();
        if (!trimmed) return false;
        return negativesNumbers.filter(num => num === trimmed).length > 1;
      }),
      hasAnyDuplicate: hasDuplicateGA || hasDuplicatePositives || hasDuplicateNegatives
    };
  }, [scorerNumber, assistNumber, assist2Number, positives, negatives]);

  const handleSaveClick = () => {
    // Validate scorer is required
    if (!scorerNumber.trim()) {
      toast({ title: "Goleador Requerido", description: "Debes ingresar el número del jugador que anotó.", variant: "destructive" });
      return;
    }

    if (duplicateChecker.hasAnyDuplicate) {
      toast({ title: "Valores Duplicados", description: "No puedes tener jugadores repetidos.", variant: "destructive" });
      return;
    }

    const selectedPlayer = teamData?.players.find(p => p.number === scorerNumber.trim());
    const selectedAssistPlayer = teamData?.players.find(p => p.number === assistNumber.trim());
    const selectedAssist2Player = teamData?.players.find(p => p.number === assist2Number.trim());

    const positivesData = positives
      .map((num, idx) => num.trim() ? { playerNumber: num.trim(), playerName: teamData?.players.find(p => p.number === num.trim())?.name } : null)
      .filter(p => p !== null);

    const negativesData = negatives
      .map((num, idx) => num.trim() ? { playerNumber: num.trim(), playerName: opposingTeamData?.players.find(p => p.number === num.trim())?.name } : null)
      .filter(p => p !== null);

    const updates: Partial<GoalLog> = {
      scorer: { playerNumber: scorerNumber.trim(), playerName: selectedPlayer?.name },
      assist: assistNumber.trim() ? { playerNumber: assistNumber.trim(), playerName: selectedAssistPlayer?.name } : undefined,
      assist2: assist2Number.trim() ? { playerNumber: assist2Number.trim(), playerName: selectedAssist2Player?.name } : undefined,
      positives: positivesData.length > 0 ? positivesData : undefined,
      negatives: negativesData.length > 0 ? negativesData : undefined,
    };

    dispatch({ type: 'EDIT_GOAL', payload: { goalId: goal.id, updates } });

    // Close edit mode after state updates
    setTimeout(() => {
      toast({ title: "Gol Actualizado", description: "Los cambios han sido guardados." });
      onSave();
    }, 50);
  };

  return (
    <Card className="bg-card/80 border-primary/50">
      <CardContent className="p-4 space-y-3">
        {/* Goleador y Asistentes */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs"># Gol (Requerido)</Label>
            <Input
              value={scorerNumber}
              onChange={(e) => { if (/^\d*$/.test(e.target.value)) setScorerNumber(e.target.value); }}
              className={duplicateChecker.scorer ? "border-red-500 border-2" : (scorerNumber.trim() ? "border-green-500 border-2" : "")}
              placeholder="Ej: 99"
              required
            />
            {selectedPlayer && (
              <p className="text-xs text-muted-foreground mt-1 truncate" title={selectedPlayer.name}>
                {selectedPlayer.name}
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs"># Asist 1</Label>
            <Input
              value={assistNumber}
              onChange={(e) => { if (/^\d*$/.test(e.target.value)) setAssistNumber(e.target.value); }}
              className={duplicateChecker.assist ? "border-red-500 border-2" : (assistNumber.trim() ? "border-green-500 border-2" : "")}
              placeholder="Opc."
            />
            {selectedAssistPlayer && (
              <p className="text-xs text-muted-foreground mt-1 truncate" title={selectedAssistPlayer.name}>
                {selectedAssistPlayer.name}
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs"># Asist 2</Label>
            <Input
              value={assist2Number}
              onChange={(e) => { if (/^\d*$/.test(e.target.value)) setAssist2Number(e.target.value); }}
              className={duplicateChecker.assist2 ? "border-red-500 border-2" : (assist2Number.trim() ? "border-green-500 border-2" : "")}
              placeholder="Opc."
            />
            {selectedAssist2Player && (
              <p className="text-xs text-muted-foreground mt-1 truncate" title={selectedAssist2Player.name}>
                {selectedAssist2Player.name}
              </p>
            )}
          </div>
        </div>

        {/* Positivas */}
        <div>
          <Label className="text-xs font-semibold">Positivas</Label>
          <div className="grid grid-cols-5 gap-1 mt-1">
            {positives.map((pos, idx) => {
              const isReadonly = (idx === 0 && scorerNumber.trim()) ||
                               (idx === 1 && assistNumber.trim()) ||
                               (idx === 2 && assist2Number.trim());
              const isDuplicate = duplicateChecker.positives[idx];
              const isComplete = pos.trim();

              let className = "text-xs ";
              if (isReadonly) className += "bg-muted";
              else if (isDuplicate) className += "border-red-500 border-2";
              else if (isComplete) className += "border-green-500 border-2";

              return (
                <div key={idx}>
                  <Input
                    value={pos}
                    onChange={(e) => {
                      if (/^\d*$/.test(e.target.value) && !isReadonly) {
                        const newPositives = [...positives];
                        newPositives[idx] = e.target.value;
                        setPositives(newPositives);
                      }
                    }}
                    placeholder={`#${idx + 1}`}
                    readOnly={isReadonly}
                    className={className}
                  />
                  {selectedPositivePlayers[idx] && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate" title={selectedPositivePlayers[idx]?.name}>
                      {selectedPositivePlayers[idx]?.name}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Negativas */}
        <div>
          <Label className="text-xs font-semibold">Negativas</Label>
          <div className="grid grid-cols-5 gap-1 mt-1">
            {negatives.map((neg, idx) => (
              <div key={idx}>
                <Input
                  value={neg}
                  onChange={(e) => {
                    if (/^\d*$/.test(e.target.value)) {
                      const newNegatives = [...negatives];
                      newNegatives[idx] = e.target.value;
                      setNegatives(newNegatives);
                    }
                  }}
                  placeholder={`#${idx + 1}`}
                  className={`text-xs ${duplicateChecker.negatives[idx] ? "border-red-500 border-2" : (neg.trim() ? "border-green-500 border-2" : "")}`}
                />
                {selectedNegativePlayers[idx] && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate" title={selectedNegativePlayers[idx]?.name}>
                    {selectedNegativePlayers[idx]?.name}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={handleSaveClick} className="text-green-500 hover:text-green-600">
            <CheckCircle className="mr-1 h-4 w-4" /> Guardar
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-destructive hover:text-destructive/80">
            <XCircle className="mr-1 h-4 w-4" /> Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const QRTooltipContent = ({ title, url, ipAddress, ipLabel, status, isConnecting, onConnect, onDisconnect }: { title: string; url: string; ipAddress?: string; ipLabel?: string; status: TunnelState['status']; isConnecting?: boolean; onConnect?: () => void; onDisconnect?: () => void; }) => {
    const { toast } = useToast();
    const [remotePassword, setRemotePassword] = useState<string | null>('cargando...');
    const [combinedInfoQrValue, setCombinedInfoQrValue] = useState('');


    useEffect(() => {
        const fetchPassword = async () => {
            try {
                const res = await fetch('/api/public-ip');
                if (res.ok) {
                    const data = await res.json();
                    setRemotePassword(data.password || 'Error');
                } else {
                    setRemotePassword('Error');
                }
            } catch {
                setRemotePassword('Error');
            }
        };
        fetchPassword();
    }, []);

    useEffect(() => {
        if (ipAddress && remotePassword && !remotePassword.includes('cargando')) {
            const qrText = `Clave de túnel: ${ipAddress}\nClave de acceso: ${remotePassword}`;
            setCombinedInfoQrValue(qrText);
        } else {
            setCombinedInfoQrValue('');
        }
    }, [ipAddress, remotePassword]);


    const handleCopyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text).then(() => {
        toast({ title: "Copiado", description: `${label} copiado al portapapeles.` });
        }, () => {
        toast({ title: "Error al Copiar", description: `No se pudo copiar: ${label}`, variant: "destructive" });
        });
    };
    
    if (status === 'error') {
       return (
            <div className="flex flex-col items-center gap-4 p-4 bg-popover text-popover-foreground text-center">
                <p className="font-semibold text-lg">{title}</p>
                <div className="p-2 text-sm text-destructive">
                    <p>Error de conexión.</p>
                </div>
                 <div className="flex gap-2">
                    {onDisconnect && (
                         <Button onClick={onDisconnect} disabled={isConnecting} size="sm" variant="outline" className="mt-2">
                           {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PowerOff className="mr-2 h-4 w-4" />}
                           Desconectar
                         </Button>
                    )}
                    {onConnect && (
                      <Button onClick={onConnect} disabled={isConnecting} size="sm" className="mt-2">
                        {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
                        Reconectar
                      </Button>
                    )}
                 </div>
            </div>
        );
    }

    if (!url) {
        return (
            <div className="flex flex-col items-center gap-4 p-4 bg-popover text-popover-foreground text-center">
                 <p className="font-semibold text-lg">{title}</p>
                 <div className="p-2 text-sm">
                    <p>{status === 'disconnected' ? 'Túnel no conectado.' : (status === 'connecting' ? 'Conectando...' : 'Generando URL...')}</p>
                    {status === 'disconnected' && onConnect && (
                      <Button onClick={onConnect} disabled={isConnecting} size="sm" className="mt-2">
                        {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
                        Conectar
                      </Button>
                    )}
                 </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-4 p-4 bg-popover text-popover-foreground w-64">
            <p className="font-semibold text-lg">{title}</p>
             <div className="flex items-end gap-2">
                <div className="bg-white p-2 rounded-md">
                    <QRCodeSVG value={url} size={140} />
                </div>
                {combinedInfoQrValue && (
                    <div className="bg-white p-1 rounded-md">
                        <QRCodeSVG value={combinedInfoQrValue} size={50} />
                    </div>
                )}
            </div>
             {ipAddress && (
                 <div className="w-full text-center">
                    <p className="text-sm font-medium">{ipLabel || "Clave de Túnel (IP Pública):"}</p>
                    <div className="flex items-center justify-between mt-1 p-2 bg-muted rounded-md text-muted-foreground font-mono">
                        <span className="truncate">{ipAddress}</span>
                    </div>
                </div>
            )}
            <div className="w-full text-center">
                <p className="text-sm font-medium">Clave de Acceso Remoto</p>
                <div className="flex items-center justify-between mt-1 p-2 bg-muted rounded-md text-muted-foreground font-mono">
                    <span className="truncate">{remotePassword}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopyToClipboard(remotePassword || '', 'Clave de Acceso')}>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            </div>
             <Button variant="link" size="sm" onClick={() => handleCopyToClipboard(url, 'URL')} className="-mb-2">
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copiar URL de conexión
             </Button>
        </div>
    );
};

const parseUserAgent = (uaString?: string): string => {
    if (!uaString) return 'Dispositivo Desconocido';
    
    // Simple parser for demonstration
    if (uaString.includes('Android')) return 'Chrome en Android';
    if (uaString.includes('iPhone') || uaString.includes('iPad')) return 'Safari en iOS';
    if (uaString.includes('Macintosh')) return 'Navegador en Mac';
    if (uaString.includes('Windows')) return 'Navegador en Windows';
    
    return 'Dispositivo Desconocido';
};


// TEMPORARILY DISABLED: AccessRequestManager to reduce server polling
// Uncomment this component if you need the access request approval feature
/*
const AccessRequestManager = () => {
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const { toast } = useToast();

    const fetchRequests = useCallback(async () => {
        try {
            const res = await fetch('/api/auth-challenge');
            if (res.ok) {
                const data = await res.json();
                setRequests(data.requests || []);
            }
        } catch (e) {
            console.warn("Could not fetch access requests", e);
        }
    }, []);

    useEffect(() => {
        fetchRequests();
        const interval = setInterval(fetchRequests, 5000); // Poll for new requests
        return () => clearInterval(interval);
    }, [fetchRequests]);

    const handleApprove = async (requestId: string) => {
        try {
            const res = await fetch('/api/auth-challenge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'approve', requestId }),
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: "Acceso Aprobado", description: `Se ha concedido acceso al dispositivo.` });
                fetchRequests(); // Refresh the list
            } else {
                toast({ title: "Error", description: data.message || "No se pudo aprobar la solicitud.", variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error de Red", description: "No se pudo comunicar con el servidor.", variant: "destructive" });
        }
    };

    const handleReject = async (requestId: string) => {
        try {
            await fetch('/api/auth-challenge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reject', requestId }),
            });
            toast({ title: "Solicitud Rechazada" });
            fetchRequests(); // Refresh list
        } catch (e) {
            toast({ title: "Error de Red", variant: "destructive" });
        }
    };

    if (requests.length === 0) return null;

    return (
        <Popover>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                            <Button variant="destructive" className="fixed top-20 right-4 z-50 animate-pulse">
                                Pedido de Acceso ({requests.length})
                            </Button>
                        </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                        <p>Hay usuarios remotos esperando tu aprobación para acceder a los controles.</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <PopoverContent className="w-80">
                <div className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Solicitudes Pendientes</h4>
                        <p className="text-sm text-muted-foreground">
                            Aprueba o rechaza el acceso para los usuarios remotos.
                        </p>
                    </div>
                    <div className="grid gap-2">
                        {requests.map((req) => (
                            <div key={req.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 p-2 border rounded-md">
                                <div className="flex items-center gap-2 truncate">
                                    <Fingerprint className="h-5 w-5 text-blue-400 shrink-0"/>
                                    <div className="truncate">
                                      <span className="text-sm font-semibold text-primary">{req.verificationNumber}</span>
                                      <span className="text-xs text-muted-foreground ml-2 truncate" title={req.userAgent}>
                                        {parseUserAgent(req.userAgent)}
                                      </span>
                                    </div>
                                </div>
                                <Button size="icon" className="h-7 w-7 bg-green-600 hover:bg-green-700" onClick={() => handleApprove(req.id)}>
                                    <Check className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => handleReject(req.id)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};
*/


export default function ControlsPage() {
  const { state, dispatch, isLoading: isGameStateLoading } = useGameState();
  const { authStatus } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [pageDisplayState, setPageDisplayState] = useState<PageDisplayState>('Checking');
  const [currentLockHolderId, setCurrentLockHolderId] = useState<string | null>(null);
  
  const [instanceId, setInstanceId] = useState<string | null>(null);
  
  const channelRef = useRef<BroadcastChannel | null>(null);
  
  const [isGoalManagementOpen, setIsGoalManagementOpen] = useState(false);
  const [editingTeamForGoals, setEditingTeamForGoals] = useState<Team | null>(null);
  const [isGoldenGoalDialogOpen, setIsGoldenGoalDialogOpen] = useState(false);
  
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  const [localIp, setLocalIp] = useState<string | null>(null);
  const [publicIp, setPublicIp] = useState<string | null>(null);
  const [localPort, setLocalPort] = useState<string>('');
  const [isConnectingTunnel, setIsConnectingTunnel] = useState(false);
  const [isShootoutConfirmOpen, setIsShootoutConfirmOpen] = useState(false);
  
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    setInstanceId(safeUUID());
    if (typeof window !== 'undefined') {
        setLocalPort(window.location.port);
    }

    const fetchIps = async () => {
        try {
            const [localRes, publicRes] = await Promise.all([
                fetch('/api/local-ip'),
                fetch('/api/public-ip')
            ]);
            if (localRes.ok) {
                const data = await localRes.json();
                setLocalIp(data.ip || null);
            }
            if (publicRes.ok) {
                const data = await publicRes.json();
                setPublicIp(data.ip || null);
            }
        } catch (error) {
            console.warn("Could not fetch IP addresses for QR codes.", error);
        }
    };
    fetchIps();

  }, []);

  const checkLockStatus = useCallback(() => {
    if (!instanceId) {
      return;
    }
    const lockIdFromStorage = localStorage.getItem(CONTROLS_LOCK_KEY);
    
    if (!lockIdFromStorage) {
      localStorage.setItem(CONTROLS_LOCK_KEY, instanceId);
      setCurrentLockHolderId(instanceId);
      setPageDisplayState('Primary');
    } else if (lockIdFromStorage === instanceId) {
      setPageDisplayState('Primary');
      setCurrentLockHolderId(instanceId);
    } else {
      setPageDisplayState('Secondary');
      setCurrentLockHolderId(lockIdFromStorage);
    }
  }, [instanceId, setPageDisplayState, setCurrentLockHolderId]);


  useEffect(() => {
    if (!instanceId) return; 
    
    setPageDisplayState('Checking'); 

    if (!channelRef.current) {
      channelRef.current = new BroadcastChannel(CONTROLS_CHANNEL_NAME);
    }

    const handleChannelMessage = (message: MessageEvent) => {
      if (!instanceId) return;
      if (message.data?.type === 'TAKEOVER_COMMAND') {
        if (message.data.newPrimaryId !== instanceId) {
          router.push('/');
        } else {
          setPageDisplayState('Primary');
          setCurrentLockHolderId(instanceId);
        }
      } else if (message.data?.type === 'LOCK_RELEASED') {
        if (message.data.releasedBy !== instanceId) {
          checkLockStatus();
        }
      }
    };
    channelRef.current.onmessage = handleChannelMessage;

    const handleStorageChange = (event: StorageEvent) => {
      if (!instanceId) return;
      if (event.key === CONTROLS_LOCK_KEY) {
        checkLockStatus();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const handleBeforeUnload = () => {
      if (!instanceId) return;
      const currentLockIdInStorage = localStorage.getItem(CONTROLS_LOCK_KEY);
      if (currentLockIdInStorage === instanceId) {
        localStorage.removeItem(CONTROLS_LOCK_KEY);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    checkLockStatus();

    return () => {
      if (!instanceId) return;
      
      const currentLockIdInStorage = localStorage.getItem(CONTROLS_LOCK_KEY);
      if (currentLockIdInStorage === instanceId) {
        localStorage.removeItem(CONTROLS_LOCK_KEY);
        if (channelRef.current) { 
             channelRef.current.postMessage({ type: 'LOCK_RELEASED', releasedBy: instanceId });
        }
      }
      
      if (channelRef.current) {
        channelRef.current.close(); 
        channelRef.current = null;
      }
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [instanceId, checkLockStatus, router]);


  // Effect for listening to remote commands from the server
  useEffect(() => {
    if (pageDisplayState !== 'Primary') {
      return;
    }

    const eventSource = new EventSource('/api/remote-commands/events');

    eventSource.onopen = () => {
        // Handle connection opened if needed
    };

    eventSource.onmessage = (event) => {
      try {
        if (!event.data) return;
        const command: RemoteCommand = JSON.parse(event.data);
        const { live: currentLive, config: currentConfig } = stateRef.current;
        
        if (!currentLive || !currentConfig) {
            console.warn("Received remote command but state is not ready. Ignoring.");
            return;
        }

        if (command.type === 'ADD_GOAL') {
          const { team, scorerNumber, assistNumber } = command.payload;
          
          const selectedTournament = (currentConfig.tournaments || []).find(t => t.id === currentConfig.selectedTournamentId);
          const teamData = selectedTournament?.teams.find(t => t.name === currentLive[`${team}TeamName`] && (t.subName || undefined) === (currentLive[`${team}TeamSubName`] || undefined) && t.category === currentConfig.selectedMatchCategory);
          const scorerPlayer = teamData?.players.find(p => p.number === scorerNumber);
          const assistPlayer = assistNumber ? teamData?.players.find(p => p.number === assistNumber) : undefined;
          
          const goalPayload: Omit<GoalLog, 'id'> = {
            team,
            timestamp: Date.now(),
            gameTime: currentLive.clock.currentTime,
            periodText: getActualPeriodText(currentLive.clock.currentPeriod, currentLive.clock.periodDisplayOverride, currentConfig.numberOfRegularPeriods, currentLive.shootout),
            scorer: { playerNumber: scorerNumber, playerName: scorerPlayer?.name },
            assist: assistNumber ? { playerNumber: assistNumber, playerName: assistPlayer?.name } : undefined,
          };

          dispatch({ type: 'ADD_GOAL', payload: goalPayload });
          toast({ title: "Gol Añadido (Remoto)", description: `Gol para ${team === 'home' ? currentLive.homeTeamName : currentLive.awayTeamName} #${scorerNumber} registrado.` });
        } else if (command.type === 'ADD_PENALTY') {
          const { team, playerNumber, penaltyTypeId } = command.payload;
          const penaltyDef = currentConfig.penaltyTypes.find(p => p.id === penaltyTypeId);
          if (penaltyDef) {
            dispatch({
                type: 'ADD_PENALTY',
                payload: {
                  team,
                  penalty: { playerNumber, penaltyTypeId },
                },
            });
            toast({ title: "Penalidad Añadida (Remoto)", description: `Jugador #${playerNumber} de ${team === 'home' ? currentLive.homeTeamName : currentLive.awayTeamName} recibió una penalidad de ${penaltyDef.name}.` });
          }
        } else if (command.type === 'ADD_SHOT') {
            const { team, playerNumber } = command.payload;
            dispatch({ type: 'ADD_PLAYER_SHOT', payload: { team, playerNumber } });
            toast({
              title: "Tiro Registrado (Remoto)",
              description: `Tiro para el jugador #${playerNumber} del equipo ${team === 'home' ? currentLive.homeTeamName : currentLive.awayTeamName}.`,
              duration: 1500,
            });
        } else if (command.type === 'ACTIVATE_PENDING_PUCK_PENALTIES') {
            dispatch({ type: 'ACTIVATE_PENDING_PUCK_PENALTIES' });
            toast({ title: "Puck en Juego (Remoto)", description: "Se activaron las penalidades pendientes." });
        }
      } catch (e) {
        console.error("Failed to parse remote command from server event:", e);
      }
    };

    eventSource.onerror = () => {
      // Don't console.error to avoid noise
    };

    return () => {
      eventSource.close();
    };
  }, [pageDisplayState, dispatch, toast, reconnectTrigger]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (pageDisplayState !== 'Primary') {
        return;
      }

      if (event.code === 'Space' || event.key === ' ') {
        const activeElement = document.activeElement as HTMLElement;

        // Solo ignorar el espacio en TEXTAREA, SELECT y contentEditable
        // Los INPUT numéricos ahora permitirán que el espacio controle el reloj
        if (
          activeElement &&
          (activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT' ||
            activeElement.isContentEditable ||
            activeElement.getAttribute?.('role') === 'button')
        ) {
          return;
        }

        event.preventDefault();
        dispatch({ type: 'TOGGLE_CLOCK' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dispatch, pageDisplayState]);


  const handleTakeOver = useCallback(() => {
    if (!instanceId) {
      toast({ title: "Error", description: "No se pudo obtener el ID de la instancia. Intenta recargar.", variant: "destructive" });
      return;
    }
    localStorage.setItem(CONTROLS_LOCK_KEY, instanceId);
    if (channelRef.current) {
      channelRef.current.postMessage({ type: 'TAKEOVER_COMMAND', newPrimaryId: instanceId });
    }
    setCurrentLockHolderId(instanceId);
    setPageDisplayState('Primary'); 
    toast({ title: "Control Adquirido", description: "Esta pestaña ahora es la principal para los controles." });
  }, [instanceId, toast, setCurrentLockHolderId, setPageDisplayState]);

  const handleActivatePendingPuckPenalties = () => {
    dispatch({ type: 'ACTIVATE_PENDING_PUCK_PENALTIES' });
  };
  
  const shouldShowPendingPuckButton = useMemo(() => {
    if (state.config.autoActivatePuckPenalties) return false;
    const hasPending = state.live.penalties.home.some(p => p._status === 'pending_puck') ||
                       state.live.penalties.away.some(p => p._status === 'pending_puck');
    return hasPending;
  }, [state.live.penalties, state.config.autoActivatePuckPenalties]);


  const handleScoreClick = (team: Team) => {
    setEditingTeamForGoals(team);
    setIsGoalManagementOpen(true);
  };
  
  const isOvertime = state.live.clock.currentPeriod > state.config.numberOfRegularPeriods && state.live.clock.periodDisplayOverride === null;
  const handleFinishByGoldenGoal = () => {
    if (state.live.clock.isClockRunning) {
        dispatch({ type: 'TOGGLE_CLOCK' });
    }
    if (state.live.score.home === state.live.score.away) {
        setIsGoldenGoalDialogOpen(true);
    } else {
        dispatch({ type: 'MANUAL_END_GAME' });
        toast({ title: "Partido Finalizado", description: "El juego ha sido finalizado manualmente." });
    }
  };

  const handleTunnelConnect = async () => {
    setIsConnectingTunnel(true);
    dispatch({ type: 'UPDATE_TUNNEL_STATE', payload: { status: 'connecting', lastMessage: null } });

    try {
      const response = await fetch('/api/localtunnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', port: state.config.tunnel.port }),
      });

      const data = await response.json();

      if (data.success) {
        dispatch({ type: 'UPDATE_TUNNEL_STATE', payload: { status: 'connected', url: data.url, lastMessage: data.message || null, subdomain: data.subdomain || null } });
        toast({
          title: "Túnel Conectado",
          description: data.url ? `Accesible en: ${data.url}` : 'El túnel se ha conectado.',
        });
      } else {
        dispatch({ type: 'UPDATE_TUNNEL_STATE', payload: { status: 'error', lastMessage: data.message } });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error de red.';
      dispatch({ type: 'UPDATE_TUNNEL_STATE', payload: { status: 'error', lastMessage: errorMessage } });
    } finally {
        setIsConnectingTunnel(false);
    }
  };

  const handleTunnelDisconnect = async () => {
      setIsConnectingTunnel(true);
      dispatch({ type: 'UPDATE_TUNNEL_STATE', payload: { status: 'connecting', lastMessage: null } });
      try {
        const response = await fetch('/api/localtunnel', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }),
        });
        const data = await response.json();
        if (data.success) {
            dispatch({ type: 'UPDATE_TUNNEL_STATE', payload: { status: 'disconnected', url: null, subdomain: null, lastMessage: data.message || 'Desconectado.' } });
            toast({ title: "Túnel Desconectado" });
        } else {
            dispatch({ type: 'UPDATE_TUNNEL_STATE', payload: { status: 'error', lastMessage: data.message || "Error al desconectar." } });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error de red.';
        dispatch({ type: 'UPDATE_TUNNEL_STATE', payload: { status: 'error', lastMessage: errorMessage } });
      } finally {
        setIsConnectingTunnel(false);
      }
  };

  const statusIndicators = useMemo(() => {
    const tunnelStatus = state.config.tunnel.status || 'disconnected';
    const isLocalIpReady = !!(localIp && !localIp.includes('Error'));
    
    return {
        local: {
            status: isLocalIpReady ? 'connected' : 'error',
            text: 'Control Remoto - Local',
            className: isLocalIpReady ? 'bg-blue-600 hover:bg-blue-700' : 'bg-destructive hover:bg-destructive/90',
            dotClassName: isLocalIpReady ? 'bg-white' : 'bg-white/50 animate-pulse'
        },
        internet: {
            status: tunnelStatus,
            text: 'Control Remoto - Internet',
            className: tunnelStatus === 'connected' ? 'bg-green-600 hover:bg-green-700' : (tunnelStatus === 'error' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-gray-500 hover:bg-gray-600'),
            dotClassName: tunnelStatus === 'connected' ? 'bg-white' : (tunnelStatus === 'error' ? 'bg-white animate-pulse' : 'bg-black/50')
        }
    };
  }, [state.config.tunnel, localIp]);

  const localUrl = (localIp && localPort) ? `http://${localIp}:${localPort}/mobile-controls/login` : '';
  const tunnelUrl = state.config.tunnel.status === 'connected' && state.config.tunnel.url ? `${state.config.tunnel.url}/mobile-controls/login` : '';
  
  // Health check for tunnel
  useEffect(() => {
    if (pageDisplayState !== 'Primary' || state.config.tunnel.status !== 'connected') {
      return;
    }

    const healthCheckInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/localtunnel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'health-check' }),
        });
        if (response.ok) {
            const data = await response.json();
            if (data.status === 'error') {
                dispatch({ type: 'UPDATE_TUNNEL_STATE', payload: { status: 'error', lastMessage: data.message || 'El túnel no responde.' } });
            }
        }
      } catch(e) {
         dispatch({ type: 'UPDATE_TUNNEL_STATE', payload: { status: 'error', lastMessage: 'Error de red al verificar el túnel.' } });
      }
    }, 20000); // Check every 20 seconds

    return () => clearInterval(healthCheckInterval);

  }, [pageDisplayState, state.config.tunnel.status, dispatch]);


  const handleAddExtraOvertime = () => {
    dispatch({ type: 'ADD_EXTRA_OVERTIME' });
    toast({ title: "Overtime Extra Añadido", description: "Se ha añadido un período de OT y se ha iniciado un descanso." });
  };
  
  const handleFinalizeAsTie = () => {
    dispatch({ type: 'FINISH_SHOOTOUT' });
    toast({ title: "Partido Finalizado", description: "El juego ha sido finalizado como empate." });
  }

  const isAwaitingDecision = state.live.clock.periodDisplayOverride === 'AwaitingDecision';

  const performStartShootout = () => {
    dispatch({ type: 'START_SHOOTOUT' });
    toast({ title: "Tanda de Penales Iniciada" });
    setIsShootoutConfirmOpen(false);
  };

  const handlePrepareStartShootout = () => {
    setIsShootoutConfirmOpen(true);
  };

  const showStoppedTimeAlert = useMemo(() => {
    const { config, live } = state;
    if (!config.enableStoppedTimeAlert || !live) return false;
    
    const isLastRegularPeriod = live.clock.currentPeriod === config.numberOfRegularPeriods;
    const isTimeConditionMet = live.clock.currentTime <= config.stoppedTimeAlertTimeRemaining * 60 * 100;
    const isGoalDiffConditionMet = Math.abs(live.score.home - live.score.away) <= config.stoppedTimeAlertGoalDiff;

    return isLastRegularPeriod && isTimeConditionMet && isGoalDiffConditionMet && live.clock.periodDisplayOverride === null;
  }, [state]);
  
  const handleTogglePuckAutomation = () => {
      const currentSetting = state.config.autoActivatePuckPenalties;
      const newSetting = !currentSetting;
      dispatch({ type: 'UPDATE_SELECTED_FT_PROFILE_DATA', payload: { autoActivatePuckPenalties: newSetting } });
      toast({
          title: "Modo de Activación Cambiado",
          description: `Las penalidades ahora se activarán de forma ${newSetting ? 'automática' : 'manual'}.`
      });
  };

  const finishedFixtureMatch = useMemo(() => {
      if (state.live.clock.periodDisplayOverride !== 'End of Game' || !state.live.matchId) {
          return null;
      }
      const tournament = state.config.tournaments.find(t => t.id === state.config.selectedTournamentId);
      if (!tournament || !tournament.matches) return null;
      return tournament.matches.find(m => m.id === state.live.matchId);
  }, [state.live.clock.periodDisplayOverride, state.live.matchId, state.config.tournaments, state.config.selectedTournamentId]);


  if (authStatus === 'loading' || isGameStateLoading || !state.live || !state.config || !state.live.penalties) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
        <HockeyPuckSpinner className="h-24 w-24 text-primary mb-4" />
        <p className="text-xl text-foreground">Cargando...</p>
      </div>
    );
  }
  
  if (authStatus === 'unauthenticated') {
    router.replace('/mobile-controls/login');
    return (
       <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive-foreground">Acceso Denegado</h1>
        <p className="text-muted-foreground mt-2">No tienes permisos para ver esta página. Redirigiendo al login...</p>
        <Button onClick={() => router.push('/mobile-controls/login')} className="mt-4">
            <LogIn className="mr-2 h-4 w-4" /> Ir a Login
        </Button>
      </div>
    );
  }


  if (pageDisplayState === 'Checking' || !instanceId) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
        <HockeyPuckSpinner className="h-12 w-12 text-primary mb-4" />
        <p className="text-xl text-foreground">Verificando instancia de controles...</p>
        <p className="text-sm text-muted-foreground">Esto tomará un momento.</p>
      </div>
    );
  }

  if (pageDisplayState === 'Secondary') {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-6 rounded-lg shadow-xl bg-card max-w-md mx-auto">
        <AlertTriangle className="h-16 w-16 text-destructive mb-6" />
        <h1 className="text-2xl font-bold text-destructive-foreground mb-3">Múltiples Pestañas de Controles</h1>
        <p className="text-lg text-card-foreground mb-4">
          Ya existe otra pestaña o instancia de Controles activa. Para evitar problemas, solo una puede estar activa.
        </p>
        <div className="space-y-3 w-full max-w-xs">
           <Button onClick={handleTakeOver} className="w-full">
            Tomar el Control Principal en esta Pestaña
          </Button>
          <Button variant="outline" onClick={() => router.push('/')} className="w-full">
            Ir al Scoreboard
          </Button>
        </div>
      </div>
    );
  }
  
  const isShootoutActive = state.live.shootout.isActive;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8">
      {showStoppedTimeAlert && (
          <div className="my-4 p-4 text-center bg-yellow-500 text-yellow-900 font-bold rounded-lg animate-pulse">
              ¡ATENCIÓN! Se debe frenar el reloj mientras el puck no está en juego!
          </div>
      )}
      <MiniScoreboard onScoreClick={handleScoreClick} />

      <PenaltyNotifications />


      {finishedFixtureMatch && (
        <div className="my-4 flex justify-center">
            <Button
                onClick={() => {
                    const matchDate = formatDate(new Date(finishedFixtureMatch.date), 'yyyy-MM-dd');
                    router.push(`/tournaments/${state.config.selectedTournamentId}?tab=fixture&view=list&date=${matchDate}`);
                }}
                size="lg"
            >
                <FileText className="mr-2 h-5 w-5" /> Ver Resumen del Partido
            </Button>
        </div>
      )}

      {isShootoutActive && <ShootoutControl />}

      {shouldShowPendingPuckButton && (
        <div className="my-6 flex justify-center">
          <Button
            variant="destructive"
            size="lg"
            className="px-8 py-4 text-base font-semibold h-auto" 
            onClick={handleActivatePendingPuckPenalties}
          >
            <PlayCircle className="mr-2 h-5 w-5" /> 
            ACTIVAR PENALIDADES (PUCK EN JUEGO)
          </Button>
        </div>
      )}

      {isOvertime && (
        <div className="my-6 flex justify-center">
          <Button
            size="lg"
            className="px-8 py-4 text-base font-semibold h-auto bg-amber-500 hover:bg-amber-600 text-black"
            onClick={handleFinishByGoldenGoal}
          >
            <Trophy className="mr-2 h-5 w-5" /> 
            Finalizar por Gol de Oro
          </Button>
        </div>
      )}
      
      {isAwaitingDecision && (
          <div className="flex flex-col items-center gap-2 mt-4 p-4 border-2 border-dashed rounded-lg">
            <h3 className="text-lg font-bold text-center mb-2">Definición de Partido</h3>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                onClick={handleAddExtraOvertime}
                className="bg-blue-600 hover:bg-blue-700"
                aria-label="Añadir Overtime Extra"
              >
                <PlusCircle className="mr-2 h-5 w-5" /> Añadir Overtime Extra
              </Button>
              <Button
                onClick={handlePrepareStartShootout}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Swords className="mr-2 h-5 w-5" />
                Ir a Tanda de Penales
              </Button>
               <Button
                onClick={handleFinalizeAsTie}
                variant="destructive"
              >
                <Flag className="mr-2 h-5 w-5" /> Finalizar Partido (Empate)
              </Button>
            </div>
          </div>
      )}

      {!isShootoutActive && (
        <Tabs defaultValue="penalties" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="penalties">Penalidades</TabsTrigger>
            <TabsTrigger value="goals">Goles</TabsTrigger>
          </TabsList>

          <TabsContent value="penalties">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PenaltyControlCard team="home" teamName={state.live.homeTeamName} />
              <PenaltyControlCard team="away" teamName={state.live.awayTeamName} />
            </div>
          </TabsContent>

          <TabsContent value="goals">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Goals display will go here */}
              <GoalsDisplayCard
                team="home"
                teamName={state.live.homeTeamName}
                goals={state.live.goals.home || []}
                onAddGoal={() => handleScoreClick('home')}
              />
              <GoalsDisplayCard
                team="away"
                teamName={state.live.awayTeamName}
                goals={state.live.goals.away || []}
                onAddGoal={() => handleScoreClick('away')}
              />
            </div>
          </TabsContent>
        </Tabs>
      )}

      <div className="mt-12 pt-8 border-t border-border">
         <div className="flex flex-wrap gap-4 items-start">
            <Button variant="outline" className="flex-shrink-0" onClick={() => router.push('/setup')}>
              <RefreshCw className="mr-2 h-4 w-4" /> Iniciar Nuevo Partido
            </Button>
        </div>
         <p className="text-xs text-muted-foreground mt-2">
          La acción "Iniciar Nuevo Partido" te llevará a una página para configurar los equipos y reglas del partido.
        </p>
      </div>

      {/* Connection Status Indicators */}
      <div className="fixed bottom-4 right-4 flex flex-col items-end gap-2 z-50">
          {/* <AccessRequestManager /> */}
           <TooltipProvider delayDuration={100}>
              <Tooltip>
                 <TooltipTrigger asChild>
                    <Badge
                        onClick={handleTogglePuckAutomation}
                        className={cn(
                            "flex items-center gap-2 transition-all cursor-pointer",
                             state.config.autoActivatePuckPenalties
                                ? "bg-green-600 hover:bg-green-700 text-white"
                                : "bg-amber-500 hover:bg-amber-600 text-black"
                        )}
                    >
                      <PlayCircle className="h-3 w-3" />
                      <span className="text-xs">
                          Esperando Puck - {state.config.autoActivatePuckPenalties ? 'Automático' : 'Manual'}
                      </span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                      <p>Clic para cambiar. <span className="font-bold">Automático:</span> las penalidades empiezan al descontar.</p>
                      <p><span className="font-bold">Manual:</span> requiere "Puck en Juego" para iniciar.</p>
                  </TooltipContent>
              </Tooltip>
              <Tooltip>
                  <TooltipTrigger asChild>
                      <Badge className={cn("flex items-center gap-2 transition-all text-white cursor-help", statusIndicators.local.className)}>
                          <span className={cn("h-2 w-2 rounded-full", statusIndicators.local.dotClassName)}></span>
                          <span className="text-xs">{statusIndicators.local.text}</span>
                      </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="p-0 border-none bg-transparent shadow-none">
                       <QRTooltipContent 
                          title="Conexión de Red Local" 
                          url={localUrl} 
                          status={statusIndicators.local.status}
                       />
                  </TooltipContent>
              </Tooltip>
              <Tooltip>
                  <TooltipTrigger asChild>
                      <Badge className={cn("flex items-center gap-2 transition-all cursor-help", statusIndicators.internet.className, statusIndicators.internet.status === 'error' ? 'text-black' : 'text-white')}>
                          <span className={cn("h-2 w-2 rounded-full", statusIndicators.internet.dotClassName)}></span>
                          <span className="text-xs">{statusIndicators.internet.text}</span>
                      </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="p-0 border-none bg-transparent shadow-none">
                        <QRTooltipContent 
                            title="Conexión por Internet" 
                            url={tunnelUrl} 
                            ipAddress={publicIp ?? 'cargando...'}
                            ipLabel="Clave de Túnel (IP Pública)"
                            status={state.config.tunnel.status}
                            isConnecting={isConnectingTunnel}
                            onConnect={handleTunnelConnect}
                            onDisconnect={handleTunnelDisconnect}
                        />
                  </TooltipContent>
              </Tooltip>
          </TooltipProvider>
      </div>


      {isGoalManagementOpen && (
        <GoalManagementDialog 
            isOpen={isGoalManagementOpen} 
            onOpenChange={(isOpen) => {
              if (isOpen) {
                setIsGoalManagementOpen(true);
              } else {
                setTimeout(() => setIsGoalManagementOpen(false), 150);
              }
            }}
            team={editingTeamForGoals}
        />
      )}

      {isGoldenGoalDialogOpen && (
          <GoldenGoalDialog
              isOpen={isGoldenGoalDialogOpen}
              onOpenChange={(isOpen) => {
                if (isOpen) {
                  setIsGoldenGoalDialogOpen(true);
                } else {
                  setTimeout(() => setIsGoldenGoalDialogOpen(false), 150);
                }
              }}
          />
      )}

      <AlertDialog open={isShootoutConfirmOpen} onOpenChange={setIsShootoutConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Inicio de Tanda de Penales</AlertDialogTitle>
              <AlertDialogDescription>
                Esto iniciará el modo de tanda de penales (shootout). El reloj principal y las penalidades se pausarán. ¿Estás seguro?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsShootoutConfirmOpen(false)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={performStartShootout}>
                Confirmar e Iniciar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

    
