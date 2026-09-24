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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTournament = (overrides = {}) => ({
  id: 'tournament-1',
  name: 'Test Tournament',
  status: 'active' as const,
  clubs: [],
  categories: [],
  matches: [],
  teams: [
    { id: 'team-1', name: 'Home Team', players: [], clubId: '', category: 'cat-1' },
    { id: 'team-2', name: 'Away Team', players: [], clubId: '', category: 'cat-1' },
  ],
  ...overrides,
});

const makeMatch = (id = 'match-1') => ({
  id,
  date: '2026-01-01',
  categoryId: 'cat-1',
  homeTeamId: 'team-1',
  awayTeamId: 'team-2',
  playersPerTeam: 5,
  phase: 'clasificacion' as const,
});

const makeStaffMember = (id = 'staff-1') => ({
  id,
  firstName: 'Juan',
  lastName: 'Perez',
  role: 'referee' as const,
});

// Simulate a sync being "in-flight": item is in the queue with attempts > 0
const withInFlightSync = (state: GameState, syncId: string, payload: any): GameState => ({
  ...state,
  _pendingSyncs: [
    {
      id: syncId,
      createdAt: new Date(Date.now() - 5000).toISOString(),
      attempts: 1,
      lastAttemptAt: new Date().toISOString(),
      payload,
    },
  ],
});

// ---------------------------------------------------------------------------

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
    expect(newState._pendingSyncs[0].payload.type).toBe('SYNC_TEAM_PLAYERS');
    const payload = newState._pendingSyncs[0].payload as any;
    expect(payload.tournamentId).toBe('tournament-1');
    expect(payload.teamId).toBe('team-1');
    expect(payload.players[0].name).toBe('Juan');
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

// ---------------------------------------------------------------------------
// Concurrency: modifications arriving while a sync is in-flight
// ---------------------------------------------------------------------------

