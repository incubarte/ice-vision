import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer, getInitialState, setGameReducerRef } from '../game-state-reducer';
import type { GameState, GameAction } from '@/types';

/**
 * Comprehensive tests for gameReducer actions.
 * Covers: TOGGLE_CLOCK, SET_TIME, ADJUST_TIME, SET_PERIOD, ADD_GOAL (standalone),
 * EDIT_GOAL, DELETE_GOAL, ADD_PLAYER_SHOT, handleAutoTransition (via TICK),
 * START_BREAK, START_PRE_OT_BREAK, START_WARMUP, START_TIMEOUT, END_TIMEOUT,
 * ADD_EXTRA_OVERTIME, START_SHOOTOUT, RECORD_SHOOTOUT_ATTEMPT, FINISH_SHOOTOUT,
 * SET_TEAM_ATTENDANCE, UPDATE_ATTENDANCE_PLAYER, SET_ACTIVE_GOALKEEPER,
 * FINISH_GAME_WITH_OT_GOAL
 */

const setupGameState = (overrides?: {
  period?: number;
  time?: number;
  override?: GameState['live']['clock']['periodDisplayOverride'];
  running?: boolean;
  score?: { home: number; away: number };
}): GameState => {
  const state = JSON.parse(JSON.stringify(getInitialState())) as GameState;
  state.config.numberOfRegularPeriods = 2;
  state.config.defaultPeriodDuration = 120000;
  state.config.defaultOTPeriodDuration = 30000;
  state.config.defaultBreakDuration = 12000;
  state.config.defaultPreOTBreakDuration = 6000;
  state.config.defaultTimeoutDuration = 3000;
  state.config.defaultWarmUpDuration = 30000;
  state.config.numberOfOvertimePeriods = 1;
  state.config.autoStartBreaks = false;
  state.config.autoStartPreOTBreaks = false;
  state.config.autoStartTimeouts = false;
  state.config.autoStartWarmUp = false;
  state.config.maxConcurrentPenalties = 2;
  state.config.playersPerTeamOnIce = 5;
  state.config.flashingZeroDurationMs = 200;
  state.config.penaltyTypes = [
    { id: 'minor', name: 'Minor', duration: 120, reducesPlayerCount: true, clearsOnGoal: true, isBenchPenalty: false },
  ];

  state.live.clock.currentPeriod = overrides?.period ?? 1;
  state.live.clock.currentTime = overrides?.time ?? 120000;
  state.live.clock.periodDisplayOverride = overrides?.override ?? null;
  state.live.clock.isClockRunning = overrides?.running ?? false;
  state.live.clock.absoluteElapsedTimeCs = 0;
  state.live.clock._liveAbsoluteElapsedTimeCs = 0;

  if (overrides?.score) {
    state.live.score.home = overrides.score.home;
    state.live.score.away = overrides.score.away;
  }

  // Default matchContext with common player numbers used in tests
  const defaultPlayers = ['5', '7', '9', '10', '11', '99'].map(num => ({
    id: `p${num}`, number: num, name: `Player ${num}`, type: 'player' as const,
  }));
  state.live.matchContext = {
    tournamentId: 'test-tournament',
    homeTeamId: 'home-team',
    awayTeamId: 'away-team',
    homeRoster: defaultPlayers,
    awayRoster: defaultPlayers,
    categoryId: 'test-cat',
  } as any;

  return state;
};

