
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useGameState, getPeriodText, type Team, type GoalLog, type PlayerData, getActualPeriodText, formatTime } from "@/contexts/game-state-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, PlusCircle, CheckCircle, XCircle, Goal, Edit3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";


interface GoalManagementDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  team: Team | null;
}

function AddGoalForm({ team, onGoalAdded, disabled }: { team: Team, onGoalAdded: () => void, disabled: boolean }) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const [scorerNumber, setScorerNumber] = useState('');
  const [assistNumber, setAssistNumber] = useState('');
  const [assist2Number, setAssist2Number] = useState('');
  const [positives, setPositives] = useState<string[]>(['', '', '', '', '']);
  const [negatives, setNegatives] = useState<string[]>(['', '', '', '', '']);

  const teamData = useMemo(() => {
    if (!state.config || !state.live || !state.config.tournaments) return null;
    const selectedTournament = state.config.tournaments.find(t => t.id === state.config.selectedTournamentId);
    if (!selectedTournament || !selectedTournament.teams) return null;

    const teamName = team === 'home' ? state.live.homeTeamName : state.live.awayTeamName;
    const teamSubName = team === 'home' ? state.live.homeTeamSubName : state.live.awayTeamSubName;
    return selectedTournament.teams.find(t => t.name === teamName && (t.subName || undefined) === (teamSubName || undefined) && t.category === state.config.selectedMatchCategory);
  }, [team, state.live, state.config]);

  const opposingTeamData = useMemo(() => {
    if (!state.config || !state.live || !state.config.tournaments) return null;
    const selectedTournament = state.config.tournaments.find(t => t.id === state.config.selectedTournamentId);
    if (!selectedTournament || !selectedTournament.teams) return null;

    const opposingTeamName = team === 'home' ? state.live.awayTeamName : state.live.homeTeamName;
    const opposingTeamSubName = team === 'home' ? state.live.awayTeamSubName : state.live.homeTeamSubName;
    return selectedTournament.teams.find(t => t.name === opposingTeamName && (t.subName || undefined) === (opposingTeamSubName || undefined) && t.category === state.config.selectedMatchCategory);
  }, [team, state.live, state.config]);

  const selectedPlayer = useMemo(() => teamData?.players.find(p => p.number === scorerNumber), [teamData, scorerNumber]);
  const selectedAssistPlayer = useMemo(() => teamData?.players.find(p => p.number === assistNumber), [teamData, assistNumber]);
  const selectedAssist2Player = useMemo(() => teamData?.players.find(p => p.number === assist2Number), [teamData, assist2Number]);

  const getPlayersByNumbers = (numbers: string[], fromOpposingTeam = false) => {
    const sourceTeam = fromOpposingTeam ? opposingTeamData : teamData;
    return numbers.map(num => num ? sourceTeam?.players.find(p => p.number === num) : null);
  };
  const selectedPositivePlayers = useMemo(() => getPlayersByNumbers(positives, false), [teamData, positives]);
  const selectedNegativePlayers = useMemo(() => getPlayersByNumbers(negatives, true), [opposingTeamData, negatives]);

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
      positives: positives.map((p, idx) => {
        const trimmed = p.trim();
        if (!trimmed) return false;
        return positivesNumbers.filter(n => n === trimmed).length > 1;
      }),
      negatives: negatives.map((n, idx) => {
        const trimmed = n.trim();
        if (!trimmed) return false;
        return negativesNumbers.filter(num => num === trimmed).length > 1;
      }),
      hasAnyDuplicate: hasDuplicateGA || hasDuplicatePositives || hasDuplicateNegatives
    };
  }, [scorerNumber, assistNumber, assist2Number, positives, negatives]);

  // Auto-complete positives when goleador/asistentes change
  useEffect(() => {
    const newPositives = [...positives];
    if (scorerNumber.trim()) {
      newPositives[0] = scorerNumber.trim();
    } else {
      newPositives[0] = '';
    }
    if (assistNumber.trim()) {
      newPositives[1] = assistNumber.trim();
    } else {
      newPositives[1] = '';
    }
    if (assist2Number.trim()) {
      newPositives[2] = assist2Number.trim();
    } else {
      newPositives[2] = '';
    }
    setPositives(newPositives);
  }, [scorerNumber, assistNumber, assist2Number]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.live || !state.config) return;

    const { periodDisplayOverride } = state.live.clock;
    if (disabled || (periodDisplayOverride && periodDisplayOverride !== 'Time Out')) {
        toast({ title: "Acción no permitida", description: "No se pueden agregar goles durante el calentamiento, descansos o con el partido finalizado.", variant: "destructive" });
        return;
    }

    // Block if there are duplicates
    if (duplicateChecker.hasAnyDuplicate) {
        toast({ title: "Valores Duplicados", description: "No puedes tener jugadores repetidos en goleador/asistentes, positivas o negativas.", variant: "destructive" });
        return;
    }

    const trimmedScorerNumber = scorerNumber.trim();
    const trimmedAssistNumber = assistNumber.trim();
    const trimmedAssist2Number = assist2Number.trim();

    if (!trimmedScorerNumber) {
      toast({ title: "Número del Goleador Requerido", description: "Debes ingresar el número del jugador que anotó.", variant: "destructive" });
      return;
    }
    if (!/^\d+$/.test(trimmedScorerNumber)) {
      toast({ title: "Número de Goleador Inválido", description: "El número debe ser numérico.", variant: "destructive" });
      return;
    }

    // Validate assistentes
    const usedNumbers = new Set([trimmedScorerNumber]);
    if (trimmedAssistNumber) {
        if (!/^\d+$/.test(trimmedAssistNumber)) {
            toast({ title: "Número de Asistencia Inválido", description: "El número de la asistencia debe ser numérico.", variant: "destructive" });
            return;
        }
        if (usedNumbers.has(trimmedAssistNumber)) {
            toast({ title: "Jugador Duplicado", description: "Los jugadores no pueden repetirse.", variant: "destructive" });
            return;
        }
        usedNumbers.add(trimmedAssistNumber);
    }
    if (trimmedAssist2Number) {
        if (!/^\d+$/.test(trimmedAssist2Number)) {
            toast({ title: "Número de Asistencia 2 Inválido", description: "El número debe ser numérico.", variant: "destructive" });
            return;
        }
        if (usedNumbers.has(trimmedAssist2Number)) {
            toast({ title: "Jugador Duplicado", description: "Los jugadores no pueden repetirse.", variant: "destructive" });
            return;
        }
    }

    const payload: Omit<GoalLog, 'id'> = {
        team,
        timestamp: Date.now(),
        gameTime: state.live.clock.currentTime,
        periodText: getActualPeriodText(state.live.clock.currentPeriod, state.live.clock.periodDisplayOverride, state.config.numberOfRegularPeriods, state.live.shootout),
        scorer: {
          playerNumber: trimmedScorerNumber,
          playerName: selectedPlayer?.name,
        },
    };

    if (trimmedAssistNumber) {
        payload.assist = {
            playerNumber: trimmedAssistNumber,
            playerName: selectedAssistPlayer?.name,
        };
    }

    if (trimmedAssist2Number) {
        payload.assist2 = {
            playerNumber: trimmedAssist2Number,
            playerName: selectedAssist2Player?.name,
        };
    }

    // Add positives and negatives
    const positivesData = positives
      .map((num, idx) => num.trim() ? { playerNumber: num.trim(), playerName: selectedPositivePlayers[idx]?.name } : null)
      .filter(p => p !== null);
    if (positivesData.length > 0) {
      payload.positives = positivesData;
    }

    const negativesData = negatives
      .map((num, idx) => num.trim() ? { playerNumber: num.trim(), playerName: selectedNegativePlayers[idx]?.name } : null)
      .filter(p => p !== null);
    if (negativesData.length > 0) {
      payload.negatives = negativesData;
    }

    dispatch({ type: 'ADD_GOAL', payload });

    toast({ title: "Gol Añadido", description: `Gol para el jugador #${trimmedScorerNumber} registrado.` });
    setScorerNumber('');
    setAssistNumber('');
    setAssist2Number('');
    setPositives(['', '', '', '', '']);
    setNegatives(['', '', '', '', '']);
    onGoalAdded();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Añadir Nuevo Gol</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Goleador y Asistencias */}
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <Label htmlFor="new-scorer-number"># Goleador</Label>
                    <Input
                        id="new-scorer-number"
                        value={scorerNumber}
                        onChange={(e) => { if (/^\d*$/.test(e.target.value)) setScorerNumber(e.target.value); }}
                        placeholder="Ej: 99"
                        autoComplete="off"
                        disabled={disabled}
                        className={duplicateChecker.scorer ? "border-red-500 border-2" : (scorerNumber.trim() ? "border-green-500 border-2" : "")}
                    />
                    {selectedPlayer && <p className="text-xs text-muted-foreground mt-1 truncate" title={selectedPlayer.name}>Jugador: {selectedPlayer.name}</p>}
                </div>
                <div>
                    <Label htmlFor="new-assist-number"># Asist. 1</Label>
                    <Input
                        id="new-assist-number"
                        value={assistNumber}
                        onChange={(e) => { if (/^\d*$/.test(e.target.value)) setAssistNumber(e.target.value); }}
                        placeholder="(Opcional)"
                         autoComplete="off"
                         disabled={disabled}
                         className={duplicateChecker.assist ? "border-red-500 border-2" : (assistNumber.trim() ? "border-green-500 border-2" : "")}
                    />
                    {selectedAssistPlayer && <p className="text-xs text-muted-foreground mt-1 truncate" title={selectedAssistPlayer.name}>Asistente: {selectedAssistPlayer.name}</p>}
                </div>
                <div>
                    <Label htmlFor="new-assist2-number"># Asist. 2</Label>
                    <Input
                        id="new-assist2-number"
                        value={assist2Number}
                        onChange={(e) => { if (/^\d*$/.test(e.target.value)) setAssist2Number(e.target.value); }}
                        placeholder="(Opcional)"
                        autoComplete="off"
                        disabled={disabled}
                        className={duplicateChecker.assist2 ? "border-red-500 border-2" : (assist2Number.trim() ? "border-green-500 border-2" : "")}
                    />
                    {selectedAssist2Player && <p className="text-xs text-muted-foreground mt-1 truncate" title={selectedAssist2Player.name}>Asistente: {selectedAssist2Player.name}</p>}
                </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Las positivas se completarán automáticamente con el goleador y asistentes. Puedes editarlas más tarde desde el tab de Goles.
            </p>

            <Button type="submit" className="w-full" disabled={disabled}>
                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Gol
            </Button>
        </form>
      </CardContent>
    </Card>
  );
}


