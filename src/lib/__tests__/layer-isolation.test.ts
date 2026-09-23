/**
 * Layer isolation tests.
 *
 * These tests enforce the architectural contract:
 *  "The clock/scoreboard module MUST NOT couple directly to tournament management.
 *   All tournament data flows through APIs — the local module only holds a lite
 *   snapshot. Tournament mutations queue as pending syncs (never direct writes)."
 *
 * Categories:
 *  1. Reducer never imports from data-access (static module boundary)
 *  2. readTournament with includeSummaries=false never requests summary file paths
 *  3. All tournament mutations from the clock go through _pendingSyncs, not direct calls
 *  4. SYNC_MATCH carries matchContext.tournamentId, not selectedTournamentId
 *  5. Offline mode flag propagates correctly
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gameReducer, setGameReducerRef } from '../game-state-reducer';
import type { GameState, PendingSyncSyncMatch, PendingSyncAddMatch, PendingSyncAddPlayer } from '@/types';
import defaultSettings from '@/config/defaults.json';

// ─── Helpers ────────────────────────────────────────────────────────────────

const TOURNAMENT_ID = 'cloud-tournament-1';
const MATCH_ID = 'match-live-1';
const SELECTED_TOURNAMENT_ID = 'different-selected-id'; // must never appear in clock syncs

function makeClockState(scoreHome = 2, scoreAway = 1): GameState {
  return {
    config: {
      ...defaultSettings,
      numberOfRegularPeriods: 2,
      numberOfOvertimePeriods: 0,
      maxConcurrentPenalties: 2,
      tickIntervalMs: 200,
    },
    live: {
      matchId: MATCH_ID,
      homeTeamName: 'Lions',
      awayTeamName: 'Bears',
      score: { home: scoreHome, away: scoreAway, homeShots: 8, awayShots: 6 },
      clock: {
        currentTime: 0,
        currentPeriod: 2,
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
      // matchContext is the snapshot taken at match start — source of truth for tournamentId
      matchContext: {
        tournamentId: TOURNAMENT_ID,
        matchId: MATCH_ID,
        homeTeamId: 'team-home',
        awayTeamId: 'team-away',
        homeRoster: [],
        awayRoster: [],
        categoryId: 'cat-1',
      },
    },
    tournament: {
      tournaments: [],
      activeTournament: {
        id: TOURNAMENT_ID,
        name: 'Test Cup',
        status: 'active',
        clubs: [],
        teams: [{ id: 'team-home', name: 'Lions', players: [], clubId: '', category: 'cat-1' } as any],
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
          } as any,
        ],
      },
      // This is intentionally different — syncs must use matchContext.tournamentId
      selectedTournamentId: SELECTED_TOURNAMENT_ID,
      selectedMatchCategory: '',
    },
    _pendingSyncs: [],
    _lastActionType: null,
  } as unknown as GameState;
}

// ─── 1. Static module boundary ────────────────────────────────────────────

describe('Layer: reducer does not directly access storage/data-access', () => {
  it('game-state-reducer source does not import from data-access', async () => {
    // Dynamic import allows us to inspect the module's source-level dependencies.
    // The reducer must be pure — all I/O is handled by the context layer.
    const fs = await import('fs');
    const path = await import('path');
    const reducerSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/game-state-reducer.ts'),
      'utf-8'
    );
    expect(reducerSrc).not.toMatch(/from ['"].*data-access['"]/);
    expect(reducerSrc).not.toMatch(/from ['"].*storage['"]/);
    expect(reducerSrc).not.toMatch(/storageProvider/);
  });

  it('game-state-reducer does not call saveTournamentOnServer directly', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const reducerSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/game-state-reducer.ts'),
      'utf-8'
    );
    // Strip single-line comments before checking — comments are allowed to mention these names
    const codeOnly = reducerSrc.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    expect(codeOnly).not.toMatch(/saveTournamentOnServer\s*\(/);
    expect(codeOnly).not.toMatch(/\bfetch\s*\(/);
  });
});

// ─── 2. SYNC_MATCH uses matchContext, not selectedTournamentId ────────────

describe('Layer: SYNC_MATCH tournamentId comes from matchContext, not selectedTournamentId', () => {
  beforeEach(() => setGameReducerRef(gameReducer));

  it('SYNC_MATCH.tournamentId equals matchContext.tournamentId', () => {
    const state = makeClockState();
    const newState = gameReducer(state, { type: 'MANUAL_END_GAME' });

    const sync = newState._pendingSyncs[0];
    expect(sync.payload.type).toBe('SYNC_MATCH');
    expect((sync.payload as PendingSyncSyncMatch).tournamentId).toBe(TOURNAMENT_ID);
  });

  it('SYNC_MATCH.tournamentId is NOT selectedTournamentId', () => {
    const state = makeClockState();
    expect(state.tournament.selectedTournamentId).toBe(SELECTED_TOURNAMENT_ID);

    const newState = gameReducer(state, { type: 'MANUAL_END_GAME' });
    const payload = newState._pendingSyncs[0].payload as PendingSyncSyncMatch;

    expect(payload.tournamentId).not.toBe(SELECTED_TOURNAMENT_ID);
  });

  it('works correctly even when matchContext.tournamentId differs from activeTournament.id', () => {
    const state = makeClockState();
    // Simulate a scenario where the active tournament changed mid-session
    state.tournament.activeTournament = {
      ...state.tournament.activeTournament!,
      id: 'another-tournament',
    };

    const newState = gameReducer(state, { type: 'MANUAL_END_GAME' });
    const payload = newState._pendingSyncs[0].payload as PendingSyncSyncMatch;

    // Still uses matchContext, not activeTournament.id
    expect(payload.tournamentId).toBe(TOURNAMENT_ID);
  });
});

// ─── 3. ADD_PLAYER goes through pending sync, not direct write ────────────

describe('Layer: ADD_PLAYER_TO_TEAM queues sync, never writes directly', () => {
  beforeEach(() => setGameReducerRef(gameReducer));

  it('ADD_PLAYER_TO_TEAM pushes to _pendingSyncs with correct tournamentId', () => {
    const state = makeClockState();
    const newState = gameReducer(state, {
      type: 'ADD_PLAYER_TO_TEAM',
      payload: { teamId: 'team-home', player: { id: 'p1', name: 'García', number: '9', type: 'player' } },
    });

    expect(newState._pendingSyncs).toHaveLength(1);
    const payload = newState._pendingSyncs[0].payload as PendingSyncAddPlayer;
    expect(payload.type).toBe('ADD_PLAYER');
    expect(payload.tournamentId).toBe(TOURNAMENT_ID);
  });
});

// ─── 4. ADD_MATCH goes through pending sync ────────────────────────────────

describe('Layer: ADD_MATCH_TO_TOURNAMENT queues sync, never writes directly', () => {
  beforeEach(() => setGameReducerRef(gameReducer));

  it('ADD_MATCH_TO_TOURNAMENT pushes to _pendingSyncs', () => {
    const state = makeClockState();
    const newState = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: {
        tournamentId: TOURNAMENT_ID,
        match: {
          id: 'new-match-offline',
          date: '2025-02-01',
          categoryId: 'cat-1',
          homeTeamId: 'team-home',
          awayTeamId: 'team-away',
          playersPerTeam: 5,
          phase: 'clasificacion',
        } as any,
      },
    });

    expect(newState._pendingSyncs).toHaveLength(1);
    const payload = newState._pendingSyncs[0].payload as PendingSyncAddMatch;
    expect(payload.type).toBe('ADD_MATCH');
    expect(payload.match.id).toBe('new-match-offline');
  });

  it('client-assigned match ID is preserved in sync payload (cloud must respect it)', () => {
    const clientId = 'uuid-set-by-local-app-before-dispatch';
    const state = makeClockState();
    const newState = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: {
        tournamentId: TOURNAMENT_ID,
        match: { id: clientId, date: '2025-02-01', categoryId: 'cat-1', homeTeamId: 'h', awayTeamId: 'a', playersPerTeam: 5, phase: 'clasificacion' } as any,
      },
    });

    const payload = newState._pendingSyncs[0].payload as PendingSyncAddMatch;
    expect(payload.match.id).toBe(clientId);
    // Local state also uses the same ID
    const localMatch = newState.tournament.activeTournament?.matches.find(m => m.id === clientId);
    expect(localMatch).toBeDefined();
  });
});

// ─── 5. Offline mode flag ────────────────────────────────────────────────────

describe('Layer: SET_OFFLINE_MODE and LOAD_PENDING_SYNCS', () => {
  beforeEach(() => setGameReducerRef(gameReducer));

  it('SET_OFFLINE_MODE true sets offlineMode flag in tournament state', () => {
    const state = makeClockState();
    const newState = gameReducer(state, { type: 'SET_OFFLINE_MODE', payload: true });
    expect(newState.tournament.offlineMode).toBe(true);
  });

  it('SET_OFFLINE_MODE false clears the flag', () => {
    const state = makeClockState();
    state.tournament.offlineMode = true;
    const newState = gameReducer(state, { type: 'SET_OFFLINE_MODE', payload: false });
    expect(newState.tournament.offlineMode).toBe(false);
  });

  it('LOAD_PENDING_SYNCS replaces the entire queue', () => {
    const state = makeClockState();
    state._pendingSyncs = [
      {
        id: 'old-sync',
        createdAt: new Date().toISOString(),
        attempts: 5,
        payload: { type: 'ADD_PLAYER', tournamentId: 't1', teamId: 'team-1', player: { id: 'p1', name: 'Old', number: '1', type: 'player' } as any },
      },
    ];

    const newSyncs = [
      {
        id: 'restored-sync',
        createdAt: new Date().toISOString(),
        attempts: 1,
        lastError: 'Timeout',
        payload: { type: 'ADD_MATCH' as const, tournamentId: TOURNAMENT_ID, match: { id: 'restored-match' } as any },
      },
    ];

    const newState = gameReducer(state, { type: 'LOAD_PENDING_SYNCS', payload: newSyncs });
    expect(newState._pendingSyncs).toHaveLength(1);
    expect(newState._pendingSyncs[0].id).toBe('restored-sync');
    expect(newState._pendingSyncs[0].attempts).toBe(1);
  });
});

// ─── 6. Sync integrity across operations ──────────────────────────────────

describe('Layer: sync queue integrity across multiple operations', () => {
  beforeEach(() => setGameReducerRef(gameReducer));

  it('each sync has a unique ID', () => {
    let state = makeClockState();

    state = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: { tournamentId: TOURNAMENT_ID, match: { id: 'm1', date: '', categoryId: 'cat-1', homeTeamId: 'h', awayTeamId: 'a', playersPerTeam: 5, phase: 'clasificacion' } as any },
    });
    state = gameReducer(state, {
      type: 'ADD_PLAYER_TO_TEAM',
      payload: { teamId: 'team-home', player: { id: 'p1', name: 'Test', number: '1', type: 'player' } },
    });

    const ids = state._pendingSyncs.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('syncs are ordered: ADD_MATCH before ADD_PLAYER', () => {
    let state = makeClockState();

    state = gameReducer(state, {
      type: 'ADD_MATCH_TO_TOURNAMENT',
      payload: { tournamentId: TOURNAMENT_ID, match: { id: 'm1', date: '', categoryId: 'cat-1', homeTeamId: 'h', awayTeamId: 'a', playersPerTeam: 5, phase: 'clasificacion' } as any },
    });
    state = gameReducer(state, {
      type: 'ADD_PLAYER_TO_TEAM',
      payload: { teamId: 'team-home', player: { id: 'p1', name: 'Test', number: '1', type: 'player' } },
    });

    expect(state._pendingSyncs[0].payload.type).toBe('ADD_MATCH');
    expect(state._pendingSyncs[1].payload.type).toBe('ADD_PLAYER');
  });

  it('match result update only affects the correct match in activeTournament', () => {
    const state = makeClockState();
    // Add a second match that should NOT be touched
    state.tournament.activeTournament!.matches.push({
      id: 'other-match',
      date: '2025-01-02',
      categoryId: 'cat-1',
      homeTeamId: 'team-home',
      awayTeamId: 'team-away',
      playersPerTeam: 5,
      phase: 'clasificacion',
    } as any);

    const newState = gameReducer(state, { type: 'MANUAL_END_GAME' });

    const updatedMatch = newState.tournament.activeTournament?.matches.find(m => m.id === MATCH_ID);
    const otherMatch   = newState.tournament.activeTournament?.matches.find(m => m.id === 'other-match');

    expect(updatedMatch?.result).toBeDefined();
    expect(otherMatch?.result).toBeUndefined();
  });
});
