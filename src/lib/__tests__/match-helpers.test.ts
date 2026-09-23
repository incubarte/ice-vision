import { describe, it, expect } from 'vitest';
import { calculateScoreFromSummary, hasOvertimeOrShootout } from '../match-helpers';
import type { GameSummary } from '@/types';

function makeSummary(overrides: Partial<GameSummary> = {}): GameSummary {
  return {
    statsByPeriod: [],
    playedPeriods: [],
    attendance: { home: [], away: [] },
    ...overrides,
  } as GameSummary;
}

function periodStats(period: string, homeGoals: number, awayGoals: number) {
  return {
    period,
    stats: {
      goals: {
        home: Array.from({ length: homeGoals }, (_, i) => ({ id: `h${i}`, playerNumber: '10', time: 60 })),
        away: Array.from({ length: awayGoals }, (_, i) => ({ id: `a${i}`, playerNumber: '11', time: 120 })),
      },
      playerStats: { home: [], away: [] },
      shots: { home: 0, away: 0 },
    },
  } as any;
}

// ─── calculateScoreFromSummary ─────────────────────────────────────────────

describe('calculateScoreFromSummary', () => {
  it('returns 0-0 for an empty summary', () => {
    const result = calculateScoreFromSummary(makeSummary());
    expect(result).toEqual({ home: 0, away: 0 });
  });

  it('counts physical goals across all periods', () => {
    const summary = makeSummary({
      statsByPeriod: [periodStats('1ST', 2, 1), periodStats('2ND', 1, 2)],
    });
    expect(calculateScoreFromSummary(summary)).toEqual({ home: 3, away: 3 });
  });

  it('adds +1 to shootout winner (not total SO goals)', () => {
    const summary = makeSummary({
      statsByPeriod: [periodStats('1ST', 1, 1)],
      shootout: {
        isActive: false,
        rounds: [],
        homeScore: 3,
        awayScore: 2,
        homeAttempts: [
          { id: 's1', playerNumber: '10', isGoal: true, time: 0 },
          { id: 's2', playerNumber: '11', isGoal: true, time: 0 },
          { id: 's3', playerNumber: '12', isGoal: true, time: 0 },
        ],
        awayAttempts: [
          { id: 's4', playerNumber: '20', isGoal: true, time: 0 },
          { id: 's5', playerNumber: '21', isGoal: true, time: 0 },
        ],
      },
    } as any);
    // 1-1 from regulation, home wins SO → home gets +1 = 2-1
    expect(calculateScoreFromSummary(summary)).toEqual({ home: 2, away: 1 });
  });

  it('adds +1 to away when away wins shootout', () => {
    const summary = makeSummary({
      statsByPeriod: [periodStats('1ST', 0, 0)],
      shootout: {
        homeAttempts: [{ id: 's1', playerNumber: '10', isGoal: false, time: 0 }],
        awayAttempts: [{ id: 's2', playerNumber: '20', isGoal: true, time: 0 }],
      },
    } as any);
    expect(calculateScoreFromSummary(summary)).toEqual({ home: 0, away: 1 });
  });

  it('does not add bonus when shootout is tied (edge case)', () => {
    const summary = makeSummary({
      statsByPeriod: [periodStats('1ST', 2, 1)],
      shootout: {
        homeAttempts: [{ id: 's1', playerNumber: '10', isGoal: true, time: 0 }],
        awayAttempts: [{ id: 's2', playerNumber: '20', isGoal: true, time: 0 }],
      },
    } as any);
    // SO is tied — no bonus
    expect(calculateScoreFromSummary(summary)).toEqual({ home: 2, away: 1 });
  });

  it('handles missing statsByPeriod gracefully', () => {
    const summary = { ...makeSummary(), statsByPeriod: undefined } as any;
    expect(calculateScoreFromSummary(summary)).toEqual({ home: 0, away: 0 });
  });
});

// ─── hasOvertimeOrShootout ─────────────────────────────────────────────────

describe('hasOvertimeOrShootout', () => {
  it('returns false for a regular game with no OT/SO data', () => {
    const summary = makeSummary({ statsByPeriod: [periodStats('1ST', 2, 1), periodStats('2ND', 0, 0)] });
    expect(hasOvertimeOrShootout(summary)).toBe(false);
  });

  it('returns true when overTimeOrShootouts flag is set', () => {
    expect(hasOvertimeOrShootout(makeSummary({ overTimeOrShootouts: true } as any))).toBe(true);
  });

  it('returns true when playedPeriods contains an OT period', () => {
    const summary = makeSummary({ playedPeriods: ['1ST', '2ND', 'OT1'] });
    expect(hasOvertimeOrShootout(summary)).toBe(true);
  });

  it('returns true when statsByPeriod contains an OT period', () => {
    const summary = makeSummary({
      statsByPeriod: [periodStats('1ST', 1, 1), periodStats('OT1', 1, 0)],
    });
    expect(hasOvertimeOrShootout(summary)).toBe(true);
  });

  it('returns true when shootout has attempts even without flag', () => {
    const summary = makeSummary({
      shootout: {
        homeAttempts: [{ id: 's1', playerNumber: '10', isGoal: true, time: 0 }],
        awayAttempts: [],
      },
    } as any);
    expect(hasOvertimeOrShootout(summary)).toBe(true);
  });

  it('returns false when shootout exists but has no attempts', () => {
    const summary = makeSummary({
      shootout: { homeAttempts: [], awayAttempts: [] },
    } as any);
    expect(hasOvertimeOrShootout(summary)).toBe(false);
  });
});
