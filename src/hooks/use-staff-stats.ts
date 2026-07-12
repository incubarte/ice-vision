import { useMemo, useState, useEffect } from 'react';
import type { Tournament, StaffMember, GameSummary } from '@/types';

export interface RefereeMatchRow {
  refereeId: string;
  refereeName: string;
  refereeOrder: number; // 1 = principal, 2 = segundo
  matchId: string;
  matchDate: string;
  categoryName: string;
  homeTeamName: string;
  awayTeamName: string;
  penaltiesHome: number;
  penaltiesAway: number;
}

export interface StaffMatchStats {
  staffId: string;
  staffName: string;
  totalMatches: number;
  asPrincipal: number;
  asSecond: number;
  asThird: number;
  totalGoals: number;
  totalPenalties: number;
  avgGoalsPerMatch: number;
  avgPenaltiesPerMatch: number;
  categories: Set<string>;
}

// Hook to load summaries for a tournament
function useTournamentSummaries(tournamentId: string | undefined) {
  const [summaries, setSummaries] = useState<Record<string, GameSummary>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tournamentId) {
      setSummaries({});
      return;
    }

    setLoading(true);
    fetch(`/api/tournaments/${tournamentId}/summaries`)
      .then(res => res.ok ? res.json() : {})
      .then(data => {
        setSummaries(data || {});
        setLoading(false);
      })
      .catch(() => {
        setSummaries({});
        setLoading(false);
      });
  }, [tournamentId]);

  return { summaries, loading };
}

export function useRefereeStats(tournament: Tournament | null | undefined, categoryFilter?: string) {
  const { summaries } = useTournamentSummaries(tournament?.id);

  return useMemo(() => {
    if (!tournament || !tournament.matches || !tournament.staff) {
      return [];
    }

    const refereeStatsMap = new Map<string, StaffMatchStats>();

    // Initialize all referees
    tournament.staff
      .filter(s => s.roles.includes('referee'))
      .forEach(staff => {
        refereeStatsMap.set(staff.id, {
          staffId: staff.id,
          staffName: `${staff.firstName} ${staff.lastName}`,
          totalMatches: 0,
          asPrincipal: 0,
          asSecond: 0,
          asThird: 0,
          totalGoals: 0,
          totalPenalties: 0,
          avgGoalsPerMatch: 0,
          avgPenaltiesPerMatch: 0,
          categories: new Set()
        });
      });

    // Process matches
    tournament.matches.forEach(match => {
      // Apply category filter if provided
      if (categoryFilter && match.categoryId !== categoryFilter) {
        return;
      }

      // Try to get summary from match object or from summaries dictionary
      const summary = match.summary || summaries[match.id];
      if (!summary || !summary.staff || !summary.staff.referees) {
        return;
      }

      // Get match category for tracking
      const category = tournament.categories?.find(c => c.id === match.categoryId);
      const categoryName = category?.name || 'Sin categoría';

      // Calculate match goals and penalties
      const totalGoals = summary.statsByPeriod?.reduce((acc, period) => {
        const homeGoals = period.stats.goals?.home?.length || 0;
        const awayGoals = period.stats.goals?.away?.length || 0;
        return acc + homeGoals + awayGoals;
      }, 0) || 0;

      const totalPenalties = summary.statsByPeriod?.reduce((acc, period) => {
        const homePenalties = period.stats.penalties?.home?.length || 0;
        const awayPenalties = period.stats.penalties?.away?.length || 0;
        return acc + homePenalties + awayPenalties;
      }, 0) || 0;

      // Process each referee in this match
      summary.staff.referees.forEach(referee => {
        const stats = refereeStatsMap.get(referee.id);
        if (!stats) return;

        stats.totalMatches++;
        stats.totalGoals += totalGoals;
        stats.totalPenalties += totalPenalties;
        stats.categories.add(categoryName);

        // Track by order/position
        if (referee.order === 1) stats.asPrincipal++;
        else if (referee.order === 2) stats.asSecond++;
        else if (referee.order === 3) stats.asThird++;
      });
    });

    // Calculate averages
    refereeStatsMap.forEach(stats => {
      if (stats.totalMatches > 0) {
        stats.avgGoalsPerMatch = stats.totalGoals / stats.totalMatches;
        stats.avgPenaltiesPerMatch = stats.totalPenalties / stats.totalMatches;
      }
    });

    // Convert to array and filter out those with no matches
    return Array.from(refereeStatsMap.values())
      .filter(stats => stats.totalMatches > 0)
      .sort((a, b) => b.totalMatches - a.totalMatches);
  }, [tournament, categoryFilter, summaries]);
}

