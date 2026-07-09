
"use client";

import { useMemo } from 'react';
import type { Tournament } from '@/types';
import { calculateScoreFromSummary } from '@/lib/match-helpers';

export interface TeamDetailStats {
  teamId: string;
  teamName: string;
  teamSubName?: string;
  categoryId: string;
  categoryName: string;
  matchesPlayed: number;
  avgSkaters: number;      // Promedio de jugadores (sin arqueros) presentes
  goalsFor: number;        // Goles hechos
  goalsAgainst: number;    // Goles recibidos
  goalDiff: number;        // Diferencia de goles
  penaltiesCommitted: number; // Penalidades hechas (todas)
  penaltiesReceived: number;  // Penalidades recibidas (oponente, genera PP)
  pkTimeSeconds: number;   // Tiempo PK (faltas propias que reducen jugador, en segundos)
  ppTimeSeconds: number;   // Tiempo PP (faltas del oponente que reducen jugador, en segundos)
}

export function useTeamStats(
  tournament: Tournament | null | undefined,
  categoryId: string | null
): TeamDetailStats[] {
  return useMemo(() => {
    if (!tournament) return [];

    const teams = (tournament.teams || []).filter(t =>
      categoryId ? t.category === categoryId : true
    );

    const matches = (tournament.matches || []).filter(m =>
      m.summary &&
      m.summary.statsByPeriod &&
      (categoryId ? m.categoryId === categoryId : true)
    );

    const result: TeamDetailStats[] = [];

    for (const team of teams) {
      const category = tournament.categories?.find(c => c.id === team.category);

      const teamMatches = matches.filter(m =>
        m.homeTeamId === team.id || m.awayTeamId === team.id
      );

      if (teamMatches.length === 0) continue;

      let goalsFor = 0;
      let goalsAgainst = 0;
      let penaltiesCommitted = 0;
      let penaltiesReceived = 0;
      let pkTimeSeconds = 0;
      let ppTimeSeconds = 0;
      let totalSkaters = 0;
      let matchesWithAttendance = 0;

      for (const match of teamMatches) {
        const isHome = match.homeTeamId === team.id;
        const summary = match.summary!;

        // Goles totales del partido
        const score = calculateScoreFromSummary(summary);
        goalsFor += isHome ? score.home : score.away;
        goalsAgainst += isHome ? score.away : score.home;

        // Promedio de jugadores presentes (excluyendo arqueros)
        const attendanceSide = isHome
          ? summary.attendance?.home
          : summary.attendance?.away;
        if (attendanceSide && attendanceSide.length > 0) {
          const skaterCount = attendanceSide.filter(
            e => e.isPresent && e.type !== 'goalkeeper'
          ).length;
          totalSkaters += skaterCount;
          matchesWithAttendance++;
        }

        // Penalidades por período
        // Las penalidades están organizadas por el período en que se cometieron,
        // pero timeServed ya acumula el tiempo real servido (incluyendo carry-over de período).
        for (const period of summary.statsByPeriod || []) {
          const teamPens = isHome
            ? (period.stats.penalties.home || [])
            : (period.stats.penalties.away || []);
          const opponentPens = isHome
            ? (period.stats.penalties.away || [])
            : (period.stats.penalties.home || []);

          for (const pen of teamPens) {
            penaltiesCommitted++;
            // Solo las que reducen jugador generan tiempo de PK
            if (pen.reducesPlayerCount) {
              // timeServed está en segundos. Si no está definido (penalidad aún activa
              // al finalizar el partido sin ser procesada), se omite.
              pkTimeSeconds += pen.timeServed ?? 0;
            }
          }

          for (const pen of opponentPens) {
            penaltiesReceived++;
            // Las del oponente que reducen jugador generan tiempo de PP
            if (pen.reducesPlayerCount) {
              ppTimeSeconds += pen.timeServed ?? 0;
            }
          }
        }
      }

      result.push({
        teamId: team.id,
        teamName: team.name,
        teamSubName: team.subName,
        categoryId: team.category,
        categoryName: category?.name ?? team.category,
        matchesPlayed: teamMatches.length,
        avgSkaters: matchesWithAttendance > 0
          ? Math.round((totalSkaters / matchesWithAttendance) * 10) / 10
          : 0,
        goalsFor,
        goalsAgainst,
        goalDiff: goalsFor - goalsAgainst,
        penaltiesCommitted,
        penaltiesReceived,
        pkTimeSeconds,
        ppTimeSeconds,
      });
    }

    // Ordenar por categoría luego por GF desc
    result.sort((a, b) => {
      if (a.categoryName !== b.categoryName) return a.categoryName.localeCompare(b.categoryName);
      return b.goalsFor - a.goalsFor;
    });

    return result;
  }, [tournament, categoryId]);
}
