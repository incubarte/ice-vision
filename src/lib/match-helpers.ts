/**
 * Helper functions for calculating match data from game summaries
 * This ensures a single source of truth for match results
 */

import type { GameSummary } from '@/types';

/**
 * Calculates the final score from a game summary
 * Includes physical goals from all periods + winner bonus from shootout
 */
export function calculateScoreFromSummary(summary: GameSummary): { home: number; away: number } {
  // Count physical goals from all periods
  let homeScore = (summary.statsByPeriod || []).reduce(
    (acc, p) => acc + (p.stats.goals.home?.length ?? 0),
    0
  );
  let awayScore = (summary.statsByPeriod || []).reduce(
    (acc, p) => acc + (p.stats.goals.away?.length ?? 0),
    0
  );

  // If there was a shootout, add +1 to the winner (not the total penalty goals)
  if (summary.shootout) {
    const homeShootoutGoals = summary.shootout.homeAttempts.filter(a => a.isGoal).length;
    const awayShootoutGoals = summary.shootout.awayAttempts.filter(a => a.isGoal).length;

    if (homeShootoutGoals > awayShootoutGoals) {
      homeScore += 1;
    } else if (awayShootoutGoals > homeShootoutGoals) {
      awayScore += 1;
    }
  }

  return { home: homeScore, away: awayScore };
}

/**
 * Checks if a match went to overtime or shootout
 */
export function hasOvertimeOrShootout(summary: GameSummary): boolean {
  return summary.overTimeOrShootouts || false;
}
