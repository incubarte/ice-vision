

"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useGameState, formatTime, getPeriodText, getPeriodContextFromAbsoluteTime } from '@/contexts/game-state-context';
import type { Penalty, Team, PenaltyTypeDefinition } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Trash2, UserPlus, Hourglass, ChevronsUpDown, Check, Info, Goal, X, Plus, Minus, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PenaltyLogDialog } from '../scoreboard/penalty-log-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from '@/components/ui/checkbox';
import { getActualPeriodText } from '@/contexts/game-state-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HockeyPuckSpinner } from '../ui/hockey-puck-spinner';
import { Separator } from '../ui/separator';


interface PenaltyControlCardProps {
  team: Team;
  teamName: string;
}

const CagedUserIcon = ({ size, className, isReducing, ...props }: { size: number; className?: string; isReducing: boolean; [key: string]: any }) => {
  // Si reduce: rojo, si no reduce: azul
  const strokeColor = isReducing ? "hsl(var(--destructive))" : "rgb(59, 130, 246)";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(className)}
      style={{ width: `${size}rem`, height: `${size}rem` }}
      {...props}
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" strokeWidth="2" stroke={strokeColor} />
      <circle cx="12" cy="7" r="4" strokeWidth="2" stroke={strokeColor} />
      <line x1="6" y1="2" x2="6" y2="22" strokeWidth="1" stroke="hsl(var(--muted-foreground))" opacity="0.5" />
      <line x1="10" y1="2" x2="10" y2="22" strokeWidth="1" stroke="hsl(var(--muted-foreground))" opacity="0.5" />
      <line x1="14" y1="2" x2="14" y2="22" strokeWidth="1" stroke="hsl(var(--muted-foreground))" opacity="0.5" />
      <line x1="18" y1="2" x2="18" y2="22" strokeWidth="1" stroke="hsl(var(--muted-foreground))" opacity="0.5" />
    </svg>
  );
};


const statusTextMap: Record<NonNullable<Penalty['_status']>, string> = {
    running: 'Corriendo',
    pending_concurrent: 'Esperando Slot',
    pending_puck: 'Esperando Puck',
};

