"use client";

import { useGameState } from '@/contexts/game-state-context';
import { useMemo } from 'react';
import { formatTime } from '@/lib/game-helpers';
import { cn } from '@/lib/utils';
import type { Penalty, Team } from '@/types';

interface PenaltyNotification {
  penalty: Penalty;
  team: Team;
  teamName: string;
  remainingTime: number;
}

export function PenaltyNotifications() {
  const { state } = useGameState();

  if (!state.config || !state.live) {
    return null;
  }

  const { live, config } = state;
  const { penalties, clock, homeTeamName, awayTeamName } = live;

  // Get penalties that are about to expire (less than 15 seconds)
  const expiringPenalties = useMemo(() => {
    const notifications: PenaltyNotification[] = [];
    const threshold = 15 * 100; // 15 seconds in centiseconds

    // Check home penalties
    penalties.home.forEach(penalty => {
      if (penalty._status === 'running' && penalty.expirationTime !== undefined) {
        const remainingTime = Math.max(0, penalty.expirationTime - clock._liveAbsoluteElapsedTimeCs);

        if (remainingTime > 0 && remainingTime <= threshold) {
          notifications.push({
            penalty,
            team: 'home',
            teamName: homeTeamName,
            remainingTime,
          });
        }
      }
    });

    // Check away penalties
    penalties.away.forEach(penalty => {
      if (penalty._status === 'running' && penalty.expirationTime !== undefined) {
        const remainingTime = Math.max(0, penalty.expirationTime - clock._liveAbsoluteElapsedTimeCs);

        if (remainingTime > 0 && remainingTime <= threshold) {
          notifications.push({
            penalty,
            team: 'away',
            teamName: awayTeamName,
            remainingTime,
          });
        }
      }
    });

    // Sort by remaining time (earliest first)
    return notifications.sort((a, b) => a.remainingTime - b.remainingTime);
  }, [penalties, clock._liveAbsoluteElapsedTimeCs, homeTeamName, awayTeamName]);

  // Don't render anything if there are no expiring penalties
  if (expiringPenalties.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 px-4 mt-4 max-w-7xl mx-auto">
      {expiringPenalties.map(({ penalty, team, teamName, remainingTime }) => {
        const shouldBlink = remainingTime <= 10 * 100; // Less than 10 seconds
        const timeFormatted = formatTime(remainingTime);

        return (
          <div
            key={penalty.id}
            className={cn(
              "flex items-center justify-between px-6 py-3 rounded-lg",
              "bg-amber-500/20 border-2 border-amber-500/50",
              "backdrop-blur-sm shadow-lg",
              "transition-all duration-300",
              shouldBlink && "animate-pulse"
            )}
            style={{
              animation: shouldBlink ? 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite' : undefined
            }}
          >
            <div className="flex items-center gap-4">
              <span className="font-bold text-2xl text-amber-400">
                #{penalty.playerNumber}
              </span>
              <span className="text-base text-foreground/90 font-medium">
                {teamName}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground uppercase tracking-wide">
                Finaliza en
              </span>
              <span className={cn(
                "font-mono font-bold text-2xl",
                shouldBlink ? "text-red-400" : "text-amber-400"
              )}>
                {timeFormatted}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
