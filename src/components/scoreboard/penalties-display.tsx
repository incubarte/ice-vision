
"use client";

import type { Penalty, ClockState } from '@/types';
import { useGameState } from '@/contexts/game-state-context';
import { PenaltyCard } from './penalty-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PenaltiesDisplayProps {
  teamDisplayType: "Local" | "Visitante";
  teamName: string;
  penalties: Penalty[];
  mode?: 'desktop' | 'mobile' | 'scoreboard';
  clock?: ClockState;
}

export function PenaltiesDisplay({ teamDisplayType, teamName, penalties, mode = 'desktop', clock }: PenaltiesDisplayProps) {
  const { state } = useGameState();
  const isMobile = mode === 'mobile';

  if (!state.config) {
    return null;
  }

  // Ordenar: primero las que reducen jugador, luego las que no; dentro de cada grupo, orden cronológico
  const penaltiesToDisplay = penalties
    .map((penalty, index) => ({ penalty, originalIndex: index }))
    .sort((a, b) => {
      const aReduces = a.penalty.reducesPlayerCount && !a.penalty._doesNotReducePlayerCountOverride;
      const bReduces = b.penalty.reducesPlayerCount && !b.penalty._doesNotReducePlayerCountOverride;
      if (aReduces && !bReduces) return -1;
      if (!aReduces && bReduces) return 1;
      return a.originalIndex - b.originalIndex;
    })
    .map(item => item.penalty);

  const penaltiesToShow = isMobile ? penaltiesToDisplay : penaltiesToDisplay.slice(0, 3);

  if (isMobile) {
    return (
      <Card className="bg-card shadow-lg flex-1">
        <CardHeader className="flex flex-row justify-between items-center p-3 md:p-6">
          <CardTitle className="text-primary-foreground" style={{ fontSize: '1.125rem' }}>
            {`Penalidades ${teamName}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3 pt-0 md:p-6 md:pt-0 md:space-y-3 lg:space-y-4">
          {penaltiesToDisplay.length === 0 ? (
            <p className="text-muted-foreground" style={{ fontSize: '0.875rem' }}>Ninguna</p>
          ) : (
            penaltiesToShow.map(penalty => (
              <PenaltyCard key={penalty.id} penalty={penalty} teamName={teamName} mode={mode} clock={clock} />
            ))
          )}
        </CardContent>
      </Card>
    );
  }

  if (mode === 'scoreboard') {
    const align = teamDisplayType === 'Visitante' ? 'right' : 'left';
    if (penaltiesToDisplay.length === 0) return null;
    return (
      <div className={cn("flex flex-col gap-4", align === 'right' && "items-end")}>
        <span className="text-foreground/30 uppercase tracking-widest text-xs font-medium">Penalidades</span>
        {penaltiesToDisplay.slice(0, 3).map(penalty => (
          <PenaltyCard key={penalty.id} penalty={penalty} teamName={teamName} mode="scoreboard" align={align} clock={clock} />
        ))}
      </div>
    );
  }

  // Desktop: limpio, sin Card wrapper, sin título, sin estado vacío
  return (
    <div className="flex-1 flex flex-col gap-1.5 pt-1">
      {penaltiesToShow.map(penalty => (
        <PenaltyCard key={penalty.id} penalty={penalty} teamName={teamName} mode={mode} clock={clock} />
      ))}
    </div>
  );
}