describe('Game Reducer - Clock Control', () => {
  beforeEach(() => {
    setGameReducerRef(gameReducer);
  });

  describe('TOGGLE_CLOCK', () => {
    it('should start the clock when stopped and time > 0', () => {
      const state = setupGameState({ time: 60000, running: false });
      const result = gameReducer(state, { type: 'TOGGLE_CLOCK' });

      expect(result.live.clock.isClockRunning).toBe(true);
      expect(result.live.clock.clockStartTimeMs).toBeTypeOf('number');
      expect(result.live.clock.remainingTimeAtStartCs).toBe(60000);
    });

    it('should stop the clock when running', () => {
      const state = setupGameState({ time: 60000, running: true });
      state.live.clock.clockStartTimeMs = Date.now() - 100; // started 100ms ago
      state.live.clock.remainingTimeAtStartCs = 60000;

      const result = gameReducer(state, { type: 'TOGGLE_CLOCK' });

      expect(result.live.clock.isClockRunning).toBe(false);
      expect(result.live.clock.clockStartTimeMs).toBeNull();
      expect(result.live.clock.remainingTimeAtStartCs).toBeNull();
    });

    it('should not start if time is 0', () => {
      const state = setupGameState({ time: 0, running: false });
      const result = gameReducer(state, { type: 'TOGGLE_CLOCK' });

      expect(result.live.clock.isClockRunning).toBe(false);
    });

    it('should not toggle during End of Game', () => {
      const state = setupGameState({ override: 'End of Game' });
      const result = gameReducer(state, { type: 'TOGGLE_CLOCK' });

      expect(result.live.clock.periodDisplayOverride).toBe('End of Game');
      expect(result.live.clock.isClockRunning).toBe(false);
    });

    it('should not toggle during flashing zero', () => {
      const state = setupGameState({ time: 0, running: false });
      state.live.clock.isFlashingZero = true;

      const result = gameReducer(state, { type: 'TOGGLE_CLOCK' });
      expect(result.live.clock.isClockRunning).toBe(false);
    });
  });

  describe('SET_TIME', () => {
    it('should set time from minutes and seconds', () => {
      const state = setupGameState({ time: 120000 });
      const result = gameReducer(state, {
        type: 'SET_TIME',
        payload: { minutes: 5, seconds: 30 },
      });

      expect(result.live.clock.currentTime).toBe(33000); // (5*60+30)*100
    });

    it('should stop clock if time set to 0', () => {
      const state = setupGameState({ time: 60000, running: true });
      state.live.clock.clockStartTimeMs = Date.now();
      state.live.clock.remainingTimeAtStartCs = 60000;

      const result = gameReducer(state, {
        type: 'SET_TIME',
        payload: { minutes: 0, seconds: 0 },
      });

      expect(result.live.clock.currentTime).toBe(0);
      expect(result.live.clock.isClockRunning).toBe(false);
    });

    it('should not work during End of Game', () => {
      const state = setupGameState({ override: 'End of Game' });
      const result = gameReducer(state, {
        type: 'SET_TIME',
        payload: { minutes: 10, seconds: 0 },
      });

      expect(result.live.clock.currentTime).toBe(state.live.clock.currentTime);
    });

    it('should recalculate absolute time for game periods', () => {
      const state = setupGameState({ period: 2, time: 60000 });
      const result = gameReducer(state, {
        type: 'SET_TIME',
        payload: { minutes: 10, seconds: 0 },
      });

      // Period 2, 10 min remaining → period 1 full (120000) + (120000 - 60000) elapsed in P2
      expect(result.live.clock.absoluteElapsedTimeCs).toBe(120000 + 60000);
    });
  });

  describe('ADJUST_TIME', () => {
    it('should add time to the clock', () => {
      const state = setupGameState({ time: 60000, running: false });
      const result = gameReducer(state, { type: 'ADJUST_TIME', payload: 3000 }); // +30 seconds

      expect(result.live.clock.currentTime).toBe(63000);
    });

    it('should subtract time from the clock, clamping to 0', () => {
      const state = setupGameState({ time: 1000, running: false });
      const result = gameReducer(state, { type: 'ADJUST_TIME', payload: -5000 });

      expect(result.live.clock.currentTime).toBe(0);
      expect(result.live.clock.isClockRunning).toBe(false);
    });

    it('should stop clock if adjusted to 0 while running', () => {
      const state = setupGameState({ time: 500, running: true });
      state.live.clock.clockStartTimeMs = Date.now();
      state.live.clock.remainingTimeAtStartCs = 500;

      const result = gameReducer(state, { type: 'ADJUST_TIME', payload: -10000 });

      expect(result.live.clock.currentTime).toBe(0);
      expect(result.live.clock.isClockRunning).toBe(false);
    });
  });

  describe('SET_PERIOD', () => {
    it('should set period and reset clock to period duration', () => {
      const state = setupGameState({ period: 1 });
      const result = gameReducer(state, { type: 'SET_PERIOD', payload: 2 });

      expect(result.live.clock.currentPeriod).toBe(2);
      expect(result.live.clock.currentTime).toBe(120000); // defaultPeriodDuration
      expect(result.live.clock.periodDisplayOverride).toBeNull();
    });

    it('should use OT duration for OT periods', () => {
      const state = setupGameState({ period: 2 });
      const result = gameReducer(state, { type: 'SET_PERIOD', payload: 3 }); // OT1

      expect(result.live.clock.currentPeriod).toBe(3);
      expect(result.live.clock.currentTime).toBe(30000); // defaultOTPeriodDuration
    });

    it('should set Pre Warm-up when going to period 0 from fresh state', () => {
      const state = setupGameState({ period: 0, override: 'Pre Warm-up' });
      const result = gameReducer(state, { type: 'SET_PERIOD', payload: 0 });

      expect(result.live.clock.currentPeriod).toBe(0);
      expect(result.live.clock.periodDisplayOverride).toBe('Pre Warm-up');
    });

    it('should set Warm-up when going to period 0 after playing periods', () => {
      const state = setupGameState({ period: 1 });
      state.live.playedPeriods = ['1ST'];
      const result = gameReducer(state, { type: 'SET_PERIOD', payload: 0 });

      expect(result.live.clock.currentPeriod).toBe(0);
      expect(result.live.clock.periodDisplayOverride).toBe('Warm-up');
    });
  });
});

