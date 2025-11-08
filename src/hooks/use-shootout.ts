/**
 * Custom hook for managing shootouts
 * Provides a clean API for shootout operations while using the main game state
 */

import { useCallback } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import type { Team, ShootoutAttempt } from '@/types';

export const useShootout = () => {
  const { state, dispatch } = useGameState();

  const startShootout = useCallback(() => {
    dispatch({ type: 'START_SHOOTOUT' });
  }, [dispatch]);

  const endShootout = useCallback(() => {
    dispatch({ type: 'END_SHOOTOUT' });
  }, [dispatch]);

  const recordShootoutAttempt = useCallback(
    (team: Team, attempt: Omit<ShootoutAttempt, 'id'>) => {
      dispatch({ type: 'RECORD_SHOOTOUT_ATTEMPT', payload: { team, attempt } });
    },
    [dispatch]
  );

  const editShootoutAttempt = useCallback(
    (team: Team, attemptId: string, updates: Partial<ShootoutAttempt>) => {
      dispatch({ type: 'EDIT_SHOOTOUT_ATTEMPT', payload: { team, attemptId, updates } });
    },
    [dispatch]
  );

  const deleteShootoutAttempt = useCallback(
    (team: Team, attemptId: string) => {
      dispatch({ type: 'DELETE_SHOOTOUT_ATTEMPT', payload: { team, attemptId } });
    },
    [dispatch]
  );

  const getShootoutScore = useCallback(() => {
    const homeGoals = state.live.shootout.homeAttempts.filter((a) => a.isGoal === true).length;
    const awayGoals = state.live.shootout.awayAttempts.filter((a) => a.isGoal === true).length;
    return { home: homeGoals, away: awayGoals };
  }, [state.live.shootout]);

  const getShootoutAttempts = useCallback(
    (team?: Team) => {
      if (team) {
        return state.live.shootout[`${team}Attempts`];
      }
      return {
        home: state.live.shootout.homeAttempts,
        away: state.live.shootout.awayAttempts,
      };
    },
    [state.live.shootout]
  );

  const isShootoutActive = state.live.shootout.isActive;
  const shootoutRounds = state.live.shootout.rounds;

  return {
    // State
    shootout: state.live.shootout,
    isActive: isShootoutActive,
    rounds: shootoutRounds,

    // Actions
    startShootout,
    endShootout,
    recordShootoutAttempt,
    editShootoutAttempt,
    deleteShootoutAttempt,

    // Helpers
    getShootoutScore,
    getShootoutAttempts,
  };
};
