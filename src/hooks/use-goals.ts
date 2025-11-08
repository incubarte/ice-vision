/**
 * Custom hook for managing goals
 * Provides a clean API for goal operations while using the main game state
 */

import { useCallback } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import type { GoalLog, Team } from '@/types';

export const useGoals = () => {
  const { state, dispatch } = useGameState();

  const addGoal = useCallback(
    (payload: Omit<GoalLog, 'id' | 'periodText'> & { periodText?: string }) => {
      dispatch({ type: 'ADD_GOAL', payload });
    },
    [dispatch]
  );

  const editGoal = useCallback(
    (goalId: string, updates: Partial<GoalLog>) => {
      dispatch({ type: 'EDIT_GOAL', payload: { goalId, updates } });
    },
    [dispatch]
  );

  const deleteGoal = useCallback(
    (goalId: string) => {
      dispatch({ type: 'DELETE_GOAL', payload: { goalId } });
    },
    [dispatch]
  );

  const getGoalsByTeam = useCallback(
    (team: Team) => {
      return state.live.goals[team];
    },
    [state.live.goals]
  );

  const getAllGoals = useCallback(() => {
    return [...state.live.goals.home, ...state.live.goals.away].sort((a, b) => {
      // Sort by time if available, otherwise maintain order
      if (a.time !== undefined && b.time !== undefined) {
        return b.time - a.time; // Most recent first
      }
      return 0;
    });
  }, [state.live.goals]);

  const getGoalById = useCallback(
    (goalId: string): GoalLog | undefined => {
      const homeGoal = state.live.goals.home.find((g) => g.id === goalId);
      if (homeGoal) return homeGoal;
      return state.live.goals.away.find((g) => g.id === goalId);
    },
    [state.live.goals]
  );

  const getScore = useCallback(() => {
    return {
      home: state.live.goals.home.length,
      away: state.live.goals.away.length,
    };
  }, [state.live.goals]);

  return {
    // State
    goals: state.live.goals,
    score: state.live.score,
    goalCelebration: state.live.goalCelebration,

    // Actions
    addGoal,
    editGoal,
    deleteGoal,

    // Helpers
    getGoalsByTeam,
    getAllGoals,
    getGoalById,
    getScore,
  };
};