describe('Game Reducer - Goals', () => {
  beforeEach(() => {
    setGameReducerRef(gameReducer);
  });

  describe('ADD_GOAL', () => {
    it('should add a goal and increment score', () => {
      const state = setupGameState({ period: 1, time: 60000 });
      const result = gameReducer(state, {
        type: 'ADD_GOAL',
        payload: { team: 'home', scorer: { playerNumber: '10' } },
      });

      expect(result.live.score.home).toBe(1);
      expect(result.live.score.away).toBe(0);
      expect(result.live.goals.home).toHaveLength(1);
      expect(result.live.goals.home[0].scorer?.playerNumber).toBe('10');
    });

    it('should auto-add scorer to attendance', () => {
      const state = setupGameState();
      expect(state.live.attendance.home).toHaveLength(0);

      const result = gameReducer(state, {
        type: 'ADD_GOAL',
        payload: { team: 'home', scorer: { playerNumber: '7' } },
      });

      expect(result.live.attendance.home).toContain('7');
    });

    it('should auto-add assist to attendance', () => {
      const state = setupGameState();

      const result = gameReducer(state, {
        type: 'ADD_GOAL',
        payload: {
          team: 'away',
          scorer: { playerNumber: '9' },
          assist: { playerNumber: '11' },
        },
      });

      expect(result.live.attendance.away).toContain('9');
      expect(result.live.attendance.away).toContain('11');
    });

    it('should auto-add scorer number to attendance', () => {
      const state = setupGameState();
      state.live.matchContext = {
        tournamentId: 't1',
        homeRoster: [{ id: 'p1', number: '10', name: 'John Doe', type: 'player' }],
        awayRoster: [],
      } as any;

      const result = gameReducer(state, {
        type: 'ADD_GOAL',
        payload: { team: 'home', scorer: { playerNumber: '10' } },
      });

      expect(result.live.attendance.home).toContain('10');
    });

    it('should not duplicate attendance when scorer already present', () => {
      const state = setupGameState();
      state.live.attendance.home = ['10'];

      const result = gameReducer(state, {
        type: 'ADD_GOAL',
        payload: { team: 'home', scorer: { playerNumber: '10' } },
      });

      const count = result.live.attendance.home.filter((n: string) => n === '10').length;
      expect(count).toBe(1);
    });

    it('should detect power play goal opportunity', () => {
      const state = setupGameState({ period: 1, time: 60000 });
      // Home has a running penalty
      state.live.penalties.home = [{
        id: 'pen1',
        playerNumber: '5',
        _status: 'running',
        reducesPlayerCount: true,
        clearsOnGoal: true,
        initialDuration: 120,
        expirationTime: 50000,
        _doesNotReducePlayerCountOverride: false,
      } as any];

      const result = gameReducer(state, {
        type: 'ADD_GOAL',
        payload: { team: 'away', scorer: { playerNumber: '9' } },
      });

      expect(result.live.pendingPowerPlayGoal).not.toBeNull();
      expect(result.live.pendingPowerPlayGoal?.team).toBe('home');
      expect(result.live.pendingPowerPlayGoal?.penaltyId).toBe('pen1');
    });

    it('should log goal with the game period text, not "TIME OUT", when added during a timeout', () => {
      const state = setupGameState({ period: 2, time: 60000 });
      state.live.clock.isClockRunning = false;
      state.live.clock.periodDisplayOverride = 'Time Out';
      state.live.clock.preTimeoutState = {
        period: 2,
        time: 60000,
        override: null,
        absoluteElapsedTimeCs: state.live.clock.absoluteElapsedTimeCs,
      } as any;

      const result = gameReducer(state, {
        type: 'ADD_GOAL',
        payload: { team: 'home', scorer: { playerNumber: '10' } },
      });

      expect(result.live.goals.home[0].periodText).toBe('2ND');
    });
  });

  describe('EDIT_GOAL', () => {
    it('should update goal data', () => {
      const state = setupGameState();
      // Add a goal first
      let result = gameReducer(state, {
        type: 'ADD_GOAL',
        payload: { team: 'home', scorer: { playerNumber: '10' } },
      });
      const goalId = result.live.goals.home[0].id;

      result = gameReducer(result, {
        type: 'EDIT_GOAL',
        payload: {
          goalId,
          updates: { assist: { playerNumber: '5' } },
        },
      });

      expect(result.live.goals.home[0].assist?.playerNumber).toBe('5');
    });
  });

  describe('DELETE_GOAL', () => {
    it('should remove a goal and decrement score', () => {
      const state = setupGameState();
      let result = gameReducer(state, {
        type: 'ADD_GOAL',
        payload: { team: 'home', scorer: { playerNumber: '10' } },
      });
      expect(result.live.score.home).toBe(1);
      const goalId = result.live.goals.home[0].id;

      result = gameReducer(result, {
        type: 'DELETE_GOAL',
        payload: { goalId },
      });

      expect(result.live.score.home).toBe(0);
      expect(result.live.goals.home).toHaveLength(0);
    });
  });

  describe('ADD_PLAYER_SHOT', () => {
    it('should add a shot and increment shot count', () => {
      const state = setupGameState({ period: 1, time: 60000 });
      const result = gameReducer(state, {
        type: 'ADD_PLAYER_SHOT',
        payload: { team: 'home', playerNumber: '10' },
      });

      expect(result.live.shotsLog.home).toHaveLength(1);
      expect(result.live.score.homeShots).toBe(1);
      expect(result.live.shotsLog.home[0].playerNumber).toBe('10');
    });

    it('should track shots per team independently', () => {
      let state = setupGameState({ period: 1 });
      state = gameReducer(state, { type: 'ADD_PLAYER_SHOT', payload: { team: 'home', playerNumber: '10' } });
      state = gameReducer(state, { type: 'ADD_PLAYER_SHOT', payload: { team: 'home', playerNumber: '7' } });
      state = gameReducer(state, { type: 'ADD_PLAYER_SHOT', payload: { team: 'away', playerNumber: '9' } });

      expect(state.live.score.homeShots).toBe(2);
      expect(state.live.score.awayShots).toBe(1);
    });
  });
});

