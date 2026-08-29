import { useEffect, useRef } from 'react';
import { useGameState } from '@/contexts/game-state-context';

/**
 * Auto-switches to the active game's tournament when on game pages (/controls, /scoreboard).
 * This ensures the controls and scoreboard always show data from the tournament with the active game.
 */
export function useAutoSwitchTournament() {
  const { state, dispatch, isLoading } = useGameState();

  // Use a ref to read selectedTournamentId without adding it to deps.
  // Adding it would cause a loop: user selects tournament Y → auto-switch fires and overrides with X
  // → tournament page re-dispatches Y → auto-switch fires again → infinite loop.
  const selectedTournamentIdRef = useRef(state.config.selectedTournamentId);
  selectedTournamentIdRef.current = state.config.selectedTournamentId;

  useEffect(() => {
    if (isLoading || !state.live?.matchId) return;

    const activeGameTournamentId =
      state.live.matchContext?.tournamentId
      || state._pendingSummaryGeneration?.tournamentId;

    if (!activeGameTournamentId) return;
    if (activeGameTournamentId === selectedTournamentIdRef.current) return;

    dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: { selectedTournamentId: activeGameTournamentId } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, state.live?.matchId, state.live?.matchContext?.tournamentId, state._pendingSummaryGeneration?.tournamentId, dispatch]);
}