export function useMesaStats(tournament: Tournament | null | undefined, categoryFilter?: string) {
  const { summaries } = useTournamentSummaries(tournament?.id);

  return useMemo(() => {
    if (!tournament || !tournament.matches || !tournament.staff) {
      return [];
    }

    const mesaStatsMap = new Map<string, StaffMatchStats>();

    // Initialize all mesa staff
    tournament.staff
      .filter(s => s.roles.includes('mesa'))
      .forEach(staff => {
        mesaStatsMap.set(staff.id, {
          staffId: staff.id,
          staffName: `${staff.firstName} ${staff.lastName}`,
          totalMatches: 0,
          asPrincipal: 0,
          asSecond: 0,
          asThird: 0,
          totalGoals: 0,
          totalPenalties: 0,
          avgGoalsPerMatch: 0,
          avgPenaltiesPerMatch: 0,
          categories: new Set()
        });
      });

    // Process matches
    tournament.matches.forEach(match => {
      // Apply category filter if provided
      if (categoryFilter && match.categoryId !== categoryFilter) {
        return;
      }

      // Try to get summary from match object or from summaries dictionary
      const summary = match.summary || summaries[match.id];
      if (!summary || !summary.staff || !summary.staff.mesa) {
        return;
      }

      // Get match category for tracking
      const category = tournament.categories?.find(c => c.id === match.categoryId);
      const categoryName = category?.name || 'Sin categoría';

      // Calculate match goals and penalties
      const totalGoals = summary.statsByPeriod?.reduce((acc, period) => {
        const homeGoals = period.stats.goals?.home?.length || 0;
        const awayGoals = period.stats.goals?.away?.length || 0;
        return acc + homeGoals + awayGoals;
      }, 0) || 0;

      const totalPenalties = summary.statsByPeriod?.reduce((acc, period) => {
        const homePenalties = period.stats.penalties?.home?.length || 0;
        const awayPenalties = period.stats.penalties?.away?.length || 0;
        return acc + homePenalties + awayPenalties;
      }, 0) || 0;

      // Process each mesa person in this match
      summary.staff.mesa.forEach(mesa => {
        const stats = mesaStatsMap.get(mesa.id);
        if (!stats) return;

        stats.totalMatches++;
        stats.totalGoals += totalGoals;
        stats.totalPenalties += totalPenalties;
        stats.categories.add(categoryName);

        // Track by order/position
        if (mesa.order === 1) stats.asPrincipal++;
        else if (mesa.order === 2) stats.asSecond++;
        else if (mesa.order === 3) stats.asThird++;
      });
    });

    // Calculate averages
    mesaStatsMap.forEach(stats => {
      if (stats.totalMatches > 0) {
        stats.avgGoalsPerMatch = stats.totalGoals / stats.totalMatches;
        stats.avgPenaltiesPerMatch = stats.totalPenalties / stats.totalMatches;
      }
    });

    // Convert to array and filter out those with no matches
    return Array.from(mesaStatsMap.values())
      .filter(stats => stats.totalMatches > 0)
      .sort((a, b) => b.totalMatches - a.totalMatches);
  }, [tournament, categoryFilter, summaries]);
}

export function useRefereeMatchBreakdown(
  tournament: Tournament | null | undefined,
  categoryFilter?: string
): RefereeMatchRow[] {
  const { summaries } = useTournamentSummaries(tournament?.id);

  return useMemo(() => {
    if (!tournament?.matches) return [];

    const rows: RefereeMatchRow[] = [];

    tournament.matches.forEach(match => {
      if (categoryFilter && match.categoryId !== categoryFilter) return;

      const summary = match.summary || summaries[match.id];
      if (!summary?.staff?.referees?.length || !summary.statsByPeriod) return;

      const category = tournament.categories?.find(c => c.id === match.categoryId);
      const homeTeam = tournament.teams?.find(t => t.id === match.homeTeamId);
      const awayTeam = tournament.teams?.find(t => t.id === match.awayTeamId);

      const penaltiesHome = summary.statsByPeriod.reduce(
        (acc, p) => acc + (p.stats.penalties?.home?.length ?? 0), 0
      );
      const penaltiesAway = summary.statsByPeriod.reduce(
        (acc, p) => acc + (p.stats.penalties?.away?.length ?? 0), 0
      );

      summary.staff.referees.forEach(ref => {
        rows.push({
          refereeId: ref.id,
          refereeName: `${ref.firstName} ${ref.lastName}`,
          refereeOrder: ref.order,
          matchId: match.id,
          matchDate: match.date,
          categoryName: category?.name ?? match.categoryId,
          homeTeamName: homeTeam?.name ?? match.homeTeamId ?? '?',
          awayTeamName: awayTeam?.name ?? match.awayTeamId ?? '?',
          penaltiesHome,
          penaltiesAway,
        });
      });
    });

    rows.sort((a, b) => {
      const nameComp = a.refereeName.localeCompare(b.refereeName);
      if (nameComp !== 0) return nameComp;
      return a.matchDate.localeCompare(b.matchDate);
    });

    return rows;
  }, [tournament, categoryFilter, summaries]);
}
