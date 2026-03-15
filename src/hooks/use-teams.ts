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
      dispatch({ type: 'UPDATE_LIVE_STATE', payload: { [`${team}TeamName`]: name } });
    },
    [dispatch]
  );

  const setTeamSubName = useCallback(
    (team: Team, subName: string) => {
      dispatch({ type: 'UPDATE_LIVE_STATE', payload: { [`${team}TeamSubName`]: subName } });
    },
    [dispatch]
  );

  const swapTeams = useCallback(() => {
    const homeName = state.live.homeTeamName;
    const awayName = state.live.awayTeamName;
    const homeSubName = state.live.homeTeamSubName;
    const awaySubName = state.live.awayTeamSubName;
    dispatch({ type: 'UPDATE_LIVE_STATE', payload: {
      homeTeamName: awayName,
      awayTeamName: homeName,
      homeTeamSubName: awaySubName,
      awayTeamSubName: homeSubName,
    } });
  }, [dispatch, state.live.homeTeamName, state.live.awayTeamName, state.live.homeTeamSubName, state.live.awayTeamSubName]);

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
      // Prefer matchContext (snapshot from game setup) for live game independence
      const mc = state.live.matchContext;
      if (mc) {
        const teamName = state.live[`${team}TeamName`];
        return {
          id: team === 'home' ? mc.homeTeamId : mc.awayTeamId,
          name: teamName,
          subName: state.live[`${team}TeamSubName`],
          logoDataUrl: team === 'home' ? mc.homeTeamLogoDataUrl : mc.awayTeamLogoDataUrl,
          players: team === 'home' ? mc.homeRoster : mc.awayRoster,
          category: mc.categoryId,
        };
      }

      // Fallback to activeTournament for backward compat
      const teamName = state.live[`${team}TeamName`];
      const teamSubName = state.live[`${team}TeamSubName`];
      const category = state.config.selectedMatchCategory;
      const tournament = state.config.activeTournament;
      if (!tournament || tournament.id !== state.config.selectedTournamentId) return null;
      return (tournament.teams || []).find(
        (t) =>
          t.name === teamName &&
          (t.subName || undefined) === (teamSubName || undefined) &&
          t.category === category
      ) || null;
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