const PenaltyItem = ({ penalty, team, isEditing, onEditStart, onEditConfirm, onEditCancel, isDeleteSelectionMode, isSelectedForDeletion, onToggleSelection, onDragStart, onDragEnter, onDragLeave, onDragOver, onDrop, onAdjust }: {
    penalty: Penalty;
    team: Team;
    isEditing: boolean;
    onEditStart: (penaltyId: string, currentTime: string) => void;
    onEditConfirm: (penaltyId: string, newTimeValue: string) => void;
    onEditCancel: () => void;
    isDeleteSelectionMode: boolean;
    isSelectedForDeletion: boolean;
    onToggleSelection: (penaltyId: string) => void;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, penaltyId: string) => void;
    onDragEnter: (e: React.DragEvent<HTMLDivElement>, penaltyId: string) => void;
    onDragLeave: () => void;
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>, targetPenaltyId: string) => void;
    onAdjust: (penaltyId: string, delta: number) => void;
}) => {
    const { state, dispatch } = useGameState();
    const [editTimeValue, setEditTimeValue] = useState('');

    const attendancePlayers = state.live.attendance[team] || [];

    const matchedPlayerForPenaltyDisplay = attendancePlayers.find(
      pData => pData.number === penalty.playerNumber || (penalty.playerNumber === "S/N" && !pData.number)
    );

    const getDisplayNumber = () => {
      if (penalty.isBenchPenalty) {
        return `Banco (#${penalty.playerNumber || 'S/N'})`;
      }
      return `#${penalty.playerNumber || 'S/N'}`;
    };
    
    const displayPenaltyNumber = getDisplayNumber();
    
    const remainingTimeCs = (penalty._status === 'running' && penalty.expirationTime !== undefined)
      ? Math.max(0, penalty.expirationTime - state.live.clock._liveAbsoluteElapsedTimeCs)
      : penalty.initialDuration * 100;

    const isWaitingSlot = penalty._status === 'pending_concurrent';
    const isPendingPuck = penalty._status === 'pending_puck';
    const statusText = isPendingPuck ? 'Esperando Puck' : (isWaitingSlot ? 'Esperando Slot' : null);
    const isEndingSoon = penalty._status === 'running' && remainingTimeCs > 0 && remainingTimeCs < 1000;

    const startTimeContext = penalty.startTime !== undefined 
        ? getPeriodContextFromAbsoluteTime(penalty.startTime, state) 
        : null;
    const expirationTimeContext = penalty.expirationTime !== undefined
        ? getPeriodContextFromAbsoluteTime(penalty.expirationTime, state)
        : null;
        
    const displayStatus = penalty._status ? statusTextMap[penalty._status] : 'Estado Desconocido';
    
    const ejectionMessage = useMemo(() => {
        if (!penalty._limitReached || penalty._limitReached.length === 0) return null;
        return ` - Expulsado`;
    }, [penalty._limitReached]);

    const penaltyLogDetails = state.live.penaltiesLog[team]?.find(p => p.id === penalty.id);
    const penaltyNameForTooltip = penaltyLogDetails?.penaltyName || "Tipo desconocido";


    const handleGoalEndPenalty = () => {
        dispatch({
            type: 'END_PENALTY_FOR_GOAL',
            payload: { team, penaltyId: penalty.id }
        });
    };

    const handleTogglePlayerReduction = () => {
      dispatch({
        type: 'TOGGLE_PENALTY_PLAYER_REDUCTION',
        payload: { team, penaltyId: penalty.id },
      });
    };
    
    // The penalty effectively reduces player count if its definition says so AND there's no override.
    const isEffectivelyReducingPlayerCount = penalty.reducesPlayerCount && !penalty._doesNotReducePlayerCountOverride;


    return (
        <Card
            draggable={!isEditing && !isDeleteSelectionMode}
            onDragStart={(e) => onDragStart(e, penalty.id)}
            onDragEnter={(e) => onDragEnter(e, penalty.id)}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, penalty.id)}
            onClick={() => isDeleteSelectionMode && onToggleSelection(penalty.id)}
            className={cn(
                "p-3 bg-muted/30 transition-all border",
                !isEditing && !isDeleteSelectionMode && "cursor-move",
                isDeleteSelectionMode && "cursor-pointer",
                isSelectedForDeletion && "ring-2 ring-destructive border-destructive bg-destructive/10",
                isWaitingSlot && "opacity-60 bg-muted/10",
                isPendingPuck && "opacity-40 bg-yellow-500/5 border-yellow-500/30",
                penalty._limitReached && "bg-amber-500/10 border-amber-500/40",
                isEndingSoon && !isEffectivelyReducingPlayerCount && "animate-flashing-border-blue border-2",
                isEndingSoon && isEffectivelyReducingPlayerCount && "animate-flashing-border border-2",
                !isEffectivelyReducingPlayerCount && !isEndingSoon && "border-blue-500/30"
            )}
        >
            <div className="flex justify-between items-center w-full gap-2">
                 <div className="flex items-center gap-3">
                    {isDeleteSelectionMode && (
                        <Checkbox
                            checked={isSelectedForDeletion}
                            onCheckedChange={() => onToggleSelection(penalty.id)}
                            aria-label={`Seleccionar penalidad del jugador ${penalty.playerNumber}`}
                            className="mr-2"
                        />
                    )}
                     <TooltipProvider delayDuration={200}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                 <button
                                    onClick={handleTogglePlayerReduction}
                                    disabled={isDeleteSelectionMode || isEditing}
                                    className="cursor-pointer rounded-full p-1 hover:bg-white/10"
                                >
                                    <CagedUserIcon size={1.75} isReducing={isEffectivelyReducingPlayerCount} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Clic para alternar si esta penalidad reduce</p>
                                <p>el número de jugadores en la cancha.</p>
                            </TooltipContent>
                        </Tooltip>
                         <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex-1 min-w-0 cursor-help flex items-center gap-2">
                                    <div>
                                        <p className="font-semibold text-card-foreground truncate flex items-center">
                                            {displayPenaltyNumber}
                                            {state.config.showAliasInPenaltyPlayerSelector && state.config.showAliasInControlsPenaltyList && matchedPlayerForPenaltyDisplay && matchedPlayerForPenaltyDisplay.name && !penalty.isBenchPenalty && (
                                                <span className="ml-1 text-xs text-muted-foreground font-normal">
                                                    - {matchedPlayerForPenaltyDisplay.name}
                                                </span>
                                            )}
                                             {ejectionMessage && <span className="font-bold text-lg text-destructive"> {ejectionMessage}</span>}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Total: {formatTime(penalty.initialDuration * 100)}
                                            {!isEffectivelyReducingPlayerCount && <span className="text-blue-400 font-semibold"> (No reduce)</span>}
                                        </p>
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="text-sm space-y-1">
                                    <p><strong>Tipo de Falta:</strong> {penaltyNameForTooltip}</p>
                                    <Separator className="my-1"/>
                                    {startTimeContext ? (
                                        <p>
                                            <strong>Inicio:</strong> {formatTime(startTimeContext.timeInPeriodCs)}
                                            <span className="text-muted-foreground"> ({startTimeContext.periodText})</span>
                                        </p>
                                    ) : (
                                        <p><strong>Inicio:</strong> Aún no ha comenzado</p>
                                    )}
                                    {expirationTimeContext ? (
                                        <p>
                                            <strong>Fin:</strong> {formatTime(expirationTimeContext.timeInPeriodCs)}
                                            <span className="text-muted-foreground"> ({expirationTimeContext.periodText})</span>
                                        </p>
                                    ) : (
                                        <p><strong>Fin:</strong> Pendiente</p>
                                    )}
                                    <p><strong>Estado:</strong> {displayStatus}</p>
                                    {ejectionMessage && (
                                        <p className="font-semibold text-destructive">Expulsado por cantidad de faltas.</p>
                                    )}
                                    <p className="text-xs text-muted-foreground pt-1 border-t mt-1">
                                      Absoluto: {penalty.startTime !== undefined ? formatTime(penalty.startTime) : 'N/A'} → {penalty.expirationTime !== undefined ? formatTime(penalty.expirationTime) : 'N/A'}
                                    </p>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => onAdjust(penalty.id, -1)}
                        disabled={isDeleteSelectionMode || isEditing}
                    >
                        <Minus className="h-4 w-4" />
                    </Button>
                    {isEditing ? (
                        <Input
                            type="text"
                            value={editTimeValue}
                            onChange={(e) => setEditTimeValue(e.target.value)}
                            onBlur={() => onEditConfirm(penalty.id, editTimeValue)}
                            onKeyDown={(e) => { if (e.key === 'Enter') onEditConfirm(penalty.id, editTimeValue); if (e.key === 'Escape') onEditCancel(); }}
                            className="w-20 h-8 text-center font-mono"
                            autoFocus
                            placeholder="MM:SS"
                        />
                    ) : (
                        <div
                            className="w-20 h-8 flex items-center justify-center font-mono text-lg cursor-pointer rounded-md hover:bg-white/10"
                            onClick={(e) => {
                                if (isDeleteSelectionMode) return;
                                e.stopPropagation();
                                onEditStart(penalty.id, formatTime(remainingTimeCs));
                                setEditTimeValue(formatTime(remainingTimeCs));
                            }}
                        >
                            {formatTime(remainingTimeCs)}
                        </div>
                    )}
                     <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => onAdjust(penalty.id, 1)}
                        disabled={isDeleteSelectionMode || isEditing}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                     {penalty.clearsOnGoal && penalty._status === 'running' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-500 hover:text-green-400"
                            onClick={handleGoalEndPenalty}
                            disabled={isDeleteSelectionMode || isEditing}
                            aria-label="Finalizar penalidad por gol"
                        >
                            <Goal className="h-5 w-5" />
                        </Button>
                    )}
                </div>
            </div>
            {statusText && (
                <div className={cn("text-xs italic mt-1 flex items-center", isPendingPuck ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground")}>
                    <Hourglass className="h-3 w-3 mr-1" />
                    {statusText}
                </div>
            )}
            {isEndingSoon && !isEffectivelyReducingPlayerCount && (
                <div className="text-xs font-semibold mt-1 flex items-center text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Entra con Puck Frenado - No suma jugadores
                </div>
            )}
        </Card>
    );
};

