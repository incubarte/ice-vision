

"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useReducer, useEffect, useRef, useState, useCallback } from 'react';
import type { GameState, GameAction, Team, ScoreboardLayoutSettings, FormatAndTimingsProfileData, PenaltyTypeDefinition, ReplaySettings } from '@/types';
import { useToast as showToast } from '@/hooks/use-toast';
import isEqual from 'lodash.isequal';
import { updateConfigOnServer, updateGameStateOnServer, saveTournamentOnServer } from '@/app/actions';

// Import constants
import {
  BROADCAST_CHANNEL_NAME,
  SUMMARY_DATA_STORAGE_KEY,
  DEFAULT_HORN_SOUND_PATH,
  DEFAULT_PENALTY_BEEP_PATH,
  INITIAL_LAYOUT_SETTINGS,
  createDefaultFormatAndTimingsProfile,
  createDefaultScoreboardLayoutProfile,
} from '@/lib/game-constants';

import {
  formatTime,
  getPeriodText,
  getActualPeriodText,
  getPeriodContextFromAbsoluteTime,
  centisecondsToDisplaySeconds,
  centisecondsToDisplayMinutes,
  getEndReasonText,
  getCategoryNameById,
} from '@/lib/game-helpers';

// Import reducer, initial state, and helpers from the pure (non-React) module
import {
  gameReducer,
  getInitialState,
  TAB_ID,
  setGameReducerRef,
} from '@/lib/game-state-reducer';

// Re-export for backward compatibility — consumers import these from the context
export { BROADCAST_CHANNEL_NAME, SUMMARY_DATA_STORAGE_KEY, DEFAULT_HORN_SOUND_PATH, DEFAULT_PENALTY_BEEP_PATH };
export { INITIAL_LAYOUT_SETTINGS, createDefaultFormatAndTimingsProfile, createDefaultScoreboardLayoutProfile };
export { formatTime, getPeriodText, getActualPeriodText, getPeriodContextFromAbsoluteTime, centisecondsToDisplaySeconds, centisecondsToDisplayMinutes, getEndReasonText, getCategoryNameById };
export { gameReducer, getInitialState };
export type { GameState, Team, ScoreboardLayoutSettings, FormatAndTimingsProfileData, PenaltyTypeDefinition, ReplaySettings };

type GameStateContextType = {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  isLoading: boolean;
};

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

const GameStateObserver = () => {
  const { state, dispatch } = useGameState();
  const { toast } = showToast();
  const lastToastRef = useRef<GameState['_lastToastMessage']>(null);

  useEffect(() => {
    if (state._lastToastMessage && state._lastToastMessage !== lastToastRef.current) {
      toast(state._lastToastMessage);
      lastToastRef.current = state._lastToastMessage;
    }
  }, [state._lastToastMessage, toast]);

  return null;
}


