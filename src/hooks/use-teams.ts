/**
 * Custom hook for managing teams
 * Provides a clean API for team operations while using the main game state
 */

import { useCallback } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import type { Team } from '@/types';

export const useTeams = () => {
  const { state, dispatch } = useGameState();

  const setTeamName = useCallback(
    (team: Team, name: string) => {
      dispatch({ type: 'SET_TEAM_NAME', payload: { team, name } });
    },
    [dispatch]
  );

  const setTeamSubName = useCallback(
    (team: Team, subName: string) => {
      dispatch({ type: 'SET_TEAM_SUBNAME', payload: { team, subName } });
    },
    [dispatch]
  );

  const swapTeams = useCallback(() => {
    dispatch({ type: 'SWAP_TEAMS' });
  }, [dispatch]);

  const getTeamName = useCallback(
    (team: Team) => {
      return state.live[`${team}TeamName`];
    },
    [state.live]
  );

  const getTeamSubName = useCallback(
    (team: Team) => {
      return state.live[`${team}TeamSubName`] || '';
    },
    [state.live]
  );

  const getTeamData = useCallback(
    (team: Team) => {
      const teamName = state.live[`${team}TeamName`];
      const teamSubName = state.live[`${team}TeamSubName`];
      const category = state.config.selectedMatchCategory;

      const tournament = state.config.tournaments.find(
        (t) => t.id === state.config.selectedTournamentId
      );

      if (!tournament) return null;

      return tournament.teams.find(
        (t) =>
          t.name === teamName &&
          (t.subName || undefined) === (teamSubName || undefined) &&
          t.category === category
      );
    },
    [state.live, state.config]
  );

  const homeTeamName = state.live.homeTeamName;
  const awayTeamName = state.live.awayTeamName;
  const homeTeamSubName = state.live.homeTeamSubName;
  const awayTeamSubName = state.live.awayTeamSubName;

  return {
    // State
    homeTeamName,
    awayTeamName,
    homeTeamSubName,
    awayTeamSubName,

    // Actions
    setTeamName,
    setTeamSubName,
    swapTeams,

    // Helpers
    getTeamName,
    getTeamSubName,
    getTeamData,
  };
};
