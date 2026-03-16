"use client";

import { useMemo } from 'react';
import type { Tournament } from '@/types';

export interface GoalkeeperPeriodStats {
  period: string;
  shotsAgainst: number;
  goalsAgainst: number;
  saves: number; // atajados
  savePercentage: number; // % efectividad
  timeOnIce: number; // in centiseconds
}

export interface GoalkeeperStats {
  playerId: string;
  playerName: string;
  playerNumber: string;
  teamId: string;
  teamName: string;
  categoryName: string;
  totalShotsAgainst: number;
  totalGoalsAgainst: number;
  totalSaves: number; // total atajados
  savePercentage: number; // % total efectividad
  totalTimeOnIce: number; // in centiseconds
  matchesPlayed: number; // partidos jugados
  periodStats: GoalkeeperPeriodStats[];
}

export function useGoalkeeperStats(tournament: Tournament | null | undefined, categoryId: string | null) {
  const goalkeeperStats = useMemo(() => {
    if (!tournament) return [];

    let finishedMatches = tournament.matches || [];
    if (categoryId) {
      finishedMatches = finishedMatches.filter(m => m.categoryId === categoryId);
    }
    finishedMatches = finishedMatches.filter(m => m.summary);

    const statsMap = new Map<string, GoalkeeperStats>();
    const allTeams = tournament.teams || [];
    const allCategories = tournament.categories || [];

    // Initialize all goalkeepers
    allTeams.forEach(team => {
      if (!categoryId || team.category === categoryId) {
        const category = allCategories.find(c => c.id === team.category);
        team.players.filter(p => p.type === 'goalkeeper').forEach(gk => {
          if (!statsMap.has(gk.id)) {
            statsMap.set(gk.id, {
              playerId: gk.id,
              playerName: gk.name,
              playerNumber: gk.number,
              teamId: team.id,
              teamName: team.name,
              categoryName: category?.name || 'N/A',
              totalShotsAgainst: 0,
              totalGoalsAgainst: 0,
              totalSaves: 0,
              savePercentage: 0,
              totalTimeOnIce: 0,
              matchesPlayed: 0,
              periodStats: []
            });
          }
        });
      }
    });

    finishedMatches.forEach(match => {
      if (!match.summary || !match.summary.statsByPeriod) return;

      const homeTeam = allTeams.find(t => t.id === match.homeTeamId);
      const awayTeam = allTeams.find(t => t.id === match.awayTeamId);
      if (!homeTeam || !awayTeam) return;

      // Track goalkeepers who played in this match
      const goalkeeperPlayedInMatch = new Set<string>();

      // Track the last active goalkeeper for each team across periods
      let lastHomeGKId: string | null = null;
      let lastAwayGKId: string | null = null;

      match.summary.statsByPeriod.forEach(period => {
        const periodName = period.period;
        const periodDuration = period.periodDuration || 0;

        // Get goalkeeper changes for this period
        let homeGKChanges = period.goalkeeperChangesLog?.home || [];
        let awayGKChanges = period.goalkeeperChangesLog?.away || [];

        // If we have a last active GK from previous period, check if we need to add implicit change
        if (lastHomeGKId) {
          // If no changes in period, GK plays whole period
          if (homeGKChanges.length === 0) {
            homeGKChanges = [{ playerId: lastHomeGKId, gameTime: periodDuration, timestamp: 0, periodText: '' }];
          }
          // If first change is not at period start, add implicit change for continuation
          else if (homeGKChanges[0].gameTime < periodDuration) {
            homeGKChanges = [{ playerId: lastHomeGKId, gameTime: periodDuration, timestamp: 0, periodText: '' }, ...homeGKChanges];
          }
        }
        if (lastAwayGKId) {
          if (awayGKChanges.length === 0) {
            awayGKChanges = [{ playerId: lastAwayGKId, gameTime: periodDuration, timestamp: 0, periodText: '' }];
          }
          else if (awayGKChanges[0].gameTime < periodDuration) {
            awayGKChanges = [{ playerId: lastAwayGKId, gameTime: periodDuration, timestamp: 0, periodText: '' }, ...awayGKChanges];
          }
        }

        // Sort by gameTime descending (clock counts down, so higher time = earlier)
        homeGKChanges = homeGKChanges.sort((a, b) => b.gameTime - a.gameTime);
        awayGKChanges = awayGKChanges.sort((a, b) => b.gameTime - a.gameTime);

        // Process home goalkeepers
        processGoalkeepersForTeam(
          'home',
          homeTeam,
          homeGKChanges,
          period.stats.goals.away || [], // Goals against = away team's goals
          period.stats.playerStats.away || [], // Shots against = away team's shots
          periodName,
          periodDuration,
          statsMap,
          goalkeeperPlayedInMatch
        );

        // Process away goalkeepers
        processGoalkeepersForTeam(
          'away',
          awayTeam,
          awayGKChanges,
          period.stats.goals.home || [], // Goals against = home team's goals
          period.stats.playerStats.home || [], // Shots against = home team's shots
          periodName,
          periodDuration,
          statsMap,
          goalkeeperPlayedInMatch
        );

        // Update last active goalkeeper for next period
        if (homeGKChanges.length > 0) {
          // The last change in the array is the one active at the end of the period
          lastHomeGKId = homeGKChanges[homeGKChanges.length - 1].playerId;
        }
        if (awayGKChanges.length > 0) {
          lastAwayGKId = awayGKChanges[awayGKChanges.length - 1].playerId;
        }
      });

      // After processing all periods in this match, increment matchesPlayed for each GK that played
      goalkeeperPlayedInMatch.forEach(gkId => {
        const stat = statsMap.get(gkId);
        if (stat) {
          stat.matchesPlayed++;
        }
      });
    });

    // Convert to array (include ALL goalkeepers, even those with no time)
    const statsArray = Array.from(statsMap.values());

    // Calculate final save percentages
    statsArray.forEach(stat => {
      stat.savePercentage = stat.totalShotsAgainst > 0
        ? Math.round((stat.totalSaves / stat.totalShotsAgainst) * 100)
        : 0;
    });

    // Sort by save percentage (best first), goalkeepers without shots go last
    statsArray.sort((a, b) => {
      // Goalkeepers without shots go to the end
      const aHasShots = a.totalShotsAgainst > 0;
      const bHasShots = b.totalShotsAgainst > 0;

      if (aHasShots && !bHasShots) return -1;
      if (!aHasShots && bHasShots) return 1;

      // Both have shots, sort by save percentage (descending)
      if (aHasShots && bHasShots) {
        if (b.savePercentage !== a.savePercentage) return b.savePercentage - a.savePercentage;
      }

      // Tie-breaker: more time on ice first
      if (b.totalTimeOnIce !== a.totalTimeOnIce) return b.totalTimeOnIce - a.totalTimeOnIce;

      // Final tie-breaker: alphabetical by name
      return a.playerName.localeCompare(b.playerName);
    });

    return statsArray;
  }, [tournament, categoryId]);

  return goalkeeperStats;
}