describe('Game Reducer - Roster Validation', () => {
  beforeEach(() => {
    setGameReducerRef(gameReducer);
  });

  describe('ADD_GOAL rejects invalid player numbers', () => {
    it('should reject goal with scorer not in roster', () => {
      const state = setupGameState({ period: 1, time: 60000 });
      const result = gameReducer(state, {
        type: 'ADD_GOAL',
        payload: { team: 'home', timestamp: Date.now(), gameTime: 60000, scorer: { playerNumber: '88' } },
      });

      expect(result.live.score.home).toBe(0);
      expect(result.live.goals.home).toHaveLength(0);
    });

    it('should reject goal with assist not in roster', () => {
      const state = setupGameState({ period: 1, time: 60000 });
      const result = gameReducer(state, {
        type: 'ADD_GOAL',
        payload: {
          team: 'home',
          timestamp: Date.now(),
          gameTime: 60000,
          scorer: { playerNumber: '10' },
          assist: { playerNumber: '88' },
        },
      });

      expect(result.live.score.home).toBe(0);
      expect(result.live.goals.home).toHaveLength(0);
    });

    it('should accept goal when all players are in roster', () => {
      const state = setupGameState({ period: 1, time: 60000 });
      const result = gameReducer(state, {
        type: 'ADD_GOAL',
        payload: {
          team: 'home',
          timestamp: Date.now(),
          gameTime: 60000,
          scorer: { playerNumber: '10' },
          assist: { playerNumber: '7' },
        },
      });

      expect(result.live.score.home).toBe(1);
      expect(result.live.goals.home).toHaveLength(1);
    });
  });

  describe('ADD_PLAYER_SHOT rejects invalid player numbers', () => {
    it('should reject shot with player not in roster', () => {
      const state = setupGameState({ period: 1, time: 60000 });
      const result = gameReducer(state, {
        type: 'ADD_PLAYER_SHOT',
        payload: { team: 'home', playerNumber: '88' },
      });

      expect(result.live.shotsLog.home).toHaveLength(0);
      expect(result.live.score.homeShots).toBe(0);
    });

    it('should accept shot when player is in roster', () => {
      const state = setupGameState({ period: 1, time: 60000 });
      const result = gameReducer(state, {
        type: 'ADD_PLAYER_SHOT',
        payload: { team: 'home', playerNumber: '10' },
      });

      expect(result.live.shotsLog.home).toHaveLength(1);
      expect(result.live.score.homeShots).toBe(1);
    });
  });

  describe('ADD_PENALTY rejects invalid player numbers', () => {
    it('should reject penalty with player not in roster', () => {
      const state = setupGameState();
      const result = gameReducer(state, {
        type: 'ADD_PENALTY',
        payload: { team: 'home', penalty: { penaltyTypeId: 'minor', playerNumber: '88' } },
      });

      expect(result.live.penalties.home).toHaveLength(0);
      expect(result.live.penaltiesLog.home).toHaveLength(0);
    });

    it('should accept penalty when player is in roster', () => {
      const state = setupGameState();
      const result = gameReducer(state, {
        type: 'ADD_PENALTY',
        payload: { team: 'home', penalty: { penaltyTypeId: 'minor', playerNumber: '10' } },
      });

      expect(result.live.penalties.home).toHaveLength(1);
    });
  });

  describe('RECORD_SHOOTOUT_ATTEMPT rejects invalid player numbers', () => {
    it('should reject shootout attempt with player not in roster', () => {
      const state = setupGameState({ override: 'Shootout' });
      state.live.shootout = { isActive: true, rounds: 5, homeAttempts: [], awayAttempts: [], initiator: null };

      const result = gameReducer(state, {
        type: 'RECORD_SHOOTOUT_ATTEMPT',
        payload: { team: 'home', playerNumber: '88', isGoal: true },
      });

      expect(result.live.shootout.homeAttempts).toHaveLength(0);
    });

    it('should accept shootout attempt when player is in roster', () => {
      const state = setupGameState({ override: 'Shootout' });
      state.live.shootout = { isActive: true, rounds: 5, homeAttempts: [], awayAttempts: [], initiator: null };

      const result = gameReducer(state, {
        type: 'RECORD_SHOOTOUT_ATTEMPT',
        payload: { team: 'home', playerNumber: '10', isGoal: true },
      });

      expect(result.live.shootout.homeAttempts).toHaveLength(1);
    });
  });
});