function EditableGoalItem({ goal }: { goal: GoalLog }) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  // Editing state
  const { minutes, seconds } = useMemo(() => {
    const totalSeconds = Math.floor(goal.gameTime / 100);
    return {
      minutes: Math.floor(totalSeconds / 60),
      seconds: totalSeconds % 60,
    };
  }, [goal.gameTime]);
  const [minInput, setMinInput] = useState(String(minutes).padStart(2, '0'));
  const [secInput, setSecInput] = useState(String(seconds).padStart(2, '0'));
  const [periodInput, setPeriodInput] = useState(goal.periodText);
  const [scorerNumberInput, setScorerNumberInput] = useState(goal.scorer?.playerNumber || '');
  const [assistNumberInput, setAssistNumberInput] = useState(goal.assist?.playerNumber || '');
  const [assist2NumberInput, setAssist2NumberInput] = useState(goal.assist2?.playerNumber || '');
  const [positivesInput, setPositivesInput] = useState<string[]>(
    goal.positives?.map(p => p?.playerNumber || '') || ['', '', '', '', '']
  );
  const [negativesInput, setNegativesInput] = useState<string[]>(
    goal.negatives?.map(n => n?.playerNumber || '') || ['', '', '', '', '']
  );

  const periodOptions = useMemo(() => {
    if (!state.config) return [];
    const options: { value: string, label: string }[] = [];
    const totalPeriods = state.config.numberOfRegularPeriods + state.config.numberOfOvertimePeriods;
    for (let i = 1; i <= totalPeriods; i++) {
        const periodText = getPeriodText(i, state.config.numberOfRegularPeriods);
        options.push({ value: periodText, label: periodText });
    }
    return options;
  }, [state.config]);

  useEffect(() => {
    if (!isEditing) {
      const totalSeconds = Math.floor(goal.gameTime / 100);
      setMinInput(String(Math.floor(totalSeconds / 60)).padStart(2, '0'));
      setSecInput(String(totalSeconds % 60).padStart(2, '0'));
      setPeriodInput(goal.periodText);
      setScorerNumberInput(goal.scorer?.playerNumber || '');
      setAssistNumberInput(goal.assist?.playerNumber || '');
      setAssist2NumberInput(goal.assist2?.playerNumber || '');
      const posArray = goal.positives?.map(p => p?.playerNumber || '') || [];
      while (posArray.length < 5) posArray.push('');
      setPositivesInput(posArray);

      const negArray = goal.negatives?.map(n => n?.playerNumber || '') || [];
      while (negArray.length < 5) negArray.push('');
      setNegativesInput(negArray);
    }
  }, [isEditing, goal]);

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

  // Player resolution
  const selectedScorerPlayer = useMemo(() => teamData?.players.find(p => p.number === scorerNumberInput), [teamData, scorerNumberInput]);
  const selectedAssistPlayer = useMemo(() => teamData?.players.find(p => p.number === assistNumberInput), [teamData, assistNumberInput]);
  const selectedAssist2Player = useMemo(() => teamData?.players.find(p => p.number === assist2NumberInput), [teamData, assist2NumberInput]);

  const getPlayersByNumbers = (numbers: string[], fromOpposingTeam = false) => {
    const sourceTeam = fromOpposingTeam ? opposingTeamData : teamData;
    return numbers.map(num => num ? sourceTeam?.players.find(p => p.number === num) : null);
  };
  const selectedPositivePlayers = useMemo(() => getPlayersByNumbers(positivesInput, false), [teamData, positivesInput]);
  const selectedNegativePlayers = useMemo(() => getPlayersByNumbers(negativesInput, true), [opposingTeamData, negativesInput]);

  // Detect duplicates
  const duplicateChecker = useMemo(() => {
    const goleadorAsistentes = [scorerNumberInput.trim(), assistNumberInput.trim(), assist2NumberInput.trim()].filter(n => n);
    const hasDuplicateGA = goleadorAsistentes.length !== new Set(goleadorAsistentes).size;

    const positivesNumbers = positivesInput.map(p => p.trim()).filter(n => n);
    const hasDuplicatePositives = positivesNumbers.length !== new Set(positivesNumbers).size;

    const negativesNumbers = negativesInput.map(n => n.trim()).filter(n => n);
    const hasDuplicateNegatives = negativesNumbers.length !== new Set(negativesNumbers).size;

    return {
      scorer: scorerNumberInput.trim() && goleadorAsistentes.filter(n => n === scorerNumberInput.trim()).length > 1,
      assist: assistNumberInput.trim() && goleadorAsistentes.filter(n => n === assistNumberInput.trim()).length > 1,
      assist2: assist2NumberInput.trim() && goleadorAsistentes.filter(n => n === assist2NumberInput.trim()).length > 1,
      positives: positivesInput.map((p) => {
        const trimmed = p.trim();
        if (!trimmed) return false;
        return positivesNumbers.filter(n => n === trimmed).length > 1;
      }),
      negatives: negativesInput.map((n) => {
        const trimmed = n.trim();
        if (!trimmed) return false;
        return negativesNumbers.filter(num => num === trimmed).length > 1;
      }),
      hasAnyDuplicate: hasDuplicateGA || hasDuplicatePositives || hasDuplicateNegatives
    };
  }, [scorerNumberInput, assistNumberInput, assist2NumberInput, positivesInput, negativesInput]);

  // Auto-complete positives when goleador/asistentes change
  useEffect(() => {
    if (!isEditing) return;
    setPositivesInput(prev => {
      const newPositives = [...prev];
      if (scorerNumberInput.trim()) {
        newPositives[0] = scorerNumberInput.trim();
      } else {
        newPositives[0] = '';
      }
      if (assistNumberInput.trim()) {
        newPositives[1] = assistNumberInput.trim();
      } else {
        newPositives[1] = '';
      }
      if (assist2NumberInput.trim()) {
        newPositives[2] = assist2NumberInput.trim();
      } else {
        newPositives[2] = '';
      }
      return newPositives;
    });
  }, [scorerNumberInput, assistNumberInput, assist2NumberInput, isEditing]);

  const handleSave = () => {
    // Check for duplicates first
    if (duplicateChecker.hasAnyDuplicate) {
      toast({ title: "Valores Duplicados", description: "No puedes tener jugadores repetidos en goleador/asistentes, positivas o negativas.", variant: "destructive" });
      return;
    }

    const trimmedScorerNumber = scorerNumberInput.trim();
    if (!trimmedScorerNumber || !/^\d+$/.test(trimmedScorerNumber)) {
      toast({ title: "Número de Goleador Inválido", description: "El número del goleador es requerido y debe ser numérico.", variant: "destructive" });
      return;
    }

    const trimmedAssistNumber = assistNumberInput.trim();
    if (trimmedAssistNumber && !/^\d+$/.test(trimmedAssistNumber)) {
      toast({ title: "Número de Asistencia Inválido", description: "El número de la asistencia debe ser numérico.", variant: "destructive" });
      return;
    }

    const trimmedAssist2Number = assist2NumberInput.trim();
    if (trimmedAssist2Number && !/^\d+$/.test(trimmedAssist2Number)) {
      toast({ title: "Número de Asistencia 2 Inválido", description: "El número debe ser numérico.", variant: "destructive" });
      return;
    }

    const mins = parseInt(minInput, 10) || 0;
    const secs = parseInt(secInput, 10) || 0;
    const newGameTime = (mins * 60 + secs) * 100;

    const scorerPlayer = teamData?.players.find(p => p.number === trimmedScorerNumber);

    const updates: Partial<GoalLog> = {};
    if (newGameTime !== goal.gameTime) updates.gameTime = newGameTime;
    if (periodInput !== goal.periodText) updates.periodText = periodInput;
    if (trimmedScorerNumber !== goal.scorer?.playerNumber) {
        updates.scorer = { playerNumber: trimmedScorerNumber, playerName: scorerPlayer?.name };
    }
    if (trimmedAssistNumber !== (goal.assist?.playerNumber || '') || (!trimmedAssistNumber && goal.assist)) {
        if (trimmedAssistNumber) {
            const assistPlayer = teamData?.players.find(p => p.number === trimmedAssistNumber);
            updates.assist = { playerNumber: trimmedAssistNumber, playerName: assistPlayer?.name };
        } else {
            updates.assist = undefined;
        }
    }
    if (trimmedAssist2Number !== (goal.assist2?.playerNumber || '') || (!trimmedAssist2Number && goal.assist2)) {
        if (trimmedAssist2Number) {
            const assist2Player = teamData?.players.find(p => p.number === trimmedAssist2Number);
            updates.assist2 = { playerNumber: trimmedAssist2Number, playerName: assist2Player?.name };
        } else {
            updates.assist2 = undefined;
        }
    }

    // Handle positives
    const positivesData = positivesInput
      .map((num, idx) => num.trim() ? { playerNumber: num.trim(), playerName: selectedPositivePlayers[idx]?.name } : null)
      .filter(p => p !== null);
    const currentPositivesData = goal.positives?.filter(p => p !== null) || [];
    const positivesChanged = JSON.stringify(positivesData) !== JSON.stringify(currentPositivesData);
    if (positivesChanged) {
      updates.positives = positivesData.length > 0 ? positivesData : undefined;
    }

    // Handle negatives
    const negativesData = negativesInput
      .map((num, idx) => num.trim() ? { playerNumber: num.trim(), playerName: selectedNegativePlayers[idx]?.name } : null)
      .filter(p => p !== null);
    const currentNegativesData = goal.negatives?.filter(n => n !== null) || [];
    const negativesChanged = JSON.stringify(negativesData) !== JSON.stringify(currentNegativesData);
    if (negativesChanged) {
      updates.negatives = negativesData.length > 0 ? negativesData : undefined;
    }

    if (Object.keys(updates).length > 0) {
        dispatch({ type: 'EDIT_GOAL', payload: { goalId: goal.id, updates } });
        toast({ title: "Gol Actualizado", description: "Los cambios en el gol han sido guardados." });
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    dispatch({ type: 'DELETE_GOAL', payload: { goalId: goal.id } });
    toast({ title: "Gol Eliminado", description: "El gol ha sido eliminado del registro." });
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const displayTimestamp = useMemo(() => {
    const date = new Date(goal.timestamp);
    if (isNaN(date.getTime())) return { time: '--:--', date: '--/--' };
    return {
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: date.toLocaleDateString([], { day: '2-digit', month: '2-digit' }),
    }
  }, [goal.timestamp]);

  if (isEditing) {
    return (
      <Card className="bg-card/80 border-primary/50">
        <CardContent className="p-3 space-y-3">
            {/* Time and Period */}
            <div className="flex items-center gap-2">
                <Input value={minInput} onChange={(e) => { if (/^\d{0,2}$/.test(e.target.value)) setMinInput(e.target.value); }} className="w-12 h-8 text-center" aria-label="Minutos del gol" />
                <span>:</span>
                <Input value={secInput} onChange={(e) => { if (/^\d{0,2}$/.test(e.target.value)) setSecInput(e.target.value); }} className="w-12 h-8 text-center" aria-label="Segundos del gol" />
                <Select value={periodInput} onValueChange={setPeriodInput}>
                    <SelectTrigger className="w-24 h-8 text-center justify-center">
                        <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                        {periodOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {/* Goleador y Asistentes */}
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <Label htmlFor={`scorer-${goal.id}`} className="text-xs"># Gol</Label>
                    <Input
                        id={`scorer-${goal.id}`}
                        value={scorerNumberInput}
                        onChange={(e) => { if (/^\d*$/.test(e.target.value)) setScorerNumberInput(e.target.value); }}
                        className={duplicateChecker.scorer ? "border-red-500 border-2" : (scorerNumberInput.trim() ? "border-green-500 border-2" : "")}
                        placeholder="Ej: 99"
                        autoComplete="off"
                    />
                    {selectedScorerPlayer && <p className="text-xs text-muted-foreground mt-1 truncate" title={selectedScorerPlayer.name}>{selectedScorerPlayer.name}</p>}
                </div>
                <div>
                    <Label htmlFor={`assist-${goal.id}`} className="text-xs"># Asist 1</Label>
                    <Input
                        id={`assist-${goal.id}`}
                        value={assistNumberInput}
                        onChange={(e) => { if (/^\d*$/.test(e.target.value)) setAssistNumberInput(e.target.value); }}
                        className={duplicateChecker.assist ? "border-red-500 border-2" : (assistNumberInput.trim() ? "border-green-500 border-2" : "")}
                        placeholder="Opc."
                        autoComplete="off"
                    />
                    {selectedAssistPlayer && <p className="text-xs text-muted-foreground mt-1 truncate" title={selectedAssistPlayer.name}>{selectedAssistPlayer.name}</p>}
                </div>
                <div>
                    <Label htmlFor={`assist2-${goal.id}`} className="text-xs"># Asist 2</Label>
                    <Input
                        id={`assist2-${goal.id}`}
                        value={assist2NumberInput}
                        onChange={(e) => { if (/^\d*$/.test(e.target.value)) setAssist2NumberInput(e.target.value); }}
                        className={duplicateChecker.assist2 ? "border-red-500 border-2" : (assist2NumberInput.trim() ? "border-green-500 border-2" : "")}
                        placeholder="Opc."
                        autoComplete="off"
                    />
                    {selectedAssist2Player && <p className="text-xs text-muted-foreground mt-1 truncate" title={selectedAssist2Player.name}>{selectedAssist2Player.name}</p>}
                </div>
            </div>

            {/* Positivas */}
            <div className="space-y-2">
                <Label className="text-xs font-semibold">Positivas</Label>
                <div className="grid grid-cols-5 gap-2">
                    {positivesInput.map((pos, idx) => {
                        const isReadonly = (idx === 0 && scorerNumberInput.trim()) ||
                                         (idx === 1 && assistNumberInput.trim()) ||
                                         (idx === 2 && assist2NumberInput.trim());
                        const isDuplicate = duplicateChecker.positives[idx];
                        const isComplete = pos.trim();

                        let className = "h-8 text-xs";
                        if (isReadonly) className += " bg-muted";
                        else if (isDuplicate) className += " border-red-500 border-2";
                        else if (isComplete) className += " border-green-500 border-2";

                        return (
                            <div key={idx}>
                                <Input
                                    value={pos}
                                    onChange={(e) => {
                                        if (/^\d*$/.test(e.target.value) && !isReadonly) {
                                            const newPositives = [...positivesInput];
                                            newPositives[idx] = e.target.value;
                                            setPositivesInput(newPositives);
                                        }
                                    }}
                                    placeholder={`#${idx + 1}`}
                                    autoComplete="off"
                                    readOnly={isReadonly}
                                    className={className}
                                />
                                {selectedPositivePlayers[idx] && <p className="text-xs text-muted-foreground mt-1 truncate" title={selectedPositivePlayers[idx]?.name}>{selectedPositivePlayers[idx]?.name}</p>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Negativas */}
            <div className="space-y-2">
                <Label className="text-xs font-semibold">Negativas</Label>
                <div className="grid grid-cols-5 gap-2">
                    {negativesInput.map((neg, idx) => {
                        const isDuplicate = duplicateChecker.negatives[idx];
                        const isComplete = neg.trim();

                        let className = "h-8 text-xs";
                        if (isDuplicate) className += " border-red-500 border-2";
                        else if (isComplete) className += " border-green-500 border-2";

                        return (
                            <div key={idx}>
                                <Input
                                    value={neg}
                                    onChange={(e) => {
                                        if (/^\d*$/.test(e.target.value)) {
                                            const newNegatives = [...negativesInput];
                                            newNegatives[idx] = e.target.value;
                                            setNegativesInput(newNegatives);
                                        }
                                    }}
                                    placeholder={`#${idx + 1}`}
                                    autoComplete="off"
                                    className={className}
                                />
                                {selectedNegativePlayers[idx] && <p className="text-xs text-muted-foreground mt-1 truncate" title={selectedNegativePlayers[idx]?.name}>{selectedNegativePlayers[idx]?.name}</p>}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex justify-end gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-600" onClick={handleSave}><CheckCircle className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/80" onClick={handleCancel}><XCircle className="h-5 w-5" /></Button>
            </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-4 flex-grow min-w-0">
            <div className="flex flex-col text-xs text-muted-foreground w-20 text-center shrink-0">
              <span>{displayTimestamp.time}</span>
              <span className="opacity-80">{displayTimestamp.date}</span>
            </div>
            <div className="flex-grow min-w-0">
              <p className="font-semibold text-card-foreground">
                Gol #{goal.scorer?.playerNumber || 'S/N'}
                {goal.scorer?.playerName && <span className="text-sm font-normal"> {goal.scorer.playerName}</span>}
                {goal.assist?.playerNumber && (
                  <span className="text-sm font-normal text-muted-foreground"> (Asist. #{goal.assist.playerNumber}{goal.assist.playerName ? ` ${goal.assist.playerName}` : ''})</span>
                )}
                {goal.assist2?.playerNumber && (
                  <span className="text-sm font-normal text-muted-foreground"> (Asist. 2 #{goal.assist2.playerNumber}{goal.assist2.playerName ? ` ${goal.assist2.playerName}` : ''})</span>
                )}
              </p>
              <p className="text-sm text-muted-foreground font-normal">
                {formatTime(goal.gameTime)} - {goal.periodText}
              </p>
              {goal.positives && goal.positives.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-semibold">Positivas:</span> {goal.positives.map(p => `#${p?.playerNumber}${p?.playerName ? ` ${p.playerName}` : ''}`).join(', ')}
                </p>
              )}
              {goal.negatives && goal.negatives.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-semibold">Negativas:</span> {goal.negatives.map(n => `#${n?.playerNumber}${n?.playerName ? ` ${n.playerName}` : ''}`).join(', ')}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="text-primary hover:text-primary/80 h-8 w-8" onClick={() => setIsEditing(true)}>
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function GoalManagementDialog({ isOpen, onOpenChange, team }: GoalManagementDialogProps) {
  const { state } = useGameState();

  if (!state.live || !state.config) return null;

  const teamName = team === 'home' ? state.live.homeTeamName : state.live.awayTeamName;

  if (!team) return null;

  const isActionDisabled = state.live.clock.periodDisplayOverride !== null && state.live.clock.periodDisplayOverride !== 'Time Out';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Añadir Gol: {teamName}</DialogTitle>
          <DialogDescription>
            Ingresa el goleador y asistentes. Las positivas se completarán automáticamente.
          </DialogDescription>
        </DialogHeader>

        <AddGoalForm team={team} onGoalAdded={() => onOpenChange(false)} disabled={isActionDisabled} />

        <DialogFooter className="border-t pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancelar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