function processGoalkeepersForTeam(
  team: 'home' | 'away',
  teamData: any,
  gkChanges: any[],
  goalsAgainst: any[],
  opponentPlayerStats: any[],
  periodName: string,
  periodDuration: number,
  statsMap: Map<string, GoalkeeperStats>,
  goalkeeperPlayedInMatch?: Set<string>
) {
  // If no goalkeeper changes, skip
  if (gkChanges.length === 0) return;

  // Build time ranges for each goalkeeper
  const gkTimeRanges: { playerId: string; startTime: number; endTime: number }[] = [];

  for (let i = 0; i < gkChanges.length; i++) {
    const change = gkChanges[i];
    const startTime = change.gameTime;
    const endTime = i < gkChanges.length - 1 ? gkChanges[i + 1].gameTime : 0; // 0 = end of period

    gkTimeRanges.push({
      playerId: change.playerId,
      startTime,
      endTime
    });
  }

  // Process each goalkeeper that played in this period
  const gkIdsInPeriod = new Set(gkChanges.map(c => c.playerId));

  gkIdsInPeriod.forEach(gkId => {
    const gkPlayer = teamData.players.find((p: any) => p.id === gkId);
    if (!gkPlayer || !statsMap.has(gkId)) return;

    const stat = statsMap.get(gkId)!;

    // Calculate time on ice for this goalkeeper in this period
    // Clock counts DOWN from periodDuration to 0
    // startTime > endTime (e.g., enter at 71052, exit at 0 means played 71052 centiseconds)
    let timeOnIce = 0;
    gkTimeRanges.filter(r => r.playerId === gkId).forEach(range => {
      const timePlayed = range.startTime - range.endTime; // endTime=0 means played until end
      timeOnIce += timePlayed;
    });

    // Track that this goalkeeper played in this match (if they have time on ice)
    if (timeOnIce > 0 && goalkeeperPlayedInMatch) {
      goalkeeperPlayedInMatch.add(gkId);
    }

    // Count goals against during this goalkeeper's time
    let goalsAgainstCount = 0;
    goalsAgainst.forEach(goal => {
      const goalTime = goal.gameTime || 0;
      // Find which goalkeeper was active at this time
      const activeRange = gkTimeRanges.find(r =>
        (r.endTime === 0 ? goalTime <= r.startTime : goalTime <= r.startTime && goalTime > r.endTime)
      );
      if (activeRange && activeRange.playerId === gkId) {
        goalsAgainstCount++;
      }
    });

    // Count shots against during this goalkeeper's time
    // Shots are recorded in opponent player stats with gameTime
    let shotsAgainstCount = 0;
    opponentPlayerStats.forEach(playerStat => {
      if (playerStat.shotTimes && Array.isArray(playerStat.shotTimes)) {
        // Count shots that happened during this goalkeeper's time
        playerStat.shotTimes.forEach((shotTime: number) => {
          // Find which goalkeeper was active at this time
          const activeRange = gkTimeRanges.find(r =>
            (r.endTime === 0 ? shotTime <= r.startTime : shotTime <= r.startTime && shotTime > r.endTime)
          );
          if (activeRange && activeRange.playerId === gkId) {
            shotsAgainstCount++;
          }
        });
      }
    });

    // Calculate saves (atajados) = shots against - goals against
    const savesCount = Math.max(0, shotsAgainstCount - goalsAgainstCount);

    // Calculate save percentage
    const savePercentage = shotsAgainstCount > 0
      ? Math.round((savesCount / shotsAgainstCount) * 100)
      : 0;

    // Find or create period stats
    let periodStat = stat.periodStats.find(p => p.period === periodName);
    if (!periodStat) {
      periodStat = {
        period: periodName,
        shotsAgainst: 0,
        goalsAgainst: 0,
        saves: 0,
        savePercentage: 0,
        timeOnIce: 0
      };
      stat.periodStats.push(periodStat);
    }

    // Update period stats
    periodStat.shotsAgainst += shotsAgainstCount;
    periodStat.goalsAgainst += goalsAgainstCount;
    periodStat.saves += savesCount;
    periodStat.savePercentage = savePercentage; // Recalculate each time
    periodStat.timeOnIce += timeOnIce;

    // Update totals
    stat.totalShotsAgainst += shotsAgainstCount;
    stat.totalGoalsAgainst += goalsAgainstCount;
    stat.totalSaves += savesCount;
    stat.totalTimeOnIce += timeOnIce;
  });
}