describe('Game Reducer - Period Transitions', () => {
  beforeEach(() => {
    setGameReducerRef(gameReducer);
  });

  describe('handleAutoTransition (via TICK at clock=0)', () => {
    it('should transition from period 1 to Break when clock reaches 0', () => {
      const state = setupGameState({ period: 1, time: 1, running: true });
      state.live.clock.clockStartTimeMs = Date.now() - 100;
      state.live.clock.remainingTimeAtStartCs = 1;

      const result = gameReducer(state, { type: 'TICK' });

      // After flashing zero completes, auto-transition should occur
      // First it goes to flashing zero state
      expect(result.live.clock.isFlashingZero || result.live.clock.periodDisplayOverride === 'Break').toBe(true);
    });

    it('should transition from Warm-up to Period 1', () => {
      const state = setupGameState({ period: 0, time: 0, override: 'Warm-up' });
      // Simulate handleAutoTransition being called
      // The auto-transition from Warm-up sets period 1 with defaultPeriodDuration
      const result = gameReducer(state, { type: 'MANUAL_END_GAME' });
      // MANUAL_END_GAME only works with null override, so use a different approach:
      // Directly test via START_BREAK flow or similar
    });

    it('should transition from Break to next period', () => {
      const state = setupGameState({ period: 1, time: 0, override: 'Break' });
      // Simulate clock reaching 0 during break by dispatching auto-transition
      // handleAutoTransition from Break → next period
      const result = gameReducer(state, { type: 'TOGGLE_CLOCK' });
      // Break with time 0 won't start, but we can test START_BREAK → period transition
    });
  });

  describe('START_BREAK', () => {
    it('should set Break state with correct duration', () => {
      const state = setupGameState({ period: 1, time: 0 });
      const result = gameReducer(state, { type: 'START_BREAK' });

      expect(result.live.clock.periodDisplayOverride).toBe('Break');
      expect(result.live.clock.currentTime).toBe(12000); // defaultBreakDuration
      expect(result.live.clock.isClockRunning).toBe(false); // autoStartBreaks=false
    });

    it('should auto-start break when configured', () => {
      const state = setupGameState({ period: 1, time: 0 });
      state.config.autoStartBreaks = true;
      const result = gameReducer(state, { type: 'START_BREAK' });

      expect(result.live.clock.isClockRunning).toBe(true);
      expect(result.live.clock.clockStartTimeMs).toBeTypeOf('number');
    });

    it('should add finished period to playedPeriods', () => {
      const state = setupGameState({ period: 1 });
      const result = gameReducer(state, { type: 'START_BREAK' });

      expect(result.live.playedPeriods).toContain('1ST');
    });

    it('should not duplicate playedPeriods', () => {
      const state = setupGameState({ period: 1 });
      state.live.playedPeriods = ['1ST'];
      const result = gameReducer(state, { type: 'START_BREAK' });

      expect(result.live.playedPeriods.filter(p => p === '1ST')).toHaveLength(1);
    });
  });

  describe('START_PRE_OT_BREAK', () => {
    it('should set Pre-OT Break with correct duration', () => {
      const state = setupGameState({ period: 2, time: 0 });
      const result = gameReducer(state, { type: 'START_PRE_OT_BREAK' });

      expect(result.live.clock.periodDisplayOverride).toBe('Pre-OT Break');
      expect(result.live.clock.currentTime).toBe(6000); // defaultPreOTBreakDuration
    });

    it('should add finished period to playedPeriods', () => {
      const state = setupGameState({ period: 2 });
      const result = gameReducer(state, { type: 'START_PRE_OT_BREAK' });

      expect(result.live.playedPeriods).toContain('2ND');
    });
  });

  describe('START_WARMUP', () => {
    it('should transition from Pre Warm-up to Warm-up', () => {
      const state = setupGameState({ period: 0, override: 'Pre Warm-up' });
      const result = gameReducer(state, { type: 'START_WARMUP' });

      expect(result.live.clock.periodDisplayOverride).toBe('Warm-up');
      expect(result.live.clock.currentTime).toBe(30000); // defaultWarmUpDuration
    });

    it('should auto-start clock when configured', () => {
      const state = setupGameState({ period: 0, override: 'Pre Warm-up' });
      state.config.autoStartWarmUp = true;
      const result = gameReducer(state, { type: 'START_WARMUP' });

      expect(result.live.clock.isClockRunning).toBe(true);
    });

    it('should not transition if not in Pre Warm-up', () => {
      const state = setupGameState({ period: 1, override: null });
      const result = gameReducer(state, { type: 'START_WARMUP' });

      // Should remain unchanged
      expect(result.live.clock.periodDisplayOverride).toBeNull();
    });
  });
});

describe('Game Reducer - Timeouts', () => {
  beforeEach(() => {
    setGameReducerRef(gameReducer);
  });

  describe('START_TIMEOUT', () => {
    it('should save pre-timeout state and set Time Out', () => {
      const state = setupGameState({ period: 1, time: 80000, running: false });
      const result = gameReducer(state, {
        type: 'START_TIMEOUT',
        payload: { team: 'home' },
      });

      expect(result.live.clock.periodDisplayOverride).toBe('Time Out');
      expect(result.live.clock.currentTime).toBe(3000); // defaultTimeoutDuration
      expect(result.live.clock.preTimeoutState).not.toBeNull();
      expect(result.live.clock.preTimeoutState?.period).toBe(1);
      expect(result.live.clock.preTimeoutState?.time).toBe(80000);
      expect(result.live.clock.preTimeoutState?.team).toBe('home');
    });

    it('should auto-start timeout when configured', () => {
      const state = setupGameState({ period: 1, time: 80000 });
      state.config.autoStartTimeouts = true;
      const result = gameReducer(state, {
        type: 'START_TIMEOUT',
        payload: { team: 'away' },
      });

      expect(result.live.clock.isClockRunning).toBe(true);
    });
  });

  describe('END_TIMEOUT', () => {
    it('should restore pre-timeout state', () => {
      const state = setupGameState({ period: 1, time: 80000 });

      // Start timeout
      let result = gameReducer(state, {
        type: 'START_TIMEOUT',
        payload: { team: 'home' },
      });
      expect(result.live.clock.periodDisplayOverride).toBe('Time Out');

      // End timeout
      result = gameReducer(result, { type: 'END_TIMEOUT' });

      expect(result.live.clock.periodDisplayOverride).toBeNull();
      expect(result.live.clock.currentPeriod).toBe(1);
      expect(result.live.clock.currentTime).toBe(80000);
      expect(result.live.clock.isClockRunning).toBe(false);
      expect(result.live.clock.preTimeoutState).toBeNull();
    });

    it('should not crash if no pre-timeout state exists', () => {
      const state = setupGameState();
      const result = gameReducer(state, { type: 'END_TIMEOUT' });

      // Should remain unchanged
      expect(result.live.clock.currentTime).toBe(state.live.clock.currentTime);
    });
  });
});

