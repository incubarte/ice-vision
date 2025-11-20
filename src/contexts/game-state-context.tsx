

"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useReducer, useEffect, useRef, useState, useCallback } from 'react';
import type { Penalty, Team, TeamData, PlayerData, CategoryData, ConfigState, LiveState, FormatAndTimingsProfile, FormatAndTimingsProfileData, ScoreboardLayoutSettings, ScoreboardLayoutProfile, GameSummary, GoalLog, PenaltyLog, PreTimeoutState, PeriodDisplayOverrideType, ClockState, ScoreState, PenaltiesState, GameState, GameAction, TunnelState, PenaltyTypeDefinition, AttendedPlayerInfo, ShootoutState, ShotLog, SummaryPlayerStats, Tournament, MatchData, PeriodSummary, ReplaySettings, ShootoutAttempt } from '@/types';
import { useToast as showToast } from '@/hooks/use-toast';
import isEqual from 'lodash.isequal';
import { updateConfigOnServer, updateGameStateOnServer, saveTournamentOnServer } from '@/app/actions';
import { safeUUID } from '@/lib/utils';
import defaultSettings from '@/config/defaults.json';
import { generateSummaryData } from '@/lib/summary-generator';

// Import constants and helpers
import {
  BROADCAST_CHANNEL_NAME,
  SUMMARY_DATA_STORAGE_KEY,
  CENTISECONDS_PER_SECOND,
  FLASHING_ZERO_DURATION_MS,
  DEFAULT_HORN_SOUND_PATH,
  DEFAULT_PENALTY_BEEP_PATH,
  IN_CODE_INITIAL_PROFILE_NAME,
  IN_CODE_INITIAL_LAYOUT_PROFILE_NAME,
  IN_CODE_INITIAL_PLAY_SOUND_AT_PERIOD_END,
  IN_CODE_INITIAL_CUSTOM_HORN_SOUND_DATA_URL,
  IN_CODE_INITIAL_ENABLE_TEAM_SELECTION_IN_MINI_SCOREBOARD,
  IN_CODE_INITIAL_ENABLE_PLAYER_SELECTION_FOR_PENALTIES,
  IN_CODE_INITIAL_SHOW_ALIAS_IN_PENALTY_PLAYER_SELECTOR,
  IN_CODE_INITIAL_SHOW_ALIAS_IN_CONTROLS_PENALTY_LIST,
  IN_CODE_INITIAL_SHOW_ALIAS_IN_SCOREBOARD_PENALTIES,
  IN_CODE_INITIAL_ENABLE_PENALTY_COUNTDOWN_SOUND,
  IN_CODE_INITIAL_PENALTY_COUNTDOWN_START_TIME,
  IN_CODE_INITIAL_CUSTOM_PENALTY_BEEP_SOUND_DATA_URL,
  IN_CODE_INITIAL_ENABLE_DEBUG_MODE,
  IN_CODE_INITIAL_SHOW_STANDINGS_IN_WARMUP,
  IN_CODE_INITIAL_SHOW_SHOTS_DATA,
  IN_CODE_INITIAL_ENABLE_OLYMPIA_TRANSITION,
  IN_CODE_INITIAL_TUNNEL_STATE,
  INITIAL_LAYOUT_SETTINGS,
  IN_CODE_INITIAL_REPLAYS_SETTINGS,
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

// Import reducer helper functions
import {
  applyFormatAndTimingsProfileToState,
  applyScoreboardLayoutProfileToState,
  calculateAbsoluteTimeForPeriod,
  finalizeMatch,
  handleAutoTransition,
  sortPenaltiesByStatus,
  setGameReducerRef,
} from '@/lib/game-state-reducer';

// Re-export for backward compatibility
export { BROADCAST_CHANNEL_NAME, SUMMARY_DATA_STORAGE_KEY, DEFAULT_HORN_SOUND_PATH, DEFAULT_PENALTY_BEEP_PATH };
export { INITIAL_LAYOUT_SETTINGS, createDefaultFormatAndTimingsProfile, createDefaultScoreboardLayoutProfile };
export { formatTime, getPeriodText, getActualPeriodText, getPeriodContextFromAbsoluteTime, centisecondsToDisplaySeconds, centisecondsToDisplayMinutes, getEndReasonText, getCategoryNameById };




// TAB_ID for cross-tab synchronization
let TAB_ID: string;
if (typeof window !== 'undefined') {
  if (window.crypto && window.crypto.randomUUID) {
    TAB_ID = window.crypto.randomUUID();
  } else {
    TAB_ID = `tab-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }
} else {
  TAB_ID = 'server-tab-id-' + Math.random().toString(36).substring(2);
}


const INITIAL_LIVE_DATA: LiveState = {
  score: { home: 0, away: 0, homeShots: 0, awayShots: 0 },
  penalties: { home: [], away: [] },
  goals: { home: [], away: [] },
  penaltiesLog: { home: [], away: [] },
  shotsLog: { home: [], away: [] },
  attendance: { home: [], away: [] },
  clock: {
    currentTime: 30000, // Default warm-up duration
    currentPeriod: 0,
    isClockRunning: false,
    periodDisplayOverride: 'Pre Warm-up',
    preTimeoutState: null,
    clockStartTimeMs: null,
    remainingTimeAtStartCs: null,
    absoluteElapsedTimeCs: 0,
    _liveAbsoluteElapsedTimeCs: 0,
    isFlashingZero: false,
  },
  shootout: {
    isActive: false,
    rounds: 5,
    homeAttempts: [],
    awayAttempts: [],
    initiator: null,
  },
  homeTeamName: 'Local',
  awayTeamName: 'Visitante',
  playHornTrigger: 0,
  playPenaltyBeepTrigger: 0,
  pendingPowerPlayGoal: null,
  overlayMessage: null,
  goalCelebration: null,
  replayLoadRequest: null,
  replayOverlay: null,
  matchId: null,
  playedPeriods: [],
};

// Create default profiles using imported factory functions
const defaultInitialProfile = createDefaultFormatAndTimingsProfile();
const defaultInitialLayoutProfile = createDefaultScoreboardLayoutProfile();

const getInitialState = (): GameState => {
  return {
    config: {
      ...defaultSettings.formatAndTimings,
      gameTimeMode: 'stopped',
      autoActivatePuckPenalties: true,
      enableStoppedTimeAlert: false,
      stoppedTimeAlertGoalDiff: 1,
      stoppedTimeAlertTimeRemaining: 2,
      penaltyTypes: defaultSettings.penaltyTypes.map(p => ({...p, isBenchPenalty: p.isBenchPenalty || false })) as PenaltyTypeDefinition[],
      defaultPenaltyTypeId: defaultSettings.defaultPenaltyTypeId,
      formatAndTimingsProfiles: [defaultInitialProfile],
      selectedFormatAndTimingsProfileId: defaultInitialProfile.id,
      playSoundAtPeriodEnd: IN_CODE_INITIAL_PLAY_SOUND_AT_PERIOD_END,
      customHornSoundDataUrl: IN_CODE_INITIAL_CUSTOM_HORN_SOUND_DATA_URL,
      enableTeamSelectionInMiniScoreboard: IN_CODE_INITIAL_ENABLE_TEAM_SELECTION_IN_MINI_SCOREBOARD,
      enablePlayerSelectionForPenalties: IN_CODE_INITIAL_ENABLE_PLAYER_SELECTION_FOR_PENALTIES,
      showAliasInPenaltyPlayerSelector: IN_CODE_INITIAL_SHOW_ALIAS_IN_PENALTY_PLAYER_SELECTOR,
      showAliasInControlsPenaltyList: IN_CODE_INITIAL_SHOW_ALIAS_IN_CONTROLS_PENALTY_LIST,
      showAliasInScoreboardPenalties: IN_CODE_INITIAL_SHOW_ALIAS_IN_SCOREBOARD_PENALTIES,
      enablePenaltyCountdownSound: IN_CODE_INITIAL_ENABLE_PENALTY_COUNTDOWN_SOUND,
      penaltyCountdownStartTime: IN_CODE_INITIAL_PENALTY_COUNTDOWN_START_TIME,
      customPenaltyBeepSoundDataUrl: IN_CODE_INITIAL_CUSTOM_PENALTY_BEEP_SOUND_DATA_URL,
      enableDebugMode: IN_CODE_INITIAL_ENABLE_DEBUG_MODE,
      showStandingsInWarmup: IN_CODE_INITIAL_SHOW_STANDINGS_IN_WARMUP,
      showShotsData: IN_CODE_INITIAL_SHOW_SHOTS_DATA,
      enableOlympiaTransition: IN_CODE_INITIAL_ENABLE_OLYMPIA_TRANSITION,
      tickIntervalMs: 200,
      scoreboardLayout: INITIAL_LAYOUT_SETTINGS,
      scoreboardLayoutProfiles: [defaultInitialLayoutProfile],
      selectedScoreboardLayoutProfileId: defaultInitialLayoutProfile.id,
      selectedMatchCategory: '',
      tournaments: [],
      selectedTournamentId: null,
      tunnel: IN_CODE_INITIAL_TUNNEL_STATE,
      replays: IN_CODE_INITIAL_REPLAYS_SETTINGS,
      // Auto-sync defaults
      autoSyncAnalysisIntervalMinutes: 0,
      autoSyncEnabled: false,
      autoSyncResolveConflicts: false,
      autoSyncSkipDuringMatch: true,
      autoSyncAfterMatch: false,
      autoSyncAfterSummaryEdit: false,
    },
    live: {
      ...INITIAL_LIVE_DATA,
      clock: { ...INITIAL_LIVE_DATA.clock, currentTime: defaultInitialProfile.defaultWarmUpDuration }
    },
    _initialConfigLoadComplete: false,
  };
};

type GameStateContextType = {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  isLoading: boolean;
};

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

// Helper functions (calculateAbsoluteTimeForPeriod, finalizeMatch, handleAutoTransition, sortPenaltiesByStatus,
// applyFormatAndTimingsProfileToState, applyScoreboardLayoutProfileToState)
// are now imported from @/lib/game-state-reducer



const gameReducer = (state: GameState, action: GameAction): GameState => {
  let newState: GameState = { ...state };
  let newTimestamp = Date.now();
  let toastMessage: GameState['_lastToastMessage'] = null;

  // Clear pending power play goal confirmation on almost any penalty change
  if (action.type !== 'ADD_GOAL' && action.type !== 'CLEAR_PENDING_POWER_PLAY_GOAL' && action.type !== 'TICK' && state.live.pendingPowerPlayGoal) {
      if ('payload' in action && typeof action.payload === 'object' && action.payload && 'team' in action.payload && action.payload.team === state.live.pendingPowerPlayGoal.team) {
          newState.live.pendingPowerPlayGoal = null;
      }
  }

  switch (action.type) {
    case 'SHOW_OVERLAY_MESSAGE':
      newState = { ...state, live: { ...state.live, overlayMessage: { id: safeUUID(), ...action.payload } } };
      break;
    case 'HIDE_OVERLAY_MESSAGE':
      newState = { ...state, live: { ...state.live, overlayMessage: null } };
      break;
    case 'START_LOADING_REPLAY':
      newState = { ...state, live: { ...state.live, replayLoadRequest: { id: safeUUID(), ...action.payload } } };
      break;
    case 'SHOW_REPLAY_OVERLAY':
      newState = { ...state, live: { ...state.live, replayLoadRequest: null, replayOverlay: { id: safeUUID(), ...action.payload }}};
      break;
    case 'HIDE_REPLAY_OVERLAY':
      newState = { ...state, live: { ...state.live, replayOverlay: null }};
      break;
    case 'SHOW_GOAL_CELEBRATION':
      newState = { ...state, live: { ...state.live, goalCelebration: { id: safeUUID(), ...action.payload } } };
      break;
    case 'HIDE_GOAL_CELEBRATION':
      newState = { ...state, live: { ...state.live, goalCelebration: null } };
      break;
    case 'HYDRATE_FROM_SERVER': {
        const serverState = action.payload;
        if (!serverState.config) {
            console.error("Hydration from server failed: config is missing.");
            return state; // Return current state if server data is incomplete
        }

        // Merge server config with initial state to ensure all properties exist
        const initialState = getInitialState();
        let finalState: GameState = {
            ...initialState,
            config: {
                ...initialState.config,
                ...serverState.config,
                // Ensure critical properties have defaults if missing
                tunnel: serverState.config.tunnel || initialState.config.tunnel,
                replays: serverState.config.replays || initialState.config.replays,
            },
            _initialConfigLoadComplete: true,
        };

        // Auto-select first tournament if none is selected but tournaments exist
        if (!finalState.config.selectedTournamentId && finalState.config.tournaments && finalState.config.tournaments.length > 0) {
            console.log('[Reducer] No tournament selected, auto-selecting first tournament:', finalState.config.tournaments[0].id);
            finalState.config.selectedTournamentId = finalState.config.tournaments[0].id;
        }

        if (serverState.live && serverState.live.clock) {
            finalState.live = serverState.live;
        }

        newState = applyFormatAndTimingsProfileToState(finalState, finalState.config.selectedFormatAndTimingsProfileId);
        newState = applyScoreboardLayoutProfileToState(newState, finalState.config.selectedScoreboardLayoutProfileId);
        break;
    }
    case 'HYDRATE_TOURNAMENT_DETAILS': {
        const { tournamentData } = action.payload;
        if (!tournamentData) return state;
        console.log('[Reducer] HYDRATE_TOURNAMENT_DETAILS', tournamentData.id, 'teams:', tournamentData.teams?.length, 'categories:', tournamentData.categories?.length);
        const newTournaments = state.config.tournaments.map(t =>
            t.id === tournamentData.id ? { ...t, ...tournamentData } : t
        );
        newState = { ...state, config: { ...state.config, tournaments: newTournaments } };
        break;
    }
    case 'SET_STATE_FROM_LOCAL_BROADCAST': {
        const incomingTimestamp = action.payload._lastUpdatedTimestamp;
        const currentTimestamp = state._lastUpdatedTimestamp;

        if (incomingTimestamp && currentTimestamp && incomingTimestamp <= currentTimestamp) {
            return state;
        }
        
        const broadcastedState = {...action.payload};

        newState = { ...broadcastedState, _lastActionOriginator: undefined };
        break;
    }
    case 'TOGGLE_CLOCK': {
      if (state.live.clock.periodDisplayOverride === "End of Game" || state.live.clock.isFlashingZero) break;
      const { isClockRunning, clockStartTimeMs, remainingTimeAtStartCs, currentTime, periodDisplayOverride, absoluteElapsedTimeCs } = state.live.clock;
      
      let newClockState: Partial<ClockState> = {};
      let newAbsoluteElapsedTimeCs = absoluteElapsedTimeCs;

      if (isClockRunning) { // Stopping the clock
        let preciseCurrentTimeCs = currentTime;
        if (clockStartTimeMs && remainingTimeAtStartCs !== null) {
          const elapsedCs = Math.floor((Date.now() - clockStartTimeMs) / 10);
          preciseCurrentTimeCs = Math.max(0, remainingTimeAtStartCs - elapsedCs);
          if (periodDisplayOverride === null) newAbsoluteElapsedTimeCs += elapsedCs;
        }
        newClockState = {
            currentTime: preciseCurrentTimeCs,
            isClockRunning: false,
            clockStartTimeMs: null,
            remainingTimeAtStartCs: null,
            absoluteElapsedTimeCs: newAbsoluteElapsedTimeCs,
            _liveAbsoluteElapsedTimeCs: newAbsoluteElapsedTimeCs,
        };

      } else { // Starting the clock
        if (currentTime > 0) {
            newClockState = {
                isClockRunning: true,
                clockStartTimeMs: Date.now(),
                remainingTimeAtStartCs: currentTime,
            };
        }
      }
      
      const updatedLiveState = {
        ...state.live,
        clock: { ...state.live.clock, ...newClockState },
      };
      
      newState = { ...state, live: updatedLiveState };
      break;
    }
    case 'SET_TIME': {
        if (state.live.clock.periodDisplayOverride === "End of Game" || state.live.clock.periodDisplayOverride === "Shootout") break;
        const newTimeCs = Math.max(0, (action.payload.minutes * 60 + action.payload.seconds) * CENTISECONDS_PER_SECOND);
        const newIsClockRunning = newTimeCs > 0 ? state.live.clock.isClockRunning : false;
        let newAbsoluteTime = state.live.clock.absoluteElapsedTimeCs;
        if (state.live.clock.periodDisplayOverride === null) {
            newAbsoluteTime = calculateAbsoluteTimeForPeriod(state.live.clock.currentPeriod, newTimeCs, state);
        }
        newState = { ...state, live: { ...state.live, clock: {
            ...state.live.clock,
            currentTime: newTimeCs,
            isClockRunning: newIsClockRunning,
            clockStartTimeMs: newIsClockRunning ? Date.now() : null,
            remainingTimeAtStartCs: newIsClockRunning ? newTimeCs : null,
            absoluteElapsedTimeCs: newAbsoluteTime,
            _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
        }}};
        toastMessage = { title: "Reloj Actualizado", description: `Tiempo establecido a ${formatTime(newTimeCs, { showTenths: newTimeCs < 6000, includeMinutesForTenths: true })}` };
        break;
    }
    case 'ADJUST_TIME': {
        if (state.live.clock.periodDisplayOverride === "End of Game" || state.live.clock.periodDisplayOverride === "Shootout") break;
        const { isClockRunning, clockStartTimeMs, remainingTimeAtStartCs, currentTime, periodDisplayOverride } = state.live.clock;
        let currentTimeSnapshotCs = currentTime;
        if (isClockRunning && clockStartTimeMs && remainingTimeAtStartCs !== null) {
            currentTimeSnapshotCs = Math.max(0, remainingTimeAtStartCs - Math.floor((Date.now() - clockStartTimeMs) / 10));
        }
        const newAdjustedTimeCs = Math.max(0, currentTimeSnapshotCs + action.payload);
        const newIsClockRunning = newAdjustedTimeCs > 0 ? isClockRunning : false;
        let newAbsoluteTime = state.live.clock.absoluteElapsedTimeCs;
        if (periodDisplayOverride === null) {
            newAbsoluteTime = calculateAbsoluteTimeForPeriod(state.live.clock.currentPeriod, newAdjustedTimeCs, state);
        }
        newState = { ...state, live: { ...state.live, clock: {
            ...state.live.clock,
            currentTime: newAdjustedTimeCs,
            isClockRunning: newIsClockRunning,
            clockStartTimeMs: newIsClockRunning ? Date.now() : null,
            remainingTimeAtStartCs: newIsClockRunning ? newAdjustedTimeCs : null,
            absoluteElapsedTimeCs: newAbsoluteTime,
            _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
        }}};
        break;
    }
    case 'SET_PERIOD': {
        const newPeriod = Math.max(0, action.payload);
        const { defaultWarmUpDuration, autoStartWarmUp, numberOfRegularPeriods, defaultPeriodDuration, defaultOTPeriodDuration } = state.config;
        const periodDurationCs = (newPeriod === 0) ? defaultWarmUpDuration : (newPeriod > numberOfRegularPeriods ? defaultOTPeriodDuration : defaultPeriodDuration);
        const autoStartClock = (newPeriod === 0) ? (autoStartWarmUp && periodDurationCs > 0) : false;
        const newAbsoluteTime = calculateAbsoluteTimeForPeriod(newPeriod, periodDurationCs, state);

        // Si newPeriod === 0, determinar si es Pre Warm-up o Warm-up
        // - Pre Warm-up: solo si es un partido nuevo (sin períodos jugados y estado actual es Pre Warm-up)
        // - Warm-up: si estás retrocediendo desde el período 1 (ya has jugado períodos)
        let periodOverride = null;
        if (newPeriod === 0) {
            const hasPlayedPeriods = state.live.playedPeriods && state.live.playedPeriods.length > 0;
            const isComingFromPreWarmup = state.live.clock.periodDisplayOverride === 'Pre Warm-up';
            periodOverride = (hasPlayedPeriods || (!isComingFromPreWarmup && state.live.clock.currentPeriod > 0)) ? 'Warm-up' : 'Pre Warm-up';
        }

        newState = { ...state, live: { ...state.live, clock: {
            ...state.live.clock,
            currentPeriod: newPeriod,
            periodDisplayOverride: periodOverride,
            currentTime: periodDurationCs,
            isClockRunning: autoStartClock,
            preTimeoutState: null,
            clockStartTimeMs: autoStartClock ? Date.now() : null,
            remainingTimeAtStartCs: autoStartClock ? periodDurationCs : null,
            absoluteElapsedTimeCs: newAbsoluteTime,
            _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
        }}};
        break;
    }
    case 'ADD_GOAL': {
      const { live, config } = state;

      let periodTextForLog: string;
      if (action.payload.periodText) {
          periodTextForLog = action.payload.periodText;
      } else {
          periodTextForLog = getActualPeriodText(live.clock.currentPeriod, live.clock.periodDisplayOverride, config.numberOfRegularPeriods || 2, live.shootout);
          if (live.clock.periodDisplayOverride === 'Break' || live.clock.periodDisplayOverride === 'Pre-OT Break') {
            periodTextForLog = getPeriodText(live.clock.currentPeriod, config.numberOfRegularPeriods || 2);
          }
      }

      const newGoal: GoalLog = { ...action.payload, id: safeUUID(), periodText: periodTextForLog };
      
      const newLiveGoals = { ...live.goals };
      newLiveGoals[action.payload.team] = [...newLiveGoals[action.payload.team], newGoal];

      const teamScored = action.payload.team;
      const teamConceded = teamScored === 'home' ? 'away' : 'home';
      
      const newScore: ScoreState = {
        ...live.score,
        home: newLiveGoals.home.length,
        away: newLiveGoals.away.length,
      };

      let pendingPPGoal: LiveState['pendingPowerPlayGoal'] = null;
      const scoringTeamOnIce = config.playersPerTeamOnIce - state.live.penalties[teamScored].filter(p => p._status === 'running' && (p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride)).length;
      const concedingTeamOnIce = config.playersPerTeamOnIce - state.live.penalties[teamConceded].filter(p => p._status === 'running' && (p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride)).length;

      if (scoringTeamOnIce > concedingTeamOnIce) {
          const firstEligiblePenalty = state.live.penalties[teamConceded].find(p => 
              p._status === 'running' && 
              p.clearsOnGoal &&
              (p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride)
          );
          if (firstEligiblePenalty) {
              pendingPPGoal = { team: teamConceded, penaltyId: firstEligiblePenalty.id };
          }
      }
      
      // Goal Celebration Logic
      let goalCelebration: LiveState['goalCelebration'] = null;
      const isFinishingSoon = state.live.clock.isClockRunning && state.live.clock.currentTime < 500;
      const anyPenaltyEndingSoon = [...live.penalties.home, ...live.penalties.away].some(p => p.expirationTime && (p.expirationTime - state.live.clock._liveAbsoluteElapsedTimeCs) < 1500);
      if (!isFinishingSoon && !anyPenaltyEndingSoon) {
          const teamData = config.tournaments.find(t => t.id === config.selectedTournamentId)?.teams.find(t => t.name === live[`${teamScored}TeamName`] && (t.subName || undefined) === (live[`${teamScored}TeamSubName`] || undefined) && t.category === config.selectedMatchCategory);
          goalCelebration = { id: safeUUID(), goal: newGoal, teamData };
      }
      
      newState = { ...state, live: { ...state.live, 
        score: newScore,
        goals: newLiveGoals,
        pendingPowerPlayGoal: pendingPPGoal,
        goalCelebration: goalCelebration,
      }};
      toastMessage = { title: "Gol Añadido", description: `Gol para el jugador #${action.payload.scorer?.playerNumber} registrado.` };
      break;
    }
     case 'EDIT_GOAL': {
      const { goalId, updates } = action.payload;
      const newLiveGoals = {
        home: [...state.live.goals.home],
        away: [...state.live.goals.away]
      };
      let goalFoundAndUpdated = false;

      for (const team of ['home', 'away'] as const) {
          const goalIndex = newLiveGoals[team].findIndex(g => g.id === goalId);
          if (goalIndex !== -1) {
              newLiveGoals[team][goalIndex] = { ...newLiveGoals[team][goalIndex], ...updates };
              goalFoundAndUpdated = true;
              break;
          }
      }

      if (goalFoundAndUpdated) {
        const newScore = { ...state.live.score, home: newLiveGoals.home.length, away: newLiveGoals.away.length };
        newState = { ...state, live: { ...state.live,
          score: newScore,
          goals: newLiveGoals,
        }};
        toastMessage = { title: "Gol Actualizado", description: "Los cambios en el gol han sido guardados." };
      }
      break;
    }
    case 'DELETE_GOAL': {
      const { goalId } = action.payload;
      const newLiveGoals = { ...state.live.goals };
      let goalFoundAndDeleted = false;

      for (const team of ['home', 'away'] as const) {
          const initialLength = newLiveGoals[team].length;
          newLiveGoals[team] = newLiveGoals[team].filter(g => g.id !== goalId);
          if (newLiveGoals[team].length < initialLength) {
              goalFoundAndDeleted = true;
              break;
          }
      }

      if (goalFoundAndDeleted) {
          const newScore = { ...state.live.score, home: newLiveGoals.home.length, away: newLiveGoals.away.length };
          newState = { ...state, live: { ...state.live,
            score: newScore,
            goals: newLiveGoals,
          }};
          toastMessage = { title: "Gol Eliminado", description: "El gol ha sido eliminado del registro." };
      }
      break;
    }
    case 'ADD_PLAYER_SHOT': {
      const { team, playerNumber } = action.payload;
      const attendedPlayer = state.live.attendance[team].find(p => p.number === playerNumber);
      
      const newShotLog: ShotLog = {
        id: safeUUID(),
        team,
        timestamp: Date.now(),
        gameTime: state.live.clock.currentTime,
        periodText: getActualPeriodText(state.live.clock.currentPeriod, state.live.clock.periodDisplayOverride, state.config.numberOfRegularPeriods, state.live.shootout),
        playerId: attendedPlayer?.id || `unknown-${playerNumber}`,
        playerNumber,
        playerName: attendedPlayer?.name,
      };

      const newShotsLog = { ...state.live.shotsLog };
      newShotsLog[team] = [...newShotsLog[team], newShotLog];
      
      const newScore = { 
        ...state.live.score,
        homeShots: newShotsLog.home.length,
        awayShots: newShotsLog.away.length,
      };

      newState = { ...state, live: { ...state.live,
        score: newScore,
        shotsLog: newShotsLog,
      }};
      break;
    }
    case 'SET_PLAYER_SHOTS': {
        break;
    }
    case 'FINISH_GAME_WITH_OT_GOAL': {
      // First, add the goal to the state
      let tempState = gameReducer(state, { 
        type: 'ADD_GOAL',
        payload: action.payload 
      });

      // Then, call finalizeMatch with the updated state
      newState = finalizeMatch(tempState);
      toastMessage = { title: "¡Partido Finalizado!", description: "Gol de oro registrado exitosamente." };
      break;
    }
    case 'ADD_PENALTY': {
      const { team, penalty, addGameTime, addPeriodText } = action.payload;
      const { penaltyTypeId, playerNumber } = penalty;
      const { config, live } = state;
      const penaltyDef = config.penaltyTypes.find(p => p.id === penaltyTypeId);

      if (!penaltyDef) {
        console.error(`Penalty definition with id ${penaltyTypeId} not found.`);
        break;
      }
      
      const newPenaltyId = safeUUID();
      const teamDetails = config.tournaments.find(t => t.id === config.selectedTournamentId)?.teams.find(t => t.name === live[`${team}TeamName`] && (t.subName || undefined) === (live[`${team}TeamSubName`] || undefined) && t.category === config.selectedMatchCategory);
      const playerDetails = teamDetails?.players.find(p => p.number === playerNumber);
      
      const newPenaltyLog: PenaltyLog = {
        id: newPenaltyId, team, playerNumber: playerNumber.toUpperCase(), playerName: playerDetails?.name,
        penaltyName: penaltyDef.name,
        initialDuration: penaltyDef.duration,
        reducesPlayerCount: penaltyDef.reducesPlayerCount,
        clearsOnGoal: penaltyDef.clearsOnGoal,
        isBenchPenalty: penaltyDef.isBenchPenalty,
        addTimestamp: Date.now(),
        addGameTime: addGameTime ?? live.clock.currentTime,
        addPeriodText: addPeriodText ?? getActualPeriodText(live.clock.currentPeriod, live.clock.periodDisplayOverride, config.numberOfRegularPeriods || 2, live.shootout),
      };

      const newLivePenaltiesLog = { ...live.penaltiesLog };
      newLivePenaltiesLog[team] = [...newLivePenaltiesLog[team], newPenaltyLog];

      const { _liveAbsoluteElapsedTimeCs } = live.clock;
      const limitReachedReasons: ('quantity')[] = [];
      const playerPenalties = live.penaltiesLog[team].filter(
        p => p.playerNumber === playerNumber && p.endReason !== 'deleted' && !p.isBenchPenalty
      );
      
      if (config.enableMaxPenaltiesLimit && !penaltyDef.isBenchPenalty) {
        if (playerPenalties.length + 1 >= config.maxPenaltiesPerPlayer) {
          limitReachedReasons.push('quantity');
        }
      }
      
      let newStatus: Penalty['_status'];
      let startTime, expirationTime;
      
      if (penaltyDef.reducesPlayerCount) {
        newStatus = config.autoActivatePuckPenalties ? 'pending_concurrent' : 'pending_puck';
        startTime = undefined;
        expirationTime = undefined;
      } else {
        newStatus = 'running';
        startTime = _liveAbsoluteElapsedTimeCs;
        expirationTime = _liveAbsoluteElapsedTimeCs + penaltyDef.duration * CENTISECONDS_PER_SECOND;
      }
      
      const newPenalty: Penalty = { 
        id: newPenaltyId, playerNumber: playerNumber.toUpperCase(), initialDuration: penaltyDef.duration,
        reducesPlayerCount: penaltyDef.reducesPlayerCount, clearsOnGoal: penaltyDef.clearsOnGoal,
        isBenchPenalty: penaltyDef.isBenchPenalty, _status: newStatus, startTime, expirationTime,
        _limitReached: limitReachedReasons.length > 0 ? limitReachedReasons : undefined,
      };

      newState = { ...state, live: { ...live,
        penalties: { ...live.penalties, [team]: sortPenaltiesByStatus([...live.penalties[team], newPenalty]) },
        penaltiesLog: newLivePenaltiesLog
      }};
      const teamName = team === 'home' ? live.homeTeamName : live.awayTeamName;
      toastMessage = { title: "Penalidad Agregada", description: `Jugador ${playerNumber.toUpperCase()}${playerDetails ? ` (${playerDetails.name})` : ''} de ${teamName} recibió una penalidad de ${penaltyDef.name}.` };
      
      break;
    }
    case 'REMOVE_PENALTY': {
      const { team, penaltyId } = action.payload;
      const penaltyToRemove = state.live.penalties[team].find(p => p.id === penaltyId);
      if (!penaltyToRemove) break;

      const remainingTimeCs = penaltyToRemove.expirationTime !== undefined ? Math.max(0, penaltyToRemove.expirationTime - state.live.clock._liveAbsoluteElapsedTimeCs) : penaltyToRemove.initialDuration * 100;
      const timeServed = penaltyToRemove.initialDuration - Math.round(remainingTimeCs / 100);

      const newPenaltiesLog = { ...state.live.penaltiesLog };
      newPenaltiesLog[team] = newPenaltiesLog[team].map(p =>
        p.id === penaltyId && !p.endReason ? { ...p, endTimestamp: Date.now(), endGameTime: state.live.clock.currentTime, endPeriodText: getActualPeriodText(state.live.clock.currentPeriod, state.live.clock.periodDisplayOverride, state.config.numberOfRegularPeriods, state.live.shootout), endReason: 'deleted', timeServed } : p
      );
      
      newState = { ...state, live: { ...state.live,
        penalties: { ...state.live.penalties, [team]: sortPenaltiesByStatus(state.live.penalties[team].filter(p => p.id !== penaltyId))},
        penaltiesLog: newPenaltiesLog
      }};
      break;
    }
    case 'DELETE_PENALTY_LOG': {
      const { team, logId } = action.payload;
      
      const newPenaltiesLog = { ...state.live.penaltiesLog };
      newPenaltiesLog[team] = newPenaltiesLog[team].filter((p: PenaltyLog) => p.id !== logId);
      
      newState = { ...state, live: { ...state.live, 
        penaltiesLog: newPenaltiesLog
      }};
      toastMessage = { title: "Penalidad Eliminada del Registro", variant: "destructive" };
      break;
    }
     case 'END_PENALTY_FOR_GOAL': {
      const { team, penaltyId } = action.payload;
      const penaltyToEnd = state.live.penalties[team].find(p => p.id === penaltyId);
      if (!penaltyToEnd || !penaltyToEnd.clearsOnGoal) break;

      const remainingTimeCs = penaltyToEnd.expirationTime !== undefined ? Math.max(0, penaltyToEnd.expirationTime - state.live.clock._liveAbsoluteElapsedTimeCs) : penaltyToEnd.initialDuration * 100;
      const timeServed = penaltyToEnd.initialDuration - Math.round(remainingTimeCs / 100);
      
      const newPenaltiesLog = { ...state.live.penaltiesLog };
      newPenaltiesLog[team] = newPenaltiesLog[team].map(p =>
        p.id === penaltyId && !p.endReason ? { ...p, endTimestamp: Date.now(), endGameTime: state.live.clock.currentTime, endPeriodText: getActualPeriodText(state.live.clock.currentPeriod, state.live.clock.periodDisplayOverride, state.config.numberOfRegularPeriods, state.live.shootout), endReason: 'goal_on_pp', timeServed } : p
      );

      newState = { ...state, live: { ...state.live,
        penalties: { ...state.live.penalties, [team]: sortPenaltiesByStatus(state.live.penalties[team].filter(p => p.id !== penaltyId))},
        penaltiesLog: newPenaltiesLog,
        pendingPowerPlayGoal: null,
      }};
      toastMessage = { title: "Penalidad Finalizada", description: "La penalidad se eliminó por el gol en Power Play." };
      break;
    }
    case 'CLEAR_PENDING_POWER_PLAY_GOAL': {
      newState = { ...state, live: { ...state.live, pendingPowerPlayGoal: null } };
      break;
    }
    case 'TOGGLE_PENALTY_PLAYER_REDUCTION': {
      const { team, penaltyId } = action.payload;
      const penaltiesForTeam = [...state.live.penalties[team]];
      const penaltyIndex = penaltiesForTeam.findIndex(p => p.id === penaltyId);
      if (penaltyIndex === -1) break;

      const penaltyToToggle = { ...penaltiesForTeam[penaltyIndex] };
      const isCurrentlyReducing = penaltyToToggle.reducesPlayerCount && !penaltyToToggle._doesNotReducePlayerCountOverride;

      if (isCurrentlyReducing) {
        penaltyToToggle._doesNotReducePlayerCountOverride = true;
      } else {
        const runningAndReducingPenalties = penaltiesForTeam.filter(
          p => p.id !== penaltyId && p._status === 'running' && p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride
        ).length;

        if (runningAndReducingPenalties >= state.config.maxConcurrentPenalties) {
          penaltyToToggle._status = 'pending_concurrent';
          penaltyToToggle.startTime = undefined;
          penaltyToToggle.expirationTime = undefined;
          penaltyToToggle._doesNotReducePlayerCountOverride = false; // Set intention
          toastMessage = { title: "Sin Slots Disponibles", description: `La penalidad para #${penaltyToToggle.playerNumber} está ahora en "Esperando Slot".` };
        } else {
          penaltyToToggle._doesNotReducePlayerCountOverride = false;
        }
      }
      
      penaltiesForTeam[penaltyIndex] = penaltyToToggle;
      
      newState = { ...state, live: { ...state.live, penalties: { ...state.live.penalties, [team]: sortPenaltiesByStatus(penaltiesForTeam) }}};
      break;
    }
    case 'ADJUST_PENALTY_TIME': {
      const { team, penaltyId, delta } = action.payload;
       newState = { ...state, live: { ...state.live, penalties: { ...state.live.penalties, [team]: state.live.penalties[team].map(p =>
        p.id === penaltyId && p.expirationTime !== undefined ? { ...p, expirationTime: p.expirationTime + (delta * CENTISECONDS_PER_SECOND) } : p
      )}}};
      break;
    }
     case 'SET_PENALTY_TIME': {
      const { team, penaltyId, time } = action.payload;
      const newRemainingTimeCs = time * CENTISECONDS_PER_SECOND;
      const updatedPenalties = state.live.penalties[team].map(p =>
        p.id === penaltyId ? { ...p, expirationTime: state.live.clock._liveAbsoluteElapsedTimeCs + newRemainingTimeCs } : p
      );
      newState = { ...state, live: { ...state.live, penalties: { ...state.live.penalties, [team]: sortPenaltiesByStatus(updatedPenalties) }}};
      toastMessage = { title: "Tiempo de Penalidad Establecido", description: `Tiempo actualizado a ${formatTime(newRemainingTimeCs)}.` };
      break;
    }
    case 'REORDER_PENALTIES': {
      const { team, startIndex, endIndex } = action.payload;
      const currentPenalties = [...state.live.penalties[team]];
      const [removed] = currentPenalties.splice(startIndex, 1);
      if (removed) currentPenalties.splice(endIndex, 0, removed);
      newState = { ...state, live: { ...state.live, penalties: { ...state.live.penalties, [team]: sortPenaltiesByStatus(currentPenalties) }}};
      toastMessage = { title: "Penalidades Reordenadas", description: `Orden de penalidades para ${team === 'home' ? state.live.homeTeamName : state.live.awayTeamName} actualizado.` };
      break;
    }
    case 'ACTIVATE_PENDING_PUCK_PENALTIES': {
      const activate = (penalties: Penalty[]) => penalties.map(p => {
        if (p._status === 'pending_puck') {
          return { ...p, _status: 'pending_concurrent' };
        }
        return p;
      });
      newState = { ...state, live: { ...state.live, penalties: { home: activate(state.live.penalties.home), away: activate(state.live.penalties.away) }}};
      break;
    }
    case 'TICK': {
      if (!state.live?.clock) return state; // Safety guard
      let hasChanged = false;
      let significantChangeOccurred = false;
      const { clock, penalties, penaltiesLog } = state.live;
      const { config } = state;
      const now = Date.now();
      
      let currentTimeSnapshot = clock.currentTime;
      let liveAbsoluteElapsedTimeCs = clock.absoluteElapsedTimeCs;
      let playHornTrigger = state.live.playHornTrigger;
      let playPenaltyBeepTrigger = state.live.playPenaltyBeepTrigger;

      if (clock.isFlashingZero) {
        if (now >= (clock.flashingZeroEndTime || 0)) {
          significantChangeOccurred = true;
          newState = handleAutoTransition(state);
        } else {
          return state; // No other processing during flashing
        }
        break;
      }
      
      if (clock.isClockRunning && clock.clockStartTimeMs && clock.remainingTimeAtStartCs !== null) {
        const elapsedCs = Math.floor((Date.now() - clock.clockStartTimeMs) / 10);
        currentTimeSnapshot = Math.max(0, clock.remainingTimeAtStartCs - elapsedCs);
        if (clock.periodDisplayOverride === null) liveAbsoluteElapsedTimeCs = clock.absoluteElapsedTimeCs + elapsedCs;
        if (currentTimeSnapshot !== clock.currentTime) hasChanged = true;
      } else if (clock.isClockRunning && clock.currentTime <= 0) {
        currentTimeSnapshot = 0;
      }
      
      const newPenaltiesLog: { home: PenaltyLog[], away: PenaltyLog[] } = penaltiesLog
        ? JSON.parse(JSON.stringify(penaltiesLog))
        : { home: [], away: [] };
      
      const processPenalties = (team: Team): Penalty[] => {
          const teamPenalties = penalties[team];
          const runningPenalties = teamPenalties.filter(p => p._status === 'running');
          
          const expiredPenalties = runningPenalties.filter(p => p.expirationTime !== undefined && liveAbsoluteElapsedTimeCs >= p.expirationTime);
          if (expiredPenalties.length > 0) significantChangeOccurred = true;
          
          expiredPenalties.forEach(p => {
              const logIndex = newPenaltiesLog[team].findIndex(log => log.id === p.id && !log.endReason);
              if (logIndex > -1) {
                  const absoluteEndTime = p.expirationTime ?? liveAbsoluteElapsedTimeCs;
                  const endTimeContext = getPeriodContextFromAbsoluteTime(absoluteEndTime, state);
                  newPenaltiesLog[team][logIndex] = {
                      ...newPenaltiesLog[team][logIndex],
                      endTimestamp: Date.now(), endGameTime: endTimeContext.timeInPeriodCs,
                      endPeriodText: endTimeContext.periodText, endReason: 'completed', timeServed: p.initialDuration,
                  };
              }
          });

          let stillRunning = runningPenalties.filter(p => !expiredPenalties.find(exp => exp.id === p.id));
          let availableSlots = config.maxConcurrentPenalties - stillRunning.filter(p => (p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride)).length;
          const playersServing = new Set(stillRunning.filter(p => (p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride)).map(p => p.playerNumber));
          
          let pendingConcurrent = teamPenalties.filter(p => p._status === 'pending_concurrent');
          for (const p of pendingConcurrent) {
              if (availableSlots > 0 && !playersServing.has(p.playerNumber)) {
                  significantChangeOccurred = true;
                  stillRunning.push({ ...p, _status: 'running', startTime: liveAbsoluteElapsedTimeCs, expirationTime: liveAbsoluteElapsedTimeCs + (p.initialDuration * CENTISECONDS_PER_SECOND) });
                  if(p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride) {
                    playersServing.add(p.playerNumber);
                    availableSlots--;
                  }
              }
          }
          
          const newlyActivatedIds = new Set(stillRunning.map(p => p.id));
          const remainingPending = pendingConcurrent.filter(p => !newlyActivatedIds.has(p.id));
          const pendingPuck = teamPenalties.filter(p => p._status === 'pending_puck');
          return [...stillRunning, ...remainingPending, ...pendingPuck];
      };

      const homePenaltiesResult = processPenalties('home');
      const awayPenaltiesResult = processPenalties('away');
      
      const checkBeep = (team: Team) => {
          if (config.enablePenaltyCountdownSound && clock.isClockRunning && clock.periodDisplayOverride === null) {
              penalties[team].forEach(p => {
                  if (p._status === 'running' && p.expirationTime !== undefined) {
                      const prevRem = p.expirationTime - clock._liveAbsoluteElapsedTimeCs;
                      const currRem = p.expirationTime - liveAbsoluteElapsedTimeCs;
                      if (currRem / 100 <= config.penaltyCountdownStartTime && currRem > 0 && Math.floor(prevRem / 100) > Math.floor(currRem / 100)) {
                          playPenaltyBeepTrigger++;
                          hasChanged = true;
                      }
                  }
              });
          }
      };
      checkBeep('home');
      checkBeep('away');

      if (!isEqual(homePenaltiesResult, penalties.home)) { hasChanged = true; significantChangeOccurred = true; }
      if (!isEqual(awayPenaltiesResult, penalties.away)) { hasChanged = true; significantChangeOccurred = true; }

      const stateWithLiveTime = { ...state, live: { ...state.live, clock: { ...state.live.clock, _liveAbsoluteElapsedTimeCs: liveAbsoluteElapsedTimeCs }}};

      if (clock.isClockRunning && currentTimeSnapshot <= 0) {
        significantChangeOccurred = true;
        
        const shouldTriggerHorn = clock.periodDisplayOverride !== "Time Out";
        
        newState = {
            ...state,
            live: {
                ...state.live,
                clock: {
                    ...clock,
                    currentTime: 0,
                    isClockRunning: false,
                    isFlashingZero: true,
                    flashingZeroEndTime: now + FLASHING_ZERO_DURATION_MS,
                    clockStartTimeMs: null,
                    remainingTimeAtStartCs: null,
                },
                playHornTrigger: shouldTriggerHorn ? playHornTrigger + 1 : playHornTrigger,
            }
        };
      } else if (hasChanged) {
        newState = { ...state, live: { ...state.live,
            clock: { ...clock, currentTime: currentTimeSnapshot, _liveAbsoluteElapsedTimeCs: liveAbsoluteElapsedTimeCs },
            penalties: { home: sortPenaltiesByStatus(homePenaltiesResult), away: sortPenaltiesByStatus(awayPenaltiesResult) },
            penaltiesLog: newPenaltiesLog,
            playPenaltyBeepTrigger: playPenaltyBeepTrigger
        }};
      } else {
        return { ...state, live: { ...state.live, clock: { ...state.live.clock, _liveAbsoluteElapsedTimeCs: liveAbsoluteElapsedTimeCs }}};
      }
      
      newState._lastActionOriginator = significantChangeOccurred ? TAB_ID : undefined;
      newState._lastUpdatedTimestamp = significantChangeOccurred ? newTimestamp : state._lastUpdatedTimestamp;
      return newState;
    }
    case 'SET_HOME_TEAM_NAME': newState = { ...state, live: { ...state.live, homeTeamName: action.payload || 'Local' } }; break;
    case 'SET_HOME_TEAM_SUB_NAME': newState = { ...state, live: { ...state.live, homeTeamSubName: action.payload } }; break;
    case 'SET_AWAY_TEAM_NAME': newState = { ...state, live: { ...state.live, awayTeamName: action.payload || 'Visitante' } }; break;
    case 'SET_AWAY_TEAM_SUB_NAME': newState = { ...state, live: { ...state.live, awayTeamSubName: action.payload } }; break;
    case 'START_BREAK': {
        const newAbsoluteTime = calculateAbsoluteTimeForPeriod(state.live.clock.currentPeriod, 0, state);
        const autoStart = state.config.autoStartBreaks && state.config.defaultBreakDuration > 0;
        const finishedPeriodText = getPeriodText(state.live.clock.currentPeriod, state.config.numberOfRegularPeriods);
        const playedPeriods = [...state.live.playedPeriods];
        if (!playedPeriods.includes(finishedPeriodText)) {
            playedPeriods.push(finishedPeriodText);
        }
        newState = { ...state, live: { ...state.live,
            playedPeriods, 
            clock: { ...state.live.clock,
            currentTime: state.config.defaultBreakDuration, periodDisplayOverride: 'Break', isClockRunning: autoStart, preTimeoutState: null,
            clockStartTimeMs: autoStart ? Date.now() : null, remainingTimeAtStartCs: autoStart ? state.config.defaultBreakDuration : null,
            absoluteElapsedTimeCs: newAbsoluteTime, _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
        }}};
        break;
    }
    case 'START_PRE_OT_BREAK': {
        const newAbsoluteTime = calculateAbsoluteTimeForPeriod(state.live.clock.currentPeriod, 0, state);
        const autoStart = state.config.autoStartPreOTBreaks && state.config.defaultPreOTBreakDuration > 0;
        const finishedPeriodText = getPeriodText(state.live.clock.currentPeriod, state.config.numberOfRegularPeriods);
        const playedPeriods = [...state.live.playedPeriods];
        if (!playedPeriods.includes(finishedPeriodText)) {
            playedPeriods.push(finishedPeriodText);
        }
        newState = { ...state, live: { ...state.live, 
            playedPeriods,
            clock: { ...state.live.clock,
            currentTime: state.config.defaultPreOTBreakDuration, periodDisplayOverride: 'Pre-OT Break', isClockRunning: autoStart, preTimeoutState: null,
            clockStartTimeMs: autoStart ? Date.now() : null, remainingTimeAtStartCs: autoStart ? state.config.defaultPreOTBreakDuration : null,
            absoluteElapsedTimeCs: newAbsoluteTime, _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
        }}};
        break;
    }
    case 'START_BREAK_AFTER_PREVIOUS_PERIOD': {
        const { currentPeriod, periodDisplayOverride } = state.live.clock;
        const periodBeforeBreak = (periodDisplayOverride === 'Break' || periodDisplayOverride === 'Pre-OT Break') ? currentPeriod : currentPeriod - 1;
        if (periodBeforeBreak < 1) break;
        const newAbsoluteTime = calculateAbsoluteTimeForPeriod(periodBeforeBreak, 0, state);
        const isPreOT = periodBeforeBreak >= state.config.numberOfRegularPeriods;
        const breakDurationCs = isPreOT ? state.config.defaultPreOTBreakDuration : state.config.defaultBreakDuration;
        const autoStart = isPreOT ? state.config.autoStartPreOTBreaks : state.config.autoStartBreaks;
        newState = { ...state, live: { ...state.live, clock: { ...state.live.clock,
            currentPeriod: periodBeforeBreak, currentTime: breakDurationCs, periodDisplayOverride: isPreOT ? 'Pre-OT Break' : 'Break',
            isClockRunning: autoStart && breakDurationCs > 0, preTimeoutState: null,
            clockStartTimeMs: autoStart && breakDurationCs > 0 ? Date.now() : null, remainingTimeAtStartCs: autoStart && breakDurationCs > 0 ? breakDurationCs : null,
            absoluteElapsedTimeCs: newAbsoluteTime, _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
        }}};
        break;
    }
    case 'START_WARMUP': {
        // Transition from 'Pre Warm-up' to 'Warm-up' (triggered by operator clicking "Comenzar Partido")
        if (state.live.clock.periodDisplayOverride !== 'Pre Warm-up') break;

        const { defaultWarmUpDuration, autoStartWarmUp } = state.config;
        const autoStartClock = autoStartWarmUp && defaultWarmUpDuration > 0;

        newState = { ...state, live: { ...state.live, clock: {
            ...state.live.clock,
            periodDisplayOverride: 'Warm-up',
            currentTime: defaultWarmUpDuration,
            isClockRunning: autoStartClock,
            clockStartTimeMs: autoStartClock ? Date.now() : null,
            remainingTimeAtStartCs: autoStartClock ? defaultWarmUpDuration : null,
        }}};
        toastMessage = { title: "Warm-up Iniciado", description: `El partido ha comenzado. Reloj ${autoStartClock ? 'corriendo' : 'pausado'}.` };
        break;
    }
    case 'START_TIMEOUT': {
        const { team } = action.payload;
        let { currentTime, absoluteElapsedTimeCs, isClockRunning, clockStartTimeMs, remainingTimeAtStartCs, periodDisplayOverride } = state.live.clock;
        if (isClockRunning && clockStartTimeMs && remainingTimeAtStartCs !== null) {
            const elapsedCs = Math.floor((Date.now() - clockStartTimeMs) / 10);
            currentTime = Math.max(0, remainingTimeAtStartCs - elapsedCs);
            if (periodDisplayOverride === null) absoluteElapsedTimeCs += elapsedCs;
        }
        const autoStart = state.config.autoStartTimeouts && state.config.defaultTimeoutDuration > 0;
        newState = { ...state, live: { ...state.live, clock: { ...state.live.clock,
            preTimeoutState: {
                period: state.live.clock.currentPeriod, time: currentTime, isClockRunning: isClockRunning,
                override: periodDisplayOverride, clockStartTimeMs: clockStartTimeMs, remainingTimeAtStartCs: remainingTimeAtStartCs,
                absoluteElapsedTimeCs: absoluteElapsedTimeCs,
                team,
            },
            currentTime: state.config.defaultTimeoutDuration, periodDisplayOverride: 'Time Out', isClockRunning: autoStart,
            clockStartTimeMs: autoStart ? Date.now() : null, remainingTimeAtStartCs: autoStart ? state.config.defaultTimeoutDuration : null,
            absoluteElapsedTimeCs: absoluteElapsedTimeCs,
        }}};
        toastMessage = { title: "Time Out Iniciado", description: `Time Out de ${state.config.defaultTimeoutDuration / 100} segundos. Reloj ${autoStart ? 'corriendo' : 'pausado'}.` };
        break;
    }
     case 'END_TIMEOUT': {
      if (state.live.clock.preTimeoutState) {
        const { period, time, override, absoluteElapsedTimeCs } = state.live.clock.preTimeoutState;
        newState = { ...state, live: { ...state.live, clock: {
            ...state.live.clock, currentPeriod: period, currentTime: time, isClockRunning: false,
            periodDisplayOverride: override, clockStartTimeMs: null, remainingTimeAtStartCs: null,
            preTimeoutState: null, absoluteElapsedTimeCs: absoluteElapsedTimeCs, _liveAbsoluteElapsedTimeCs: absoluteElapsedTimeCs,
        }}};
        toastMessage = { title: "Time Out Finalizado", description: "Juego reanudado al estado anterior." };
      }
      break;
    }
    case 'MANUAL_END_GAME': {
        const { live, config } = state;
        const { clock, score } = live;

        // This action should only be triggered from an active period
        if (clock.periodDisplayOverride !== null) break;

        const isLastRegularPeriod = clock.currentPeriod === config.numberOfRegularPeriods;

        if (isLastRegularPeriod) {
            if (score.home !== score.away) {
                return finalizeMatch(state);
            } else {
                if (config.numberOfOvertimePeriods > 0) {
                    return gameReducer(state, { type: 'START_PRE_OT_BREAK' });
                } else {
                    // No OTs configured, go straight to decision
                    return { ...state, live: { ...live, clock: { ...clock, currentTime: 0, isClockRunning: false, periodDisplayOverride: 'AwaitingDecision' } } };
                }
            }
        } else if (clock.currentPeriod < config.numberOfRegularPeriods) {
            // Not the last regular period, so just start a normal break
            return gameReducer(state, { type: 'START_BREAK' });
        } else {
            // This is an OT period
             const totalGamePeriods = config.numberOfRegularPeriods + config.numberOfOvertimePeriods;
             if(clock.currentPeriod >= totalGamePeriods) {
                if (score.home !== score.away) {
                  return finalizeMatch(state);
                } else {
                  return { ...state, live: { ...live, clock: { ...clock, currentTime: 0, isClockRunning: false, periodDisplayOverride: 'AwaitingDecision' } } };
                }
             } else {
                // Not the final OT, but tied. Go to next break.
                if(score.home === score.away) {
                  return gameReducer(state, { type: 'START_PRE_OT_BREAK' });
                } else {
                  // Game ends on golden goal in OT.
                  return finalizeMatch(state);
                }
             }
        }
        break;
    }
    case 'ADD_EXTRA_OVERTIME': {
      if (state.live.clock.periodDisplayOverride !== 'AwaitingDecision') break;
      const { config, live } = state;
      const newNumberOfOTs = config.numberOfOvertimePeriods + 1;
      
      const newAbsoluteTime = calculateAbsoluteTimeForPeriod(live.clock.currentPeriod, 0, state);
      const autoStart = config.autoStartPreOTBreaks && config.defaultPreOTBreakDuration > 0;
      
      const finishedPeriodText = getPeriodText(live.clock.currentPeriod, config.numberOfRegularPeriods);
      const playedPeriods = [...live.playedPeriods];
      if (!playedPeriods.includes(finishedPeriodText)) {
          playedPeriods.push(finishedPeriodText);
      }

      newState = {
        ...state,
        config: {
          ...config,
          numberOfOvertimePeriods: newNumberOfOTs,
        },
        live: {
          ...live,
          playedPeriods,
          clock: {
            ...live.clock,
            currentPeriod: live.clock.currentPeriod,
            currentTime: config.defaultPreOTBreakDuration,
            periodDisplayOverride: 'Pre-OT Break',
            isClockRunning: autoStart,
            clockStartTimeMs: autoStart ? Date.now() : null,
            remainingTimeAtStartCs: autoStart ? config.defaultPreOTBreakDuration : null,
            absoluteElapsedTimeCs: newAbsoluteTime,
            _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
          }
        }
      };
      toastMessage = { title: "Overtime Extra Añadido", description: "Se ha añadido un período de OT y se ha iniciado un descanso." };
      break;
    }
    case 'START_SHOOTOUT': {
      if (state.live.clock.periodDisplayOverride !== 'AwaitingDecision') break;
      const { live, config } = state;
      const finishedPeriodText = getPeriodText(live.clock.currentPeriod, config.numberOfRegularPeriods);
      const playedPeriods = [...live.playedPeriods];
      if (!playedPeriods.includes(finishedPeriodText)) {
          playedPeriods.push(finishedPeriodText);
      }
      
      newState = { ...state, live: { ...state.live, 
        playedPeriods,
        shootout: {
          ...INITIAL_LIVE_DATA.shootout,
          isActive: true,
        },
        clock: {
            ...state.live.clock,
            periodDisplayOverride: 'Shootout'
        }
      }};
      toastMessage = { title: "Tanda de Penales Iniciada" };
      break;
    }
    case 'UPDATE_SHOOTOUT_ROUNDS':
        if (!state.live.shootout) break;
        newState = {
            ...state,
            live: { ...state.live,
                shootout: {
                    ...state.live.shootout,
                    rounds: action.payload,
                }
            }
        };
        break;
    case 'RECORD_SHOOTOUT_ATTEMPT': {
      if (!state.live.shootout) break;
      const { team, ...attemptData } = action.payload;
      const { shootout } = state.live;
      const currentAttempts = shootout[team === 'home' ? 'homeAttempts' : 'awayAttempts'];
      
      const newAttempt: ShootoutAttempt = {
          id: safeUUID(),
          round: currentAttempts.length + 1,
          ...attemptData,
      };

      let newInitiator = shootout.initiator;
      if (!newInitiator) {
          newInitiator = team;
      }

      newState = {
          ...state,
          live: { ...state.live,
              shootout: {
                  ...shootout,
                  initiator: newInitiator,
                  [team === 'home' ? 'homeAttempts' : 'awayAttempts']: [...currentAttempts, newAttempt],
              }
          }
      };
      break;
    }
    case 'UNDO_LAST_SHOOTOUT_ATTEMPT': {
      if (!state.live.shootout) {
        break;
      }
      const { team } = action.payload;
      const { shootout } = state.live;
      const attemptsKey = team === 'home' ? 'homeAttempts' : 'awayAttempts';
      const currentAttempts = shootout[attemptsKey];
      
      const newAttempts = currentAttempts.slice(0, -1);
      
      let newInitiator = shootout.initiator;
      if (shootout.homeAttempts.length + shootout.awayAttempts.length === 1) {
          newInitiator = null;
      }

      newState = { ...state, live: { ...state.live,
          shootout: {
            ...shootout,
            initiator: newInitiator,
            [attemptsKey]: newAttempts,
          }
        }
      };
      break;
    }
    case 'FINISH_SHOOTOUT': {
      let finalScore = { ...state.live.score };
      if (state.live.shootout.isActive) {
        const homeGoals = state.live.shootout.homeAttempts.filter(a => a.isGoal === true).length;
        const awayGoals = state.live.shootout.awayAttempts.filter(a => a.isGoal === true).length;

        if (homeGoals > awayGoals) {
          finalScore.home += 1;
        } else if (awayGoals > homeGoals) {
          finalScore.away += 1;
        }
      }
      
      const tempState = { ...state, live: { ...state.live, score: finalScore, shootout: { ...state.live.shootout, isActive: false } }};
      const finalizedState = finalizeMatch(tempState);
      newState = finalizedState;
      toastMessage = { title: "Tanda de Penales Finalizada", description: "El resultado final ha sido actualizado." };
      break;
    }
    case 'UPDATE_SELECTED_FT_PROFILE_DATA': {
      const { selectedFormatAndTimingsProfileId, formatAndTimingsProfiles } = state.config;
      if (!selectedFormatAndTimingsProfileId) break;

      const newProfiles = formatAndTimingsProfiles.map(p => {
          if (p.id === selectedFormatAndTimingsProfileId) {
              return { ...p, ...action.payload };
          }
          return p;
      });

      const updatedState = {
          ...state,
          config: {
              ...state.config,
              formatAndTimingsProfiles: newProfiles,
          },
      };
      
      newState = applyFormatAndTimingsProfileToState(updatedState, selectedFormatAndTimingsProfileId);
      break;
    }
    case 'UPDATE_CONFIG_FIELDS': {
        newState = {
            ...state,
            config: {
                ...state.config,
                ...action.payload,
            }
        };
        break;
    }
    case 'ADD_FORMAT_AND_TIMINGS_PROFILE': 
      newState = { ...state, config: { ...state.config, formatAndTimingsProfiles: [...state.config.formatAndTimingsProfiles, createDefaultFormatAndTimingsProfile(undefined, action.payload.name)] } }; 
      toastMessage = { title: "Perfil Creado", description: `Perfil "${action.payload.name.trim()}" añadido.` };
      break;
    case 'UPDATE_FORMAT_AND_TIMINGS_PROFILE_NAME': 
      newState = { ...state, config: { ...state.config, formatAndTimingsProfiles: state.config.formatAndTimingsProfiles.map(p => p.id === action.payload.profileId ? {...p, name: action.payload.newName} : p) } }; 
      toastMessage = { title: "Nombre de Perfil Actualizado" };
      break;
    case 'DELETE_FORMAT_AND_TIMINGS_PROFILE': {
        let newProfiles = state.config.formatAndTimingsProfiles.filter(p => p.id !== action.payload.profileId);
        if (newProfiles.length === 0) newProfiles = [createDefaultFormatAndTimingsProfile()];
        const newSelectedId = action.payload.profileId === state.config.selectedFormatAndTimingsProfileId ? newProfiles[0].id : state.config.selectedScoreboardLayoutProfileId;
        newState = { ...state, config: { ...state.config, formatAndTimingsProfiles: newProfiles, selectedFormatAndTimingsProfileId: newSelectedId }};
        newState = applyFormatAndTimingsProfileToState(newState, newSelectedId);
        toastMessage = { title: "Perfil Eliminado", variant: "destructive" };
        break;
    }
    case 'SELECT_FORMAT_AND_TIMINGS_PROFILE': {
      newState = applyFormatAndTimingsProfileToState(state, action.payload.profileId);
      break;
    }
    case 'LOAD_FORMAT_AND_TIMINGS_PROFILES': {
        const newProfiles = action.payload.length > 0 ? action.payload : [createDefaultFormatAndTimingsProfile()];
        newState = { ...state, config: { ...state.config, formatAndTimingsProfiles: newProfiles, selectedFormatAndTimingsProfileId: newProfiles[0].id } };
        newState = applyFormatAndTimingsProfileToState(newState, newProfiles[0].id);
        break;
    }
    case 'REORDER_PENALTY_TYPES': {
      if (!state.config.selectedFormatAndTimingsProfileId) break;
      const { startIndex, endIndex } = action.payload;

      const newProfiles = state.config.formatAndTimingsProfiles.map(p => {
        if (p.id === state.config.selectedFormatAndTimingsProfileId) {
          const newPenaltyTypes = [...(p.penaltyTypes || [])];
          const [removed] = newPenaltyTypes.splice(startIndex, 1);
          if(removed) newPenaltyTypes.splice(endIndex, 0, removed);
          return { ...p, penaltyTypes: newPenaltyTypes };
        }
        return p;
      });

      const updatedState = { ...state, config: { ...state.config, formatAndTimingsProfiles: newProfiles }};
      newState = applyFormatAndTimingsProfileToState(updatedState, state.config.selectedFormatAndTimingsProfileId);
      break;
    }
    case 'UPDATE_LAYOUT_SETTINGS': newState = { ...state, config: { ...state.config, scoreboardLayout: { ...state.config.scoreboardLayout, ...action.payload } }}; break;
    case 'SAVE_CURRENT_LAYOUT_TO_PROFILE': {
        if (!state.config.selectedScoreboardLayoutProfileId) break;
        newState = { ...state, config: { ...state.config, scoreboardLayoutProfiles: state.config.scoreboardLayoutProfiles.map(p => p.id === state.config.selectedScoreboardLayoutProfileId ? { ...p, ...state.config.scoreboardLayout } : p) }};
        break;
    }
    case 'ADD_SCOREBOARD_LAYOUT_PROFILE': 
      newState = { ...state, config: { ...state.config, scoreboardLayoutProfiles: [...state.config.scoreboardLayoutProfiles, createDefaultScoreboardLayoutProfile(undefined, action.payload.name)] }}; 
      toastMessage = { title: "Perfil de Diseño Creado", description: `Perfil "${action.payload.name.trim()}" añadido.` };
      break;
    case 'UPDATE_SCOREBOARD_LAYOUT_PROFILE_NAME': 
      newState = { ...state, config: { ...state.config, scoreboardLayoutProfiles: state.config.scoreboardLayoutProfiles.map(p => p.id === action.payload.profileId ? {...p, name: action.payload.newName} : p) }}; 
      toastMessage = { title: "Nombre de Perfil de Diseño Actualizado" };
      break;
    case 'DELETE_SCOREBOARD_LAYOUT_PROFILE': {
        let newProfiles = state.config.scoreboardLayoutProfiles.filter(p => p.id !== action.payload.profileId);
        if (newProfiles.length === 0) newProfiles = [createDefaultScoreboardLayoutProfile()];
        const newSelectedId = action.payload.profileId === state.config.selectedScoreboardLayoutProfileId ? newProfiles[0].id : state.config.selectedScoreboardLayoutProfileId;
        newState = { ...state, config: { ...state.config, scoreboardLayoutProfiles: newProfiles, selectedScoreboardLayoutProfileId: newSelectedId }};
        newState = applyScoreboardLayoutProfileToState(newState, newSelectedId);
        toastMessage = { title: "Perfil de Diseño Eliminado", variant: "destructive" };
        break;
    }
    case 'SELECT_SCOREBOARD_LAYOUT_PROFILE': {
        newState = applyScoreboardLayoutProfileToState(state, action.payload.profileId);
        break;
    }
    case 'LOAD_SOUND_AND_DISPLAY_CONFIG': {
        const { scoreboardLayoutProfiles, ...otherSettings } = action.payload;
        const newProfiles = scoreboardLayoutProfiles && scoreboardLayoutProfiles.length > 0 ? scoreboardLayoutProfiles : [createDefaultScoreboardLayoutProfile()];
        newState = { ...state, config: { ...state.config, ...otherSettings, scoreboardLayoutProfiles: newProfiles, selectedScoreboardLayoutProfileId: newProfiles[0].id }};
        newState = applyScoreboardLayoutProfileToState(newState, newProfiles[0].id);
        break;
    }
    case 'SET_CATEGORIES_FOR_TOURNAMENT': {
        newState = { ...state, config: { ...state.config, tournaments: (state.config.tournaments || []).map(t => t.id === action.payload.tournamentId ? { ...t, categories: action.payload.categories } : t) } };
        break;
    }
    case 'ADD_CATEGORIES_TO_TOURNAMENT': {
        newState = { ...state, config: { ...state.config, tournaments: (state.config.tournaments || []).map(t => t.id === action.payload.tournamentId ? { ...t, categories: [...(t.categories || []), ...action.payload.categories] } : t) } };
        break;
    }
    case 'SET_SELECTED_MATCH_CATEGORY': newState = { ...state, config: { ...state.config, selectedMatchCategory: action.payload } }; toastMessage = { title: "Categoría del Partido Actualizada" }; break;
    case 'UPDATE_TUNNEL_STATE': newState = { ...state, config: { ...state.config, tunnel: { ...state.config.tunnel, ...action.payload } }}; break;
    case 'ADD_TOURNAMENT': {
        const newTournament: Tournament = {
            id: safeUUID(),
            name: action.payload.name,
            status: action.payload.status,
            teams: [],
            categories: [],
            matches: [],
        };
        newState = { ...state, config: { ...state.config, tournaments: [...(state.config.tournaments || []), newTournament] } };
        break;
    }
    case 'UPDATE_TOURNAMENT': {
        newState = { ...state, config: { ...state.config, tournaments: (state.config.tournaments || []).map(t => t.id === action.payload.id ? {...t, ...action.payload} : t) } };
        break;
    }
    case 'DELETE_TOURNAMENT': {
        newState = { ...state, config: { ...state.config, tournaments: (state.config.tournaments || []).filter(t => t.id !== action.payload.id) } };
        break;
    }
    case 'SET_ACTIVE_TOURNAMENT': {
        const selectedTournament = (state.config.tournaments || []).find(t => t.id === action.payload.tournamentId);
        const selectedCategory = (selectedTournament?.categories || [])[0]?.id || '';
        newState = { ...state, config: { ...state.config, selectedTournamentId: action.payload.tournamentId, selectedMatchCategory: selectedCategory } };
        break;
    }
    case 'ADD_MATCH_TO_TOURNAMENT': {
        const { tournamentId, match } = action.payload;
        // Correct way: create a new tournaments array, then map over it.
        const newTournaments = state.config.tournaments.map(t => {
            if (t.id === tournamentId) {
                // Create a new tournament object with a new matches array, ensuring the new match has an ID.
                return { ...t, matches: [...(t.matches || []), { ...match, id: match.id || safeUUID() }] };
            }
            return t;
        });
        newState = { ...state, config: { ...state.config, tournaments: newTournaments } };
        break;
    }
    case 'UPDATE_MATCH_IN_TOURNAMENT': {
        const { tournamentId, match } = action.payload;
        const newTournaments = state.config.tournaments.map(t => {
            if (t.id === tournamentId) {
                // Create a new tournament object with a new matches array
                const newMatches = (t.matches || []).map(m => m.id === match.id ? match : m);
                return { ...t, matches: newMatches };
            }
            return t;
        });
        newState = { ...state, config: { ...state.config, tournaments: newTournaments } };
        break;
    }
    case 'DELETE_MATCH_FROM_TOURNAMENT': {
        const { tournamentId, matchId } = action.payload;
        const newTournaments = state.config.tournaments.map(t => {
             if (t.id === tournamentId) {
                const newMatches = (t.matches || []).filter(m => m.id !== matchId);
                return { ...t, matches: newMatches };
             }
             return t;
        });
        newState = { ...state, config: { ...state.config, tournaments: newTournaments } };
        break;
    }
    case 'SAVE_MATCH_SUMMARY': {
      const { matchId, summary } = action.payload;
      const tournamentId = state.config.selectedTournamentId;
      if (!tournamentId) break;

      const newTournaments = state.config.tournaments.map(t => {
        if (t.id === tournamentId) {
          const newMatches = (t.matches || []).map(m => {
            if (m.id === matchId) {
                // Count physical goals from all periods
                let homeScore = (summary.statsByPeriod || []).reduce((acc, p) => acc + (p.stats.goals.home?.length ?? 0), 0);
                let awayScore = (summary.statsByPeriod || []).reduce((acc, p) => acc + (p.stats.goals.away?.length ?? 0), 0);

                // If there was a shootout, add +1 to the winner (not the total penalty goals)
                if (summary.shootout) {
                    const homeShootoutGoals = summary.shootout.homeAttempts.filter(a => a.isGoal).length;
                    const awayShootoutGoals = summary.shootout.awayAttempts.filter(a => a.isGoal).length;
                    if (homeShootoutGoals > awayShootoutGoals) {
                        homeScore += 1;
                    } else if (awayShootoutGoals > homeShootoutGoals) {
                        awayScore += 1;
                    }
                }

                return { ...m, summary, homeScore, awayScore, overTimeOrShootouts: summary.overTimeOrShootouts };
            }
            return m;
          });
          return { ...t, matches: newMatches };
        }
        return t;
      });
      newState = { ...state, config: { ...state.config, tournaments: newTournaments }};
      break;
    }
    case 'ADD_TEAM_TO_TOURNAMENT': {
        const { tournamentId, team } = action.payload;
        newState = { ...state, config: { ...state.config, tournaments: state.config.tournaments.map(t => {
            if (t.id === tournamentId) {
                const newTeams = [...(t.teams || []), { ...team, id: team.id || safeUUID() }];
                return { ...t, teams: newTeams };
            }
            return t;
        }) } };
        break;
    }
    case 'DELETE_TEAMS_FROM_TOURNAMENT': {
        const { tournamentId, teamIds } = action.payload;
         newState = { ...state, config: { ...state.config, tournaments: state.config.tournaments.map(t => {
            if (t.id === tournamentId) {
                if (!t.teams) return t;
                return { ...t, teams: t.teams.filter(team => !teamIds.includes(team.id)) };
            }
            return t;
         })}};
        break;
    }
    case 'UPDATE_TEAM_DETAILS': {
      const { teamId, ...updates } = action.payload;
      newState = {
        ...state,
        config: {
          ...state.config,
          tournaments: state.config.tournaments.map(t => {
            if (!t.teams) return t; // Safety check
            return {
              ...t,
              teams: t.teams.map(team =>
                team.id === teamId ? { ...team, ...updates } : team
              ),
            };
          }),
        },
      };
      toastMessage = { title: "Equipo Actualizado", description: `El equipo "${updates.name}" ha sido actualizado.` };
      break;
    }
    case 'ADD_PLAYER_TO_TEAM': {
      const { teamId, player } = action.payload;
      newState = { ...state, config: { ...state.config, tournaments: state.config.tournaments.map(t => {
        if (!t.teams) return t;
        return {
          ...t,
          teams: t.teams.map(team =>
            team.id === teamId
              ? { ...team, players: [...(team.players || []), { ...player, id: safeUUID() }] }
              : team
          )
        };
      })}};
      toastMessage = { title: "Jugador Añadido", description: `Jugador ${player.number ? `#${player.number} ` : ''}${player.name} añadido.` };
      break;
    }
    case 'UPDATE_PLAYER_IN_TEAM': {
      const { teamId, playerId, updates } = action.payload;
      newState = {
        ...state,
        config: {
          ...state.config,
          tournaments: state.config.tournaments.map(t => {
            if (!t.teams) return t; // Safety check
            return {
              ...t,
              teams: t.teams.map(team =>
                team.id === teamId
                  ? {
                      ...team,
                      players: team.players.map(p =>
                        p.id === playerId ? { ...p, ...updates } : p
                      ),
                    }
                  : team
              ),
            };
          }),
        },
      };
      break;
    }
    case 'REMOVE_PLAYER_FROM_TEAM': {
      const { teamId, playerId } = action.payload;
      newState = {
        ...state,
        config: {
          ...state.config,
          tournaments: state.config.tournaments.map(t => {
            if (!t.teams) return t; // Safety check
            return {
              ...t,
              teams: t.teams.map(team =>
                team.id === teamId
                  ? {
                      ...team,
                      players: team.players.filter(p => p.id !== playerId),
                    }
                  : team
              ),
            };
          }),
        },
      };
      break;
    }
    case 'SET_TEAM_ATTENDANCE': {
      const { team, playerIds } = action.payload;
      const selectedTournament = state.config.tournaments.find(t => t.id === state.config.selectedTournamentId);
      const teamData = selectedTournament?.teams.find(t => 
        t.name === state.live[`${team}TeamName`] &&
        (t.subName || undefined) === (state.live[`${team}TeamSubName`] || undefined) &&
        t.category === state.config.selectedMatchCategory
      );

      let attendedPlayerInfo: AttendedPlayerInfo[] = [];
      if (teamData) {
        attendedPlayerInfo = teamData.players
          .filter(p => playerIds.includes(p.id))
          .map(p => ({ id: p.id, number: p.number, name: p.name }));
      }
      
      newState = {
        ...state,
        live: {
          ...state.live,
          attendance: {
            ...state.live.attendance,
            [team]: attendedPlayerInfo,
          },
        },
      };
      break;
    }
     case 'UPDATE_LIVE_STATE':
        newState = { ...state, live: { ...state.live, ...action.payload } };
        break;
    case 'RESET_CONFIG_TO_DEFAULTS': {
      const defaultFormatProfile = createDefaultFormatAndTimingsProfile();
      const defaultLayoutParams = createDefaultScoreboardLayoutProfile();
      newState = {
        ...state,
        config: {
          ...state.config,
          ...defaultFormatProfile,
          ...defaultLayoutParams,
          formatAndTimingsProfiles: state.config.formatAndTimingsProfiles.map(p => p.id === state.config.selectedFormatAndTimingsProfileId ? { ...defaultFormatProfile, id: p.id, name: p.name } : p),
          scoreboardLayout: INITIAL_LAYOUT_SETTINGS,
          scoreboardLayoutProfiles: state.config.scoreboardLayoutProfiles.map(p => p.id === state.config.selectedScoreboardLayoutProfileId ? { ...defaultLayoutParams, id: p.id, name: p.name } : p),
          playSoundAtPeriodEnd: IN_CODE_INITIAL_PLAY_SOUND_AT_PERIOD_END,
          customHornSoundDataUrl: IN_CODE_INITIAL_CUSTOM_HORN_SOUND_DATA_URL,
          enablePenaltyCountdownSound: IN_CODE_INITIAL_ENABLE_PENALTY_COUNTDOWN_SOUND,
          penaltyCountdownStartTime: IN_CODE_INITIAL_PENALTY_COUNTDOWN_START_TIME,
          customPenaltyBeepSoundDataUrl: IN_CODE_INITIAL_CUSTOM_PENALTY_BEEP_SOUND_DATA_URL,
          enableTeamSelectionInMiniScoreboard: IN_CODE_INITIAL_ENABLE_TEAM_SELECTION_IN_MINI_SCOREBOARD,
          enablePlayerSelectionForPenalties: IN_CODE_INITIAL_ENABLE_PLAYER_SELECTION_FOR_PENALTIES,
          showAliasInPenaltyPlayerSelector: IN_CODE_INITIAL_SHOW_ALIAS_IN_PENALTY_PLAYER_SELECTOR,
          showAliasInControlsPenaltyList: IN_CODE_INITIAL_SHOW_ALIAS_IN_CONTROLS_PENALTY_LIST,
          showAliasInScoreboardPenalties: IN_CODE_INITIAL_SHOW_ALIAS_IN_SCOREBOARD_PENALTIES,
          enableDebugMode: IN_CODE_INITIAL_ENABLE_DEBUG_MODE,
          showStandingsInWarmup: IN_CODE_INITIAL_SHOW_STANDINGS_IN_WARMUP,
          showShotsData: IN_CODE_INITIAL_SHOW_SHOTS_DATA,
          enableOlympiaTransition: IN_CODE_INITIAL_ENABLE_OLYMPIA_TRANSITION,
          selectedMatchCategory: '', // Resets match category
          tunnel: IN_CODE_INITIAL_TUNNEL_STATE,
          replays: IN_CODE_INITIAL_REPLAYS_SETTINGS,
        }
      };
      toastMessage = { title: "Configuración Restablecida", description: "Todas las configuraciones han vuelto a sus valores predeterminados." };
      break;
    }
    case 'RESET_GAME_STATE': {
      const { defaultWarmUpDuration, autoStartWarmUp } = state.config;
      
      const resetLiveState: LiveState = {
        ...INITIAL_LIVE_DATA,
        clock: {
          ...INITIAL_LIVE_DATA.clock,
          currentTime: defaultWarmUpDuration,
          isClockRunning: autoStartWarmUp && defaultWarmUpDuration > 0,
          clockStartTimeMs: (autoStartWarmUp && defaultWarmUpDuration > 0) ? Date.now() : null,
          remainingTimeAtStartCs: (autoStartWarmUp && defaultWarmUpDuration > 0) ? defaultWarmUpDuration : null,
        },
        playHornTrigger: state.live.playHornTrigger,
        playPenaltyBeepTrigger: state.live.playPenaltyBeepTrigger,
      };
      newState = { ...state, live: resetLiveState };
      break;
    }
  }

  const nonOriginatingActionTypes: GameAction['type'][] = ['HYDRATE_FROM_SERVER', 'HYDRATE_TOURNAMENT_DETAILS', 'SET_STATE_FROM_LOCAL_BROADCAST'];
  if (action.type === 'TICK') return newState;
  if (nonOriginatingActionTypes.includes(action.type)) return { ...newState, _lastActionOriginator: undefined };

  return { ...newState, _lastActionOriginator: TAB_ID, _lastUpdatedTimestamp: newTimestamp, _lastToastMessage: toastMessage };
};

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
        
        dispatch({ type: 'HYDRATE_FROM_SERVER', payload: data });

      } catch (error) {
        console.error("Failed to fetch initial state from server:", error);
        dispatch({ type: 'HYDRATE_FROM_SERVER', payload: getInitialState() });
      } finally {
        setIsLoading(false);
      }
  }, []);

  const fetchTournamentDetails = useCallback(async (tournamentId: string) => {
    try {
        const res = await fetch(`/api/tournaments/${tournamentId}`);
        if (!res.ok) {
            console.warn(`[GameState] Tournament ${tournamentId} not found, clearing selectedTournamentId`);
            // If tournament not found, clear the selectedTournamentId
            dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: { selectedTournamentId: null } });
            return;
        }
        const data = await res.json();
        if (data.tournament) {
            dispatch({ type: 'HYDRATE_TOURNAMENT_DETAILS', payload: { tournamentData: data.tournament }});
        }
    } catch (error) {
        console.error("Error fetching tournament details:", error);
        // On error, also clear the selectedTournamentId to prevent repeated errors
        dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: { selectedTournamentId: null } });
    }
  }, [dispatch]);

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
    const { selectedTournamentId, tournaments } = state.config;
    if (selectedTournamentId) {
        const tournament = tournaments.find(t => t.id === selectedTournamentId);

        // If tournament not found in the array, clear the selectedTournamentId
        if (!tournament) {
            console.warn('[GameState] Selected tournament not found in tournaments array, clearing selectedTournamentId');
            dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: { selectedTournamentId: null } });
            return;
        }

        console.log('[GameState] Selected tournament:', selectedTournamentId, 'Has teams?', !!tournament?.teams);
        // Fetch details only if we don't have them (i.e., no teams or matches array)
        if (!tournament.teams) {
            console.log('[GameState] Fetching tournament details for', selectedTournamentId);
            fetchTournamentDetails(selectedTournamentId);
        }
    }
    // Only trigger when selectedTournamentId changes, NOT when tournaments array changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.config.selectedTournamentId, fetchTournamentDetails]);


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
              if(hasConfigChanged) {
                  const { tournaments, ...baseConfig } = state.config;
                  const tournamentsMeta = (tournaments || []).map(t => ({ id: t.id, name: t.name, status: t.status }));
                  updateConfigOnServer({ ...baseConfig, tournaments: tournamentsMeta });
              }
              // Logic to save individual tournament if it changes
              const changedTournament = state.config.tournaments.find((newTournament, index) => {
                const oldTournament = oldState.config.tournaments.find(t => t.id === newTournament.id);
                return oldTournament && !isEqual(newTournament, oldTournament);
              });

              if(changedTournament) {
                saveTournamentOnServer(changedTournament);
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

// Helper functions are now imported from @/lib/game-helpers
// Re-exported at the top for backward compatibility



    

    









