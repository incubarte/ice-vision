import { describe, it, expect, beforeEach, vi } from 'vitest';
import { gameReducer } from '@/contexts/game-state-context';
import { setGameReducerRef } from '../game-state-reducer';
import type { GameState, GameAction } from '@/types';
import defaultSettings from '@/config/defaults.json';

// Simple mock for generating initial state
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
    _lastActionType: null,
  } as unknown as GameState;
  
  return state;
};

describe('Game State Reducer - End of Game Flow', () => {
  beforeEach(() => {
    // Set up recursive reducer ref
    setGameReducerRef(gameReducer);
  });

  it('should transition to End of Game when MANUAL_END_GAME is triggered at the end of the last period', () => {
    const state = getInitialState();
    
    // Set state to end of period 2 (last regular period) with home team winning
    state.live.clock.currentPeriod = 2;
    state.live.clock.currentTime = 0;
    state.live.clock.periodDisplayOverride = null;
    state.live.score.home = 2;
    state.live.score.away = 1;

    const action: GameAction = { type: 'MANUAL_END_GAME' };
    const newState = gameReducer(state, action);

    expect(newState.live.clock.periodDisplayOverride).toBe('End of Game');
    expect(newState.live.clock.isClockRunning).toBe(false);
    expect(newState._pendingSummaryGeneration?.matchId).toBe('test-match-123');
  });

  it('should transition to AwaitingDecision when tied at the end of last period with no OTs', () => {
    const state = getInitialState();
    state.config.numberOfOvertimePeriods = 0;
    state.live.clock.currentPeriod = 2;
    state.live.clock.currentTime = 0;
    state.live.score.home = 1;
    state.live.score.away = 1;

    const action: GameAction = { type: 'MANUAL_END_GAME' };
    const newState = gameReducer(state, action);

    expect(newState.live.clock.periodDisplayOverride).toBe('AwaitingDecision');
  });

  it('should transition to Pre-OT Break when tied at end of regulation with OTs configured', () => {
    const state = getInitialState();
    state.config.numberOfOvertimePeriods = 1;
    state.config.defaultPreOTBreakDuration = 6000;
    state.live.clock.currentPeriod = 2;
    state.live.clock.currentTime = 0;
    state.live.score.home = 1;
    state.live.score.away = 1;

    const action: GameAction = { type: 'MANUAL_END_GAME' };
    const newState = gameReducer(state, action);

    expect(newState.live.clock.periodDisplayOverride).toBe('Pre-OT Break');
    expect(newState.live.clock.currentTime).toBe(6000);
  });
});
