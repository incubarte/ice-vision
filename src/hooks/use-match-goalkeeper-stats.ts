"use client";

import { useMemo } from 'react';
import type { GameSummary, PlayerData } from '@/types';
import type { GoalkeeperStats, GoalkeeperPeriodStats } from './use-goalkeeper-stats';

export function useMatchGoalkeeperStats(
  summary: GameSummary | undefined,
  homeTeam: { players: PlayerData[] } | undefined,
  awayTeam: { players: PlayerData[] } | undefined
): { home: GoalkeeperStats[], away: GoalkeeperStats[] } {
  const goalkeeperStats = useMemo(() => {
    if (!summary || !homeTeam || !awayTeam) {
      return { home: [], away: [] };
    }

    const homeGKMap = new Map<string, GoalkeeperStats>();
    const awayGKMap = new Map<string, GoalkeeperStats>();

    // Initialize goalkeeper maps
    homeTeam.players.filter(p => p.type === 'goalkeeper').forEach(gk => {
      homeGKMap.set(gk.id, {
        playerId: gk.id,
        playerName: gk.name,
        playerNumber: gk.number,
        teamId: '',
        teamName: '',
        categoryName: '',
        totalShotsAgainst: 0,
        totalGoalsAgainst: 0,
        totalSaves: 0,
        savePercentage: 0,
        totalTimeOnIce: 0,
        matchesPlayed: 1, // Single match context
        periodStats: []
      });
    });

    awayTeam.players.filter(p => p.type === 'goalkeeper').forEach(gk => {
      awayGKMap.set(gk.id, {
        playerId: gk.id,
        playerName: gk.name,
        playerNumber: gk.number,
        teamId: '',
        teamName: '',
        categoryName: '',
        totalShotsAgainst: 0,
        totalGoalsAgainst: 0,
        totalSaves: 0,
        savePercentage: 0,
        totalTimeOnIce: 0,
        matchesPlayed: 1, // Single match context
        periodStats: []
      });
    });

    // Track the last active goalkeeper for each team across periods
    let lastHomeGKId: string | null = null;
    let lastAwayGKId: string | null = null;

    // Process each period
    (summary.statsByPeriod || []).forEach(period => {
      const periodName = period.period;
      const periodDuration = period.periodDuration || 120000;

      let homeGKChanges = period.goalkeeperChangesLog?.home || [];
      let awayGKChanges = period.goalkeeperChangesLog?.away || [];

      console.log(`[GK Debug] ========== Period ${periodName} START ==========`);
      console.log(`[GK Debug] Period ${periodName} periodDuration =`, periodDuration);
      console.log(`[GK Debug] Period ${periodName} BEFORE implicit: home changes =`, homeGKChanges.map(c => ({ id: c.playerId, time: c.gameTime })), 'lastHomeGKId =', lastHomeGKId);
      console.log(`[GK Debug] Period ${periodName} BEFORE implicit: away changes =`, awayGKChanges.map(c => ({ id: c.playerId, time: c.gameTime })), 'lastAwayGKId =', lastAwayGKId);

      // If we have a last active GK from previous period, check if we need to add implicit change
      if (lastHomeGKId) {
        // If no changes in period, GK plays whole period
        if (homeGKChanges.length === 0) {
          console.log(`[GK Debug] Adding implicit home GK for ${periodName}: ${lastHomeGKId} at ${periodDuration}`);
          homeGKChanges = [{ playerId: lastHomeGKId, gameTime: periodDuration, timestamp: 0, periodText: '' }];
        }
        // If first change is not at period start, add implicit change for continuation
        else if (homeGKChanges[0].gameTime < periodDuration) {
          console.log(`[GK Debug] Adding implicit continuation home GK for ${periodName}: ${lastHomeGKId}`);
          homeGKChanges = [{ playerId: lastHomeGKId, gameTime: periodDuration, timestamp: 0, periodText: '' }, ...homeGKChanges];
        }
      }
      if (lastAwayGKId) {
        if (awayGKChanges.length === 0) {
          console.log(`[GK Debug] Adding implicit away GK for ${periodName}: ${lastAwayGKId} at ${periodDuration}`);
          awayGKChanges = [{ playerId: lastAwayGKId, gameTime: periodDuration, timestamp: 0, periodText: '' }];
        }
        else if (awayGKChanges[0].gameTime < periodDuration) {
          console.log(`[GK Debug] Adding implicit continuation away GK for ${periodName}: ${lastAwayGKId}`);
          awayGKChanges = [{ playerId: lastAwayGKId, gameTime: periodDuration, timestamp: 0, periodText: '' }, ...awayGKChanges];
        }
      }

      // Sort by gameTime descending (clock counts down, so higher time = earlier)
      homeGKChanges = homeGKChanges.sort((a, b) => b.gameTime - a.gameTime);
      awayGKChanges = awayGKChanges.sort((a, b) => b.gameTime - a.gameTime);

      console.log(`[GK Debug] Period ${periodName} AFTER sort: homeGKChanges.length=${homeGKChanges.length}, home changes:`, homeGKChanges.map(c => ({ id: c.playerId, time: c.gameTime })));
      console.log(`[GK Debug] Period ${periodName} AFTER sort: awayGKChanges.length=${awayGKChanges.length}, away changes:`, awayGKChanges.map(c => ({ id: c.playerId, time: c.gameTime })));

      // Process home goalkeepers
      processGoalkeepersForPeriod(
        homeGKMap,
        homeTeam.players,
        homeGKChanges,
        period.stats.goals.away || [], // Goals against = away team's goals
        period.stats.playerStats.away || [], // Shots against = away team's player stats
        periodName,
        periodDuration
      );

      // Process away goalkeepers
      processGoalkeepersForPeriod(
        awayGKMap,
        awayTeam.players,
        awayGKChanges,
        period.stats.goals.home || [], // Goals against = home team's goals
        period.stats.playerStats.home || [], // Shots against = home team's player stats
        periodName,
        periodDuration
      );

      // Update last active goalkeeper for next period
      if (homeGKChanges.length > 0) {
        lastHomeGKId = homeGKChanges[homeGKChanges.length - 1].playerId;
        console.log(`[GK Debug] Period ${periodName} END: lastHomeGKId set to`, lastHomeGKId);
      }
      if (awayGKChanges.length > 0) {
        lastAwayGKId = awayGKChanges[awayGKChanges.length - 1].playerId;
        console.log(`[GK Debug] Period ${periodName} END: lastAwayGKId set to`, lastAwayGKId);
      }
    });

    // Calculate final percentages (include ALL goalkeepers, even those with no time)
    const homeGKArray = Array.from(homeGKMap.values())
      .map(stat => ({
        ...stat,
        savePercentage: stat.totalShotsAgainst > 0
          ? Math.round((stat.totalSaves / stat.totalShotsAgainst) * 100)
          : 0
      }));

    const awayGKArray = Array.from(awayGKMap.values())
      .map(stat => ({
        ...stat,
        savePercentage: stat.totalShotsAgainst > 0
          ? Math.round((stat.totalSaves / stat.totalShotsAgainst) * 100)
          : 0
      }));

    return { home: homeGKArray, away: awayGKArray };
  }, [summary, homeTeam, awayTeam]);

  return goalkeeperStats;
}

