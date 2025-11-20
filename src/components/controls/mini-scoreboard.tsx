
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGameState, formatTime, getActualPeriodText, getPeriodText, centisecondsToDisplayMinutes, getCategoryNameById, type TeamData } from '@/contexts/game-state-context';
import type { Team, PlayerData } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Minus, Play, Pause, ChevronLeft, ChevronRight, ChevronsRight, User, ListFilter, Search, ClipboardList, ChevronsUpDown, Check, TimerOff, PlusCircle, Swords, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
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
import { EditTeamPlayersDialog } from './edit-team-players-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


type EditingSegment = 'minutes' | 'seconds' | 'tenths';

interface MiniScoreboardProps {
  onScoreClick: (team: Team) => void;
}

export function MiniScoreboard({ onScoreClick }: MiniScoreboardProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();

  // Guard against rendering with incomplete state
  if (!state.live || !state.config) {
    return null; 
  }
  
  const isMatchFromFixture = !!state.live.matchId;
  const isWarmup = state.live.clock.periodDisplayOverride === 'Warm-up';

  const [pendingConfirmation, setPendingConfirmation] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const MAX_TOTAL_GAME_PERIODS = state.config.numberOfRegularPeriods + state.config.numberOfOvertimePeriods;

  const [editingSegment, setEditingSegment] = useState<EditingSegment | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [localHomeTeamName, setLocalHomeTeamName] = useState(state.live.homeTeamName);
  const [localHomeTeamSubName, setLocalHomeTeamSubName] = useState(state.live.homeTeamSubName);
  const [localAwayTeamName, setLocalAwayTeamName] = useState(state.live.awayTeamName);
  const [localAwayTeamSubName, setLocalAwayTeamSubName] = useState(state.live.awayTeamSubName);


  const [isHomeTeamSearchOpen, setIsHomeTeamSearchOpen] = useState(false);
  const [isAwayTeamSearchOpen, setIsAwayTeamSearchOpen] = useState(false);
  const [homeTeamSearchTerm, setHomeTeamSearchTerm] = useState('');
  const [awayTeamSearchTerm, setAwayTeamSearchTerm] = useState('');

  const [isHomePlayersDialogOpen, setIsHomePlayersDialogOpen] = useState(false);
  const [isAwayPlayersDialogOpen, setIsAwayPlayersDialogOpen] = useState(false);
  const [isTimeoutConfirmOpen, setIsTimeoutConfirmOpen] = useState(false);
  
  useEffect(() => {
    setLocalHomeTeamName(state.live.homeTeamName);
    setLocalHomeTeamSubName(state.live.homeTeamSubName);
  }, [state.live.homeTeamName, state.live.homeTeamSubName]);

  useEffect(() => {
    setLocalAwayTeamName(state.live.awayTeamName);
    setLocalAwayTeamSubName(state.live.awayTeamSubName);
  }, [state.live.awayTeamName, state.live.awayTeamSubName]);

  const getFlooredTimeParts = useCallback((timeCs: number) => {
    const safeTimeCs = Math.max(0, timeCs);
    const totalSecondsOnly = Math.floor(safeTimeCs / 100);
    const minutes = Math.floor(totalSecondsOnly / 60);
    const seconds = totalSecondsOnly % 60;
    const tenths = Math.floor((safeTimeCs % 100) / 10);
    return { minutes, seconds, tenths };
  }, []);
  
  const getDisplayTimeParts = useCallback((timeCs: number) => {
    const safeTimeCs = Math.max(0, timeCs);
    const isUnderMinute = safeTimeCs < 6000;
    
    let totalSecondsOnly;
    if (isUnderMinute) {
      // Don't round when under a minute
      totalSecondsOnly = Math.floor(safeTimeCs / 100);
    } else {
      // Round up otherwise
      totalSecondsOnly = Math.ceil(safeTimeCs / 100);
    }

    const minutes = Math.floor(totalSecondsOnly / 60);
    const seconds = totalSecondsOnly % 60;
    const tenths = Math.floor((safeTimeCs % 100) / 10);
    return { minutes, seconds, tenths };
  }, []);

  const timeParts = getFlooredTimeParts(state.live.clock.currentTime); 
  const displayTimeParts = getDisplayTimeParts(state.live.clock.currentTime);

  useEffect(() => {
    if (editingSegment && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingSegment]);

  const handleTimeAdjust = (deltaSeconds: number) => {
    if (state.live.clock.periodDisplayOverride === "End of Game") return;
    dispatch({ type: 'ADJUST_TIME', payload: deltaSeconds * 100 });
  };

  const handleToggleClock = () => {
    if (state.live.clock.periodDisplayOverride === "End of Game" || state.live.clock.isFlashingZero) return;
    setEditingSegment(null);
    const isFirstGameAction = state.live.clock.currentPeriod === 0 &&
                              state.live.clock.periodDisplayOverride === 'Warm-up' &&
                              state.live.clock.currentTime === state.config.defaultWarmUpDuration;
    const hasDefaultTeamNames = (state.live.homeTeamName.trim().toUpperCase() === 'LOCAL' || state.live.homeTeamName.trim() === '') ||
                                (state.live.awayTeamName.trim().toUpperCase() === 'VISITANTE' || state.live.awayTeamName.trim() === '');

    const toggleAction = () => {
      dispatch({ type: 'TOGGLE_CLOCK' });
    };

    if (!state.live.clock.isClockRunning && isFirstGameAction && hasDefaultTeamNames && state.config.enableTeamSelectionInMiniScoreboard) {
      checkAndConfirm(
        true,
        "Nombres de Equipo por Defecto",
        "Uno o ambos equipos aún tienen los nombres predeterminados ('Local', 'Visitante') o están vacíos. ¿Deseas iniciar la entrada en calor de todas formas o prefieres actualizar los nombres primero?",
        toggleAction
      );
    } else {
      toggleAction();
    }
  };

  const executeConfirmedAction = (actionFn: () => void) => {
    actionFn();
    setPendingConfirmation(null);
  };

  const cancelConfirmation = () => {
    setPendingConfirmation(null);
  };

  const checkAndConfirm = (
    condition: boolean,
    title: string,
    description: string,
    action: () => void
  ) => {
    if (condition) {
      setPendingConfirmation({ title, description, onConfirm: action });
    } else {
      action();
    }
  };

  const handlePreviousPeriod = () => {
    setEditingSegment(null);
    
    if (state.live.clock.periodDisplayOverride === "Time Out") {
      toast({ title: "Time Out Activo", description: "Finaliza el Time Out para cambiar de período.", variant: "destructive" });
      return;
    }
    
    if (state.live.clock.periodDisplayOverride === "End of Game") {
        const lastPlayedPeriodText = (state.live.playedPeriods || []).slice(-1)[0];
        if (lastPlayedPeriodText) {
            let lastPeriodNumber = 0;
            if (lastPlayedPeriodText.startsWith('OT')) {
                lastPeriodNumber = state.config.numberOfRegularPeriods + (parseInt(lastPlayedPeriodText.replace('OT', '') || '1', 10));
            } else {
                lastPeriodNumber = parseInt(lastPlayedPeriodText.replace(/\D/g, ''), 10) || 0;
            }
            if(lastPeriodNumber > 0) {
                 dispatch({ type: 'SET_PERIOD', payload: lastPeriodNumber });
            }
        }
       return;
    }
    
    if (state.live.clock.periodDisplayOverride === "Shootout") {
        dispatch({ type: 'MANUAL_END_GAME' }); // This will check for a tie and go to AwaitingDecision
        return;
    }
     if (state.live.clock.periodDisplayOverride === "AwaitingDecision") {
        dispatch({ type: 'SET_PERIOD', payload: state.live.clock.currentPeriod });
        return;
    }

    if (state.live.clock.periodDisplayOverride === "Break" || state.live.clock.periodDisplayOverride === "Pre-OT Break") {
      const actionToConfirm = () => {
        dispatch({ type: 'SET_PERIOD', payload: state.live.clock.currentPeriod });
        toast({ title: "Período Restaurado", description: `Retornando a ${getPeriodText(state.live.clock.currentPeriod, state.config.numberOfRegularPeriods)}. Reloj reiniciado y pausado.` });
      };

      const currentBreakDurationCs = state.live.clock.periodDisplayOverride === "Break" ? state.config.defaultBreakDuration : state.config.defaultPreOTBreakDuration;
      const shouldConfirm = state.live.clock.currentTime > 0 && state.live.clock.currentTime < currentBreakDurationCs;

      checkAndConfirm(
        shouldConfirm,
        "Confirmar Acción",
        `El descanso no ha finalizado. ¿Estás seguro de que quieres retornar a ${getPeriodText(state.live.clock.currentPeriod, state.config.numberOfRegularPeriods)}?`,
        actionToConfirm
      );
    } else {
      if (state.live.clock.currentPeriod === 1) {
        const actionToConfirm = () => {
          dispatch({ type: 'SET_PERIOD', payload: 0 });
          toast({ title: "Entrada en Calor Reiniciada", description: `Reloj de Entrada en Calor (${centisecondsToDisplayMinutes(state.config.defaultWarmUpDuration)} min) ${state.config.autoStartWarmUp ? 'corriendo.' : 'pausado.'}` });
        };
        const shouldConfirm = state.live.clock.currentTime > 0 && state.live.clock.currentTime < state.config.defaultPeriodDuration;
        checkAndConfirm(
          shouldConfirm,
          "Confirmar Acción",
          "El reloj del 1er período ha corrido. ¿Estás seguro de que quieres volver a la Entrada en Calor (reiniciará su tiempo)?",
          actionToConfirm
        );
      } else if (state.live.clock.currentPeriod > 1) {
        const actionToConfirm = () => {
          const periodBeforeIntendedBreak = state.live.clock.currentPeriod -1;
          dispatch({ type: 'START_BREAK_AFTER_PREVIOUS_PERIOD' });
          const isPreOT = periodBeforeIntendedBreak >= state.config.numberOfRegularPeriods;
          const breakType = isPreOT ? "Pre-OT Break" : "Break";
          const durationCs = isPreOT ? state.config.defaultPreOTBreakDuration : state.config.defaultBreakDuration;
          const autoStart = isPreOT ? state.config.autoStartPreOTBreaks : state.config.autoStartBreaks;
          toast({
              title: `${breakType} Iniciado`,
              description: `${breakType} iniciado después de ${getPeriodText(periodBeforeIntendedBreak, state.config.numberOfRegularPeriods)} (${centisecondsToDisplayMinutes(durationCs)} min). Reloj ${autoStart ? 'corriendo' : 'pausado'}.`
          });
        };

        const isCurrentPeriodOT = state.live.clock.currentPeriod > state.config.numberOfRegularPeriods;
        const currentPeriodExpectedDurationCs = isCurrentPeriodOT ? state.config.defaultOTPeriodDuration : state.config.defaultPeriodDuration;
        const shouldConfirm = state.live.clock.currentTime > 0 && state.live.clock.currentTime < currentPeriodExpectedDurationCs;
        checkAndConfirm(
          shouldConfirm,
          "Confirmar Acción",
          "El reloj del período actual ha corrido. ¿Estás seguro de que quieres iniciar el descanso del período anterior?",
          actionToConfirm
        );
      } else {
        toast({ title: "Inicio del Juego", description: "No se puede retroceder más allá de la Entrada en Calor.", variant: "destructive" });
      }
    }
  };

  const handleNextAction = () => {
    setEditingSegment(null);
    
    if (state.live.clock.periodDisplayOverride === "Time Out") {
      if (state.live.clock.currentTime <= 0) {
        dispatch({ type: 'END_TIMEOUT' });
        toast({ title: "Time Out Finalizado", description: "Juego reanudado al estado anterior." });
      } else {
        toast({ title: "Time Out en Curso", description: "El tiempo de Time Out aún no ha finalizado." });
      }
      return;
    }

    const performAction = () => {
        if (state.live.clock.currentPeriod === 0 && state.live.clock.periodDisplayOverride === "Warm-up") {
            dispatch({ type: 'SET_PERIOD', payload: 1 });
            toast({ title: "1er Período Iniciado", description: `Reloj de 1er Período (${centisecondsToDisplayMinutes(state.config.defaultPeriodDuration)} min) pausado.` });
        } else if (state.live.clock.periodDisplayOverride === "Break" || state.live.clock.periodDisplayOverride === "Pre-OT Break") {
            const nextNumericPeriod = state.live.clock.currentPeriod + 1;
            if (nextNumericPeriod <= MAX_TOTAL_GAME_PERIODS) {
                dispatch({ type: 'SET_PERIOD', payload: nextNumericPeriod });
                toast({ title: "Período Cambiado", description: `Período establecido a ${getPeriodText(nextNumericPeriod, state.config.numberOfRegularPeriods)}. Reloj reiniciado y pausado.` });
            } else {
                 dispatch({ type: 'MANUAL_END_GAME' });
            }
        } else if (state.live.clock.periodDisplayOverride === null) { // During a regular or OT period
            dispatch({ type: 'MANUAL_END_GAME' });
        }
    };
    
    let shouldConfirm = false;
    let confirmDescription = "";

    if (state.live.clock.periodDisplayOverride === "Warm-up" && state.live.clock.currentTime > 0 && state.live.clock.currentTime < state.config.defaultWarmUpDuration) {
        shouldConfirm = true;
        confirmDescription = "La Entrada en Calor no ha finalizado. ¿Estás seguro de que quieres iniciar el 1er Período?";
    } else if (state.live.clock.periodDisplayOverride === "Break" && state.live.clock.currentTime > 0 && state.live.clock.currentTime < state.config.defaultBreakDuration) {
        shouldConfirm = true;
        confirmDescription = `El descanso no ha finalizado. ¿Estás seguro de que quieres iniciar ${getPeriodText(state.live.clock.currentPeriod + 1, state.config.numberOfRegularPeriods)}?`;
    } else if (state.live.clock.periodDisplayOverride === "Pre-OT Break" && state.live.clock.currentTime > 0 && state.live.clock.currentTime < state.config.defaultPreOTBreakDuration) {
        shouldConfirm = true;
        confirmDescription = `El descanso no ha finalizado. ¿Estás seguro de que quieres iniciar ${getPeriodText(state.live.clock.currentPeriod + 1, state.config.numberOfRegularPeriods)}?`;
    } else if (state.live.clock.periodDisplayOverride === null && state.live.clock.currentTime > 0) {
        const isCurrentPeriodOT = state.live.clock.currentPeriod > state.config.numberOfRegularPeriods;
        const currentPeriodExpectedDurationCs = isCurrentPeriodOT ? state.config.defaultOTPeriodDuration : state.config.defaultPeriodDuration;
        if (state.live.clock.currentTime < currentPeriodExpectedDurationCs) {
            shouldConfirm = true;
            if (state.live.clock.currentPeriod >= MAX_TOTAL_GAME_PERIODS) {
                // Game ending, no confirmation needed.
            } else {
               confirmDescription = "El reloj del período actual ha corrido. ¿Estás seguro de que quieres iniciar el descanso?";
            }
        }
    }

    checkAndConfirm(shouldConfirm, "Confirmar Acción", confirmDescription, performAction);
};



  const isPreviousPeriodDisabled = (state.live.clock.currentPeriod === 0 && state.live.clock.periodDisplayOverride === "Warm-up") || state.live.clock.periodDisplayOverride === "Time Out";

  let isNextActionDisabled = false;
  if (state.live.clock.periodDisplayOverride === "Time Out" && state.live.clock.currentTime > 0) {
      isNextActionDisabled = true;
  } else if (state.live.clock.periodDisplayOverride === "End of Game" || state.live.clock.periodDisplayOverride === "Shootout" || state.live.clock.periodDisplayOverride === "AwaitingDecision") {
      isNextActionDisabled = true;
  }


  const showNextActionButton = state.live.clock.currentTime <= 0 && !state.live.clock.isClockRunning && state.live.clock.periodDisplayOverride !== "End of Game" && state.live.clock.periodDisplayOverride !== "Shootout" && state.live.clock.periodDisplayOverride !== "AwaitingDecision";


  let nextActionButtonText = "Siguiente";
  if (state.live.clock.periodDisplayOverride === "Time Out" && state.live.clock.currentTime <=0) {
    nextActionButtonText = "Finalizar Time Out";
  } else if (state.live.clock.currentPeriod === 0 && state.live.clock.periodDisplayOverride === "Warm-up" && state.live.clock.currentTime <= 0) {
    if (MAX_TOTAL_GAME_PERIODS > 0) {
        nextActionButtonText = "Iniciar 1er Período";
    } else {
        nextActionButtonText = "Finalizar Partido"; 
    }
  } else if (state.live.clock.periodDisplayOverride === null && state.live.clock.currentTime <= 0 && state.live.clock.currentPeriod >= MAX_TOTAL_GAME_PERIODS) {
     nextActionButtonText = "Finalizar Partido";
  } else if (state.live.clock.periodDisplayOverride === null && state.live.clock.currentTime <= 0 && state.live.clock.currentPeriod < MAX_TOTAL_GAME_PERIODS) {
    nextActionButtonText = "Iniciar Descanso";
  } else if ((state.live.clock.periodDisplayOverride === "Break" || state.live.clock.periodDisplayOverride === "Pre-OT Break") && state.live.clock.currentTime <= 0) {
     if (state.live.clock.currentPeriod + 1 <= MAX_TOTAL_GAME_PERIODS) {
        nextActionButtonText = `Iniciar ${getPeriodText(state.live.clock.currentPeriod + 1, state.config.numberOfRegularPeriods)}`;
     } else {
        nextActionButtonText = "Finalizar Partido";
     }
  }


  const isMainClockLastMinute = state.live.clock.currentTime < 6000 && state.live.clock.currentTime >= 0 &&
                               (state.live.clock.periodDisplayOverride !== null || state.live.clock.currentPeriod >= 0) &&
                               state.live.clock.periodDisplayOverride !== "End of Game" && state.live.clock.periodDisplayOverride !== "Shootout";

  const preTimeoutTimeCs = state.live.clock.preTimeoutState?.time;
  const isPreTimeoutLastMinute = typeof preTimeoutTimeCs === 'number' && preTimeoutTimeCs < 6000 && preTimeoutTimeCs >= 0;

  const handleSegmentClick = (segment: EditingSegment) => {
    if (state.live.clock.isClockRunning || state.live.clock.periodDisplayOverride === "End of Game" || state.live.clock.periodDisplayOverride === "Shootout" || state.live.clock.isFlashingZero) return;
    setEditingSegment(segment);
    switch (segment) {
      case 'minutes': setEditValue(String(timeParts.minutes).padStart(2, '0')); break;
      case 'seconds': setEditValue(String(timeParts.seconds).padStart(2, '0')); break;
      case 'tenths': setEditValue(String(timeParts.tenths)); break;
    }
  };

  const handleTimeEditConfirm = () => {
    if (!editingSegment || state.live.clock.periodDisplayOverride === "End of Game" || state.live.clock.periodDisplayOverride === "Shootout") return;

    const { minutes: currentMins, seconds: currentSecs, tenths: currentTenths } = timeParts;
    let newTimeCs = state.live.clock.currentTime;
    const value = editValue.trim() === '' ? 0 : parseInt(editValue, 10);

    if (isNaN(value)) {
      setEditingSegment(null);
      toast({ title: "Valor Inválido", description: "Por favor, ingresa un número.", variant: "destructive" });
      return;
    }

    switch (editingSegment) {
      case 'minutes':
        const newMinutes = Math.max(0, Math.min(value, 99));
        newTimeCs = (newMinutes * 60 * 100) + (currentSecs * 100) + (currentTenths * 10);
        break;
      case 'seconds':
        const newSeconds = Math.max(0, Math.min(value, 59));
        newTimeCs = (currentMins * 60 * 100) + (newSeconds * 100) + (currentTenths * 10);
        break;
      case 'tenths':
        if (isMainClockLastMinute) {
          const newTenthsVal = Math.max(0, Math.min(value, 9));
          newTimeCs = (currentMins * 60 * 100) + (currentSecs * 100) + (newTenthsVal * 10);
        }
        break;
    }
    newTimeCs = Math.max(0, newTimeCs);

    const payloadMinutes = Math.floor(newTimeCs / 6000);
    const payloadSeconds = Math.floor((newTimeCs % 6000) / 100);
    
    dispatch({ type: 'SET_TIME', payload: { minutes: payloadMinutes, seconds: payloadSeconds } });
    
    setEditingSegment(null);
  };

  const commonInputClass = cn(
    "bg-transparent border-0 p-0 text-center h-auto tabular-nums focus:ring-0 focus:outline-none focus:border-b focus:border-primary",
    "text-5xl font-bold",
    isMainClockLastMinute ? "text-orange-500" : "text-accent"
  );
  const commonSpanClass = cn(!(state.live.clock.isClockRunning || state.live.clock.periodDisplayOverride === "End of Game" || state.live.clock.periodDisplayOverride === "Shootout" || state.live.clock.isFlashingZero) && "cursor-pointer hover:underline");

  const activeHomePenaltiesCount = state.live.penalties.home.filter(p => p._status === 'running' && (p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride)).length;
  const playersOnIceForHome = Math.max(0, state.config.playersPerTeamOnIce - activeHomePenaltiesCount);

  const activeAwayPenaltiesCount = state.live.penalties.away.filter(p => p._status === 'running' && (p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride)).length;
  const playersOnIceForAway = Math.max(0, state.config.playersPerTeamOnIce - activeAwayPenaltiesCount);


  const handleMatchCategoryChange = (categoryId: string) => {
    dispatch({ type: 'SET_SELECTED_MATCH_CATEGORY', payload: categoryId });
    toast({ title: "Categoría del Partido Actualizada" });
  };

  const filteredTeamsForSearch = (searchTerm: string) => {
    const selectedTournament = state.config.tournaments.find(t => t.id === state.config.selectedTournamentId);
    if (!selectedTournament || !selectedTournament.teams) return [];
    
    return selectedTournament.teams.filter(team =>
      team.category === state.config.selectedMatchCategory &&
      (
        team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (team.subName && team.subName.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    ).sort((a,b) => a.name.localeCompare(b.name));
  };

  const filteredHomeTeams = useMemo(() => filteredTeamsForSearch(homeTeamSearchTerm), [homeTeamSearchTerm, state.config.tournaments, state.config.selectedTournamentId, state.config.selectedMatchCategory]);
  const filteredAwayTeams = useMemo(() => filteredTeamsForSearch(awayTeamSearchTerm), [awayTeamSearchTerm, state.config.tournaments, state.config.selectedTournamentId, state.config.selectedMatchCategory]);

  const handleSelectTeam = (teamType: 'home' | 'away', teamData: TeamData) => {
    if (teamType === 'home') {
      dispatch({ type: 'SET_HOME_TEAM_NAME', payload: teamData.name });
      dispatch({ type: 'SET_HOME_TEAM_SUB_NAME', payload: teamData.subName });
      setIsHomeTeamSearchOpen(false);
      setHomeTeamSearchTerm('');
    } else {
      dispatch({ type: 'SET_AWAY_TEAM_NAME', payload: teamData.name });
      dispatch({ type: 'SET_AWAY_TEAM_SUB_NAME', payload: teamData.subName });
      setIsAwayTeamSearchOpen(false);
      setAwayTeamSearchTerm('');
    }
    toast({ title: `Equipo ${teamType === 'home' ? 'Local' : 'Visitante'} Establecido`, description: `Equipo seleccionado: ${teamData.name}${teamData.subName ? ` - ${teamData.subName}` : ''}` });
  };

  const matchedHomeTeamId = useMemo(() => {
    if (!state.config.enableTeamSelectionInMiniScoreboard) return null;
    const selectedTournament = state.config.tournaments.find(t => t.id === state.config.selectedTournamentId);
    if (!selectedTournament || !selectedTournament.teams) return null;

    const matched = selectedTournament.teams.find(t =>
      t.name === state.live.homeTeamName &&
      (t.subName || undefined) === (state.live.homeTeamSubName || undefined) &&
      t.category === state.config.selectedMatchCategory
    );
    return matched ? matched.id : null;
  }, [state.live.homeTeamName, state.live.homeTeamSubName, state.config.tournaments, state.config.selectedTournamentId, state.config.selectedMatchCategory, state.config.enableTeamSelectionInMiniScoreboard]);

  const matchedAwayTeamId = useMemo(() => {
    if (!state.config.enableTeamSelectionInMiniScoreboard) return null;
    const selectedTournament = state.config.tournaments.find(t => t.id === state.config.selectedTournamentId);
    if (!selectedTournament || !selectedTournament.teams) return null;

    const matched = selectedTournament.teams.find(t =>
      t.name === state.live.awayTeamName &&
      (t.subName || undefined) === (state.live.awayTeamSubName || undefined) &&
      t.category === state.config.selectedMatchCategory
    );
    return matched ? matched.id : null;
  }, [state.live.awayTeamName, state.live.awayTeamSubName, state.config.tournaments, state.config.selectedTournamentId, state.config.selectedMatchCategory, state.config.enableTeamSelectionInMiniScoreboard]);

  const showHomeSearchIcon = state.config.enableTeamSelectionInMiniScoreboard && state.config.tournaments.length > 0 && !isMatchFromFixture;
  const showAwaySearchIcon = state.config.enableTeamSelectionInMiniScoreboard && state.config.tournaments.length > 0 && !isMatchFromFixture;
  const showHomePlayersIcon = state.config.enableTeamSelectionInMiniScoreboard;
  const showAwayPlayersIcon = state.config.enableTeamSelectionInMiniScoreboard;


  const handleTeamNameInputBlur = (teamType: 'home' | 'away', currentLocalName: string) => {
    if (teamType === 'home') {
      if (currentLocalName.trim() !== state.live.homeTeamName) { 
        dispatch({ type: 'SET_HOME_TEAM_NAME', payload: currentLocalName.trim() || 'Local' });
        dispatch({ type: 'SET_HOME_TEAM_SUB_NAME', payload: undefined }); 
      }
    } else {
      if (currentLocalName.trim() !== state.live.awayTeamName) {
        dispatch({ type: 'SET_AWAY_TEAM_NAME', payload: currentLocalName.trim() || 'Visitante' });
        dispatch({ type: 'SET_AWAY_TEAM_SUB_NAME', payload: undefined }); 
      }
    }
  };

  const handleTeamNameInputKeyDown = (teamType: 'home' | 'away', currentLocalName: string, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      if (teamType === 'home') {
        dispatch({ type: 'SET_HOME_TEAM_NAME', payload: currentLocalName.trim() || 'Local' });
        dispatch({ type: 'SET_HOME_TEAM_SUB_NAME', payload: undefined });
      } else {
        dispatch({ type: 'SET_AWAY_TEAM_NAME', payload: currentLocalName.trim() || 'Visitante' });
        dispatch({ type: 'SET_AWAY_TEAM_SUB_NAME', payload: undefined });
      }
      (event.target as HTMLInputElement).blur();
    }
  };

  const handlePrepareStartTimeout = () => {
    setIsTimeoutConfirmOpen(true);
  };

  const performStartTimeout = (team: Team) => {
    dispatch({ type: 'START_TIMEOUT', payload: { team } });
    const autoStart = state.config.autoStartTimeouts;
    const timeoutDurationSec = state.config.defaultTimeoutDuration / 100;
    toast({
        title: "Time Out Pedido",
        description: `Time Out para ${team === 'home' ? state.live.homeTeamName : state.live.awayTeamName}. Duración: ${timeoutDurationSec}s. Reloj ${autoStart ? 'corriendo' : 'pausado'}.`
    });
    setIsTimeoutConfirmOpen(false);
  };

  const isTimeOutButtonDisabled = 
    state.live.clock.periodDisplayOverride === "Break" ||
    state.live.clock.periodDisplayOverride === "Pre-OT Break" ||
    state.live.clock.periodDisplayOverride === "Time Out" ||
    state.live.clock.periodDisplayOverride === "Shootout";

  const timeoutDurationInSeconds = state.config.defaultTimeoutDuration / 100;
  const autoStartBehavior = state.config.autoStartTimeouts ? "se iniciará automáticamente" : "deberá iniciarse manually";
  
  const formattedTime = state.live.clock.isFlashingZero ? "00:00" : formatTime(state.live.clock.currentTime, { showTenths: isMainClockLastMinute, includeMinutesForTenths: false });

  const isShootout = state.live.clock.periodDisplayOverride === 'Shootout';
  const isFinalState = state.live.clock.periodDisplayOverride === 'AwaitingDecision' || state.live.clock.periodDisplayOverride === 'End of Game';
  const isPreWarmup = state.live.clock.periodDisplayOverride === 'Pre Warm-up';
  const showClock = !isShootout && !isFinalState && !isPreWarmup;

  const selectedTournament = state.config.tournaments.find(t => t.id === state.config.selectedTournamentId);
  const availableCategories = selectedTournament?.categories || [];


  return (
    <div className="relative">
      <div className="absolute top-0 left-0 p-2 sm:p-3 md:p-4 z-20">
        <div className="flex items-center gap-2">
          {availableCategories.length > 0 ? (
              <Select value={state.config.selectedMatchCategory} onValueChange={handleMatchCategoryChange} disabled={isMatchFromFixture}>
                  <SelectTrigger className="w-auto min-w-[120px] max-w-[200px] h-8 text-xs bg-card/80 border-border/50 backdrop-blur-sm">
                      <div className="flex items-center gap-1.5 truncate">
                          <ListFilter className="h-3.5 w-3.5 text-muted-foreground" />
                          <SelectValue placeholder="Categoría" />
                      </div>
                  </SelectTrigger>
                  <SelectContent>
                      {availableCategories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id} className="text-xs">
                              {cat.name}
                          </SelectItem>
                      ))}
                  </SelectContent>
              </Select>
          ) : (
              <div className="flex items-center gap-1.5 h-8 px-3 text-xs bg-card/80 border-border/50 rounded-md text-muted-foreground">
                  <ListFilter className="h-3.5 w-3.5" />
                  <span>Sin categorías</span>
              </div>
          )}
          {state.config.enableDebugMode && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-xs text-muted-foreground font-mono bg-card/80 p-1 rounded-md border border-border/50 cursor-help">
                    Abs: {formatTime(state.live.clock._liveAbsoluteElapsedTimeCs)} ({formatTime(state.live.clock.absoluteElapsedTimeCs)})
                  </div>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <p className="font-bold mb-2">Variables del Reloj (Debug)</p>
                  <div className="grid grid-cols-[auto_1fr] gap-x-2">
                    <strong>currentTime:</strong>
                    <span>{state.live.clock.currentTime}cs ({formatTime(state.live.clock.currentTime)})</span>
                    <strong>isClockRunning:</strong>
                    <span>{String(state.live.clock.isClockRunning)}</span>
                    <strong>absoluteElapsedTimeCs:</strong>
                    <span>{state.live.clock.absoluteElapsedTimeCs}cs ({formatTime(state.live.clock.absoluteElapsedTimeCs)})</span>
                    <strong>clockStartTimeMs:</strong>
                    <span>{state.live.clock.clockStartTimeMs ? new Date(state.live.clock.clockStartTimeMs).toLocaleTimeString() : 'null'}</span>
                    <strong>remainingTimeAtStartCs:</strong>
                    <span>{state.live.clock.remainingTimeAtStartCs !== null ? `${state.live.clock.remainingTimeAtStartCs}cs` : 'null'}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      <div className="absolute top-0 right-0 p-2 sm:p-3 md:p-4 z-20">
        <Button
          onClick={handlePrepareStartTimeout}
          variant="outline"
          className="h-8 text-xs bg-card/80 border-dashed border-white/40 backdrop-blur-sm"
          disabled={isTimeOutButtonDisabled}
          aria-label="Iniciar Time Out"
        >
          <TimerOff className="mr-1.5 h-3.5 w-3.5" />
          Time Out
        </Button>
      </div>

      <Card className="mb-8 bg-card shadow-lg pt-12 sm:pt-10 md:pt-12">
        <CardContent className="flex flex-col sm:flex-row justify-around items-center text-center gap-4 sm:gap-8 py-6">
          {/* Home Team Section */}
          <div className="flex-1 w-full sm:w-auto">
            <div className="flex justify-center items-center gap-1 mb-1 h-5 md:h-6 lg:h-7">
              {playersOnIceForHome > 0 && Array(playersOnIceForHome).fill(null).map((_, index) => (
                <User key={`home-player-${index}`} className="h-5 w-5 md:h-6 md:w-6 lg:h-7 text-primary-foreground/80" />
              ))}
              {playersOnIceForHome === 0 && state.config.playersPerTeamOnIce > 0 && (
                <span className="text-xs text-destructive animate-pulse">0 JUGADORES</span>
              )}
            </div>
             <div className="relative w-full max-w-xs mx-auto my-1">
                 <div className="flex items-center justify-center">
                    {showHomeSearchIcon && (
                        <Button variant="ghost" size="icon" className={cn("h-7 w-7 shrink-0", isMatchFromFixture && "opacity-50 cursor-not-allowed")} asChild>
                             <Popover open={isHomeTeamSearchOpen} onOpenChange={setIsHomeTeamSearchOpen}>
                                <PopoverTrigger asChild>
                                    <button disabled={isMatchFromFixture} aria-label="Buscar equipo local">
                                        <Search className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[240px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Buscar equipo..." value={homeTeamSearchTerm} onValueChange={setHomeTeamSearchTerm} />
                                        <CommandList>
                                            <CommandEmpty>No se encontraron equipos.</CommandEmpty>
                                            <CommandGroup>
                                                {filteredHomeTeams.map((team) => (
                                                    <CommandItem
                                                        key={team.id}
                                                        value={`${team.name}${team.subName ? ` - ${team.subName}` : ''}`}
                                                        onSelect={() => handleSelectTeam('home', team)}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", localHomeTeamName === team.name && (localHomeTeamSubName || undefined) === (team.subName || undefined) ? "opacity-100" : "opacity-0")} />
                                                        <span className="truncate">{team.name}{team.subName ? <span className="text-xs text-muted-foreground"> - {team.subName}</span> : ''}</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </Button>
                    )}
                    <Input
                        id="homeTeamNameInput"
                        value={localHomeTeamName}
                        onChange={(e) => setLocalHomeTeamName(e.target.value)}
                        onBlur={() => handleTeamNameInputBlur('home', localHomeTeamName)}
                        onKeyDown={(e) => handleTeamNameInputKeyDown('home', localHomeTeamName, e)}
                        placeholder="Nombre Local"
                        className={cn(
                            "h-8 text-sm uppercase w-auto text-center",
                             showHomeSearchIcon && "ml-1", 
                             showHomePlayersIcon && "mr-1"
                        )}
                        aria-label="Nombre del equipo local"
                        autoComplete="off"
                        disabled={isMatchFromFixture}
                    />
                    {showHomePlayersIcon && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 rounded-full"
                            onClick={() => setIsHomePlayersDialogOpen(true)}
                            disabled={!matchedHomeTeamId}
                            aria-label="Editar jugadores del equipo local"
                        >
                            <ClipboardList className={cn("h-4 w-4", isWarmup && isMatchFromFixture ? "animate-pulse text-green-500" : (matchedHomeTeamId ? "text-muted-foreground" : "text-muted-foreground/50 opacity-60"))} />
                        </Button>
                    )}
                </div>
                 {matchedHomeTeamId && localHomeTeamSubName && (
                    <p className="text-xs text-muted-foreground text-center mt-0.5 truncate">
                        ({localHomeTeamSubName})
                    </p>
                )}
            </div>
            <p className="text-sm text-muted-foreground text-center my-1">(Local)</p>
            <div className={cn("flex items-center justify-center gap-1 mt-1", isShootout && "invisible")}>
              <Button variant="link" className="p-0 h-auto text-4xl font-bold text-accent w-24 text-center tabular-nums hover:no-underline hover:text-accent/80" onClick={() => onScoreClick('home')}>
                  {state.live.score.home}
              </Button>
            </div>
            {matchedHomeTeamId && isHomePlayersDialogOpen && (
              <EditTeamPlayersDialog
                isOpen={isHomePlayersDialogOpen}
                onOpenChange={setIsHomePlayersDialogOpen}
                teamId={matchedHomeTeamId}
                teamName={localHomeTeamName}
                teamType="home"
              />
            )}
          </div>

          {/* Clock & Period Section */}
          <div className="flex-1 space-y-2 text-center">
            <div className={cn("w-full max-w-[180px] mx-auto mb-2 h-9", !showNextActionButton && "invisible")}>
                {showNextActionButton && (
                    <Button
                        onClick={handleNextAction}
                        className="w-full"
                        variant="default"
                        aria-label={nextActionButtonText}
                        disabled={isNextActionDisabled || state.live.clock.isFlashingZero}
                    >
                        <ChevronsRight className="mr-2 h-5 w-5" /> {nextActionButtonText}
                    </Button>
                )}
            </div>

            <div className={cn(
              "text-5xl font-bold tabular-nums flex items-baseline justify-center gap-0.5",
              isMainClockLastMinute ? "text-orange-500" : "text-accent",
              state.live.clock.isFlashingZero && "animate-flashing-clock",
              !showClock && "invisible"
            )}>
              {!(state.live.clock.isClockRunning || state.live.clock.periodDisplayOverride === "End of Game" || state.live.clock.periodDisplayOverride === "Shootout" || state.live.clock.isFlashingZero) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-accent self-center mr-1"
                  onClick={() => handleTimeAdjust(-1)}
                  aria-label="Restar 1 segundo al reloj"
                  disabled={editingSegment !== null || state.live.clock.isFlashingZero}
                >
                  <Minus className="h-3 w-3" />
                </Button>
              )}

              {editingSegment === 'minutes' ? (
                <Input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  value={editValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*$/.test(val) && val.length <= 2) setEditValue(val);
                  }}
                  onBlur={handleTimeEditConfirm}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTimeEditConfirm();
                    if (e.key === 'Escape') setEditingSegment(null);
                  }}
                  className={cn(commonInputClass, "w-[60px] px-0")}
                  maxLength={2}
                  autoComplete="off"
                />
              ) : (
                <span onClick={() => handleSegmentClick('minutes')} className={commonSpanClass}>
                  {String(displayTimeParts.minutes).padStart(2, '0')}
                </span>
              )}
              <span className={isMainClockLastMinute ? "text-orange-500" : "text-accent"}>:</span>
              {editingSegment === 'seconds' ? (
                <Input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  value={editValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*$/.test(val) && val.length <= 2) setEditValue(val);
                  }}
                  onBlur={handleTimeEditConfirm}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTimeEditConfirm();
                    if (e.key === 'Escape') setEditingSegment(null);
                  }}
                  className={cn(commonInputClass, "w-[60px] px-0")}
                  maxLength={2}
                  autoComplete="off"
                />
              ) : (
                <span onClick={() => handleSegmentClick('seconds')} className={commonSpanClass}>
                  {String(displayTimeParts.seconds).padStart(2, '0')}
                </span>
              )}
              {isMainClockLastMinute && (
                <>
                  <span className="text-orange-500">.</span>
                  {editingSegment === 'tenths' ? (
                    <Input
                      ref={inputRef}
                      type="text"
                      inputMode="numeric"
                      value={editValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d*$/.test(val) && val.length <= 1) setEditValue(val);
                      }}
                      onBlur={handleTimeEditConfirm}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleTimeEditConfirm();
                        if (e.key === 'Escape') setEditingSegment(null);
                      }}
                      className={cn(commonInputClass, "w-[30px] text-orange-500 px-0")}
                      maxLength={1}
                      autoComplete="off"
                    />
                  ) : (
                    <span onClick={() => handleSegmentClick('tenths')} className={cn(commonSpanClass, "text-orange-500")}>
                      {String(displayTimeParts.tenths)}
                    </span>
                  )}
                </>
              )}
              {!(state.live.clock.isClockRunning || state.live.clock.periodDisplayOverride === "End of Game" || state.live.clock.periodDisplayOverride === "Shootout" || state.live.clock.isFlashingZero) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-accent self-center ml-1"
                  onClick={() => handleTimeAdjust(1)}
                  aria-label="Sumar 1 segundo al reloj"
                  disabled={editingSegment !== null || state.live.clock.isFlashingZero}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className={cn("w-full max-w-[180px] mx-auto mt-2 h-9", showNextActionButton && "invisible")}>
                {state.live.clock.periodDisplayOverride === 'Pre Warm-up' ? (
                  <Button
                    onClick={() => dispatch({ type: 'START_WARMUP' })}
                    className="w-full bg-green-600 hover:bg-green-700 px-2 text-sm font-semibold"
                    variant="default"
                  >
                    <Play className="mr-1 h-4 w-4" />
                    COMENZAR PARTIDO
                  </Button>
                ) : (
                  <Button
                      onClick={handleToggleClock}
                      className="w-full"
                      variant={state.live.clock.isClockRunning ? "destructive" : "default"}
                      aria-label={state.live.clock.isClockRunning ? "Pausar Reloj" : "Iniciar Reloj"}
                      disabled={(state.live.clock.currentTime <= 0 && !state.live.clock.isClockRunning && state.live.clock.periodDisplayOverride !== "Time Out") || state.live.clock.periodDisplayOverride === "End of Game" || state.live.clock.isFlashingZero}
                  >
                      {state.live.clock.isClockRunning ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                      {state.live.clock.isClockRunning ? 'Pausar' : 'Iniciar'} Reloj
                  </Button>
                )}
            </div>
            
            <div className="relative mt-1 flex items-center justify-center gap-2">
               <Button
                onClick={handlePreviousPeriod}
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary-foreground"
                aria-label="Período Anterior o Descanso"
                disabled={isPreviousPeriodDisabled || editingSegment !== null || state.live.clock.isFlashingZero}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div
                className="text-lg text-primary-foreground uppercase w-36 truncate text-center"
              >
                 {getActualPeriodText(state.live.clock.currentPeriod, state.live.clock.periodDisplayOverride, state.config.numberOfRegularPeriods, state.live.shootout)}
              </div>
              <Button
                onClick={handleNextAction}
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary-foreground"
                aria-label="Siguiente Período o Descanso"
                disabled={isNextActionDisabled || editingSegment !== null || state.live.clock.isFlashingZero}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              {!state.live.clock.isClockRunning && state.live.clock.currentTime > 0 && state.live.clock.periodDisplayOverride === null && !isShootout && !showNextActionButton && editingSegment === null && (
                <span className="absolute top-[-0.25rem] right-1 text-[0.6rem] font-normal text-muted-foreground normal-case px-1 rounded-sm bg-background/30">
                  Paused
                </span>
              )}
            </div>
            {state.live.clock.preTimeoutState && state.live.clock.periodDisplayOverride === "Time Out" && (
              <div 
                className={cn(
                    "text-xs mt-1 normal-case tracking-normal",
                    isPreTimeoutLastMinute ? "text-orange-500/80" : "text-muted-foreground"
                )}
              >
                TIMEOUT {state.live.clock.preTimeoutState.team === 'home' ? state.live.homeTeamName : state.live.awayTeamName}
              </div>
            )}
          </div>

          {/* Away Team Section */}
          <div className="flex-1 w-full sm:w-auto">
            <div className="flex justify-center items-center gap-1 mb-1 h-5 md:h-6 lg:h-7">
              {playersOnIceForAway > 0 && Array(playersOnIceForAway).fill(null).map((_, index) => (
                <User key={`away-player-${index}`} className="h-5 w-5 md:h-6 md:w-6 lg:h-7 text-primary-foreground/80" />
              ))}
              {playersOnIceForAway === 0 && state.config.playersPerTeamOnIce > 0 && (
                <span className="text-xs text-destructive animate-pulse">0 JUGADORES</span>
              )}
            </div>
             <div className="relative w-full max-w-xs mx-auto my-1">
                <div className="flex items-center justify-center">
                    {showAwaySearchIcon && (
                        <Button variant="ghost" size="icon" className={cn("h-7 w-7 shrink-0", isMatchFromFixture && "opacity-50 cursor-not-allowed")} asChild>
                            <Popover open={isAwayTeamSearchOpen} onOpenChange={setIsAwayTeamSearchOpen}>
                                <PopoverTrigger asChild>
                                    <button disabled={isMatchFromFixture} aria-label="Buscar equipo visitante">
                                        <Search className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[240px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Buscar equipo..." value={awayTeamSearchTerm} onValueChange={setAwayTeamSearchTerm} />
                                        <CommandList>
                                            <CommandEmpty>No se encontraron equipos.</CommandEmpty>
                                            <CommandGroup>
                                                {filteredAwayTeams.map((team) => (
                                                    <CommandItem
                                                        key={team.id}
                                                        value={`${team.name}${team.subName ? ` - ${team.subName}` : ''}`}
                                                        onSelect={() => handleSelectTeam('away', team)}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", localAwayTeamName === team.name && (localAwayTeamSubName || undefined) === (team.subName || undefined) ? "opacity-100" : "opacity-0")} />
                                                        <span className="truncate">{team.name}{team.subName ? <span className="text-xs text-muted-foreground"> - {team.subName}</span> : ''}</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </Button>
                    )}
                    <Input
                        id="awayTeamNameInput"
                        value={localAwayTeamName}
                        onChange={(e) => setLocalAwayTeamName(e.target.value)}
                        onBlur={() => handleTeamNameInputBlur('away', localAwayTeamName)}
                        onKeyDown={(e) => handleTeamNameInputKeyDown('away', localAwayTeamName, e)}
                        placeholder="Nombre Visitante"
                         className={cn(
                            "h-8 text-sm uppercase w-auto text-center",
                            showAwaySearchIcon && "ml-1",
                            showAwayPlayersIcon && "mr-1"
                        )}
                        aria-label="Nombre del equipo visitante"
                        autoComplete="off"
                        disabled={isMatchFromFixture}
                    />
                     {showAwayPlayersIcon && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 rounded-full"
                            onClick={() => setIsAwayPlayersDialogOpen(true)}
                            disabled={!matchedAwayTeamId}
                            aria-label="Editar jugadores del equipo visitante"
                        >
                            <ClipboardList className={cn("h-4 w-4", isWarmup && isMatchFromFixture ? "animate-pulse text-green-500" : (matchedAwayTeamId ? "text-muted-foreground" : "text-muted-foreground/50 opacity-60"))} />
                        </Button>
                    )}
                </div>
                {matchedAwayTeamId && localAwayTeamSubName && (
                    <p className="text-xs text-muted-foreground text-center mt-0.5 truncate">
                        ({localAwayTeamSubName})
                    </p>
                )}
            </div>
            <p className="text-sm text-muted-foreground text-center my-1">(Visitante)</p>
            <div className={cn("flex items-center justify-center gap-1 mt-1", isShootout && "invisible")}>
              <Button variant="link" className="p-0 h-auto text-4xl font-bold text-accent w-24 text-center tabular-nums hover:no-underline hover:text-accent/80" onClick={() => onScoreClick('away')}>
                  {state.live.score.away}
              </Button>
            </div>
             {matchedAwayTeamId && isAwayPlayersDialogOpen && (
              <EditTeamPlayersDialog
                isOpen={isAwayPlayersDialogOpen}
                onOpenChange={setIsAwayPlayersDialogOpen}
                teamId={matchedAwayTeamId}
                teamName={localAwayTeamName}
                teamType="away"
              />
            )}
          </div>
        </CardContent>
      </Card>
      
      {pendingConfirmation && (
        <AlertDialog open={true} onOpenChange={(isOpen) => !isOpen && cancelConfirmation()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{pendingConfirmation.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingConfirmation.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelConfirmation}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => executeConfirmedAction(pendingConfirmation.onConfirm)}>
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {isTimeoutConfirmOpen && (
        <AlertDialog open={isTimeoutConfirmOpen} onOpenChange={setIsTimeoutConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Inicio de Time Out</AlertDialogTitle>
              <AlertDialogDescription>
                El reloj del Time Out de {timeoutDurationInSeconds} segundos {autoStartBehavior}. ¿Para qué equipo es el Time Out?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsTimeoutConfirmOpen(false)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => performStartTimeout('home')}>
                Para {state.live.homeTeamName}
              </AlertDialogAction>
              <AlertDialogAction onClick={() => performStartTimeout('away')}>
                Para {state.live.awayTeamName}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
