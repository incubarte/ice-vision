
"use client";

import type { Penalty, ClockState } from '@/types';
import { useGameState, formatTime } from '@/contexts/game-state-context';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import React from 'react';

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
  mode?: 'desktop' | 'mobile' | 'scoreboard';
  clock?: ClockState;
  align?: 'left' | 'right';
}

export function PenaltyCard({ penalty, teamName, mode = 'desktop', clock: mobileClock, align = 'left' }: PenaltyCardProps) {
  const { state } = useGameState();

  if (!state.config || !state.live) {
    return null;
  }

  const { config, live } = state;
  const clock = mobileClock || live.clock;
  const isMobile = mode === 'mobile';

  const matchedPlayer = React.useMemo(() => {
    const team = live.homeTeamName === teamName ? 'home' : 'away';
    const roster = live.matchContext ? (team === 'home' ? live.matchContext.homeRoster : live.matchContext.awayRoster) : [];
    return roster.find(p => p.number === penalty.playerNumber || (penalty.playerNumber === "S/N" && !p.number)) || null;
  }, [live.matchContext, live.homeTeamName, teamName, penalty.playerNumber]);

  const isWaitingSlot = penalty._status === 'pending_concurrent';
  const isPendingPuck = penalty._status === 'pending_puck';
  const doesNotReducePlayer = !penalty.reducesPlayerCount || penalty._doesNotReducePlayerCountOverride;

  const styles = {
    playerIconSize: isMobile ? 2 : config.scoreboardLayout.penaltyPlayerIconSize,
    playerNumberSize: isMobile ? '1.5rem' : `${config.scoreboardLayout.penaltyPlayerNumberSize}rem`,
    timeSize: isMobile ? '1.5rem' : `${config.scoreboardLayout.penaltyTimeSize}rem`,
    clockIconSize: isMobile ? '1.25rem' : `${config.scoreboardLayout.penaltyTimeSize * 0.6}rem`,
  };

  let remainingTimeCs: number;
  if (isMobile) {
    remainingTimeCs = penalty._visualRemainingTimeCs ?? (penalty.initialDuration * 100);
  } else if (penalty._status === 'running' && penalty.expirationTime !== undefined) {
    remainingTimeCs = Math.max(0, penalty.expirationTime - clock._liveAbsoluteElapsedTimeCs);
  } else {
    remainingTimeCs = penalty.initialDuration * 100;
  }

  const getDisplayNumber = () => {
    if (penalty.isBenchPenalty) return `Banco (#${penalty.playerNumber || 'S/N'})`;
    return `#${penalty.playerNumber || 'S/N'}`;
  };

  const renderPlayerAlias = () => {
    if (!config.showAliasInScoreboardPenalties || !matchedPlayer || !matchedPlayer.name || penalty.isBenchPenalty) return null;
    const name = matchedPlayer.name;
    const displayName = name.length > 10 ? name.substring(0, 8) + ".." : name;
    return (
      <span
        className="text-muted-foreground font-normal ml-2"
        title={name}
        style={{ fontSize: '0.6em', lineHeight: 1 }}
      >
        {displayName}
      </span>
    );
  };

  const getStatusText = () => {
    if (isPendingPuck) return "· Esperando Puck";
    if (isWaitingSlot) return "· Esp.";
    return null;
  };
  const statusText = getStatusText();

  if (mode === 'scoreboard') {
    const layout = config.scoreboardLayout;
    const nameColor = `hsl(${layout.penaltyNameColor ?? layout.penaltyTextColor ?? '0 0% 100%'})`;
    const clockColor = `hsl(${layout.penaltyClockColor ?? layout.penaltyTextColor ?? '220 15% 60%'})`;
    const numberStr = penalty.isBenchPenalty
      ? `Banco (#${penalty.playerNumber || 'S/N'})`
      : `#${penalty.playerNumber || 'S/N'}`;
    const playerName = !penalty.isBenchPenalty && matchedPlayer?.name ? matchedPlayer.name : null;

    // Symmetric: right side shows "Name #Number" (name first, number against edge)
    const playerLine = align === 'right' && playerName ? (
      <>
        <span style={{ fontSize: '0.65em', opacity: 0.5, marginRight: '0.3em' }}>{playerName}</span>
        <span>{numberStr}</span>
      </>
    ) : (
      <>
        <span>{numberStr}</span>
        {playerName && (
          <span style={{ fontSize: '0.65em', opacity: 0.5, marginLeft: '0.3em' }}>{playerName}</span>
        )}
      </>
    );

    const timeColor = isPendingPuck ? 'rgb(250 204 21)' : clockColor;
    const timeStyle: React.CSSProperties = doesNotReducePlayer && !isPendingPuck
      ? {
          fontSize: `${layout.penaltyTimeSize * 1.8}rem`,
          background: `repeating-linear-gradient(45deg, ${clockColor} 0px, ${clockColor} 3px, transparent 3px, transparent 8px)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }
      : {
          fontSize: `${layout.penaltyTimeSize * 1.8}rem`,
          color: timeColor,
        };

    return (
      <div
        className={cn(
          "flex flex-col",
          align === 'right' && "items-end",
          (isWaitingSlot || isPendingPuck) && "opacity-40"
        )}
      >
        <span
          className="font-medium leading-none mb-0.5"
          style={{ fontSize: `${layout.penaltyPlayerNumberSize * 0.85}rem`, color: nameColor }}
        >
          {playerLine}
        </span>
        <span
          className="font-bold font-headline tabular-nums leading-none"
          style={timeStyle}
        >
          {formatTime(remainingTimeCs, { showTenths: false, rounding: 'up', trimLeadingZero: true })}
        </span>
      </div>
    );
  }

  const accentColor = doesNotReducePlayer ? 'rgb(59,130,246)' : 'hsl(var(--destructive))';
  const bgStyle = doesNotReducePlayer
    ? 'rgba(59,130,246,0.06)'
    : 'rgba(255,255,255,0.03)';

  return (
    <div
      className={cn(
        "flex items-center gap-2 pr-3 py-1 rounded-sm overflow-hidden",
        (isWaitingSlot || isPendingPuck) && "opacity-40",
        doesNotReducePlayer && "opacity-70"
      )}
      style={{
        borderLeft: `3px solid ${accentColor}`,
        background: bgStyle,
        paddingLeft: '0.5rem',
      }}
    >
      <CagedUserIcon size={styles.playerIconSize} isBlue={doesNotReducePlayer} className="shrink-0" />
      <span
        className="font-bold leading-none"
        style={{ fontSize: styles.playerNumberSize }}
      >
        {getDisplayNumber()}
        {renderPlayerAlias()}
      </span>
      {statusText && (
        <span
          className={cn(
            "italic shrink-0",
            isPendingPuck ? "text-yellow-400" : "text-muted-foreground/70"
          )}
          style={{ fontSize: `${config.scoreboardLayout.penaltyTimeSize * 0.35}rem` }}
        >
          {statusText}
        </span>
      )}
      <div
        className="ml-auto flex items-center gap-1 font-mono text-accent shrink-0"
        style={{ fontSize: styles.timeSize, lineHeight: 1 }}
      >
        <Clock style={{ height: styles.clockIconSize, width: styles.clockIconSize }} />
        {formatTime(remainingTimeCs, { showTenths: false, rounding: 'up' })}
      </div>
    </div>
  );
}
