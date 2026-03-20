
"use client";

import React, { useState, useMemo } from "react";
import { useGameState, getActualPeriodText } from "@/contexts/game-state-context";
import type { Team } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy, Send } from "lucide-react";
import type { GoalLog } from "@/types";

interface GoldenGoalDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function GoldenGoalDialog({ isOpen, onOpenChange }: GoldenGoalDialogProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [scorerNumber, setScorerNumber] = useState('');
  const [assistNumber, setAssistNumber] = useState('');

  const selectedTeamRoster = useMemo(() => {
    const mc = state.live.matchContext;
    if (!mc || !selectedTeam) return [];
    return selectedTeam === 'home' ? mc.homeRoster : mc.awayRoster;
  }, [state.live.matchContext, selectedTeam]);

  const scorerPlayer = useMemo(() => selectedTeamRoster.find(p => p.number === scorerNumber), [selectedTeamRoster, scorerNumber]);
  const assistPlayer = useMemo(() => selectedTeamRoster.find(p => p.number === assistNumber), [selectedTeamRoster, assistNumber]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.live || !state.config) return;

    if (!selectedTeam) {
      toast({ title: "Equipo Requerido", description: "Debes seleccionar el equipo que anotó el gol.", variant: "destructive" });
      return;
    }

    const trimmedScorerNumber = scorerNumber.trim();
    if (!trimmedScorerNumber || !/^\d+$/.test(trimmedScorerNumber)) {
      toast({ title: "Número de Goleador Inválido", description: "El número del goleador es requerido y debe ser numérico.", variant: "destructive" });
      return;
    }
    
    const trimmedAssistNumber = assistNumber.trim();
    if (trimmedAssistNumber && !/^\d+$/.test(trimmedAssistNumber)) {
      toast({ title: "Número de Asistencia Inválido", description: "El número de asistencia debe ser numérico.", variant: "destructive" });
      return;
    }
    if (trimmedScorerNumber && trimmedAssistNumber && trimmedScorerNumber === trimmedAssistNumber) {
        toast({ title: "Jugador Duplicado", description: "El goleador y el asistente no pueden ser el mismo jugador.", variant: "destructive" });
        return;
    }

    const payload: Omit<GoalLog, 'id'> = {
        team: selectedTeam,
        timestamp: Date.now(),
        gameTime: state.live.clock.currentTime,
        periodText: getActualPeriodText(state.live.clock.currentPeriod, state.live.clock.periodDisplayOverride, state.config.numberOfRegularPeriods, state.live.shootout),
        scorer: { playerNumber: trimmedScorerNumber },
        assist: trimmedAssistNumber ? { playerNumber: trimmedAssistNumber } : undefined,
    };
    
    dispatch({ type: 'FINISH_GAME_WITH_OT_GOAL', payload });
    toast({ title: "¡Partido Finalizado!", description: "Gol de oro registrado exitosamente." });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            Registrar Gol de Oro
          </DialogTitle>
          <DialogDescription>
            El partido está empatado en tiempo extra. Registra el gol ganador para finalizar el partido.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div>
            <Label className="text-base">Equipo Ganador</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Button
                type="button"
                variant={selectedTeam === 'home' ? 'default' : 'outline'}
                onClick={() => setSelectedTeam('home')}
                className="h-12 text-base truncate"
                title={state.live.homeTeamName}
              >
                {state.live.homeTeamName}
              </Button>
              <Button
                type="button"
                variant={selectedTeam === 'away' ? 'default' : 'outline'}
                onClick={() => setSelectedTeam('away')}
                className="h-12 text-base truncate"
                title={state.live.awayTeamName}
              >
                {state.live.awayTeamName}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
                <Label htmlFor="golden-scorer"># Goleador</Label>
                <Input
                    id="golden-scorer" value={scorerNumber}
                    onChange={(e) => { if (/^\d*$/.test(e.target.value)) setScorerNumber(e.target.value); }}
                    placeholder="Ej: 99" required
                />
                {scorerPlayer && <p className="text-xs text-muted-foreground mt-1 truncate" title={scorerPlayer.name}>Jugador: {scorerPlayer.name}</p>}
            </div>
            <div>
                <Label htmlFor="golden-assist"># Asistencia</Label>
                <Input
                    id="golden-assist" value={assistNumber}
                    onChange={(e) => { if (/^\d*$/.test(e.target.value)) setAssistNumber(e.target.value); }}
                    placeholder="(Opcional)"
                />
                {assistPlayer && <p className="text-xs text-muted-foreground mt-1 truncate" title={assistPlayer.name}>Asistente: {assistPlayer.name}</p>}
            </div>
          </div>
          <DialogFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit">
                <Send className="mr-2 h-4 w-4" /> Registrar y Finalizar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
