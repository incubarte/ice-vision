

"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useReducer, useEffect, useRef, useState, useCallback } from 'react';
import type { GameState, GameAction, Team, ScoreboardLayoutSettings, FormatAndTimingsProfileData, PenaltyTypeDefinition, ReplaySettings, TournamentState } from '@/types';
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
  secondsToMinutes,
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
export { formatTime, getPeriodText, getActualPeriodText, getPeriodContextFromAbsoluteTime, centisecondsToDisplaySeconds, centisecondsToDisplayMinutes, getEndReasonText, getCategoryNameById, secondsToMinutes };
export { gameReducer, getInitialState };
export type { GameState, Team, ScoreboardLayoutSettings, FormatAndTimingsProfileData, PenaltyTypeDefinition, ReplaySettings, TournamentState };

type GameStateContextType = {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  isLoading: boolean;
  refreshTournament: (force?: boolean) => Promise<void>;
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
  const isFetchingTournamentRef = useRef(false);
  // Fetches the active tournament from the API and dispatches LOAD_TOURNAMENT_CONTEXT.
  // Used both for initial load and periodic refresh.
  const fetchActiveTournament = useCallback(async (tournamentId: string, force = false) => {
    if (isFetchingTournamentRef.current) return;
    isFetchingTournamentRef.current = true;
    try {
      const url = `/api/tournaments/${tournamentId}/lite${force ? '?force=true' : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        // 503 means cloud unavailable; route already tried stale cache and returned 503 only
        // if no cache exists at all. Nothing more to do here.
        console.warn(`[GameState] /lite returned ${res.status} for ${tournamentId}`);
        dispatch({ type: 'SET_ACTIVE_TOURNAMENT', payload: { tournamentId: null } });
        return;
      }
      const data = await res.json();
      if (data.tournament) {
        dispatch({ type: 'LOAD_TOURNAMENT_CONTEXT', payload: { tournamentData: data.tournament } });
        dispatch({ type: 'SET_OFFLINE_MODE', payload: false });
        if (data.matchResults) {
          dispatch({ type: 'SET_MATCH_RESULTS', payload: data.matchResults });
        }
        console.log(`[GameState] Tournament ${tournamentId} loaded${force ? ' (forced)' : ''}, ${Object.keys(data.matchResults || {}).length} match results`);
      }
    } catch (error) {
      console.error('[GameState] Error fetching tournament details:', error);
    } finally {
      isFetchingTournamentRef.current = false;
    }
  }, [dispatch]);

  // Initial load: fetch when selectedTournamentId changes and tournament isn't loaded yet.
  // Skipped in read-only mode — tournament browsing is fully demand-driven there
  // (each /tournaments/[id] page fetches its own data). selectedTournamentId is a
  // scoreboard concept and has no meaning in the viewer/cloud deployment.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_READ_ONLY === 'true') return;
    const { selectedTournamentId, activeTournament } = state.tournament;
    if (isLoading) return;
    if (!selectedTournamentId) return;
    if (activeTournament && activeTournament.id === selectedTournamentId) return;
    fetchActiveTournament(selectedTournamentId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tournament.selectedTournamentId, isLoading]);

  // Refresh tournament state from local disk (LOCAL_MODE) or Supabase (cloud).
  // force=true: in LOCAL_MODE, triggers a full manifest sync first (download cloud → local)
  //             so the local disk is up-to-date before reading it.
  //             Used by: "Actualizar" button, setup page before starting a match.
  const refreshTournament = useCallback(async (force = false) => {
    if (process.env.NEXT_PUBLIC_READ_ONLY === 'true') return;
    const { selectedTournamentId } = state.tournament;
    if (!selectedTournamentId || isLoading) return;

    // In LOCAL_MODE with force: sync with Supabase first so local disk is current.
    if (force && process.env.NEXT_PUBLIC_LOCAL_MODE === 'true') {
      try {
        await fetch('/api/sync-trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger: 'after-summary-edit' }),
        });
      } catch (err) {
        console.warn('[refreshTournament] sync-trigger failed:', err);
      }
    }

    await fetchActiveTournament(selectedTournamentId, force);
  }, [state.tournament.selectedTournamentId, isLoading, fetchActiveTournament]);

  // Refresh on reconnect: re-read tournament from local disk (and sync if LOCAL_MODE).
  useEffect(() => {
    if (isLoading) return;
    const doRefresh = () => refreshTournament();
    window.addEventListener('online', doRefresh);
    return () => window.removeEventListener('online', doRefresh);
  }, [refreshTournament, isLoading]);



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
          updateGameStateOnServer(state.live);
        }
        const hasConfigChanged = !isEqual(state.config, oldState.config);
        const hasTournamentChanged = !isEqual(state.tournament, oldState.tournament);
        if (hasConfigChanged || hasTournamentChanged) {
          updateConfigOnServer(state.config, state.tournament);
        }
        // Logic to save active tournament if it changes
        const skipTournamentSave = state._lastActionType === 'SAVE_MATCH_SUMMARY';
        if (!skipTournamentSave) {
          if (state.tournament.activeTournament && !isEqual(state.tournament.activeTournament, oldState.tournament.activeTournament)) {
            console.log('[GameState] Active tournament changed, saving...', state.tournament.activeTournament.id);
            saveTournamentOnServer(state.tournament.activeTournament);
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



  // Periodic manifest sync: every syncIntervalMinutes + on reconnect, fire sync-trigger.
  // Writes only mark the dirty flag; this timer is what actually uploads to Supabase.
  // Skipped while a match is running — syncs when the match ends or the timer fires after.
  // The server-side semaphore in triggerSync prevents concurrent runs.
  const syncIntervalMinutes = state.config.syncIntervalMinutes ?? 3;
  // Ref to current state so runSync reads fresh values without being in the dependency array.
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_READ_ONLY === 'true') return;
    if (!process.env.NEXT_PUBLIC_LOCAL_MODE) return;

    const runSync = () => {
      if (stateRef.current.live?.clock?.isClockRunning) {
        console.log('[PeriodicSync] Skipping — match in progress');
        return;
      }
      fetch('/api/sync-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'after-summary-edit' }),
      }).catch(err => console.error('[PeriodicSync] Failed:', err));
    };

    const interval = setInterval(runSync, syncIntervalMinutes * 60 * 1000);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', runSync);
    }
    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', runSync);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncIntervalMinutes]);

  return (
    <GameStateContext.Provider value={{ state, dispatch, isLoading, refreshTournament }}>
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
