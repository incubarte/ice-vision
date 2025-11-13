"use client";

import { useGameState, getCategoryNameById } from '@/contexts/game-state-context';
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

  const { config, live } = state;
  const { tournaments, selectedTournamentId, selectedMatchCategory } = config;
  const { homeTeamName, awayTeamName, homeTeamSubName, awayTeamSubName } = live;

  const selectedTournament = useMemo(() => {
    return (tournaments || []).find(t => t.id === selectedTournamentId);
  }, [tournaments, selectedTournamentId]);

  const homeTeamData = useMemo(() => {
    if (!selectedTournament || !selectedTournament.teams) return null;
    return selectedTournament.teams.find(t =>
      t.name === homeTeamName &&
      (t.subName || undefined) === (homeTeamSubName || undefined) &&
      t.category === selectedMatchCategory
    );
  }, [selectedTournament, homeTeamName, homeTeamSubName, selectedMatchCategory]);

  const awayTeamData = useMemo(() => {
    if (!selectedTournament || !selectedTournament.teams) return null;
    return selectedTournament.teams.find(t =>
      t.name === awayTeamName &&
      (t.subName || undefined) === (awayTeamSubName || undefined) &&
      t.category === selectedMatchCategory
    );
  }, [selectedTournament, awayTeamName, awayTeamSubName, selectedMatchCategory]);

  return {
    homeLogoDataUrl: homeTeamData?.logoDataUrl || null,
    awayLogoDataUrl: awayTeamData?.logoDataUrl || null,
  };
}

export function CompactHeaderScoreboard() {
  const { state } = useGameState();

  if (!state.config || !state.live) {
    return null; // or a loading component
  }

  const { config, live } = state;
  const { tournaments, selectedTournamentId, scoreboardLayout, playersPerTeamOnIce, selectedMatchCategory } = config;
  const { penalties, score, homeTeamName, awayTeamName, homeTeamSubName, awayTeamSubName } = live;

  const activeHomePenaltiesCount = penalties.home.filter(p => p._status === 'running' && (p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride)).length;
  const playersOnIceForHome = Math.max(0, playersPerTeamOnIce - activeHomePenaltiesCount);

  const activeAwayPenaltiesCount = penalties.away.filter(p => p._status === 'running' && (p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride)).length;
  const playersOnIceForAway = Math.max(0, playersPerTeamOnIce - activeAwayPenaltiesCount);

  const selectedTournament = useMemo(() => {
    return (tournaments || []).find(t => t.id === selectedTournamentId);
  }, [tournaments, selectedTournamentId]);

  const homeTeamData = useMemo(() => {
    if (!selectedTournament || !selectedTournament.teams) return null;
    return selectedTournament.teams.find(t =>
      t.name === homeTeamName &&
      (t.subName || undefined) === (homeTeamSubName || undefined) &&
      t.category === selectedMatchCategory
    );
  }, [selectedTournament, homeTeamName, homeTeamSubName, selectedMatchCategory]);

  const awayTeamData = useMemo(() => {
    if (!selectedTournament || !selectedTournament.teams) return null;
    return selectedTournament.teams.find(t =>
      t.name === awayTeamName &&
      (t.subName || undefined) === (awayTeamSubName || undefined) &&
      t.category === selectedMatchCategory
    );
  }, [selectedTournament, awayTeamName, awayTeamSubName, selectedMatchCategory]);

  const matchCategoryName = getCategoryNameById(selectedMatchCategory, selectedTournament?.categories);

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
          logoDataUrl={homeTeamData?.logoDataUrl}
        />
        <ClockDisplay />
        <TeamScoreDisplay 
          teamActualName={awayTeamName} 
          teamDisplayName="Visitante" 
          score={score.away} 
          playersOnIce={playersOnIceForAway}
          configuredPlayersPerTeam={playersPerTeamOnIce}
          layout={scoreboardLayout}
          logoDataUrl={awayTeamData?.logoDataUrl}
        />
      </CardContent>
    </Card>
  );
}
