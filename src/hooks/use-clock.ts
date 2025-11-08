/**
 * Custom hook for managing the game clock
 * Provides a clean API for clock operations while using the main game state
 */

import { useCallback } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import { formatTime } from '@/lib/game-helpers';

export const useClock = () => {
  const { state, dispatch } = useGameState();

  const toggleClock = useCallback(() => {
    dispatch({ type: 'TOGGLE_CLOCK' });
  }, [dispatch]);

  const setTime = useCallback(
    (minutes: number, seconds: number) => {
      dispatch({ type: 'SET_TIME', payload: { minutes, seconds } });
    },
    [dispatch]
  );

  const adjustTime = useCallback(
    (centiseconds: number) => {
      dispatch({ type: 'ADJUST_TIME', payload: centiseconds });
    },
    [dispatch]
  );

  const setPeriod = useCallback(
    (period: number) => {
      dispatch({ type: 'SET_PERIOD', payload: period });
    },
    [dispatch]
  );

  const startTimeout = useCallback(() => {
    dispatch({ type: 'START_TIMEOUT' });
  }, [dispatch]);

  const endCurrentPhase = useCallback(() => {
    dispatch({ type: 'END_CURRENT_PHASE' });
  }, [dispatch]);

  const getFormattedTime = useCallback(
    (options?: { showTenths?: boolean; includeMinutesForTenths?: boolean; rounding?: 'up' | 'down' }) => {
      return formatTime(state.live.clock.currentTime, options);
    },
    [state.live.clock.currentTime]
  );

  const isRunning = state.live.clock.isClockRunning;
  const currentTime = state.live.clock.currentTime;
  const currentPeriod = state.live.clock.currentPeriod;
  const periodDisplayOverride = state.live.clock.periodDisplayOverride;
  const isFlashingZero = state.live.clock.isFlashingZero;

  return {
    // State
    clock: state.live.clock,
    isRunning,
    currentTime,
    currentPeriod,
    periodDisplayOverride,
    isFlashingZero,

    // Actions
    toggleClock,
    setTime,
    adjustTime,
    setPeriod,
    startTimeout,
    endCurrentPhase,

    // Helpers
    getFormattedTime,
  };
};