export const GameStateProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(gameReducer, getInitialState());
  const [isLoading, setIsLoading] = useState(true);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Set the reducer reference for helper functions that need to call back to it
  // This needs to be called after React hooks are initialized
  React.useEffect(() => {
    setGameReducerRef(gameReducer);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined') {
        setIsPageVisible(!document.hidden);
        if (!document.hidden) dispatch({ type: 'TICK' });
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      setIsPageVisible(!document.hidden);
    }
    return () => {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/db');
      if (!res.ok) throw new Error('Failed to fetch initial data');
      const data = await res.json();

      dispatch({ type: 'INITIALIZE_STATE', payload: data });

    } catch (error) {
      console.error("Failed to fetch initial state from server:", error);
      dispatch({ type: 'INITIALIZE_STATE', payload: getInitialState() });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      if (!channelRef.current) {
        channelRef.current = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      }

      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type || !event.data?._lastUpdatedTimestamp) {
          return;
        }

        if (event.data._lastActionOriginator !== TAB_ID) {
          dispatch({ type: 'SET_STATE_FROM_LOCAL_BROADCAST', payload: event.data });
        }
      };

      channelRef.current.addEventListener('message', handleMessage);

      return () => {
        channelRef.current?.removeEventListener('message', handleMessage);
      };
    }
  }, [fetchInitialData]);

  // Effect to fetch full tournament data when selectedTournamentId changes
  useEffect(() => {
    const { selectedTournamentId, activeTournament, tournaments } = state.config;
    let cancelled = false;

    // Skip while initial data is still loading — tournaments array is empty until INITIALIZE_STATE
    if (isLoading) return;

    if (selectedTournamentId) {
      // Check if the selected tournament is already the active one
      if (activeTournament && activeTournament.id === selectedTournamentId) {
        return;
      }

      const tournamentMeta = tournaments.find(t => t.id === selectedTournamentId);

      // If tournament not found in the array, clear the selectedTournamentId
      if (!tournamentMeta) {
        console.warn('[GameState] Selected tournament not found in tournaments array, clearing selectedTournamentId');
        dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: { selectedTournamentId: null } });
        return;
      }

      console.log('[GameState] Selected tournament:', selectedTournamentId, 'Fetching details...');
      (async () => {
        try {
          const res = await fetch(`/api/tournaments/${selectedTournamentId}`);
          if (cancelled) return;
          if (!res.ok) {
            console.warn(`[GameState] Tournament ${selectedTournamentId} not found, clearing selectedTournamentId`);
            dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: { selectedTournamentId: null } });
            return;
          }
          const data = await res.json();
          if (cancelled) return;
          if (data.tournament) {
            dispatch({ type: 'LOAD_TOURNAMENT_CONTEXT', payload: { tournamentData: data.tournament } });
          }
        } catch (error) {
          if (cancelled) return;
          console.error("Error fetching tournament details:", error);
          dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: { selectedTournamentId: null } });
        }
      })();
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.config.selectedTournamentId, isLoading]);


  const prevStateRef = useRef<GameState>(state);
  useEffect(() => {
    const oldState = prevStateRef.current;
    prevStateRef.current = state;

    if (isLoading || typeof window === 'undefined' || !state._lastActionOriginator) return;

    if (state._lastActionOriginator === TAB_ID) {
      try {
        channelRef.current?.postMessage(state);

        const hasLiveChanged = !isEqual(state.live, oldState.live);
        if (hasLiveChanged) {
          console.log('[DEBUG] 🎯 Live state changed, persisting to server...', {
            homeShots: state.live.shotsLog.home.length,
            awayShots: state.live.shotsLog.away.length
          });
          updateGameStateOnServer(state.live);
        }
        const hasConfigChanged = !isEqual(state.config, oldState.config);
        if (hasConfigChanged) {
          updateConfigOnServer(state.config);
        }
        // Logic to save active tournament if it changes
        if (state._lastActionType !== 'SAVE_MATCH_SUMMARY' &&
          state._lastActionType !== 'TRIGGER_SUMMARY_GENERATION' &&
          state._lastActionType !== 'UPDATE_MATCH_SUMMARY_IN_STATE') {

          if (state.config.activeTournament && !isEqual(state.config.activeTournament, oldState.config.activeTournament)) {
            console.log('[GameState] Active tournament changed, saving...', state.config.activeTournament.id);
            saveTournamentOnServer(state.config.activeTournament);
          }
        } else {
          console.log(`[GameState] Skipping saveTournamentOnServer because last action was ${state._lastActionType}`);
        }

      } catch (error) {
        console.error("Error broadcasting or saving state:", error);
      }
    }
  }, [state, isLoading]);

  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    const tickInterval = state.config.tickIntervalMs || 200;
    if (state.live?.clock && (state.live.clock.isClockRunning || state.live.clock.isFlashingZero) && isPageVisible && !isLoading) {
      timerId = setInterval(() => dispatch({ type: 'TICK' }), tickInterval);
    }
    return () => clearInterval(timerId);
  }, [state.live?.clock, isPageVisible, isLoading, state.config.tickIntervalMs]);

  // Handle summary generation when triggered
  useEffect(() => {
    if (state._pendingSummaryGeneration) {
      const { matchId, tournamentId } = state._pendingSummaryGeneration;

      if (!matchId || !tournamentId) return;

      console.log(`[GameState] Triggering summary generation on server for match ${matchId}`);

      // Call server API to generate summary (it will read voice events and save the summary)
      fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            console.log(`[GameState] Summary generated on server for match ${matchId} with ${data.voiceEventsCount} voice events`);

            // Update state with the generated summary
            dispatch({
              type: 'UPDATE_MATCH_SUMMARY_IN_STATE',
              payload: { matchId, summary: data.summary }
            });
          } else {
            console.error('[GameState] Failed to generate summary:', data.error);
          }
        })
        .catch(err => console.error('[GameState] Error generating summary:', err));

      // Clear the pending flag
      dispatch({ type: 'CLEAR_PENDING_SUMMARY_GENERATION' });
    }
  }, [state._pendingSummaryGeneration]);

  return (
    <GameStateContext.Provider value={{ state, dispatch, isLoading }}>
      {children}
      <GameStateObserver />
    </GameStateContext.Provider>
  );
};

export const useGameState = () => {
  const context = useContext(GameStateContext);
  if (context === undefined) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return context;
};
