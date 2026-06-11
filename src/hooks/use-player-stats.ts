
"use client";

import { useMemo } from 'react';
import type { Tournament, PlayerData } from '@/types';

interface PlayerStats {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  categoryName: string;
  goals: number;
  assists: number;
  points: number;
  shots: number;
  shootingPercentage: number;
  penaltyCount: number;
  penaltyMinutes: number;
}

export function usePlayerStats(tournament: Tournament | null | undefined, categoryId: string | null) {
  const playerStats = useMemo(() => {
    if (!tournament) return [];

    let finishedMatches = tournament.matches || [];
    if (categoryId) {
        finishedMatches = finishedMatches.filter(m => m.categoryId === categoryId);
    }
    finishedMatches = finishedMatches.filter(m => m.summary);

    const statsMap = new Map<string, PlayerStats>();
    const allTeams = tournament.teams || [];
    const allCategories = tournament.categories || [];

    // Initialize all players
    allTeams.forEach(team => {
        if (!categoryId || team.category === categoryId) {
            const category = allCategories.find(c => c.id === team.category);
            team.players.forEach(player => {
                if (!statsMap.has(player.id)) {
                    statsMap.set(player.id, {
                        playerId: player.id,
                        playerName: player.name,
                        teamId: team.id,
                        teamName: team.name,
                        categoryName: category?.name || 'N/A',
                        goals: 0,
                        assists: 0,
                        points: 0,
                        shots: 0,
                        shootingPercentage: 0,
                        penaltyCount: 0,
                        penaltyMinutes: 0
                    });
                }
            });
        }
    });

    finishedMatches.forEach(match => {
        if (!match.summary || !match.summary.statsByPeriod) return;

        match.summary.statsByPeriod.forEach(period => {
            ['home', 'away'].forEach(teamStr => {
                const teamId = teamStr === 'home' ? match.homeTeamId : match.awayTeamId;
                const team = allTeams.find(t => t.id === teamId);
                if (!team) return;

                // Process goals and assists
                (period.stats.goals[teamStr as 'home' | 'away'] || []).forEach(goal => {
                    // Only use playerId - no fallback to number to avoid mismatches
                    if (goal.scorer?.playerId) {
                        const scorer = team.players.find(p => p.id === goal.scorer?.playerId);
                        if (scorer && statsMap.has(scorer.id)) {
                            statsMap.get(scorer.id)!.goals++;
                        }
                    }
                    // Only use playerId for assist - no fallback to number
                    if (goal.assist?.playerId) {
                        const assist = team.players.find(p => p.id === goal.assist?.playerId);
                        if (assist && statsMap.has(assist.id)) {
                            statsMap.get(assist.id)!.assists++;
                        }
                    }
                });

                // Process penalties
                 (period.stats.penalties[teamStr as 'home' | 'away'] || []).forEach(penalty => {
                    // Only use playerId - no fallback to number to avoid mismatches
                    if (penalty.playerId) {
                        const player = team.players.find(p => p.id === penalty.playerId);
                        if (player && statsMap.has(player.id)) {
                            const stat = statsMap.get(player.id)!;
                            stat.penaltyCount++;
                            stat.penaltyMinutes += (penalty.initialDuration || 0) / 60;
                        }
                    }
                });

                // Process player stats (shots)
                (period.stats.playerStats[teamStr as 'home' | 'away'] || []).forEach(playerStat => {
                    if (statsMap.has(playerStat.id)) {
                        const stat = statsMap.get(playerStat.id)!;
                        stat.shots += playerStat.shots;
                    }
                });
            });
        });
    });

    // Calculate points, shooting percentage and create array
    const statsArray = Array.from(statsMap.values()).map(stat => ({
      ...stat,
      points: stat.goals + stat.assists,
      shootingPercentage: stat.shots > 0 ? Math.round((stat.goals / stat.shots) * 100) : 0,
      penaltyMinutes: Math.round(stat.penaltyMinutes),
    }));

    // Filter out players with no activity
    const activePlayers = statsArray.filter(
        stat => stat.goals > 0 || stat.assists > 0 || stat.penaltyCount > 0 || stat.shots > 0
    );

    // Sort by points, then goals, then assists
    activePlayers.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goals !== a.goals) return b.goals - a.goals;
        if (b.assists !== a.assists) return b.assists - a.assists;
        if (a.penaltyMinutes !== b.penaltyMinutes) return a.penaltyMinutes - b.penaltyMinutes;
        return a.playerName.localeCompare(b.playerName);
    });

    // Add rank, allowing for ties
    if (activePlayers.length === 0) return [];

    const rankedStats = [{...activePlayers[0], rank: 1}];
    for (let i = 1; i < activePlayers.length; i++) {
        const prev = rankedStats[i - 1];
        const current = activePlayers[i];
        let rank = prev.rank;
        if (
            current.points !== prev.points ||
            current.goals !== prev.goals ||
            current.assists !== prev.assists ||
            current.penaltyMinutes !== prev.penaltyMinutes
        ) {
            rank = i + 1;
        }
        rankedStats.push({ ...current, rank });
    }

    return rankedStats;

  }, [tournament, categoryId]);

  return playerStats;
}
