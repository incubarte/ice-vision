/**
 * Tests for ADD_MATCH_TO_TOURNAMENT action.
 *
 * Layer contract:
 *  - The scoreboard app may create tournament matches offline.
 *  - The match ID is always assigned client-side before dispatch so that
 *    subsequent ADD_PLAYER and SYNC_MATCH syncs can reference the same ID.
 *  - The action MUST always queue an ADD_MATCH pending sync regardless of
 *    connectivity — no direct write to the server.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer, setGameReducerRef } from '../game-state-reducer';
import type { GameState, GameAction, MatchData, PendingSyncAddMatch } from '@/types';
import defaultSettings from '@/config/defaults.json';

const TOURNAMENT_ID = 'tournament-1';

function makeBaseState(): GameState {
  return {
    config: { ...defaultSettings, numberOfRegularPeriods: 2, maxConcurrentPenalties: 2, tickIntervalMs: 200 },
    live: {
      matchId: null,
      homeTeamName: '',
      awayTeamName: '',
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
      activeTournament: {
        id: TOURNAMENT_ID,
        name: 'Test Cup',
        status: 'active',
        clubs: [],
        teams: [],
        categories: [],
        matches: [],
      },
      selectedTournamentId: TOURNAMENT_ID,
      selectedMatchCategory: '',
    },
    _pendingSyncs: [],
    _lastActionType: null,
  } as unknown as GameState;
}

function makeMatch(id = 'match-new-1'): Omit<MatchData, never> {
  return {
    id,
    date: '2025-06-01',
    categoryId: 'cat-1',
    homeTeamId: 'team-home',
    awayTeamId: 'team-away',
    playersPerTeam: 5,
    phase: 'clasificacion',
  } as MatchData;
}

describe('ADD_MATCH_TO_TOURNAMENT — local state update', () => {
  beforeEach(() => setGameReducerRef(gameReducer));

  it('adds the match to activeTournament.matches', () => {
    const state = makeBaseState();
    const match = makeMatch('match-abc');

    const newState = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: { tournamentId: TOURNAMENT_ID, match },
    });

    expect(newState.tournament.activeTournament?.matches).toHaveLength(1);
    expect(newState.tournament.activeTournament?.matches[0].id).toBe('match-abc');
  });

  it('preserves the client-assigned ID (does not overwrite with new UUID)', () => {
    const state = makeBaseState();
    const match = makeMatch('client-assigned-id-123');

    const newState = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: { tournamentId: TOURNAMENT_ID, match },
    });

    expect(newState.tournament.activeTournament?.matches[0].id).toBe('client-assigned-id-123');
  });

  it('appends to existing matches without replacing them', () => {
    const state = makeBaseState();
    state.tournament.activeTournament!.matches = [makeMatch('existing-match')];

    const newState = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: { tournamentId: TOURNAMENT_ID, match: makeMatch('new-match') },
    });

    expect(newState.tournament.activeTournament?.matches).toHaveLength(2);
    expect(newState.tournament.activeTournament?.matches[0].id).toBe('existing-match');
    expect(newState.tournament.activeTournament?.matches[1].id).toBe('new-match');
  });

  it('is a no-op when tournamentId does not match activeTournament', () => {
    const state = makeBaseState();
    const newState = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: { tournamentId: 'wrong-tournament', match: makeMatch() },
    });

    expect(newState.tournament.activeTournament?.matches).toHaveLength(0);
  });

  it('is a no-op when there is no activeTournament', () => {
    const state = makeBaseState();
    state.tournament.activeTournament = null;

    const newState = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: { tournamentId: TOURNAMENT_ID, match: makeMatch() },
    });

    expect(newState.tournament.activeTournament).toBeNull();
    expect(newState._pendingSyncs).toHaveLength(0);
  });
});

describe('ADD_MATCH_TO_TOURNAMENT — pending sync queue', () => {
  beforeEach(() => setGameReducerRef(gameReducer));

  it('always pushes an ADD_MATCH sync to _pendingSyncs', () => {
    const state = makeBaseState();
    const newState = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: { tournamentId: TOURNAMENT_ID, match: makeMatch('match-1') },
    });

    expect(newState._pendingSyncs).toHaveLength(1);
    expect(newState._pendingSyncs[0].payload.type).toBe('ADD_MATCH');
  });

  it('sync payload contains the correct tournamentId', () => {
    const state = makeBaseState();
    const newState = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: { tournamentId: TOURNAMENT_ID, match: makeMatch() },
    });

    const payload = newState._pendingSyncs[0].payload as PendingSyncAddMatch;
    expect(payload.tournamentId).toBe(TOURNAMENT_ID);
  });

  it('sync payload match has the same ID as the local state match', () => {
    const state = makeBaseState();
    const match = makeMatch('synced-id-99');

    const newState = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: { tournamentId: TOURNAMENT_ID, match },
    });

    const payload = newState._pendingSyncs[0].payload as PendingSyncAddMatch;
    const localMatch = newState.tournament.activeTournament?.matches[0];

    expect(payload.match.id).toBe('synced-id-99');
    expect(payload.match.id).toBe(localMatch?.id);
  });

  it('sync entry has attempts=0 and a createdAt timestamp', () => {
    const state = makeBaseState();
    const before = new Date().toISOString();
    const newState = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: { tournamentId: TOURNAMENT_ID, match: makeMatch() },
    });

    const sync = newState._pendingSyncs[0];
    expect(sync.attempts).toBe(0);
    expect(sync.createdAt >= before).toBe(true);
    expect(sync.id).toBeTruthy();
  });

  it('accumulates multiple ADD_MATCH syncs when creating multiple matches', () => {
    let state = makeBaseState();

    state = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: { tournamentId: TOURNAMENT_ID, match: makeMatch('match-1') },
    });
    state = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: { tournamentId: TOURNAMENT_ID, match: makeMatch('match-2') },
    });

    expect(state._pendingSyncs).toHaveLength(2);
    expect((state._pendingSyncs[0].payload as PendingSyncAddMatch).match.id).toBe('match-1');
    expect((state._pendingSyncs[1].payload as PendingSyncAddMatch).match.id).toBe('match-2');
  });

  it('does not push sync when tournamentId mismatch', () => {
    const state = makeBaseState();
    const newState = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: { tournamentId: 'wrong-id', match: makeMatch() },
    });
    expect(newState._pendingSyncs).toHaveLength(0);
  });

  it('RESOLVE_SYNC removes the ADD_MATCH entry from the queue', () => {
    const state = makeBaseState();
    let newState = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: { tournamentId: TOURNAMENT_ID, match: makeMatch('match-1') },
    });

    const syncId = newState._pendingSyncs[0].id;
    newState = gameReducer(newState, { type: 'RESOLVE_SYNC', payload: { id: syncId } });

    expect(newState._pendingSyncs).toHaveLength(0);
    // But the match remains in local state
    expect(newState.tournament.activeTournament?.matches).toHaveLength(1);
  });

  it('SYNC_ATTEMPT_FAILED increments attempts and records error', () => {
    const state = makeBaseState();
    let newState = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: { tournamentId: TOURNAMENT_ID, match: makeMatch() },
    });

    const syncId = newState._pendingSyncs[0].id;
    newState = gameReducer(newState, {
      type: 'SYNC_ATTEMPT_FAILED',
      payload: { id: syncId, error: 'Network timeout' },
    });

    expect(newState._pendingSyncs[0].attempts).toBe(1);
    expect(newState._pendingSyncs[0].lastError).toBe('Network timeout');
    expect(newState._pendingSyncs[0].lastAttemptAt).toBeDefined();
  });
});

describe('ADD_MATCH_TO_TOURNAMENT — offline + online consistency', () => {
  beforeEach(() => setGameReducerRef(gameReducer));

  it('a match created offline can have a player added to it (IDs align)', () => {
    let state = makeBaseState();
    const matchId = 'offline-match-1';

    // 1. Create match offline
    state = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: { tournamentId: TOURNAMENT_ID, match: makeMatch(matchId) },
    });

    // 2. Add a team so we can add a player
    state.tournament.activeTournament!.teams = [
      { id: 'team-home', name: 'Home', players: [], clubId: '', category: 'cat-1' } as any,
    ];

    // 3. Add a player during an ongoing match
    state = gameReducer(state, {
      type: 'ADD_PLAYER_TO_TEAM',
      payload: { teamId: 'team-home', player: { id: 'player-1', name: 'Gomez', number: '7', type: 'player' } },
    });

    // Both syncs are queued
    expect(state._pendingSyncs).toHaveLength(2);
    expect(state._pendingSyncs[0].payload.type).toBe('ADD_MATCH');
    expect(state._pendingSyncs[1].payload.type).toBe('ADD_PLAYER');

    // The ADD_PLAYER sync references the same tournamentId
    const addPlayerPayload = state._pendingSyncs[1].payload as any;
    expect(addPlayerPayload.tournamentId).toBe(TOURNAMENT_ID);
  });

  it('LOAD_PENDING_SYNCS restores syncs after app restart', () => {
    const state = makeBaseState();
    const restoredSyncs = [
      {
        id: 'sync-restored-1',
        createdAt: new Date().toISOString(),
        attempts: 2,
        lastError: 'Offline',
        payload: {
          type: 'ADD_MATCH' as const,
          tournamentId: TOURNAMENT_ID,
          match: makeMatch('restored-match-1') as MatchData,
        },
      },
    ];

    const newState = gameReducer(state, { type: 'LOAD_PENDING_SYNCS', payload: restoredSyncs });

    expect(newState._pendingSyncs).toHaveLength(1);
    expect(newState._pendingSyncs[0].id).toBe('sync-restored-1');
    expect(newState._pendingSyncs[0].attempts).toBe(2);
    expect((newState._pendingSyncs[0].payload as PendingSyncAddMatch).match.id).toBe('restored-match-1');
  });
});