const PowerPlayGoalConfirmation = ({ onConfirm, onDismiss, penaltyNumber }: { onConfirm: () => void; onDismiss: () => void; penaltyNumber: string; }) => {
  return (
    <Card className="border-green-500/50 bg-green-900/20 mb-4 animate-in fade-in">
        <CardContent className="p-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-green-300">
                    <AlertTriangle className="h-5 w-5 text-green-400" />
                    <p>La penalidad de <strong>#{penaltyNumber}</strong> se eliminará por Gol. ¿Proceder?</p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={onConfirm} className="bg-green-600 hover:bg-green-700 text-white">Sí</Button>
                    <Button size="sm" variant="outline" onClick={onDismiss}>No</Button>
                </div>
            </div>
        </CardContent>
    </Card>
  );
};


export function PenaltyControlCard({ team, teamName }: PenaltyControlCardProps) {
  const { state, dispatch, isLoading } = useGameState();
  const [playerNumberForPenalty, setPlayerNumberForPenalty] = useState('');
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);
  const [penaltyTypeId, setPenaltyTypeId] = useState<string | null>(state.config.defaultPenaltyTypeId);
  const { toast } = useToast();

  const [draggedPenaltyId, setDraggedPenaltyId] = useState<string | null>(null);
  const [dragOverPenaltyId, setDragOverPenaltyId] = useState<string | null>(null);

  const [isPlayerPopoverOpen, setIsPlayerPopoverOpen] = useState(false);
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  const justSelectedPlayerRef = useRef(false);
  const [isLogOpen, setIsLogOpen] = useState(false);

  // New state for editing penalty time
  const [editingPenaltyId, setEditingPenaltyId] = useState<string | null>(null);
  
  const [isDeleteSelectionMode, setIsDeleteSelectionMode] = useState(false);
  const [selectedPenaltyIds, setSelectedPenaltyIds] = useState<string[]>([]);
  const [isMassDeleteConfirmOpen, setIsMassDeleteConfirmOpen] = useState(false);
  
  const pendingPPGoal = state.live.pendingPowerPlayGoal;

  // Set default penalty type when component loads or penalty types change
  useEffect(() => {
    setPenaltyTypeId(state.config.defaultPenaltyTypeId);
  }, [state.config.defaultPenaltyTypeId, state.config.penaltyTypes]);
  
  // Clear selection if penalty list changes
  useEffect(() => {
    setSelectedPenaltyIds([]);
  }, [state.live.penalties]);


  if (isLoading || !state.live || !state.config) {
    return (
      <Card className="bg-card shadow-md flex items-center justify-center min-h-[400px]">
        <HockeyPuckSpinner className="w-12 h-12 text-primary" />
      </Card>
    );
  }

  // Ordenar penalidades: primero las que reducen jugador, luego las que no
  // Dentro de cada grupo, mantener orden cronológico (las más recientes al final)
  const penalties = state.live.penalties[team]
    .map((penalty, index) => ({ penalty, originalIndex: index }))
    .sort((a, b) => {
      const aReduces = a.penalty.reducesPlayerCount && !a.penalty._doesNotReducePlayerCountOverride;
      const bReduces = b.penalty.reducesPlayerCount && !b.penalty._doesNotReducePlayerCountOverride;

      // Si a reduce y b no, a va primero (retorna -1)
      // Si b reduce y a no, b va primero (retorna 1)
      if (aReduces && !bReduces) return -1;
      if (!aReduces && bReduces) return 1;

      // Si ambos tienen el mismo estado, mantener orden original (cronológico)
      return a.originalIndex - b.originalIndex;
    })
    .map(item => item.penalty);

  const teamSubName = team === 'home' ? state.live.homeTeamSubName : state.live.awayTeamSubName;
  const attendancePlayers = useMemo(() => state.live.attendance[team] || [], [state.live.attendance, team]);

  const teamHasPlayers = useMemo(() => {
      if (!state.config.enablePlayerSelectionForPenalties) return false;
      return attendancePlayers.length > 0;
  }, [attendancePlayers, state.config.enablePlayerSelectionForPenalties]);

  const filteredPlayers = useMemo(() => {
    if (!teamHasPlayers) return [];
    let playersToFilter = attendancePlayers.filter(p => p.number && p.number.trim() !== '');
    playersToFilter.sort((a, b) => {
      const numA = parseInt(a.number, 10);
      const numB = parseInt(b.number, 10);
      if (isNaN(numA) || isNaN(numB)) {
        return a.number.localeCompare(b.number);
      }
      return numA - numB;
    });
    
    const searchTermLower = playerSearchTerm.toLowerCase();
    if (!searchTermLower.trim()) return playersToFilter;

    return playersToFilter.filter(
      (player) =>
        (player.number.toLowerCase().includes(searchTermLower)) ||
        (state.config.showAliasInPenaltyPlayerSelector && player.name.toLowerCase().includes(searchTermLower))
    );
  }, [attendancePlayers, teamHasPlayers, playerSearchTerm, state.config.showAliasInPenaltyPlayerSelector]);

  const handleAddPenalty = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPlayerNumberForPenalty = playerNumberForPenalty.trim();

    if (!trimmedPlayerNumberForPenalty || !penaltyTypeId) {
      toast({ title: "Error", description: "Número de jugador y tipo de falta son requeridos.", variant: "destructive" });
      return;
    }
    if (!/^\d+$/.test(trimmedPlayerNumberForPenalty) && !/^\d+[A-Za-z]*$/.test(trimmedPlayerNumberForPenalty)) {
       toast({ title: "Error", description: "El número de jugador para la penalidad debe ser numérico o un número seguido de letras (ej. 1, 23, 15A).", variant: "destructive" });
       return;
    }

    const penaltyDef = state.config.penaltyTypes.find(p => p.id === penaltyTypeId);
    if (!penaltyDef) {
        toast({ title: "Error", description: "Tipo de falta no encontrada.", variant: "destructive" });
        return;
    }
    
    dispatch({
      type: 'ADD_PENALTY',
      payload: {
        team,
        penalty: { 
          playerNumber: trimmedPlayerNumberForPenalty.toUpperCase(),
          penaltyTypeId,
        },
      },
    });
    toast({ title: "Penalidad Agregada", description: `Jugador ${trimmedPlayerNumberForPenalty.toUpperCase()}${selectedPlayerName ? ` (${selectedPlayerName})` : ''} de ${teamName} recibió una penalidad de ${penaltyDef.name}.` });
    
    setPlayerNumberForPenalty('');
    setSelectedPlayerName(null);
    setPlayerSearchTerm('');
    setPenaltyTypeId(state.config.defaultPenaltyTypeId);
  };
  
  const handleSetPenaltyTime = (penaltyId: string, newTimeValue: string) => {
    const parts = newTimeValue.split(':');
    let minutes = 0;
    let seconds = 0;

    if (parts.length === 2) {
      minutes = parseInt(parts[0], 10);
      seconds = parseInt(parts[1], 10);
    } else if (parts.length === 1) {
      seconds = parseInt(parts[0], 10);
    }

    if (isNaN(minutes) || isNaN(seconds)) {
      toast({ title: "Tiempo Inválido", description: "Por favor, usa el formato MM:SS o solo segundos.", variant: "destructive" });
      setEditingPenaltyId(null);
      return;
    }

    const totalSeconds = (minutes * 60) + seconds;

    dispatch({
      type: 'SET_PENALTY_TIME',
      payload: { team, penaltyId, time: totalSeconds }
    });

    toast({ title: "Tiempo de Penalidad Establecido", description: `Tiempo actualizado a ${formatTime(totalSeconds * 100)}.` });
    
    setEditingPenaltyId(null);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, penaltyId: string) => {
    if (isDeleteSelectionMode) {
      e.preventDefault();
      return;
    }
    setDraggedPenaltyId(penaltyId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", penaltyId);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, penaltyId: string) => {
    if (isDeleteSelectionMode) return;
    e.preventDefault();
    setDragOverPenaltyId(penaltyId);
  };

  const handleDragLeave = () => {
    if (isDeleteSelectionMode) return;
    setDragOverPenaltyId(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (isDeleteSelectionMode) return;
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetPenaltyId: string) => {
    if (isDeleteSelectionMode) return;
    e.preventDefault();
    if (draggedPenaltyId && draggedPenaltyId !== targetPenaltyId) {
      const currentTeamPenalties = state.live.penalties[team];
      const startIndex = currentTeamPenalties.findIndex(p => p.id === draggedPenaltyId);
      const endIndex = currentTeamPenalties.findIndex(p => p.id === targetPenaltyId);

      if (startIndex !== -1 && endIndex !== -1) {
        dispatch({
          type: 'REORDER_PENALTIES',
          payload: { team, startIndex, endIndex },
        });
      }
    }
    setDraggedPenaltyId(null);
    setDragOverPenaltyId(null);
  };

  const handleDragEnd = () => {
    setDraggedPenaltyId(null);
    setDragOverPenaltyId(null);
  };
  
  const handleToggleSelectionMode = () => {
    setIsDeleteSelectionMode(!isDeleteSelectionMode);
    setSelectedPenaltyIds([]); // Clear selection when toggling mode
  };
  
  const handleTogglePenaltySelection = (penaltyId: string) => {
    setSelectedPenaltyIds(prev =>
      prev.includes(penaltyId)
        ? prev.filter(id => id !== penaltyId)
        : [...prev, penaltyId]
    );
  };

  const handleConfirmMassDelete = () => {
    if (selectedPenaltyIds.length === 0) return;
    
    selectedPenaltyIds.forEach(penaltyId => {
      dispatch({ type: 'REMOVE_PENALTY', payload: { team, penaltyId } });
    });

    toast({
      title: "Penalidades Eliminadas",
      description: `${selectedPenaltyIds.length} penalidad(es) eliminada(s).`,
      variant: "destructive"
    });

    setIsMassDeleteConfirmOpen(false);
    setIsDeleteSelectionMode(false);
    setSelectedPenaltyIds([]);
  };
  
  const handleConfirmPowerPlayGoal = () => {
    if (!pendingPPGoal) return;
    dispatch({ type: 'END_PENALTY_FOR_GOAL', payload: { team: pendingPPGoal.team, penaltyId: pendingPPGoal.penaltyId } });
  };
  
  const handleDismissPowerPlayGoal = () => {
    dispatch({ type: 'CLEAR_PENDING_POWER_PLAY_GOAL' });
  };


  const renderPlayerNumberInput = () => {
    if (teamHasPlayers && attendancePlayers.length > 0) {
      return (
        <Popover
            open={isPlayerPopoverOpen}
            onOpenChange={(isOpen) => {
                setIsPlayerPopoverOpen(isOpen);
                if (isOpen) {
                    setPlayerSearchTerm(''); 
                }
                justSelectedPlayerRef.current = false; 
            }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={isPlayerPopoverOpen}
              className="w-full justify-between"
            >
              {playerNumberForPenalty || selectedPlayerName
                ? (
                  <span className="truncate flex items-baseline">
                    <span className="text-xs text-muted-foreground mr-0.5">#</span>
                    <span className="font-semibold">{playerNumberForPenalty || 'S/N'}</span>
                    {(state.config.showAliasInPenaltyPlayerSelector && selectedPlayerName) && (
                      <span className="text-xs text-muted-foreground ml-1 truncate"> - {selectedPlayerName}</span>
                    )}
                  </span>
                )
                : <span className="truncate">Nº Jugador <span className="text-foreground/70"> / Seleccionar...</span></span>
              }
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar Nº o Nombre..."
                value={playerSearchTerm}
                onValueChange={setPlayerSearchTerm}
                autoComplete="off"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmedSearch = playerSearchTerm.trim().toUpperCase();
                        if (filteredPlayers.length > 0) {
                            const playerToSelect = filteredPlayers[0];
                            setPlayerNumberForPenalty(playerToSelect.number);
                            setSelectedPlayerName(playerToSelect.name);
                        } else if (trimmedSearch && (/^\d+$/.test(trimmedSearch) || /^\d+[A-Za-z]*$/.test(trimmedSearch))) {
                           setPlayerNumberForPenalty(trimmedSearch);
                           setSelectedPlayerName(null);
                        }
                        justSelectedPlayerRef.current = true;
                        setIsPlayerPopoverOpen(false);
                    }
                }}
              />
              <CommandList>
                <CommandEmpty>
                  No se encontró jugador.
                  {playerSearchTerm.trim() && (/^\d+$/.test(playerSearchTerm.trim()) || /^\d+[A-Za-z]*$/.test(playerSearchTerm.trim())) && (
                     <p className="text-xs text-muted-foreground p-2">Enter para usar: #{playerSearchTerm.trim().toUpperCase()}</p>
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {filteredPlayers.map((player) => (
                    <CommandItem
                      key={player.name}
                      value={`${player.number} - ${state.config.showAliasInPenaltyPlayerSelector ? player.name : ''}`}
                      onSelect={() => {
                        setPlayerNumberForPenalty(player.number);
                        setSelectedPlayerName(player.name);
                        justSelectedPlayerRef.current = true;
                        setIsPlayerPopoverOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          (playerNumberForPenalty === player.number && selectedPlayerName === player.name)
                           ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="text-xs text-muted-foreground mr-0.5">#</span>
                      <span className="font-semibold text-sm mr-1">{player.number}</span>
                      {state.config.showAliasInPenaltyPlayerSelector && player.name && (
                         <span className="text-xs text-muted-foreground truncate">{player.name}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      );
    }
    return (
      <Input
        id={`${team}-playerNumberForPenalty`}
        value={playerNumberForPenalty}
        onChange={(e) => {
            setPlayerNumberForPenalty(e.target.value.toUpperCase());
            setSelectedPlayerName(null);
        }}
        placeholder="ej., 99 o 15A"
        required
        autoComplete="off"
      />
    );
  };
  
  const penaltyForConfirmation = pendingPPGoal ? state.live.penalties[pendingPPGoal.team].find(p => p.id === pendingPPGoal.penaltyId) : null;


  return (
    <>
    <Card className="bg-card shadow-md">
       <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl text-primary-foreground">{`Penalidades ${teamName}${teamSubName ? ` (${teamSubName})` : ''}`}</CardTitle>
          <div className="flex items-center gap-2">
            {!isDeleteSelectionMode && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={handleToggleSelectionMode}
                disabled={penalties.length === 0}
                aria-label="Seleccionar penalidades para eliminar"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary-foreground"
              onClick={() => setIsLogOpen(true)}
              aria-label="Ver registro de penalidades"
            >
              <Info className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
      {!isDeleteSelectionMode && (
        <form onSubmit={handleAddPenalty} className="space-y-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <div className="sm:col-span-1">
              <Label htmlFor={`${team}-playerNumberForPenalty`}>Jugador # (Penalidad)</Label>
              {renderPlayerNumberInput()}
            </div>
            <div className="sm:col-span-1">
              <Label htmlFor={`${team}-penaltyType`}>Tipo de Falta</Label>
              <Select value={penaltyTypeId || ""} onValueChange={setPenaltyTypeId}>
                <SelectTrigger id={`${team}-penaltyType`}>
                  <SelectValue placeholder="Seleccionar tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {(state.config.penaltyTypes || []).map((type: PenaltyTypeDefinition) => (
                    <SelectItem key={type.id} value={type.id}>{type.name} ({formatTime(type.duration * 100)})</SelectItem>
                  ))}
                  {(state.config.penaltyTypes || []).length === 0 && (
                    <SelectItem value="no-types" disabled>No hay tipos definidos</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full sm:w-auto sm:self-end" aria-label={`Agregar penalidad para ${teamName}`}>
              <UserPlus className="mr-2 h-4 w-4" /> Agregar
            </Button>
          </div>
        </form>
      )}
      
      {pendingPPGoal && pendingPPGoal.team === team && penaltyForConfirmation && (
          <PowerPlayGoalConfirmation
              onConfirm={handleConfirmPowerPlayGoal}
              onDismiss={handleDismissPowerPlayGoal}
              penaltyNumber={penaltyForConfirmation.playerNumber}
          />
      )}

      <div className="space-y-2">
        <Label>
          {isDeleteSelectionMode
            ? `Selecciona penalidades para eliminar (${selectedPenaltyIds.length} seleccionada/s)`
            : `Penalidades Activas (${penalties.length})`}
        </Label>
        {penalties.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin penalidades activas.</p>
        ) : (
          <div
            className="max-h-60 overflow-y-auto space-y-2 pr-2"
          >
            {penalties.map((p) => (
                <PenaltyItem
                    key={p.id}
                    penalty={p}
                    team={team}
                    isEditing={editingPenaltyId === p.id}
                    onEditStart={(id, time) => { setEditingPenaltyId(id); }}
                    onEditConfirm={handleSetPenaltyTime}
                    onEditCancel={() => setEditingPenaltyId(null)}
                    isDeleteSelectionMode={isDeleteSelectionMode}
                    isSelectedForDeletion={selectedPenaltyIds.includes(p.id)}
                    onToggleSelection={handleTogglePenaltySelection}
                    onDragStart={handleDragStart}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onAdjust={(penaltyId, delta) => {
                      dispatch({ type: 'ADJUST_PENALTY_TIME', payload: { team, penaltyId, delta } });
                    }}
                />
            ))}
          </div>
        )}
      </div>
      {isDeleteSelectionMode && (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={handleToggleSelectionMode}>
            <X className="mr-2 h-4 w-4" /> Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={selectedPenaltyIds.length === 0}
            onClick={() => setIsMassDeleteConfirmOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Eliminar Seleccionadas ({selectedPenaltyIds.length})
          </Button>
        </div>
      )}
      </CardContent>
    </Card>
      {isLogOpen && (
        <PenaltyLogDialog 
          isOpen={isLogOpen}
          onOpenChange={setIsLogOpen}
          team={team}
          teamName={teamName}
        />
      )}
      {isMassDeleteConfirmOpen && (
        <AlertDialog open={isMassDeleteConfirmOpen} onOpenChange={setIsMassDeleteConfirmOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Eliminación Múltiple</AlertDialogTitle>
                    <AlertDialogDescription>
                        ¿Estás seguro de que quieres eliminar las {selectedPenaltyIds.length} penalidades seleccionadas? Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsMassDeleteConfirmOpen(false)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmMassDelete} className="bg-destructive hover:bg-destructive/90">
                        Eliminar Penalidades
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
