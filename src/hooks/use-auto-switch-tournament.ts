import { useEffect } from 'react';
import { useGameState } from '@/contexts/game-state-context';

/**
 * Auto-switches to the active game's tournament when on game pages (/controls, /scoreboard).
 * This ensures the controls and scoreboard always show data from the tournament with the active game.
 */
export function useAutoSwitchTournament() {
  const { state, dispatch, isLoading } = useGameState();

  useEffect(() => {
    if (isLoading || !state.live?.matchId) return;

    const activeGameTournamentId =
      state.live.matchContext?.tournamentId
      || state._pendingSummaryGeneration?.tournamentId;

    if (!activeGameTournamentId) return;
    if (activeGameTournamentId === state.config.selectedTournamentId) return;

    dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: { selectedTournamentId: activeGameTournamentId } });
  }, [isLoading, state.live?.matchId, state.live?.matchContext?.tournamentId, state._pendingSummaryGeneration?.tournamentId, state.config.selectedTournamentId, dispatch]);
}
