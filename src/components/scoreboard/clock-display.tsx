
"use client";

import { useGameState, formatTime, getActualPeriodText, getPeriodText } from '@/contexts/game-state-context';
import { cn } from '@/lib/utils';
import { Trophy } from 'lucide-react';

interface ClockDisplayProps {
  className?: string;
}

export function ClockDisplay({ className }: ClockDisplayProps) {
  const { state } = useGameState();

  // Guard against rendering with incomplete state during hydration
  if (!state.config || !state.live || !state.live.clock) {
    return null; 
  }

  const { scoreboardLayout } = state.config;
  const { clock, score, homeTeamName, awayTeamName } = state.live;

  const isMainClockLastMinute = clock.currentTime < 6000 && clock.currentTime >= 0 &&
                                (clock.periodDisplayOverride !== "End of Game" && (clock.periodDisplayOverride !== null || clock.currentPeriod >= 0));

  const preTimeoutTimeCs = clock.preTimeoutState?.time;
  const isPreTimeoutLastMinute = typeof preTimeoutTimeCs === 'number' && preTimeoutTimeCs < 6000 && preTimeoutTimeCs >= 0;

  const getStatusText = () => {
    if (clock.periodDisplayOverride === 'Time Out' && clock.preTimeoutState?.team) {
        return `TIMEOUT ${clock.preTimeoutState.team === 'home' ? homeTeamName : awayTeamName}`;
    }
    if (clock.periodDisplayOverride === 'End of Game') {
      if (score.home > score.away) return <span className="truncate">{homeTeamName || 'Local'}</span>;
      if (score.away > score.home) return <span className="truncate">{awayTeamName || 'Visitante'}</span>;
      return "EMPATE";
    }
    return getActualPeriodText(clock.currentPeriod, clock.periodDisplayOverride, state.config.numberOfRegularPeriods, state.live.shootout);
  };

  const isWinnerState = clock.periodDisplayOverride === 'End of Game' && score.home !== score.away;
  const formattedTime = clock.isFlashingZero ? "00:00" : formatTime(clock.currentTime, { showTenths: isMainClockLastMinute, includeMinutesForTenths: false });
  const showClock = !isWinnerState && clock.periodDisplayOverride !== 'AwaitingDecision' && clock.periodDisplayOverride !== "End of Game";

  // Split time into main part and tenths for different sizing
  const timeHasTenths = isMainClockLastMinute && !clock.isFlashingZero && formattedTime.includes('.');
  const [mainTime, tenths] = timeHasTenths ? formattedTime.split('.') : [formattedTime, null];

  return (
    <div className={cn("text-center", className)}>
      <div
        className={cn(
          "font-bold font-headline tabular-nums tracking-tighter transition-opacity duration-300 flex items-center justify-center",
          isWinnerState ? "text-accent" : (isMainClockLastMinute ? "text-orange-500" : "text-accent"),
          clock.isFlashingZero && "animate-flashing-clock"
        )}
        style={{ fontSize: `${scoreboardLayout.clockSize}rem`, lineHeight: 1 }}
        >
        {isWinnerState ? (
            <Trophy className="w-[0.75em] h-[0.75em]" />
        ) : (
            showClock && (
              timeHasTenths ? (
                <>
                  {mainTime}
                  <span style={{ fontSize: '0.75em', alignSelf: 'flex-end' }}>.{tenths}</span>
                </>
              ) : (
                formattedTime
              )
            )
        )}
      </div>
      
      <div 
        className="mt-1 font-semibold text-primary-foreground uppercase tracking-wider relative"
        style={{ fontSize: `${scoreboardLayout.periodSize}rem`, lineHeight: 1.1 }}
      >
        <div className="inline-block relative">
          <span>
            {getStatusText()}
          </span>
          {!clock.isClockRunning && clock.currentTime > 0 && clock.periodDisplayOverride !== "End of Game" && clock.periodDisplayOverride !== 'AwaitingDecision' && !clock.isFlashingZero && (
            <span
              className="absolute left-full top-1/2 transform -translate-y-1/2 ml-3 font-normal text-muted-foreground normal-case tracking-normal px-2 py-1 bg-background/50 rounded-md whitespace-nowrap"
              style={{ fontSize: '0.4em', lineHeight: 'normal' }}
            >
              Paused
            </span>
          )}
        </div>
      </div>
      {clock.preTimeoutState && clock.periodDisplayOverride !== "End of Game" && (
        <div className="text-xs mt-1 normal-case tracking-normal text-white"
          style={{ fontSize: `${scoreboardLayout.periodSize * 0.45}rem` }}
          >
          Retornando a: <span style={{ fontSize: '1.2em' }}>{getPeriodText(clock.preTimeoutState.period, state.config.numberOfRegularPeriods)} - {formatTime(clock.preTimeoutState.time, { showTenths: isPreTimeoutLastMinute, includeMinutesForTenths: false })}</span>
          {clock.preTimeoutState.override ? ` (${clock.preTimeoutState.override})` : ''}
        </div>
      )}
    </div>
  );
}