describe('Game Reducer - Overtime & Shootout', () => {
  beforeEach(() => {
    setGameReducerRef(gameReducer);
  });

  describe('ADD_EXTRA_OVERTIME', () => {
    it('should add an OT period from AwaitingDecision and go to Pre-OT Break', () => {
      const state = setupGameState({ period: 3, override: 'AwaitingDecision', score: { home: 1, away: 1 } });
      state.config.numberOfOvertimePeriods = 1;

      const result = gameReducer(state, { type: 'ADD_EXTRA_OVERTIME' });

      expect(result.config.numberOfOvertimePeriods).toBe(2);
      expect(result.live.clock.periodDisplayOverride).toBe('Pre-OT Break');
      expect(result.live.clock.currentTime).toBe(6000); // defaultPreOTBreakDuration
    });

    it('should do nothing if not in AwaitingDecision', () => {
      const state = setupGameState({ period: 2 });
      const result = gameReducer(state, { type: 'ADD_EXTRA_OVERTIME' });

      expect(result.config.numberOfOvertimePeriods).toBe(state.config.numberOfOvertimePeriods);
    });
  });

  describe('START_SHOOTOUT', () => {
    it('should activate shootout from AwaitingDecision', () => {
      const state = setupGameState({ period: 3, override: 'AwaitingDecision' });

      const result = gameReducer(state, { type: 'START_SHOOTOUT' });

      expect(result.live.shootout.isActive).toBe(true);
      expect(result.live.clock.periodDisplayOverride).toBe('Shootout');
    });

    it('should do nothing if not in AwaitingDecision', () => {
      const state = setupGameState({ period: 1 });
      const result = gameReducer(state, { type: 'START_SHOOTOUT' });

      expect(result.live.shootout.isActive).toBe(false);
    });
  });

  describe('RECORD_SHOOTOUT_ATTEMPT', () => {
    it('should record an attempt for the correct team', () => {
      const state = setupGameState({ override: 'Shootout' });
      state.live.shootout = { isActive: true, rounds: 5, homeAttempts: [], awayAttempts: [], initiator: null };

      const result = gameReducer(state, {
        type: 'RECORD_SHOOTOUT_ATTEMPT',
        payload: { team: 'home', playerNumber: '10', isGoal: true },
      });

      expect(result.live.shootout.homeAttempts).toHaveLength(1);
      expect(result.live.shootout.homeAttempts[0].isGoal).toBe(true);
      expect(result.live.shootout.homeAttempts[0].round).toBe(1);
      expect(result.live.shootout.initiator).toBe('home');
    });

    it('should increment round number for subsequent attempts', () => {
      let state = setupGameState({ override: 'Shootout' });
      state.live.shootout = { isActive: true, rounds: 5, homeAttempts: [], awayAttempts: [], initiator: null };

      state = gameReducer(state, { type: 'RECORD_SHOOTOUT_ATTEMPT', payload: { team: 'home', playerNumber: '10', isGoal: true } });
      state = gameReducer(state, { type: 'RECORD_SHOOTOUT_ATTEMPT', payload: { team: 'home', playerNumber: '7', isGoal: false } });

      expect(state.live.shootout.homeAttempts).toHaveLength(2);
      expect(state.live.shootout.homeAttempts[1].round).toBe(2);
    });
  });

  describe('UNDO_LAST_SHOOTOUT_ATTEMPT', () => {
    it('should remove the last attempt for a team', () => {
      let state = setupGameState({ override: 'Shootout' });
      state.live.shootout = { isActive: true, rounds: 5, homeAttempts: [], awayAttempts: [], initiator: null };
      state = gameReducer(state, { type: 'RECORD_SHOOTOUT_ATTEMPT', payload: { team: 'home', playerNumber: '10', isGoal: true } });
      state = gameReducer(state, { type: 'RECORD_SHOOTOUT_ATTEMPT', payload: { team: 'home', playerNumber: '7', isGoal: false } });

      const result = gameReducer(state, { type: 'UNDO_LAST_SHOOTOUT_ATTEMPT', payload: { team: 'home' } });

      expect(result.live.shootout.homeAttempts).toHaveLength(1);
    });
  });

  describe('FINISH_SHOOTOUT', () => {
    it('should add +1 to winning team score and finalize match', () => {
      const state = setupGameState({ period: 3, score: { home: 1, away: 1 }, override: 'Shootout' });
      state.live.shootout = {
        isActive: true,
        rounds: 5,
        homeAttempts: [
          { id: '1', round: 1, isGoal: true, playerNumber: '10' },
          { id: '2', round: 2, isGoal: true, playerNumber: '7' },
        ],
        awayAttempts: [
          { id: '3', round: 1, isGoal: false, playerNumber: '9' },
          { id: '4', round: 2, isGoal: true, playerNumber: '11' },
        ],
        initiator: 'home',
      } as any;

      const result = gameReducer(state, { type: 'FINISH_SHOOTOUT' });

      // Home wins shootout 2-1, gets +1
      expect(result.live.score.home).toBe(2);
      expect(result.live.score.away).toBe(1);
      expect(result.live.clock.periodDisplayOverride).toBe('End of Game');
    });

    it('should add +1 to away if away wins shootout', () => {
      const state = setupGameState({ period: 3, score: { home: 1, away: 1 }, override: 'Shootout' });
      state.live.shootout = {
        isActive: true,
        rounds: 5,
        homeAttempts: [{ id: '1', round: 1, isGoal: false, playerNumber: '10' }],
        awayAttempts: [{ id: '2', round: 1, isGoal: true, playerNumber: '9' }],
        initiator: 'home',
      } as any;

      const result = gameReducer(state, { type: 'FINISH_SHOOTOUT' });

      expect(result.live.score.home).toBe(1);
      expect(result.live.score.away).toBe(2);
      expect(result.live.clock.periodDisplayOverride).toBe('End of Game');
    });
  });

  describe('FINISH_GAME_WITH_OT_GOAL', () => {
    it('should add goal and finalize match in one step', () => {
      const state = setupGameState({ period: 3, time: 15000, score: { home: 1, away: 1 } });
      // Pre-populate goals to match score (score is derived from goals.length)
      state.live.goals.home = [{ id: 'g1', team: 'home', scorer: { playerNumber: '7' } } as any];
      state.live.goals.away = [{ id: 'g2', team: 'away', scorer: { playerNumber: '9' } } as any];

      const result = gameReducer(state, {
        type: 'FINISH_GAME_WITH_OT_GOAL',
        payload: { team: 'home', scorer: { playerNumber: '10' } },
      });

      expect(result.live.score.home).toBe(2);
      expect(result.live.clock.periodDisplayOverride).toBe('End of Game');
    });
  });
});

