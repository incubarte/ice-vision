import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer, getInitialState, setGameReducerRef } from '../game-state-reducer';
import type { GameState, GameAction, Penalty } from '@/types';

describe('Game Reducer - Penalty Logic', () => {
  beforeEach(() => {
    setGameReducerRef(gameReducer);
  });

  const setupPenaltyTestState = () => {
    const state = getInitialState();
    state.config.maxConcurrentPenalties = 2; // Standard hockey limit
    state.config.playersPerTeamOnIce = 5;
    state.config.autoActivatePuckPenalties = false;
    state.live.clock.currentTime = 120000; // 20 mins
    state.live.clock.isClockRunning = true;
    state.live.clock.absoluteElapsedTimeCs = 0;
    state.live.clock._liveAbsoluteElapsedTimeCs = 0;
    
    // Add a standard 2-min penalty type
    state.config.penaltyTypes = [
      { id: 'minor', name: 'Minor', duration: 120, reducesPlayerCount: true, clearsOnGoal: true, isBenchPenalty: false }
    ];
    return state;
  };

  it('should start a penalty immediately if slots are available', () => {
    let state = setupPenaltyTestState();
    const action: GameAction = {
      type: 'ADD_PENALTY',
      payload: {
        team: 'home',
        penalty: { penaltyTypeId: 'minor', playerNumber: '10' }
      }
    };

    state = gameReducer(state, action);
    // After adding, it's pending_puck because autoActivatePuckPenalties=false
    expect(state.live.penalties.home[0]._status).toBe('pending_puck');

    // Activate puck -> pending_concurrent
    state = gameReducer(state, { type: 'ACTIVATE_PENDING_PUCK_PENALTIES' });
    // Process TICK -> running (because slot is available)
    state = gameReducer(state, { type: 'TICK' });
    
    const penalty = state.live.penalties.home[0];
    expect(penalty.playerNumber).toBe('10');
    expect(penalty._status).toBe('running');
    expect(penalty.expirationTime).toBe(12000); // 120s * 100cs
  });

  it('should put a 3rd penalty in pending_concurrent status (slot management)', () => {
    let state = setupPenaltyTestState();
    
    // Add 2 penalties and activate them
    state = gameReducer(state, { type: 'ADD_PENALTY', payload: { team: 'home', penalty: { penaltyTypeId: 'minor', playerNumber: '1' } } });
    state = gameReducer(state, { type: 'ADD_PENALTY', payload: { team: 'home', penalty: { penaltyTypeId: 'minor', playerNumber: '2' } } });
    state = gameReducer(state, { type: 'ACTIVATE_PENDING_PUCK_PENALTIES' });
    state = gameReducer(state, { type: 'TICK' });

    expect(state.live.penalties.home[0]._status).toBe('running');
    expect(state.live.penalties.home[1]._status).toBe('running');
    
    // Add 3rd penalty and activate puck
    state = gameReducer(state, { type: 'ADD_PENALTY', payload: { team: 'home', penalty: { penaltyTypeId: 'minor', playerNumber: '3' } } });
    state = gameReducer(state, { type: 'ACTIVATE_PENDING_PUCK_PENALTIES' });
    state = gameReducer(state, { type: 'TICK' });
    
    expect(state.live.penalties.home.length).toBe(3);
    expect(state.live.penalties.home[2]._status).toBe('pending_concurrent');
  });

  it('should activate a pending penalty when one expires during TICK', () => {
    let state = setupPenaltyTestState();
    
    // 1. Add 3 penalties with staggered start times
    // Penalty 1: starts at 0, expires at 12000
    state = gameReducer(state, { type: 'ADD_PENALTY', payload: { team: 'home', penalty: { penaltyTypeId: 'minor', playerNumber: '1' } } });
    state = gameReducer(state, { type: 'ACTIVATE_PENDING_PUCK_PENALTIES' });
    state = gameReducer(state, { type: 'TICK' });

    // Advance clock to 1000cs
    state.live.clock.absoluteElapsedTimeCs = 1000;
    state.live.clock._liveAbsoluteElapsedTimeCs = 1000;

    // Penalty 2: starts at 1000, expires at 13000
    state = gameReducer(state, { type: 'ADD_PENALTY', payload: { team: 'home', penalty: { penaltyTypeId: 'minor', playerNumber: '2' } } });
    state = gameReducer(state, { type: 'ACTIVATE_PENDING_PUCK_PENALTIES' });
    state = gameReducer(state, { type: 'TICK' });

    // Penalty 3: will be pending_concurrent (slots full)
    state = gameReducer(state, { type: 'ADD_PENALTY', payload: { team: 'home', penalty: { penaltyTypeId: 'minor', playerNumber: '3' } } });
    state = gameReducer(state, { type: 'ACTIVATE_PENDING_PUCK_PENALTIES' });
    state = gameReducer(state, { type: 'TICK' });

    expect(state.live.penalties.home.find(p => p.playerNumber === '1')?._status).toBe('running');
    expect(state.live.penalties.home.find(p => p.playerNumber === '2')?._status).toBe('running');
    expect(state.live.penalties.home.find(p => p.playerNumber === '3')?._status).toBe('pending_concurrent');

    // 2. Set clock so ONLY penalty #1 expires (it lasts until 12000)
    // 12001 is after P1 expires but before P2 expires (13000)
    state.live.clock.absoluteElapsedTimeCs = 12001; 
    state.live.clock._liveAbsoluteElapsedTimeCs = 12001; 
    
    const newState = gameReducer(state, { type: 'TICK' });

    const runningNumbers = newState.live.penalties.home
      .filter(p => p._status === 'running')
      .map(p => p.playerNumber);

    expect(runningNumbers).toContain('2');
    expect(runningNumbers).toContain('3');
    expect(runningNumbers).not.toContain('1');
  });

  it('should clear a minor penalty when the opposing team scores (Power Play Goal)', () => {
    let state = setupPenaltyTestState();
    
    // 1. Home team gets a penalty and it's running
    state = gameReducer(state, { type: 'ADD_PENALTY', payload: { team: 'home', penalty: { penaltyTypeId: 'minor', playerNumber: '99' } } });
    state = gameReducer(state, { type: 'ACTIVATE_PENDING_PUCK_PENALTIES' });
    state = gameReducer(state, { type: 'TICK' });
    expect(state.live.penalties.home[0]._status).toBe('running');
    
    // 2. Away team scores
    const newState = gameReducer(state, { 
      type: 'ADD_GOAL', 
      payload: { team: 'away', scorer: { playerNumber: '10' } } 
    });

    expect(newState.live.pendingPowerPlayGoal?.team).toBe('home');
    expect(newState.live.pendingPowerPlayGoal?.penaltyId).toBeDefined();

    // 3. Manually trigger the end of penalty
    const finalState = gameReducer(newState, {
      type: 'END_PENALTY_FOR_GOAL',
      payload: { team: 'home', penaltyId: newState.live.pendingPowerPlayGoal!.penaltyId }
    });

    expect(finalState.live.penalties.home.length).toBe(0);
    expect(finalState.live.pendingPowerPlayGoal).toBeNull();
  });
});
