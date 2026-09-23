import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer, setGameReducerRef } from '../game-state-reducer';
import type { GameState, GameAction } from '@/types';
import defaultSettings from '@/config/defaults.json';

// Simple mock for generating initial state — mirrors pattern from game-state-reducer.test.ts
const getInitialState = (): GameState => {
  const state = {
    config: {
      ...defaultSettings,
      numberOfRegularPeriods: 2,
      defaultPeriodDuration: 120000, // 20 mins in cs
      defaultBreakDuration: 12000,   // 2 mins in cs
      maxConcurrentPenalties: 2,
      tickIntervalMs: 200,
    },
    live: {
      matchId: 'test-match-123',
      homeTeamName: 'Home',
      awayTeamName: 'Away',
      score: { home: 0, away: 0, homeShots: 0, awayShots: 0 },
      clock: {
        currentTime: 120000,
        currentPeriod: 1,
        isClockRunning: false,
        isFlashingZero: false,
        periodDisplayOverride: null,
        absoluteElapsedTimeCs: 0,
        _liveAbsoluteElapsedTimeCs: 0,
      },
      penalties: { home: [], away: [] },
      attendance: { home: [], away: [] },
      shootout: { isActive: false, rounds: [], homeScore: 0, awayScore: 0 },
      playedPeriods: [],
      playHornTrigger: 0,
    },
    tournament: {
      tournaments: [],
      activeTournament: null,
      selectedTournamentId: null,
      selectedMatchCategory: '',
    },
    _pendingSyncs: [],
    _lastActionType: null,
  } as unknown as GameState;

  return state;
};

describe('Pending Syncs Queue', () => {
  beforeEach(() => {
    setGameReducerRef(gameReducer);
  });

  it('should push ADD_PLAYER sync when adding a player during a match', () => {
    const state = getInitialState();
    // Set up active tournament
    state.tournament.activeTournament = {
      id: 'tournament-1',
      name: 'Test Tournament',
      status: 'active',
      clubs: [],
      teams: [{ id: 'team-1', name: 'Home Team', players: [], clubId: '', category: 'cat-1' }],
      categories: [],
      matches: [],
    };

    const action: GameAction = {
      type: 'ADD_PLAYER_TO_TEAM',
      payload: { teamId: 'team-1', player: { name: 'Juan', number: '10', id: 'player-1', type: 'player' } },
    };

    const newState = gameReducer(state, action);

    expect(newState._pendingSyncs).toHaveLength(1);
    expect(newState._pendingSyncs[0].payload.type).toBe('ADD_PLAYER');
    expect((newState._pendingSyncs[0].payload as any).player.name).toBe('Juan');
    expect((newState._pendingSyncs[0].payload as any).tournamentId).toBe('tournament-1');
  });

  it('should push SYNC_MATCH sync when MANUAL_END_GAME is triggered at end of last period', () => {
    const state = getInitialState();
    state.live.clock.currentPeriod = 2;
    state.live.clock.currentTime = 0;
    state.live.score.home = 3;
    state.live.score.away = 1;

    const action: GameAction = { type: 'MANUAL_END_GAME' };
    const newState = gameReducer(state, action);

    expect(newState._pendingSyncs).toHaveLength(1);
    expect(newState._pendingSyncs[0].payload.type).toBe('SYNC_MATCH');
    const payload = newState._pendingSyncs[0].payload as any;
    expect(payload.matchId).toBe('test-match-123');
    expect(payload.result.homeScore).toBe(3);
    expect(payload.result.awayScore).toBe(1);
    expect(payload.result.resultType).toBe('regulation');
    // liveSnapshot replaces rawEvents — check it is present with the full live state
    expect(payload.liveSnapshot).toBeDefined();
    expect(payload.liveSnapshot.matchId).toBe('test-match-123');
    expect(payload.liveSnapshot.score.home).toBe(3);
    expect(payload.liveSnapshot.score.away).toBe(1);
    expect(payload.rawEvents).toBeUndefined();
  });

  it('should push SAVE_SUMMARY sync when saving a match summary', () => {
    const state = getInitialState();
    const mockSummary = {
      attendance: { home: [], away: [] },
      playedPeriods: [],
    } as any;
    state.tournament.activeTournament = {
      id: 'tournament-1',
      name: 'Test',
      status: 'active',
      clubs: [],
      teams: [],
      categories: [],
      matches: [
        {
          id: 'match-1',
          date: '',
          categoryId: '',
          homeTeamId: '',
          awayTeamId: '',
          playersPerTeam: 5,
          phase: 'clasificacion',
        },
      ],
    };

    const action: GameAction = {
      type: 'SAVE_MATCH_SUMMARY',
      payload: { matchId: 'match-1', summary: mockSummary },
    };

    const newState = gameReducer(state, action);

    expect(newState._pendingSyncs).toHaveLength(1);
    expect(newState._pendingSyncs[0].payload.type).toBe('SAVE_SUMMARY');
    expect((newState._pendingSyncs[0].payload as any).matchId).toBe('match-1');
  });

  it('should remove a sync item when RESOLVE_SYNC is dispatched', () => {
    const state = getInitialState();
    state._pendingSyncs = [
      {
        id: 'sync-1',
        createdAt: new Date().toISOString(),
        attempts: 0,
        payload: {
          type: 'ADD_PLAYER',
          tournamentId: 't1',
          teamId: 'team-1',
          player: { id: 'p1', name: 'Test', number: '1', type: 'player' } as any,
        },
      },
    ];

    const newState = gameReducer(state, { type: 'RESOLVE_SYNC', payload: { id: 'sync-1' } });
    expect(newState._pendingSyncs).toHaveLength(0);
  });

  it('should increment attempts and record error on SYNC_ATTEMPT_FAILED', () => {
    const state = getInitialState();
    state._pendingSyncs = [
      {
        id: 'sync-1',
        createdAt: new Date().toISOString(),
        attempts: 0,
        payload: {
          type: 'ADD_PLAYER',
          tournamentId: 't1',
          teamId: 'team-1',
          player: { id: 'p1', name: 'Test', number: '1', type: 'player' } as any,
        },
      },
    ];

    const newState = gameReducer(state, {
      type: 'SYNC_ATTEMPT_FAILED',
      payload: { id: 'sync-1', error: 'Network error' },
    });

    expect(newState._pendingSyncs[0].attempts).toBe(1);
    expect(newState._pendingSyncs[0].lastError).toBe('Network error');
    expect(newState._pendingSyncs[0].lastAttemptAt).toBeDefined();
  });
});
