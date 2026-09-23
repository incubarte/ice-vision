/**
 * Tests for useStandings and useRelegationStandings.
 *
 * The local scoreboard only receives MatchResult (homeScore, awayScore, resultType)
 * rather than full summaries. These tests verify the points system, tiebreakers,
 * and the fallback path from result → summary.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStandings, useRelegationStandings } from '@/hooks/use-standings';
import type { Tournament, MatchData, TeamData } from '@/types';

const CAT = 'cat-1';

function team(id: string, name: string): TeamData {
  return { id, name, players: [], clubId: 'club-1', category: CAT } as TeamData;
}

function finishedMatch(
  id: string,
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number,
  resultType: 'regulation' | 'overtime' | 'shootout' = 'regulation',
  phase: MatchData['phase'] = 'clasificacion'
): MatchData {
  return {
    id,
    date: '2025-01-01',
    categoryId: CAT,
    homeTeamId,
    awayTeamId,
    playersPerTeam: 5,
    phase,
    result: {
      homeScore,
      awayScore,
      resultType,
      finishedAt: '2025-01-01T20:00:00Z',
    },
  } as MatchData;
}

function makeTournament(teams: TeamData[], matches: MatchData[]): Tournament {
  return {
    id: 't1',
    name: 'Test Cup',
    status: 'active',
    clubs: [],
    teams,
    categories: [{ id: CAT, name: 'Primera' }],
    matches,
  } as Tournament;
}

// ─── Points system ─────────────────────────────────────────────────────────

describe('useStandings — points system', () => {
  it('awards 3 points for a regulation win', () => {
    const tournament = makeTournament(
      [team('A', 'Alpha'), team('B', 'Beta')],
      [finishedMatch('m1', 'A', 'B', 3, 1)]
    );
    const { result } = renderHook(() => useStandings(tournament, CAT));
    const alpha = result.current.find(t => t.id === 'A')!;
    const beta  = result.current.find(t => t.id === 'B')!;
    expect(alpha.puntos).toBe(3);
    expect(alpha.pg).toBe(1);
    expect(beta.puntos).toBe(0);
    expect(beta.pp).toBe(1);
  });

  it('awards 1 point each for a draw', () => {
    const tournament = makeTournament(
      [team('A', 'Alpha'), team('B', 'Beta')],
      [finishedMatch('m1', 'A', 'B', 2, 2)]
    );
    const { result } = renderHook(() => useStandings(tournament, CAT));
    const alpha = result.current.find(t => t.id === 'A')!;
    const beta  = result.current.find(t => t.id === 'B')!;
    expect(alpha.puntos).toBe(1);
    expect(alpha.pe).toBe(1);
    expect(beta.puntos).toBe(1);
    expect(beta.pe).toBe(1);
  });

  it('awards 2 pts for OT win, 1 pt for OT loss', () => {
    const tournament = makeTournament(
      [team('A', 'Alpha'), team('B', 'Beta')],
      [finishedMatch('m1', 'A', 'B', 2, 1, 'overtime')]
    );
    const { result } = renderHook(() => useStandings(tournament, CAT));
    const alpha = result.current.find(t => t.id === 'A')!;
    const beta  = result.current.find(t => t.id === 'B')!;
    expect(alpha.puntos).toBe(2);
    expect(alpha.pg_ot).toBe(1);
    expect(beta.puntos).toBe(1);
    expect(beta.pp_ot).toBe(1);
  });

  it('awards 2 pts for SO win, 1 pt for SO loss', () => {
    const tournament = makeTournament(
      [team('A', 'Alpha'), team('B', 'Beta')],
      [finishedMatch('m1', 'A', 'B', 3, 2, 'shootout')]
    );
    const { result } = renderHook(() => useStandings(tournament, CAT));
    const alpha = result.current.find(t => t.id === 'A')!;
    const beta  = result.current.find(t => t.id === 'B')!;
    expect(alpha.puntos).toBe(2);
    expect(beta.puntos).toBe(1);
  });

  it('accumulates points across multiple matches', () => {
    // A wins vs B (reg) → 3pts; A loses vs C (reg) → 0pts; total 3pts
    const tournament = makeTournament(
      [team('A', 'Alpha'), team('B', 'Beta'), team('C', 'Gamma')],
      [
        finishedMatch('m1', 'A', 'B', 2, 1),
        finishedMatch('m2', 'C', 'A', 3, 1),
        finishedMatch('m3', 'B', 'C', 1, 0),
      ]
    );
    const { result } = renderHook(() => useStandings(tournament, CAT));
    const alpha = result.current.find(t => t.id === 'A')!;
    expect(alpha.pj).toBe(2);
    expect(alpha.pg).toBe(1);
    expect(alpha.pp).toBe(1);
    expect(alpha.puntos).toBe(3);
  });
});

// ─── Goals / goal difference ────────────────────────────────────────────────

describe('useStandings — goals & goal difference', () => {
  it('tracks goals for and goals against correctly', () => {
    const tournament = makeTournament(
      [team('A', 'Alpha'), team('B', 'Beta')],
      [
        finishedMatch('m1', 'A', 'B', 3, 1), // A: gf=3, gc=1
        finishedMatch('m2', 'B', 'A', 2, 0), // A: gf=0, gc=2
      ]
    );
    const { result } = renderHook(() => useStandings(tournament, CAT));
    const alpha = result.current.find(t => t.id === 'A')!;
    expect(alpha.gf).toBe(3);
    expect(alpha.gc).toBe(3);
    expect(alpha.dif).toBe(0);
  });

  it('computes goal difference as gf - gc', () => {
    const tournament = makeTournament(
      [team('A', 'Alpha'), team('B', 'Beta')],
      [finishedMatch('m1', 'A', 'B', 5, 1)]
    );
    const { result } = renderHook(() => useStandings(tournament, CAT));
    const alpha = result.current.find(t => t.id === 'A')!;
    expect(alpha.dif).toBe(4);
    const beta = result.current.find(t => t.id === 'B')!;
    expect(beta.dif).toBe(-4);
  });
});

// ─── Ranking & sorting ──────────────────────────────────────────────────────

describe('useStandings — ranking', () => {
  it('ranks teams by points descending', () => {
    const tournament = makeTournament(
      [team('A', 'Alpha'), team('B', 'Beta'), team('C', 'Gamma')],
      [
        finishedMatch('m1', 'A', 'B', 2, 1), // A=3pts, B=0pts
        finishedMatch('m2', 'A', 'C', 1, 0), // A=6pts, C=0pts
        finishedMatch('m3', 'B', 'C', 2, 0), // B=3pts
      ]
    );
    const { result } = renderHook(() => useStandings(tournament, CAT));
    expect(result.current[0].id).toBe('A');
    expect(result.current[1].id).toBe('B');
    expect(result.current[2].id).toBe('C');
  });

  it('assigns same rank to teams tied on points, GD, and GF', () => {
    // A and B both win 1 game 2-1 (same stats)
    const tournament = makeTournament(
      [team('A', 'Alpha'), team('B', 'Beta'), team('C', 'Gamma')],
      [
        finishedMatch('m1', 'A', 'C', 2, 1),
        finishedMatch('m2', 'B', 'C', 2, 1),
      ]
    );
    const { result } = renderHook(() => useStandings(tournament, CAT));
    const alpha = result.current.find(t => t.id === 'A')!;
    const beta  = result.current.find(t => t.id === 'B')!;
    expect(alpha.rank).toBe(beta.rank);
  });

  it('breaks rank ties by goal difference', () => {
    // A wins 3-0, B wins 2-1 — both 3pts but A has better GD
    const tournament = makeTournament(
      [team('A', 'Alpha'), team('B', 'Beta'), team('C', 'Gamma'), team('D', 'Delta')],
      [
        finishedMatch('m1', 'A', 'C', 3, 0),
        finishedMatch('m2', 'B', 'D', 2, 1),
      ]
    );
    const { result } = renderHook(() => useStandings(tournament, CAT));
    expect(result.current[0].id).toBe('A');
    expect(result.current[1].id).toBe('B');
    expect(result.current[0].rank).toBe(1);
    expect(result.current[1].rank).toBe(2);
  });

  it('ignores matches without result or summary (unplayed)', () => {
    const unplayedMatch: MatchData = {
      id: 'unplayed',
      date: '2025-06-01',
      categoryId: CAT,
      homeTeamId: 'A',
      awayTeamId: 'B',
      playersPerTeam: 5,
      phase: 'clasificacion',
    };
    const tournament = makeTournament([team('A', 'Alpha'), team('B', 'Beta')], [unplayedMatch]);
    const { result } = renderHook(() => useStandings(tournament, CAT));
    expect(result.current.every(t => t.pj === 0)).toBe(true);
  });

  it('ignores matches from other phases (playoff, relegation)', () => {
    const tournament = makeTournament(
      [team('A', 'Alpha'), team('B', 'Beta')],
      [
        finishedMatch('m1', 'A', 'B', 3, 1, 'regulation', 'clasificacion'),
        finishedMatch('m2', 'A', 'B', 5, 0, 'regulation', 'playoff-quarterfinals'),
      ]
    );
    const { result } = renderHook(() => useStandings(tournament, CAT));
    const alpha = result.current.find(t => t.id === 'A')!;
    expect(alpha.pj).toBe(1); // only clasificacion match counted
    expect(alpha.gf).toBe(3);
  });

  it('returns empty array for null tournament', () => {
    const { result } = renderHook(() => useStandings(null, CAT));
    expect(result.current).toEqual([]);
  });

  it('returns empty array when categoryId is empty', () => {
    const tournament = makeTournament([team('A', 'Alpha')], []);
    const { result } = renderHook(() => useStandings(tournament, ''));
    expect(result.current).toEqual([]);
  });
});

// ─── Result fallback to summary ─────────────────────────────────────────────

describe('useStandings — match.result takes priority over match.summary', () => {
  it('uses match.result when present (does not need summary)', () => {
    const tournament = makeTournament(
      [team('A', 'Alpha'), team('B', 'Beta')],
      [finishedMatch('m1', 'A', 'B', 4, 2)] // has result, no summary
    );
    const { result } = renderHook(() => useStandings(tournament, CAT));
    const alpha = result.current.find(t => t.id === 'A')!;
    expect(alpha.gf).toBe(4);
    expect(alpha.gc).toBe(2);
    expect(alpha.pg).toBe(1);
  });

  it('falls back to summary when result is absent', () => {
    const matchWithSummary: MatchData = {
      id: 'm1',
      date: '2025-01-01',
      categoryId: CAT,
      homeTeamId: 'A',
      awayTeamId: 'B',
      playersPerTeam: 5,
      phase: 'clasificacion',
      summary: {
        statsByPeriod: [
          {
            period: '1ST',
            stats: {
              goals: {
                home: [{ id: 'g1', playerNumber: '10', time: 60 }],
                away: [],
              },
              playerStats: { home: [], away: [] },
              shots: { home: 0, away: 0 },
            },
          },
        ],
        playedPeriods: ['1ST'],
        attendance: { home: [], away: [] },
      } as any,
    };

    const tournament = makeTournament([team('A', 'Alpha'), team('B', 'Beta')], [matchWithSummary]);
    const { result } = renderHook(() => useStandings(tournament, CAT));
    const alpha = result.current.find(t => t.id === 'A')!;
    expect(alpha.gf).toBe(1);
    expect(alpha.pg).toBe(1);
  });
});

// ─── Relegation standings ────────────────────────────────────────────────────

describe('useRelegationStandings', () => {
  it('only counts matches with phase=relegation', () => {
    const tournament = makeTournament(
      [team('A', 'Alpha'), team('B', 'Beta')],
      [
        finishedMatch('m1', 'A', 'B', 3, 1, 'regulation', 'clasificacion'),
        finishedMatch('m2', 'A', 'B', 2, 0, 'regulation', 'relegation'),
      ]
    );
    const { result } = renderHook(() => useRelegationStandings(tournament, CAT));
    const alpha = result.current.find(t => t.id === 'A')!;
    expect(alpha.pj).toBe(1); // only relegation match
    expect(alpha.gf).toBe(2);
  });

  it('applies displayRank offset (default +4)', () => {
    const tournament = makeTournament(
      [team('A', 'Alpha'), team('B', 'Beta')],
      [finishedMatch('m1', 'A', 'B', 2, 1, 'regulation', 'relegation')]
    );
    const { result } = renderHook(() => useRelegationStandings(tournament, CAT));
    const alpha = result.current.find(t => t.id === 'A')!;
    expect(alpha.rank).toBe(1);
    expect(alpha.displayRank).toBe(5); // rank 1 + offset 4
  });

  it('applies custom offset', () => {
    const tournament = makeTournament(
      [team('A', 'Alpha'), team('B', 'Beta')],
      [finishedMatch('m1', 'A', 'B', 2, 1, 'regulation', 'relegation')]
    );
    const { result } = renderHook(() => useRelegationStandings(tournament, CAT, 6));
    const alpha = result.current.find(t => t.id === 'A')!;
    expect(alpha.displayRank).toBe(7); // rank 1 + offset 6
  });

  it('only includes teams that played in the relegation phase', () => {
    // C never played in relegation but is in the tournament
    const tournament = makeTournament(
      [team('A', 'Alpha'), team('B', 'Beta'), team('C', 'Gamma')],
      [finishedMatch('m1', 'A', 'B', 1, 0, 'regulation', 'relegation')]
    );
    const { result } = renderHook(() => useRelegationStandings(tournament, CAT));
    expect(result.current).toHaveLength(2);
    expect(result.current.find(t => t.id === 'C')).toBeUndefined();
  });
});
