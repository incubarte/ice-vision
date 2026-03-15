"use client";

import { useGameState } from '@/contexts/game-state-context';
import { Card, CardContent } from '@/components/ui/card';
import { ClockDisplay } from './clock-display';
import { TeamScoreDisplay } from './team-score-display';
import { ListFilter } from 'lucide-react'; // Icon for category
import { useMemo } from 'react';

// Hook to get team logos for use in other components
export function useTeamLogos() {
  const { state } = useGameState();

  if (!state.config || !state.live) {
    return { homeLogoDataUrl: null, awayLogoDataUrl: null };
  }

  const matchContext = state.live.matchContext;

  return {
    homeLogoDataUrl: matchContext?.homeTeamLogoDataUrl || null,
    awayLogoDataUrl: matchContext?.awayTeamLogoDataUrl || null,
  };
}

export function CompactHeaderScoreboard() {
  const { state } = useGameState();

  if (!state.config || !state.live) {
    return null; // or a loading component
  }

  const { config, live } = state;
  const { scoreboardLayout, playersPerTeamOnIce } = config;
  const { penalties, score, homeTeamName, awayTeamName, matchContext } = live;

  const activeHomePenaltiesCount = penalties.home.filter(p => p._status === 'running' && (p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride)).length;
  const playersOnIceForHome = Math.max(0, playersPerTeamOnIce - activeHomePenaltiesCount);

  const activeAwayPenaltiesCount = penalties.away.filter(p => p._status === 'running' && (p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride)).length;
  const playersOnIceForAway = Math.max(0, playersPerTeamOnIce - activeAwayPenaltiesCount);

  const matchCategoryName = matchContext?.categoryName || null;

  return (
    <Card className="bg-card shadow-xl relative">
       {matchCategoryName && (
        <div 
          className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 md:bottom-4 md:left-4 flex items-baseline gap-1 px-2 py-1 bg-primary/20 text-primary-foreground rounded-md backdrop-blur-sm z-10"
          style={{ fontSize: `${scoreboardLayout.categorySize}rem`}}
        >
            <span className="opacity-80">Cat.</span>
            <span className="font-semibold">{matchCategoryName}</span>
        </div>
      )}
      <CardContent className="p-4 md:p-6 grid grid-cols-[auto_1fr_auto] items-center gap-x-6 md:gap-x-8 lg:gap-x-10">
        <TeamScoreDisplay 
          teamActualName={homeTeamName} 
          teamDisplayName="Local" 
          score={score.home}
          playersOnIce={playersOnIceForHome}
          configuredPlayersPerTeam={playersPerTeamOnIce}
          layout={scoreboardLayout}
          logoDataUrl={matchContext?.homeTeamLogoDataUrl}
        />
        <ClockDisplay />
        <TeamScoreDisplay
          teamActualName={awayTeamName}
          teamDisplayName="Visitante"
          score={score.away}
          playersOnIce={playersOnIceForAway}
          configuredPlayersPerTeam={playersPerTeamOnIce}
          layout={scoreboardLayout}
          logoDataUrl={matchContext?.awayTeamLogoDataUrl}
        />
      </CardContent>
    </Card>
  );
}
