"use client";

import { useMemo } from 'react';
import type { Tournament } from '@/types';

interface TeamStats {
  id: string;
  name: string;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  pg_ot: number;
  pp_ot: number;
  gf: number;
  gc: number;
  puntos: number;
  rank: number;
}

interface TeamStatsWithChange extends TeamStats {
  positionChange: 'up' | 'down' | 'same';
  previousRank: number;
}

function calculateStandings(
  tournament: Tournament | null | undefined,
  categoryId: string,
  excludeMatchId?: string
): TeamStats[] {
  if (!tournament || !categoryId) return [];

  const finishedMatches = (tournament.matches || [])
    .filter(m => m.summary && m.categoryId === categoryId)
    .filter(m => !excludeMatchId || m.id !== excludeMatchId);

  const teamsInCategory = (tournament.teams || []).filter(t => t.category === categoryId);

  const stats: TeamStats[] = teamsInCategory.map(team => {
    const teamStats: any = {
      id: team.id,
      name: team.name,
      pj: 0, pg: 0, pe: 0, pp: 0, pg_ot: 0, pp_ot: 0, gf: 0, gc: 0, puntos: 0
    };

    finishedMatches
      .filter(m => m.homeTeamId === team.id || m.awayTeamId === team.id)
      .forEach(match => {
        if (!match.summary) return;

        teamStats.pj++;

        const homeGoals = (match.summary.statsByPeriod || []).reduce((acc, p) => acc + (p.stats.goals.home?.length ?? 0), 0) + (match.summary.shootout?.homeAttempts.filter(a => a.isGoal).length ?? 0);
        const awayGoals = (match.summary.statsByPeriod || []).reduce((acc, p) => acc + (p.stats.goals.away?.length ?? 0), 0) + (match.summary.shootout?.awayAttempts.filter(a => a.isGoal).length ?? 0);

        const wentToOTOrSO = match.overTimeOrShootouts || false;
        const isHome = match.homeTeamId === team.id;

        teamStats.gf += isHome ? homeGoals : awayGoals;
        teamStats.gc += isHome ? awayGoals : homeGoals;

        if (homeGoals > awayGoals) {
          if (isHome) {
            if (wentToOTOrSO) teamStats.pg_ot++; else teamStats.pg++;
          } else {
            if (wentToOTOrSO) teamStats.pp_ot++; else teamStats.pp++;
          }
        } else if (awayGoals > homeGoals) {
          if (!isHome) {
            if (wentToOTOrSO) teamStats.pg_ot++; else teamStats.pg++;
          } else {
            if (wentToOTOrSO) teamStats.pp_ot++; else teamStats.pp++;
          }
        } else {
          teamStats.pe++;
        }
      });

    teamStats.puntos = (teamStats.pg * 3) + (teamStats.pe * 1) + (teamStats.pg_ot * 2) + (teamStats.pp_ot * 1);
    return teamStats;
  });

  // Sort stats
  stats.sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    const diffA = a.gf - a.gc;
    const diffB = b.gf - b.gc;
    if(diffB !== diffA) return diffB - diffA;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.pj - b.pj;
  });

  const rankedStats: TeamStats[] = [];
  if (stats.length > 0) {
    rankedStats.push({ ...stats[0], rank: 1 });
    for (let i = 1; i < stats.length; i++) {
      const prevTeam = stats[i - 1];
      const currentTeam = stats[i];
      const prevRankedTeam = rankedStats[i - 1];

      const diffA = currentTeam.gf - currentTeam.gc;
      const diffB = prevTeam.gf - prevTeam.gc;

      let rank = prevRankedTeam.rank;
      if (currentTeam.puntos !== prevTeam.puntos || diffA !== diffB || currentTeam.gf !== prevTeam.gf) {
        rank = i + 1;
      }
      rankedStats.push({ ...currentTeam, rank });
    }
  }

  return rankedStats;
}

export function useStandingsWithChanges(
  tournament: Tournament | null | undefined,
  categoryId: string,
  currentMatchId?: string
): TeamStatsWithChange[] {
  const standingsWithChanges = useMemo(() => {
    if (!tournament || !categoryId || !currentMatchId) {
      // If no current match, just return current standings without changes
      const current = calculateStandings(tournament, categoryId);
      return current.map(team => ({
        ...team,
        positionChange: 'same' as const,
        previousRank: team.rank
      }));
    }

    // Calculate standings BEFORE this match (excluding current match)
    const standingsBefore = calculateStandings(tournament, categoryId, currentMatchId);

    // Calculate standings AFTER this match (including current match)
    const standingsAfter = calculateStandings(tournament, categoryId);

    // Create a map of previous ranks
    const previousRanks = new Map<string, number>();
    standingsBefore.forEach(team => {
      previousRanks.set(team.id, team.rank);
    });

    // Compare and add change indicators
    return standingsAfter.map(team => {
      const previousRank = previousRanks.get(team.id) ?? team.rank;
      let positionChange: 'up' | 'down' | 'same' = 'same';

      if (previousRank > team.rank) {
        positionChange = 'up'; // Moved up (lower rank number = better position)
      } else if (previousRank < team.rank) {
        positionChange = 'down'; // Moved down
      }

      return {
        ...team,
        positionChange,
        previousRank
      };
    });
  }, [tournament, categoryId, currentMatchId]);

  return standingsWithChanges;
}