describe('Concurrent modifications during in-flight sync', () => {
  beforeEach(() => {
    setGameReducerRef(gameReducer);
  });

  // --- SYNC_TEAM_PLAYERS ---

  it('adding a second player while SYNC_TEAM_PLAYERS is in-flight replaces the in-flight entry', () => {
    const state = getInitialState();
    state.tournament.activeTournament = makeTournament({
      teams: [{ id: 'team-1', name: 'Home', players: [{ id: 'p1', name: 'Player 1', number: '1', type: 'player' }], clubId: '', category: 'cat-1' }],
    });
    // Simulate a SYNC_TEAM_PLAYERS already in-flight for team-1
    const inFlightState = withInFlightSync(state, 'sync-in-flight', {
      type: 'SYNC_TEAM_PLAYERS',
      tournamentId: 'tournament-1',
      teamId: 'team-1',
      players: [{ id: 'p1', name: 'Player 1', number: '1', type: 'player' }],
    });

    const newState = gameReducer(inFlightState, {
      type: 'ADD_PLAYER_TO_TEAM',
      payload: { teamId: 'team-1', player: { id: 'p2', name: 'Player 2', number: '2', type: 'player' } },
    });

    // Still only one sync in queue (deduplicated)
    expect(newState._pendingSyncs).toHaveLength(1);
    const payload = newState._pendingSyncs[0].payload as any;
    expect(payload.type).toBe('SYNC_TEAM_PLAYERS');
    // The new entry includes BOTH players
    expect(payload.players).toHaveLength(2);
    expect(payload.players.map((p: any) => p.id)).toContain('p1');
    expect(payload.players.map((p: any) => p.id)).toContain('p2');
    // The old in-flight entry is gone (fresh attempts = 0)
    expect(newState._pendingSyncs[0].attempts).toBe(0);
  });

  it('updating a player while SYNC_TEAM_PLAYERS is in-flight replaces the in-flight entry with the latest roster', () => {
    const state = getInitialState();
    state.tournament.activeTournament = makeTournament({
      teams: [{ id: 'team-1', name: 'Home', players: [{ id: 'p1', name: 'Original Name', number: '10', type: 'player' }], clubId: '', category: 'cat-1' }],
    });
    const inFlightState = withInFlightSync(state, 'sync-in-flight', {
      type: 'SYNC_TEAM_PLAYERS',
      tournamentId: 'tournament-1',
      teamId: 'team-1',
      players: [{ id: 'p1', name: 'Original Name', number: '10', type: 'player' }],
    });

    const newState = gameReducer(inFlightState, {
      type: 'UPDATE_PLAYER_IN_TEAM',
      payload: { teamId: 'team-1', playerId: 'p1', updates: { name: 'Updated Name' } },
    });

    expect(newState._pendingSyncs).toHaveLength(1);
    const payload = newState._pendingSyncs[0].payload as any;
    expect(payload.players[0].name).toBe('Updated Name');
    expect(newState._pendingSyncs[0].attempts).toBe(0);
  });

  it('removing a player while SYNC_TEAM_PLAYERS is in-flight reflects the removal in the new sync', () => {
    const state = getInitialState();
    state.tournament.activeTournament = makeTournament({
      teams: [{ id: 'team-1', name: 'Home', players: [
        { id: 'p1', name: 'Player 1', number: '1', type: 'player' },
        { id: 'p2', name: 'Player 2', number: '2', type: 'player' },
      ], clubId: '', category: 'cat-1' }],
    });
    const inFlightState = withInFlightSync(state, 'sync-in-flight', {
      type: 'SYNC_TEAM_PLAYERS',
      tournamentId: 'tournament-1',
      teamId: 'team-1',
      players: [{ id: 'p1', name: 'Player 1', number: '1', type: 'player' }, { id: 'p2', name: 'Player 2', number: '2', type: 'player' }],
    });

    const newState = gameReducer(inFlightState, {
      type: 'REMOVE_PLAYER_FROM_TEAM',
      payload: { teamId: 'team-1', playerId: 'p2' },
    });

    expect(newState._pendingSyncs).toHaveLength(1);
    const payload = newState._pendingSyncs[0].payload as any;
    expect(payload.players).toHaveLength(1);
    expect(payload.players[0].id).toBe('p1');
  });

  // --- ADD_MATCH (UPDATE_MATCH dedup) ---

  it('editing a match while its ADD_MATCH sync is in-flight replaces the entry with the latest match data', () => {
    const originalMatch = makeMatch('match-1');
    const state = getInitialState();
    state.tournament.activeTournament = makeTournament({ matches: [originalMatch] });
    const inFlightState = withInFlightSync(state, 'sync-in-flight', {
      type: 'ADD_MATCH',
      tournamentId: 'tournament-1',
      match: originalMatch,
    });

    const updatedMatch = { ...originalMatch, date: '2026-06-15' };
    const newState = gameReducer(inFlightState, {
      type: 'UPDATE_MATCH_IN_TOURNAMENT',
      payload: { tournamentId: 'tournament-1', match: updatedMatch },
    });

    expect(newState._pendingSyncs).toHaveLength(1);
    const payload = newState._pendingSyncs[0].payload as any;
    expect(payload.type).toBe('ADD_MATCH');
    expect(payload.match.date).toBe('2026-06-15');
    expect(newState._pendingSyncs[0].attempts).toBe(0);
  });

  it('two rapid edits to the same match produce exactly one ADD_MATCH sync', () => {
    const state = getInitialState();
    state.tournament.activeTournament = makeTournament({ matches: [makeMatch('match-1')] });

    const s1 = gameReducer(state, {
      type: 'UPDATE_MATCH_IN_TOURNAMENT',
      payload: { tournamentId: 'tournament-1', match: { ...makeMatch('match-1'), date: '2026-03-01' } },
    });
    const s2 = gameReducer(s1, {
      type: 'UPDATE_MATCH_IN_TOURNAMENT',
      payload: { tournamentId: 'tournament-1', match: { ...makeMatch('match-1'), date: '2026-03-02' } },
    });

    expect(s2._pendingSyncs).toHaveLength(1);
    expect((s2._pendingSyncs[0].payload as any).match.date).toBe('2026-03-02');
  });

  // --- SYNC_STAFF ---

  it('adding staff while SYNC_STAFF is in-flight replaces the entry and includes all staff', () => {
    const state = getInitialState();
    const existingStaff = [makeStaffMember('staff-1')];
    state.tournament.activeTournament = makeTournament({ staff: existingStaff });
    const inFlightState = withInFlightSync(state, 'sync-in-flight', {
      type: 'SYNC_STAFF',
      tournamentId: 'tournament-1',
      staff: existingStaff,
    });

    const newState = gameReducer(inFlightState, {
      type: 'ADD_STAFF_TO_TOURNAMENT',
      payload: { tournamentId: 'tournament-1', staff: makeStaffMember('staff-2') },
    });

    expect(newState._pendingSyncs).toHaveLength(1);
    const payload = newState._pendingSyncs[0].payload as any;
    expect(payload.type).toBe('SYNC_STAFF');
    expect(payload.staff).toHaveLength(2);
    expect(newState._pendingSyncs[0].attempts).toBe(0);
  });

  it('three staff mutations produce exactly one SYNC_STAFF entry', () => {
    const state = getInitialState();
    state.tournament.activeTournament = makeTournament({ staff: [] });

    const s1 = gameReducer(state, { type: 'ADD_STAFF_TO_TOURNAMENT', payload: { tournamentId: 'tournament-1', staff: makeStaffMember('s1') } });
    const s2 = gameReducer(s1, { type: 'ADD_STAFF_TO_TOURNAMENT', payload: { tournamentId: 'tournament-1', staff: makeStaffMember('s2') } });
    const s3 = gameReducer(s2, { type: 'UPDATE_STAFF_IN_TOURNAMENT', payload: { tournamentId: 'tournament-1', staffId: 's1', updates: { firstName: 'Modified' } } });

    expect(s3._pendingSyncs.filter(s => s.payload.type === 'SYNC_STAFF')).toHaveLength(1);
    const payload = s3._pendingSyncs[0].payload as any;
    expect(payload.staff).toHaveLength(2);
    expect(payload.staff.find((s: any) => s.id === 's1')?.firstName).toBe('Modified');
  });

  // --- Cross-resource isolation ---

  it('concurrent modifications to different teams each get their own SYNC_TEAM_PLAYERS entry', () => {
    const state = getInitialState();
    state.tournament.activeTournament = makeTournament();

    const s1 = gameReducer(state, {
      type: 'ADD_PLAYER_TO_TEAM',
      payload: { teamId: 'team-1', player: { id: 'p1', name: 'P1', number: '1', type: 'player' } },
    });
    const s2 = gameReducer(s1, {
      type: 'ADD_PLAYER_TO_TEAM',
      payload: { teamId: 'team-2', player: { id: 'p2', name: 'P2', number: '2', type: 'player' } },
    });

    const syncs = s2._pendingSyncs.filter(s => s.payload.type === 'SYNC_TEAM_PLAYERS');
    expect(syncs).toHaveLength(2);
    expect(syncs.map((s: any) => s.payload.teamId).sort()).toEqual(['team-1', 'team-2']);
  });

  it('SYNC_TEAM_PLAYERS for team-1 is not affected by a modification to team-2', () => {
    const state = getInitialState();
    state.tournament.activeTournament = makeTournament({
      teams: [
        { id: 'team-1', name: 'Home', players: [{ id: 'p1', name: 'P1', number: '1', type: 'player' }], clubId: '', category: 'cat-1' },
        { id: 'team-2', name: 'Away', players: [], clubId: '', category: 'cat-1' },
      ],
    });
    const inFlightState = withInFlightSync(state, 'sync-team1', {
      type: 'SYNC_TEAM_PLAYERS',
      tournamentId: 'tournament-1',
      teamId: 'team-1',
      players: [{ id: 'p1', name: 'P1', number: '1', type: 'player' }],
    });

    const newState = gameReducer(inFlightState, {
      type: 'ADD_PLAYER_TO_TEAM',
      payload: { teamId: 'team-2', player: { id: 'p2', name: 'P2', number: '2', type: 'player' } },
    });

    const team1Sync = newState._pendingSyncs.find(s => (s.payload as any).teamId === 'team-1');
    const team2Sync = newState._pendingSyncs.find(s => (s.payload as any).teamId === 'team-2');

    // team-1 entry is untouched (still has original attempt count)
    expect(team1Sync?.attempts).toBe(1);
    // team-2 entry is fresh
    expect(team2Sync?.attempts).toBe(0);
    expect((team2Sync?.payload as any).players[0].id).toBe('p2');
  });

  // --- LOAD_TOURNAMENT_CONTEXT re-applies pending changes ---

  it('LOAD_TOURNAMENT_CONTEXT re-applies SYNC_TEAM_PLAYERS on top of stale cloud snapshot', () => {
    const state = getInitialState();
    state._pendingSyncs = [{
      id: 'sync-1',
      createdAt: new Date().toISOString(),
      attempts: 1,
      payload: {
        type: 'SYNC_TEAM_PLAYERS',
        tournamentId: 'tournament-1',
        teamId: 'team-1',
        players: [{ id: 'p1', name: 'Local Player', number: '99', type: 'player' as const }],
      },
    }];

    // Cloud snapshot arrives with empty roster (stale)
    const newState = gameReducer(state, {
      type: 'LOAD_TOURNAMENT_CONTEXT',
      payload: { tournamentData: makeTournament() },
    });

    const team = newState.tournament.activeTournament?.teams.find(t => t.id === 'team-1');
    expect(team?.players).toHaveLength(1);
    expect(team?.players[0].id).toBe('p1');
  });

  it('LOAD_TOURNAMENT_CONTEXT re-applies SYNC_MATCH result on top of stale cloud snapshot', () => {
    const state = getInitialState();
    state._pendingSyncs = [{
      id: 'sync-1',
      createdAt: new Date().toISOString(),
      attempts: 1,
      payload: {
        type: 'SYNC_MATCH',
        tournamentId: 'tournament-1',
        matchId: 'match-1',
        result: { homeScore: 3, awayScore: 1, resultType: 'regulation' as const, finishedAt: new Date().toISOString() },
        liveSnapshot: {} as any,
      },
    }];

    // Cloud snapshot has the match but without result
    const newState = gameReducer(state, {
      type: 'LOAD_TOURNAMENT_CONTEXT',
      payload: { tournamentData: makeTournament({ matches: [makeMatch('match-1')] }) },
    });

    const match = newState.tournament.activeTournament?.matches.find(m => m.id === 'match-1');
    expect((match as any)?.result?.homeScore).toBe(3);
    expect((match as any)?.result?.resultType).toBe('regulation');
  });
});