function processGoalkeepersForPeriod(
  gkMap: Map<string, GoalkeeperStats>,
  teamPlayers: PlayerData[],
  gkChanges: any[],
  goalsAgainst: any[],
  opponentPlayerStats: any[],
  periodName: string,
  periodDuration: number
) {
  console.log(`[GK Debug] ========== processGoalkeepersForPeriod called for ${periodName} ==========`);
  console.log(`[GK Debug]   - gkChanges.length: ${gkChanges.length}`);
  console.log(`[GK Debug]   - gkChanges:`, gkChanges.map(c => ({ id: c.playerId, time: c.gameTime })));
  console.log(`[GK Debug]   - periodDuration: ${periodDuration}`);

  if (gkChanges.length === 0) {
    console.log(`[GK Debug] No GK changes for period ${periodName}, skipping`);
    return;
  }

  console.log(`[GK Debug] Processing period ${periodName} with ${gkChanges.length} changes`);

  // Build time ranges for each goalkeeper
  // Note: gameTime counts DOWN, so a change at 90000 happens BEFORE a change at 71052
  // The array should be sorted by gameTime descending (already is from the implicit change logic)
  const gkTimeRanges: { playerId: string; startTime: number; endTime: number }[] = [];

  for (let i = 0; i < gkChanges.length; i++) {
    const change = gkChanges[i];
    const startTime = change.gameTime; // When GK enters (higher time = earlier in period)
    const endTime = i < gkChanges.length - 1 ? gkChanges[i + 1].gameTime : 0; // When GK exits (next change or end)

    // Verify the times make sense
    if (startTime < endTime) {
      console.log(`[GK Debug] WARNING: startTime (${startTime}) < endTime (${endTime}) for GK at index ${i}`);
    }

    gkTimeRanges.push({
      playerId: change.playerId,
      startTime,
      endTime
    });
  }

  // Process each goalkeeper
  const gkIdsInPeriod = new Set(gkChanges.map((c: any) => c.playerId));

  const totalOpponentShots = opponentPlayerStats.reduce((sum, ps) => sum + (ps.shots || 0), 0);
  console.log(`[GK Debug] Period ${periodName}: opponent shots = ${totalOpponentShots}, gkTimeRanges:`, gkTimeRanges);

  gkIdsInPeriod.forEach(gkId => {
    const gkPlayer = teamPlayers.find(p => p.id === gkId);
    if (!gkPlayer) {
      console.log(`[GK Debug] GK ${gkId} not found in team players`);
      return;
    }
    if (!gkMap.has(gkId)) {
      console.log(`[GK Debug] GK ${gkId} not found in gkMap`);
      return;
    }

    const stat = gkMap.get(gkId)!;

    // Calculate time on ice
    // Clock counts DOWN from periodDuration to 0
    // startTime > endTime (e.g., enter at 71052, exit at 0 means played 71052 centiseconds)
    let timeOnIce = 0;
    const myRanges = gkTimeRanges.filter(r => r.playerId === gkId);
    console.log(`[GK Debug] GK ${gkPlayer.name} (${gkId}) has ${myRanges.length} ranges:`, myRanges);
    myRanges.forEach(range => {
      const timePlayed = range.startTime - range.endTime; // endTime=0 means played until end
      console.log(`[GK Debug]   Range: ${range.startTime} - ${range.endTime} = ${timePlayed}`);
      timeOnIce += timePlayed;
    });

    // Count goals against during this goalkeeper's time
    let goalsAgainstCount = 0;
    goalsAgainst.forEach(goal => {
      const goalTime = goal.gameTime || 0;
      const activeRange = gkTimeRanges.find(r =>
        (r.endTime === 0 ? goalTime <= r.startTime : goalTime <= r.startTime && goalTime > r.endTime)
      );
      if (activeRange && activeRange.playerId === gkId) {
        goalsAgainstCount++;
      }
    });

    // Count total shots against
    const totalShotsAgainst = opponentPlayerStats.reduce((sum, ps) => sum + (ps.shots || 0), 0);

    // Distribute shots proportionally based on time on ice
    const totalGKTime = gkTimeRanges.reduce((sum, r) => {
      return sum + (r.startTime - r.endTime); // endTime=0 means played until end
    }, 0);

    const shotsProportion = totalGKTime > 0 ? timeOnIce / totalGKTime : 0;
    const shotsAgainstCount = Math.round(totalShotsAgainst * shotsProportion);

    console.log(`[GK Debug] GK ${gkPlayer.name}: timeOnIce=${timeOnIce}, totalGKTime=${totalGKTime}, proportion=${shotsProportion}, shotsAgainst=${shotsAgainstCount}, goalsAgainst=${goalsAgainstCount}`);

    // Calculate saves
    const savesCount = Math.max(0, shotsAgainstCount - goalsAgainstCount);

    // Calculate save percentage for this period
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
    periodStat.savePercentage = savePercentage;
    periodStat.timeOnIce += timeOnIce;

    // Update totals
    stat.totalShotsAgainst += shotsAgainstCount;
    stat.totalGoalsAgainst += goalsAgainstCount;
    stat.totalSaves += savesCount;
    stat.totalTimeOnIce += timeOnIce;
  });
}