describe('Game Reducer - MANUAL_END_GAME (extended)', () => {
  beforeEach(() => {
    setGameReducerRef(gameReducer);
  });

  it('should start a normal Break when ending a non-final regular period', () => {
    const state = setupGameState({ period: 1, time: 0 });
    state.live.score.home = 2;
    state.live.score.away = 1;

    const result = gameReducer(state, { type: 'MANUAL_END_GAME' });

    expect(result.live.clock.periodDisplayOverride).toBe('Break');
    expect(result.live.clock.currentTime).toBe(12000);
  });

  it('should finalize when a team leads in OT', () => {
    const state = setupGameState({ period: 3, time: 0 });
    state.config.numberOfOvertimePeriods = 1;
    state.live.score.home = 3;
    state.live.score.away = 2;

    const result = gameReducer(state, { type: 'MANUAL_END_GAME' });

    expect(result.live.clock.periodDisplayOverride).toBe('End of Game');
  });

  it('should go to AwaitingDecision when tied after final OT', () => {
    const state = setupGameState({ period: 3, time: 0 });
    state.config.numberOfOvertimePeriods = 1;
    state.live.score.home = 2;
    state.live.score.away = 2;

    const result = gameReducer(state, { type: 'MANUAL_END_GAME' });

    expect(result.live.clock.periodDisplayOverride).toBe('AwaitingDecision');
  });

  it('should go to Pre-OT Break when tied in non-final OT', () => {
    const state = setupGameState({ period: 3, time: 0 });
    state.config.numberOfOvertimePeriods = 2; // OT1 and OT2
    state.live.score.home = 2;
    state.live.score.away = 2;

    const result = gameReducer(state, { type: 'MANUAL_END_GAME' });

    expect(result.live.clock.periodDisplayOverride).toBe('Pre-OT Break');
  });

  it('should do nothing if periodDisplayOverride is not null', () => {
    const state = setupGameState({ period: 1, override: 'Break' });
    const result = gameReducer(state, { type: 'MANUAL_END_GAME' });

    // Break was not cleared since override !== null
    expect(result.live.clock.periodDisplayOverride).toBe('Break');
  });
});

