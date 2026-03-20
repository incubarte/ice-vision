
"use client";

import type { Penalty, ClockState } from '@/types';
import { useGameState, formatTime, getPeriodText } from '@/contexts/game-state-context';
import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import React from 'react'; 
import { Separator } from '../ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const CagedUserIcon = ({ size, className, isBlue }: { size: number; className?: string; isBlue?: boolean }) => {
  const strokeColor = isBlue ? "rgb(59, 130, 246)" : "hsl(var(--destructive))";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ width: `${size}rem`, height: `${size}rem` }}
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" strokeWidth="2" stroke={strokeColor} />
      <circle cx="12" cy="7" r="4" strokeWidth="2" stroke={strokeColor} />
      <line x1="6" y1="2" x2="6" y2="22" strokeWidth="1" stroke="hsl(var(--muted-foreground))" />
      <line x1="10" y1="2" x2="10" y2="22" strokeWidth="1" stroke="hsl(var(--muted-foreground))" />
      <line x1="14" y1="2" x2="14" y2="22" strokeWidth="1" stroke="hsl(var(--muted-foreground))" />
      <line x1="18" y1="2" x2="18" y2="22" strokeWidth="1" stroke="hsl(var(--muted-foreground))" />
    </svg>
  );
};

interface PenaltyWithVisualTimer extends Penalty {
  _visualRemainingTimeCs?: number;
}

interface PenaltyCardProps {
  penalty: PenaltyWithVisualTimer;
  teamName: string;
  mode?: 'desktop' | 'mobile';
  clock?: ClockState;
}

export function PenaltyCard({ penalty, teamName, mode = 'desktop', clock: mobileClock }: PenaltyCardProps) {
  const { state } = useGameState();
  
  if (!state.config || !state.live) {
    return null;
  }

  const { config, live } = state;
  const clock = mobileClock || live.clock;
  const isMobile = mode === 'mobile';
  
  const currentTeamSubName = live.homeTeamName === teamName ? live.homeTeamSubName : live.awayTeamSubName;

  const matchedPlayer = React.useMemo(() => {
    // Determine which team this penalty belongs to based on team name
    const team = live.homeTeamName === teamName ? 'home' : 'away';
    const roster = live.matchContext ? (team === 'home' ? live.matchContext.homeRoster : live.matchContext.awayRoster) : [];
    return roster.find(p => p.number === penalty.playerNumber || (penalty.playerNumber === "S/N" && !p.number)) || null;
  }, [live.matchContext, live.homeTeamName, teamName, penalty.playerNumber]);

  const isWaitingSlot = penalty._status === 'pending_concurrent';
  const isPendingPuck = penalty._status === 'pending_puck';

  // Una penalidad NO reduce jugador si: reducesPlayerCount es false O _doesNotReducePlayerCountOverride es true
  const doesNotReducePlayer = !penalty.reducesPlayerCount || penalty._doesNotReducePlayerCountOverride;

  const cardClasses = cn(
    "bg-muted/50 border-primary/30 transition-opacity",
    (isWaitingSlot || isPendingPuck) && "opacity-50",
    isPendingPuck && "border-yellow-500/40"
  );

  const renderPlayerAlias = () => {
    if (!config.showAliasInScoreboardPenalties || !matchedPlayer || !matchedPlayer.name || penalty.isBenchPenalty) return null;
    
    const name = matchedPlayer.name;
    let displayName = name;
    if (name.length > 10) {
      displayName = name.substring(0, 8) + "..";
    }
    
    return (
      <>
        {'\u00A0\u00A0\u00A0'} 
        <span 
          className="text-muted-foreground font-normal" 
          title={name} 
          style={{ fontSize: '0.6em', lineHeight: 1 }}
        >
          {displayName}
        </span>
      </>
    );
  };
  
  const getDisplayNumber = () => {
      if (penalty.isBenchPenalty) {
        return `Banco (#${penalty.playerNumber || 'S/N'})`;
      }
      return `#${penalty.playerNumber || 'S/N'}`;
    };

  const getStatusTextForScoreboard = () => {
    if (isPendingPuck) return "Esperando Puck";
    if (isWaitingSlot) return "Esperando";
    return null;
  }
  const statusText = getStatusTextForScoreboard();
  
  let remainingTimeCs: number;

  if (isMobile) {
    remainingTimeCs = penalty._visualRemainingTimeCs ?? (penalty.initialDuration * 100);
  } else if (penalty._status === 'running' && penalty.expirationTime !== undefined) {
    remainingTimeCs = Math.max(0, penalty.expirationTime - clock._liveAbsoluteElapsedTimeCs);
  } else {
    remainingTimeCs = penalty.initialDuration * 100;
  }

  const styles = {
    playerIconSize: isMobile ? 2 : config.scoreboardLayout.penaltyPlayerIconSize,
    playerNumberSize: isMobile ? '1.5rem' : `${config.scoreboardLayout.penaltyPlayerNumberSize}rem`,
    timeSize: isMobile ? '1.5rem' : `${config.scoreboardLayout.penaltyTimeSize}rem`,
    clockIconSize: isMobile ? '1.25rem' : `${config.scoreboardLayout.penaltyTimeSize * 0.5}rem`,
    totalDurationSize: isMobile ? '0.75rem' : `${config.scoreboardLayout.penaltyTimeSize * 0.4}rem`,
    statusSize: isMobile ? '0.75rem' : `${config.scoreboardLayout.penaltyTimeSize * 0.4}rem`,
  };

  const penaltyLogDetails = (live.penaltiesLog?.home || []).find(p => p.id === penalty.id) || (live.penaltiesLog?.away || []).find(p => p.id === penalty.id);
  const penaltyNameForTooltip = penaltyLogDetails?.penaltyName || "Tipo desconocido";


  return (
    <Card className={cardClasses}>
      <CardContent className="p-2 md:p-3 lg:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <CagedUserIcon size={styles.playerIconSize} className="text-primary-foreground" isBlue={doesNotReducePlayer} />
            <span
              className="font-semibold"
              style={{ fontSize: styles.playerNumberSize, lineHeight: 1 }}
            >
              {getDisplayNumber()}
              {renderPlayerAlias()}
            </span>
          </div>
          <div 
            className="flex items-center gap-1 md:gap-2 text-accent font-mono"
            style={{ fontSize: styles.timeSize, lineHeight: 1 }}
          >
            <Clock 
              className="text-accent"
              style={{
                height: styles.clockIconSize,
                width: styles.clockIconSize,
              }}
            />
            {formatTime(remainingTimeCs, { showTenths: false, rounding: 'up' })}
          </div>
        </div>
        <div className="flex justify-between items-center">
          <div
            className="text-muted-foreground mt-1"
            style={{ fontSize: styles.totalDurationSize }}
          >
            ({formatTime(penalty.initialDuration * 100, { showTenths: false })})
             {doesNotReducePlayer && <span className="text-blue-400 font-semibold"> (No reduce)</span>}
          </div>
          {statusText && (
            <div className={cn(
                "mt-1 italic",
                 isPendingPuck ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground/80"
              )}
              style={{ fontSize: styles.statusSize }}
            >
              {statusText}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
