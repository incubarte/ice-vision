

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
export type { GameState, Team, ScoreboardLayoutSettings, FormatAndTimingsProfileData, PenaltyTypeDefinition, ReplaySettings, TournamentState };

type GameStateContextType = {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  isLoading: boolean;
  triggerSync: () => Promise<void>;
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
        console.log(`[GameState] Tournament ${tournamentId} loaded${force ? ' (forced)' : ''}`);
      }
    } catch (error) {
      console.error('[GameState] Error fetching tournament details:', error);
    } finally {
      isFetchingTournamentRef.current = false;
    }
  }, [dispatch]);

  // Initial load: fetch when selectedTournamentId changes and tournament isn't loaded yet
  useEffect(() => {
    const { selectedTournamentId, activeTournament } = state.tournament;
    if (isLoading) return;
    if (!selectedTournamentId) return;
    if (activeTournament && activeTournament.id === selectedTournamentId) return;
    fetchActiveTournament(selectedTournamentId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tournament.selectedTournamentId, isLoading]);

  // Periodic refresh: re-fetch active tournament data every 5 minutes + on coming back online.
  // This keeps fixture results and standings in sync with the cloud without a page reload.
  const refreshTournament = useCallback(async (force = false) => {
    const { selectedTournamentId } = state.tournament;
    if (!selectedTournamentId || isLoading) return;
    // Don't overwrite local pending changes with cloud data — wait for the queue to flush.
    // The manual "Actualizar" button passes force=true to bypass this.
    const hasPending = (state._pendingSyncs || []).length > 0;
    if (hasPending && !force) return;
    await fetchActiveTournament(selectedTournamentId, force);
  }, [state.tournament.selectedTournamentId, state._pendingSyncs, isLoading, fetchActiveTournament]);

  // Refresh on reconnect only — no automatic polling.
  // Demand-driven: tournament data is refreshed when navigating to the tournament
  // section or starting a match. The API cache (5 min TTL) handles stale reads.
  useEffect(() => {
    if (isLoading) return;
    const doRefresh = () => refreshTournament();
    window.addEventListener('online', doRefresh);
    return () => window.removeEventListener('online', doRefresh);
  }, [refreshTournament, isLoading]);

  // When the pending sync queue is fully drained, immediately refresh from cloud.
  const prevPendingCountRef = useRef(0);
  useEffect(() => {
    const currentCount = (state._pendingSyncs || []).length;
    const { selectedTournamentId } = state.tournament;
    if (prevPendingCountRef.current > 0 && currentCount === 0 && selectedTournamentId && !isLoading) {
      console.log('[GameState] Pending syncs drained — refreshing tournament from cloud');
      fetchActiveTournament(selectedTournamentId);
    }
    prevPendingCountRef.current = currentCount;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state._pendingSyncs?.length]);


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

  // Note: Summary generation has moved to the cloud service via SYNC_MATCH pending sync.

  const isSyncingRef = useRef(false);

  function readAdminSecretFromStorage(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('adminAccess');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.expiresAt > Date.now()) return parsed.secret;
      return null;
    } catch { return null; }
  }

  const processPendingSyncs = useCallback(async () => {
    if (isSyncingRef.current) return;
    const pending = state._pendingSyncs;
    if (!pending || pending.length === 0) return;

    isSyncingRef.current = true;
    console.log(`[Sync] Processing ${pending.length} pending sync(s)...`);

    try {
      // Process in order (preserves ADD_PLAYER before SAVE_SUMMARY dependency)
      for (const sync of pending) {
        try {
          if (sync.payload.type === 'ADD_PLAYER') {
            const { tournamentId } = sync.payload;
            const tournament = state.tournament.activeTournament;
            if (!tournament || tournament.id !== tournamentId) continue;
            const result = await saveTournamentOnServer(tournament);
            if (result?.success === false) throw new Error(result.message || 'Save failed');
          } else if (sync.payload.type === 'SAVE_SUMMARY') {
            const { matchId, tournamentId, summary } = sync.payload;
            const adminSecret = readAdminSecretFromStorage();
            const res = await fetch('/api/match-summary', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(adminSecret ? { 'x-admin-secret': adminSecret } : {}),
              },
              body: JSON.stringify({ tournamentId, matchId, summary }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data?.error || `HTTP ${res.status}`);
            }
          } else if (sync.payload.type === 'SYNC_MATCH') {
            const { matchId, tournamentId, result, liveSnapshot } = sync.payload;
            const adminSecret = readAdminSecretFromStorage();
            const cloudUrl = process.env.NEXT_PUBLIC_CLOUD_ADMIN_URL || 'https://ice-vision.vercel.app';
            const res = await fetch(`${cloudUrl}/api/sync/match`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(adminSecret ? { 'x-admin-secret': adminSecret } : {}),
              },
              body: JSON.stringify({ matchId, tournamentId, result, liveSnapshot }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data?.error || `HTTP ${res.status}`);
            }
          } else if (sync.payload.type === 'SYNC_STAFF') {
            const { tournamentId, staff } = sync.payload;
            const adminSecret = readAdminSecretFromStorage();
            const cloudUrl = process.env.NEXT_PUBLIC_CLOUD_ADMIN_URL || 'https://ice-vision.vercel.app';
            const res = await fetch(`${cloudUrl}/api/sync/staff`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(adminSecret ? { 'x-admin-secret': adminSecret } : {}),
              },
              body: JSON.stringify({ tournamentId, staff }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data?.error || `HTTP ${res.status}`);
            }
          } else if (sync.payload.type === 'ADD_MATCH') {
            const { tournamentId, match } = sync.payload;
            const adminSecret = readAdminSecretFromStorage();
            const cloudUrl = process.env.NEXT_PUBLIC_CLOUD_ADMIN_URL || 'https://ice-vision.vercel.app';
            const res = await fetch(`${cloudUrl}/api/sync/add-match`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(adminSecret ? { 'x-admin-secret': adminSecret } : {}),
              },
              body: JSON.stringify({ tournamentId, match }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data?.error || `HTTP ${res.status}`);
            }
          } else if (sync.payload.type === 'SYNC_TEAM_PLAYERS') {
            const { tournamentId, teamId, players } = sync.payload;
            const adminSecret = readAdminSecretFromStorage();
            const cloudUrl = process.env.NEXT_PUBLIC_CLOUD_ADMIN_URL || 'https://ice-vision.vercel.app';
            const res = await fetch(`${cloudUrl}/api/sync/team-players`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(adminSecret ? { 'x-admin-secret': adminSecret } : {}),
              },
              body: JSON.stringify({ tournamentId, teamId, players }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data?.error || `HTTP ${res.status}`);
            }
          }
          dispatch({ type: 'RESOLVE_SYNC', payload: { id: sync.id } });
          console.log(`[Sync] Resolved sync ${sync.id} (${sync.payload.type})`);
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Unknown error';
          console.warn(`[Sync] Failed sync ${sync.id}:`, error);
          dispatch({ type: 'SYNC_ATTEMPT_FAILED', payload: { id: sync.id, error } });
        }
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [state._pendingSyncs, state.tournament.activeTournament, dispatch]);

  // Persist pending syncs to disk whenever the queue changes.
  // Also trigger immediate processing when new items are added while online —
  // isSyncingRef prevents overlapping runs so this is safe to call eagerly.
  const prevSyncCountRef = useRef(0);
  useEffect(() => {
    if (isLoading) return;
    const current = state._pendingSyncs || [];
    fetch('/api/pending-syncs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(current),
    }).catch(err => console.error('[Sync] Failed to persist pending syncs:', err));

    if (current.length > prevSyncCountRef.current && typeof navigator !== 'undefined' && navigator.onLine) {
      processPendingSyncs();
    }
    prevSyncCountRef.current = current.length;
  }, [state._pendingSyncs, isLoading, processPendingSyncs]);

  // Auto-retry: every 3 minutes + when browser goes online
  useEffect(() => {
    const interval = setInterval(processPendingSyncs, 3 * 60 * 1000);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', processPendingSyncs);
    }
    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', processPendingSyncs);
      }
    };
  }, [processPendingSyncs]);

  return (
    <GameStateContext.Provider value={{ state, dispatch, isLoading, triggerSync: processPendingSyncs, refreshTournament }}>
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
