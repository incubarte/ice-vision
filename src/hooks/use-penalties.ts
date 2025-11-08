/**
 * Custom hook for managing penalties
 * Provides a clean API for penalty operations while using the main game state
 */

import { useCallback } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import type { Penalty, Team } from '@/types';

export const usePenalties = () => {
  const { state, dispatch } = useGameState();

  const addPenalty = useCallback(
    (payload: Omit<Penalty, 'id' | '_status'>) => {
      dispatch({ type: 'ADD_PENALTY', payload });
    },
    [dispatch]
  );

  const deletePenalty = useCallback(
    (team: Team, penaltyId: string) => {
      dispatch({ type: 'DELETE_PENALTY', payload: { team, penaltyId } });
    },
    [dispatch]
  );

  const editPenalty = useCallback(
    (team: Team, penaltyId: string, updates: Partial<Penalty>) => {
      dispatch({ type: 'EDIT_PENALTY', payload: { team, penaltyId, updates } });
    },
    [dispatch]
  );

  const clearPenalty = useCallback(
    (team: Team, penaltyId: string) => {
      dispatch({ type: 'CLEAR_PENALTY', payload: { team, penaltyId } });
    },
    [dispatch]
  );

  const togglePenaltyPlayerCountOverride = useCallback(
    (team: Team, penaltyId: string) => {
      dispatch({ type: 'TOGGLE_PENALTY_PLAYER_COUNT_OVERRIDE', payload: { team, penaltyId } });
    },
    [dispatch]
  );

  const getPenaltiesByTeam = useCallback(
    (team: Team) => {
      return state.live.penalties[team];
    },
    [state.live.penalties]
  );

  const getActivePenalties = useCallback(
    (team?: Team) => {
      if (team) {
        return state.live.penalties[team].filter((p) => p._status === 'running');
      }
      return [
        ...state.live.penalties.home.filter((p) => p._status === 'running'),
        ...state.live.penalties.away.filter((p) => p._status === 'running'),
      ];
    },
    [state.live.penalties]
  );

  const getPenaltyById = useCallback(
    (team: Team, penaltyId: string): Penalty | undefined => {
      return state.live.penalties[team].find((p) => p.id === penaltyId);
    },
    [state.live.penalties]
  );

  const getPlayersOnIce = useCallback(
    (team: Team) => {
      const runningPenalties = state.live.penalties[team].filter(
        (p) => p._status === 'running' && p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride
      );
      return state.config.playersPerTeamOnIce - runningPenalties.length;
    },
    [state.live.penalties, state.config.playersPerTeamOnIce]
  );

  return {
    // State
    penalties: state.live.penalties,
    penaltiesLog: state.live.penaltiesLog,
    pendingPowerPlayGoal: state.live.pendingPowerPlayGoal,

    // Actions
    addPenalty,
    deletePenalty,
    editPenalty,
    clearPenalty,
    togglePenaltyPlayerCountOverride,

    // Helpers
    getPenaltiesByTeam,
    getActivePenalties,
    getPenaltyById,
    getPlayersOnIce,
  };
};
