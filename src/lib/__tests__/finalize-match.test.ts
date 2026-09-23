/**
 * Tests for finalizeMatch() — the function that ends a game, computes MatchResult,
 * and queues a SYNC_MATCH pending sync.
 *
 * Layer contract: finalizeMatch reads match context from state.live.matchContext
 * (the snapshot taken at match start), NOT from state.tournament.selectedTournamentId.
 * This is critical so the clock module never couples to the tournament module.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer, setGameReducerRef } from '../game-state-reducer';
import type { GameState, GameAction, MatchData, PendingSyncSyncMatch } from '@/types';
import defaultSettings from '@/config/defaults.json';

const TOURNAMENT_ID = 'tournament-abc';
const MATCH_ID = 'match-xyz';

function makeState(overrides: Partial<GameState['live']> = {}): GameState {
  return {
    config: {
      ...defaultSettings,
      numberOfRegularPeriods: 2,
      numberOfOvertimePeriods: 0,
      defaultPeriodDuration: 120000,
      defaultBreakDuration: 12000,
      maxConcurrentPenalties: 2,
      tickIntervalMs: 200,
    },
    live: {
      matchId: MATCH_ID,
      homeTeamName: 'Lions',
      awayTeamName: 'Bears',
      score: { home: 2, away: 1, homeShots: 10, awayShots: 8 },
      clock: {
        currentTime: 0,
        currentPeriod: 2, // last period
        isClockRunning: false,
        isFlashingZero: false,
        periodDisplayOverride: null,
        absoluteElapsedTimeCs: 0,
        _liveAbsoluteElapsedTimeCs: 0,
      },
      penalties: { home: [], away: [] },
      attendance: { home: [], away: [] },
      shootout: { isActive: false, rounds: [], homeScore: 0, awayScore: 0 },
      playedPeriods: ['1ST'],
      playHornTrigger: 0,
      matchContext: {
        tournamentId: TOURNAMENT_ID,
        matchId: MATCH_ID,
        homeTeamId: 'team-home',
        awayTeamId: 'team-away',
        homeRoster: [],
        awayRoster: [],
        categoryId: 'cat-1',
      },
      ...overrides,
    },
    tournament: {
      tournaments: [],
      activeTournament: {
        id: TOURNAMENT_ID,
        name: 'Test Cup',
        status: 'active',
        clubs: [],
        teams: [],
        categories: [],
        matches: [
          {
            id: MATCH_ID,
            date: '2025-01-01',
            categoryId: 'cat-1',
            homeTeamId: 'team-home',
            awayTeamId: 'team-away',
            playersPerTeam: 5,
            phase: 'clasificacion',
          } as MatchData,
        ],
      },
      selectedTournamentId: 'DIFFERENT-TOURNAMENT-ID', // should NOT be used
      selectedMatchCategory: '',
    },
    _pendingSyncs: [],
    _lastActionType: null,
  } as unknown as GameState;
}

describe('finalizeMatch — MatchResult computation', () => {
  beforeEach(() => setGameReducerRef(gameReducer));

  it('sets resultType to regulation when game ends in regulation time', () => {
    const state = makeState({ score: { home: 3, away: 1, homeShots: 10, awayShots: 8 } });
    const newState = gameReducer(state, { type: 'MANUAL_END_GAME' });

    const sync = newState._pendingSyncs[0];
    expect(sync.payload.type).toBe('SYNC_MATCH');
    expect((sync.payload as PendingSyncSyncMatch).result.resultType).toBe('regulation');
    expect((sync.payload as PendingSyncSyncMatch).result.homeScore).toBe(3);
    expect((sync.payload as PendingSyncSyncMatch).result.awayScore).toBe(1);
  });

  it('sets resultType to overtime when game ends in an OT period', () => {
    const state = makeState({
      clock: {
        currentTime: 0,
        currentPeriod: 3, // OT1 (beyond the 2 regular periods)
        isClockRunning: false,
        isFlashingZero: false,
        periodDisplayOverride: null,
        absoluteElapsedTimeCs: 0,
        _liveAbsoluteElapsedTimeCs: 0,
      },
      score: { home: 2, away: 1, homeShots: 15, awayShots: 12 },
      shootout: { isActive: false, rounds: [], homeScore: 0, awayScore: 0 },
    });
    const newState = gameReducer(state, { type: 'MANUAL_END_GAME' });

    const sync = newState._pendingSyncs[0];
    expect((sync.payload as PendingSyncSyncMatch).result.resultType).toBe('overtime');
  });

  it('sets resultType to shootout when shootout is active', () => {
    const state = makeState({
      score: { home: 2, away: 1, homeShots: 12, awayShots: 10 },
      shootout: {
        isActive: true,
        rounds: [],
        homeScore: 3,
        awayScore: 2,
        homeAttempts: [{ id: 's1', playerNumber: '10', isGoal: true, time: 0 }] as any,
        awayAttempts: [] as any,
      },
    });
    const newState = gameReducer(state, { type: 'MANUAL_END_GAME' });

    const sync = newState._pendingSyncs[0];
    expect((sync.payload as PendingSyncSyncMatch).result.resultType).toBe('shootout');
  });

  it('sets resultType to shootout when shootout has attempts but is not active', () => {
    const state = makeState({
      shootout: {
        isActive: false,
        rounds: [],
        homeScore: 2,
        awayScore: 3,
        homeAttempts: [{ id: 's1', playerNumber: '10', isGoal: false, time: 0 }] as any,
        awayAttempts: [
          { id: 's2', playerNumber: '20', isGoal: true, time: 0 },
          { id: 's3', playerNumber: '21', isGoal: true, time: 0 },
        ] as any,
      },
    });
    const newState = gameReducer(state, { type: 'MANUAL_END_GAME' });
    expect((newState._pendingSyncs[0].payload as PendingSyncSyncMatch).result.resultType).toBe('shootout');
  });

  it('sets finishedAt in the result', () => {
    const before = Date.now();
    const state = makeState();
    const newState = gameReducer(state, { type: 'MANUAL_END_GAME' });
    const after = Date.now();

    const result = (newState._pendingSyncs[0].payload as PendingSyncSyncMatch).result;
    const finishedAt = new Date(result.finishedAt).getTime();
    expect(finishedAt).toBeGreaterThanOrEqual(before);
    expect(finishedAt).toBeLessThanOrEqual(after);
  });
});

describe('finalizeMatch — SYNC_MATCH payload', () => {
  beforeEach(() => setGameReducerRef(gameReducer));

  it('liveSnapshot contains the match ID and score', () => {
    const state = makeState({ score: { home: 4, away: 2, homeShots: 20, awayShots: 15 } });
    const newState = gameReducer(state, { type: 'MANUAL_END_GAME' });

    const payload = newState._pendingSyncs[0].payload as PendingSyncSyncMatch;
    expect(payload.liveSnapshot.matchId).toBe(MATCH_ID);
    expect(payload.liveSnapshot.score.home).toBe(4);
    expect(payload.liveSnapshot.score.away).toBe(2);
  });

  it('liveSnapshot contains matchContext', () => {
    const state = makeState();
    const newState = gameReducer(state, { type: 'MANUAL_END_GAME' });

    const payload = newState._pendingSyncs[0].payload as PendingSyncSyncMatch;
    expect(payload.liveSnapshot.matchContext?.tournamentId).toBe(TOURNAMENT_ID);
  });

  it('does not include rawEvents in liveSnapshot (legacy field removed)', () => {
    const state = makeState();
    const newState = gameReducer(state, { type: 'MANUAL_END_GAME' });

    const payload = newState._pendingSyncs[0].payload as any;
    expect(payload.rawEvents).toBeUndefined();
    expect(payload.liveSnapshot).toBeDefined();
  });

  it('uses matchContext.tournamentId NOT selectedTournamentId (layer isolation)', () => {
    // selectedTournamentId is 'DIFFERENT-TOURNAMENT-ID' in makeState()
    // tournamentId in the sync must come from matchContext, which is TOURNAMENT_ID
    const state = makeState();
    expect(state.tournament.selectedTournamentId).toBe('DIFFERENT-TOURNAMENT-ID');

    const newState = gameReducer(state, { type: 'MANUAL_END_GAME' });
    const payload = newState._pendingSyncs[0].payload as PendingSyncSyncMatch;
    expect(payload.tournamentId).toBe(TOURNAMENT_ID);
    expect(payload.tournamentId).not.toBe('DIFFERENT-TOURNAMENT-ID');
  });
});

describe('finalizeMatch — tournament state updates', () => {
  beforeEach(() => setGameReducerRef(gameReducer));

  it('updates the match result in activeTournament.matches', () => {
    const state = makeState({ score: { home: 3, away: 0, homeShots: 18, awayShots: 6 } });
    const newState = gameReducer(state, { type: 'MANUAL_END_GAME' });

    const updatedMatch = newState.tournament.activeTournament?.matches.find(m => m.id === MATCH_ID);
    expect(updatedMatch?.result).toBeDefined();
    expect(updatedMatch?.result?.homeScore).toBe(3);
    expect(updatedMatch?.result?.awayScore).toBe(0);
    expect(updatedMatch?.result?.resultType).toBe('regulation');
  });

  it('sets periodDisplayOverride to End of Game', () => {
    const state = makeState();
    const newState = gameReducer(state, { type: 'MANUAL_END_GAME' });
    expect(newState.live.clock.periodDisplayOverride).toBe('End of Game');
    expect(newState.live.clock.isClockRunning).toBe(false);
  });

  it('does not push sync when there is no matchId', () => {
    const state = makeState();
    state.live.matchId = null as any;
    state.live.matchContext = null as any;
    const newState = gameReducer(state, { type: 'MANUAL_END_GAME' });
    expect(newState._pendingSyncs).toHaveLength(0);
  });
});