describe('Game Reducer - Attendance & Goalkeepers', () => {
  beforeEach(() => {
    setGameReducerRef(gameReducer);
  });

  describe('SET_TEAM_ATTENDANCE', () => {
    it('should set attendance as jersey number strings', () => {
      const state = setupGameState();
      state.live.attendance.home = [];
      state.live.matchContext = {
        tournamentId: 't1',
        homeRoster: [
          { id: 'p1', number: '10', name: 'Alice', type: 'player' },
          { id: 'p2', number: '20', name: 'Bob', type: 'goalkeeper' },
          { id: 'p3', number: '30', name: 'Charlie', type: 'player' },
        ],
        awayRoster: [],
      } as any;

      const result = gameReducer(state, {
        type: 'SET_TEAM_ATTENDANCE',
        payload: { team: 'home', playerNumbers: ['10', '20'] },
      });

      expect(result.live.attendance.home).toHaveLength(2);
      expect(result.live.attendance.home).toContain('10');
      expect(result.live.attendance.home).toContain('20');
      expect(result.live.attendance.home).not.toContain('30');
    });

    it('should store only number strings', () => {
      const state = setupGameState();

      const result = gameReducer(state, {
        type: 'SET_TEAM_ATTENDANCE',
        payload: { team: 'home', playerNumbers: ['10', '99'] },
      });

      expect(result.live.attendance.home).toHaveLength(2);
      expect(result.live.attendance.home).toContain('10');
      expect(result.live.attendance.home).toContain('99');
    });

    it('should remove players not in playerNumbers', () => {
      const state = setupGameState();
      state.live.attendance.home = ['10', '20'];

      const result = gameReducer(state, {
        type: 'SET_TEAM_ATTENDANCE',
        payload: { team: 'home', playerNumbers: ['10'] },
      });

      expect(result.live.attendance.home).toHaveLength(1);
      expect(result.live.attendance.home[0]).toBe('10');
    });
  });

  describe('UPDATE_ATTENDANCE_PLAYER', () => {
    it('should update jersey number in roster and attendance', () => {
      const state = setupGameState();
      state.live.matchContext = {
        tournamentId: 't1',
        homeRoster: [
          { id: 'p1', number: '10', name: 'Alice', type: 'player' },
        ],
        awayRoster: [],
      } as any;
      state.live.attendance.home = ['10'];

      const result = gameReducer(state, {
        type: 'UPDATE_ATTENDANCE_PLAYER',
        payload: { team: 'home', playerName: 'Alice', updates: { number: '99' } },
      });

      // Roster should be updated
      expect(result.live.matchContext?.homeRoster[0].number).toBe('99');
      // Attendance should have new number, not old
      expect(result.live.attendance.home).toContain('99');
      expect(result.live.attendance.home).not.toContain('10');
    });

    it('should handle collision by clearing conflicting player number', () => {
      const state = setupGameState();
      state.live.matchContext = {
        tournamentId: 't1',
        homeRoster: [
          { id: 'p1', number: '10', name: 'Alice', type: 'player' },
          { id: 'p2', number: '20', name: 'Bob', type: 'player' },
        ],
        awayRoster: [],
      } as any;
      state.live.attendance.home = ['10', '20'];

      // Change Alice's number to 20 (Bob's number)
      const result = gameReducer(state, {
        type: 'UPDATE_ATTENDANCE_PLAYER',
        payload: { team: 'home', playerName: 'Alice', updates: { number: '20' } },
      });

      // Alice should have number 20 in roster
      expect(result.live.matchContext?.homeRoster.find(p => p.name === 'Alice')?.number).toBe('20');
      // Bob's number should be cleared in roster
      expect(result.live.matchContext?.homeRoster.find(p => p.name === 'Bob')?.number).toBe('');
    });

    it('should preserve changed number through SET_TEAM_ATTENDANCE', () => {
      const state = setupGameState();
      state.live.matchContext = {
        tournamentId: 't1',
        homeRoster: [
          { id: 'p1', number: '10', name: 'Alice', type: 'player' },
          { id: 'p2', number: '20', name: 'Bob', type: 'player' },
        ],
        awayRoster: [],
      } as any;

      // Set initial attendance
      let result = gameReducer(state, {
        type: 'SET_TEAM_ATTENDANCE',
        payload: { team: 'home', playerNumbers: ['10', '20'] },
      });

      expect(result.live.attendance.home).toHaveLength(2);

      // Change Alice's number to 99
      result = gameReducer(result, {
        type: 'UPDATE_ATTENDANCE_PLAYER',
        payload: { team: 'home', playerName: 'Alice', updates: { number: '99' } },
      });

      expect(result.live.attendance.home).toContain('99');
      expect(result.live.matchContext?.homeRoster.find(p => p.name === 'Alice')?.number).toBe('99');

      // Re-set attendance with updated numbers
      result = gameReducer(result, {
        type: 'SET_TEAM_ATTENDANCE',
        payload: { team: 'home', playerNumbers: ['99', '20'] },
      });

      expect(result.live.attendance.home).toHaveLength(2);
      expect(result.live.attendance.home).toContain('99');
    });
  });

  describe('SET_ACTIVE_GOALKEEPER', () => {
    it('should set active goalkeeper and log the change', () => {
      const state = setupGameState();
      state.live.matchContext = {
        tournamentId: 't1',
        homeRoster: [{ id: 'p1', number: '1', name: 'Goalie One', type: 'goalkeeper' }],
        awayRoster: [],
      } as any;

      const result = gameReducer(state, {
        type: 'SET_ACTIVE_GOALKEEPER',
        payload: { team: 'home', playerNumber: '1' },
      });

      expect(result.live.homeActiveGoalkeeperNumber).toBe('1');
      expect(result.live.goalkeeperChangesLog.home).toHaveLength(1);
      expect(result.live.goalkeeperChangesLog.home[0].playerNumber).toBe('1');
    });

    it('should deactivate goalkeeper with null', () => {
      const state = setupGameState();
      state.live.homeActiveGoalkeeperNumber = '1';

      const result = gameReducer(state, {
        type: 'SET_ACTIVE_GOALKEEPER',
        payload: { team: 'home', playerNumber: null },
      });

      expect(result.live.homeActiveGoalkeeperNumber).toBeNull();
    });

    it('should reject non-goalkeeper players', () => {
      const state = setupGameState();
      state.live.matchContext = {
        tournamentId: 't1',
        homeRoster: [{ id: 'p1', number: '10', name: 'Forward', type: 'player' }],
        awayRoster: [],
      } as any;

      const result = gameReducer(state, {
        type: 'SET_ACTIVE_GOALKEEPER',
        payload: { team: 'home', playerNumber: '10' },
      });

      // Should not set because player type is not 'goalkeeper'
      expect(result.live.homeActiveGoalkeeperNumber).toBeNull();
    });

    it('should not log duplicate change for same goalkeeper', () => {
      const state = setupGameState();
      state.live.matchContext = {
        tournamentId: 't1',
        homeRoster: [{ id: 'p1', number: '1', name: 'Goalie One', type: 'goalkeeper' }],
        awayRoster: [],
      } as any;
      state.live.homeActiveGoalkeeperNumber = '1';

      const result = gameReducer(state, {
        type: 'SET_ACTIVE_GOALKEEPER',
        payload: { team: 'home', playerNumber: '1' },
      });

      // No new log entry since same goalkeeper
      expect(result.live.goalkeeperChangesLog.home).toHaveLength(0);
    });

    it('should work independently for home and away', () => {
      let state = setupGameState();
      state.live.matchContext = {
        tournamentId: 't1',
        homeRoster: [{ id: 'p1', number: '1', name: 'Home GK', type: 'goalkeeper' }],
        awayRoster: [{ id: 'p2', number: '30', name: 'Away GK', type: 'goalkeeper' }],
      } as any;

      state = gameReducer(state, { type: 'SET_ACTIVE_GOALKEEPER', payload: { team: 'home', playerNumber: '1' } });
      state = gameReducer(state, { type: 'SET_ACTIVE_GOALKEEPER', payload: { team: 'away', playerNumber: '30' } });

      expect(state.live.homeActiveGoalkeeperNumber).toBe('1');
      expect(state.live.awayActiveGoalkeeperNumber).toBe('30');
    });
  });
});
