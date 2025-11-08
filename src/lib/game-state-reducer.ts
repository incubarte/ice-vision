/**
 * Game State Reducer
 * Handles all state transitions for the hockey scoreboard game state
 */

import type {
  GameState,
  GameAction,
  LiveState,
  ScoreState,
  Penalty,
  PeriodDisplayOverrideType,
  PenaltyTypeDefinition,
  ClockState,
} from '@/types';
import { safeUUID } from './utils';
import defaultSettings from '@/config/defaults.json';
import { getPeriodText, getActualPeriodText, formatTime } from './game-helpers';
import {
  createDefaultFormatAndTimingsProfile,
  createDefaultScoreboardLayoutProfile,
  INITIAL_LAYOUT_SETTINGS,
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
  IN_CODE_INITIAL_TUNNEL_STATE,
  IN_CODE_INITIAL_REPLAYS_SETTINGS,
  CENTISECONDS_PER_SECOND,
} from './game-constants';
import { generateSummaryData } from './summary-generator';

// Import for recursive calls - will be set by the context
// This is a workaround to avoid circular dependencies
let gameReducerRef: ((state: GameState, action: GameAction) => GameState) | null = null;

export const setGameReducerRef = (reducer: (state: GameState, action: GameAction) => GameState) => {
  gameReducerRef = reducer;
};

/**
 * Calculates absolute time elapsed for a given period
 */
const calculateAbsoluteTimeForPeriod = (
  targetPeriod: number,
  remainingTimeInPeriodCs: number,
  state: GameState
): number => {
  if (targetPeriod <= 0) {
    return 0;
  }

  let totalElapsedCs = 0;
  const { numberOfRegularPeriods, defaultPeriodDuration, defaultOTPeriodDuration } = state.config;

  for (let i = 1; i < targetPeriod; i++) {
    totalElapsedCs += i <= numberOfRegularPeriods ? defaultPeriodDuration : defaultOTPeriodDuration;
  }

  const currentPeriodDuration =
    targetPeriod <= numberOfRegularPeriods ? defaultPeriodDuration : defaultOTPeriodDuration;
  totalElapsedCs += currentPeriodDuration - remainingTimeInPeriodCs;

  return Math.max(0, totalElapsedCs);
};

/**
 * Finalizes the match when it ends
 */
const finalizeMatch = (state: GameState): GameState => {
  const newAbsoluteTime = calculateAbsoluteTimeForPeriod(state.live.clock.currentPeriod, 0, state);

  const finishedPeriodText = getPeriodText(
    state.live.clock.currentPeriod,
    state.config.numberOfRegularPeriods
  );
  let playedPeriods = [...(state.live.playedPeriods || [])];
  if (!playedPeriods.includes(finishedPeriodText)) {
    playedPeriods.push(finishedPeriodText);
  }

  // Use the current score (which may include shootout winner bonus)
  // Only update goals count, but respect home/away scores that may have been adjusted
  const finalScore: ScoreState = {
    ...state.live.score,
    homeShots: state.live.score.homeShots,
    awayShots: state.live.score.awayShots,
  };

  const finalLiveState: LiveState = {
    ...state.live,
    score: finalScore,
    playedPeriods,
    clock: {
      ...state.live.clock,
      currentTime: 0,
      isClockRunning: false,
      periodDisplayOverride: 'End of Game' as PeriodDisplayOverrideType,
      absoluteElapsedTimeCs: newAbsoluteTime,
      _liveAbsoluteElapsedTimeCs: newAbsoluteTime,
      clockStartTimeMs: null,
      remainingTimeAtStartCs: null,
      preTimeoutState: null,
    },
    playHornTrigger: state.live.playHornTrigger + 1,
  };

  if (!gameReducerRef) {
    throw new Error('gameReducerRef not set. Call setGameReducerRef() first.');
  }

  let newState = gameReducerRef(state, { type: 'UPDATE_LIVE_STATE', payload: finalLiveState });

  if (newState.live.matchId) {
    const summary = generateSummaryData(newState);
    if (summary) {
      // Return a new state that includes the summary to be saved
      return gameReducerRef(newState, {
        type: 'SAVE_MATCH_SUMMARY',
        payload: { matchId: newState.live.matchId, summary },
      });
    }
  }

  return newState;
};

/**
 * Handles automatic transitions between periods, breaks, and game end
 */
const handleAutoTransition = (currentState: GameState): GameState => {
  let newGameStateAfterTransition: GameState = JSON.parse(JSON.stringify(currentState));
  const {
    numberOfRegularPeriods,
    numberOfOvertimePeriods,
    defaultBreakDuration,
    defaultPreOTBreakDuration,
    autoStartBreaks,
    autoStartPreOTBreaks,
    defaultPeriodDuration,
    defaultOTPeriodDuration,
  } = currentState.config;
  const { currentPeriod, periodDisplayOverride, preTimeoutState } = currentState.live.clock;
  const { score } = currentState.live;
  const totalGamePeriods = numberOfRegularPeriods + numberOfOvertimePeriods;

  switch (periodDisplayOverride) {
    case 'Warm-up':
      // Warm-up ends, start Period 1 (paused)
      newGameStateAfterTransition.live.clock.currentPeriod = 1;
      newGameStateAfterTransition.live.clock.currentTime = defaultPeriodDuration;
      newGameStateAfterTransition.live.clock.periodDisplayOverride = null;
      newGameStateAfterTransition.live.clock.isClockRunning = false;
      break;

    case 'Break':
    case 'Pre-OT Break':
      // A break ends, start the next period (paused)
      const nextPeriod = currentPeriod + 1;
      newGameStateAfterTransition.live.clock.currentPeriod = nextPeriod;
      newGameStateAfterTransition.live.clock.currentTime =
        nextPeriod > numberOfRegularPeriods ? defaultOTPeriodDuration : defaultPeriodDuration;
      newGameStateAfterTransition.live.clock.periodDisplayOverride = null;
      newGameStateAfterTransition.live.clock.isClockRunning = false;
      break;

    case 'Time Out':
      // A timeout ends, restore previous state (paused)
      if (preTimeoutState) {
        newGameStateAfterTransition.live.clock = {
          ...currentState.live.clock,
          currentPeriod: preTimeoutState.period,
          currentTime: preTimeoutState.time,
          isClockRunning: false,
          periodDisplayOverride: preTimeoutState.override,
          absoluteElapsedTimeCs: preTimeoutState.absoluteElapsedTimeCs,
          _liveAbsoluteElapsedTimeCs: preTimeoutState.absoluteElapsedTimeCs,
          preTimeoutState: null,
        };
      }
      break;

    case null: // A game period ends
      const newAbsoluteTime = calculateAbsoluteTimeForPeriod(currentPeriod, 0, currentState);
      newGameStateAfterTransition.live.clock.absoluteElapsedTimeCs = newAbsoluteTime;
      newGameStateAfterTransition.live.clock._liveAbsoluteElapsedTimeCs = newAbsoluteTime;

      // Add the just-finished period to the played periods list
      const finishedPeriodText = getPeriodText(currentPeriod, numberOfRegularPeriods);
      let playedPeriods = [...(newGameStateAfterTransition.live.playedPeriods || [])];
      if (!playedPeriods.includes(finishedPeriodText)) {
        playedPeriods.push(finishedPeriodText);
      }
      newGameStateAfterTransition.live.playedPeriods = playedPeriods;

      // Check for end of regulation or last OT
      if (currentPeriod >= totalGamePeriods) {
        if (score.home !== score.away) {
          // Game ends, no tie. Call the finalizer.
          return finalizeMatch(newGameStateAfterTransition);
        } else {
          // Tie game, go to pre-end decision state
          newGameStateAfterTransition.live.clock.periodDisplayOverride = 'AwaitingDecision';
          newGameStateAfterTransition.live.shootout.isActive = false;
        }
      } else if (currentPeriod >= numberOfRegularPeriods) {
        // It's a regular OT period that ended (but not the last one)
        if (score.home !== score.away) {
          // Golden goal situation in a non-final OT, game is over
          return finalizeMatch(newGameStateAfterTransition);
        } else {
          // Start a pre-OT break before the next OT
          newGameStateAfterTransition.live.clock.currentTime = defaultPreOTBreakDuration;
          newGameStateAfterTransition.live.clock.isClockRunning =
            autoStartPreOTBreaks && defaultPreOTBreakDuration > 0;
          newGameStateAfterTransition.live.clock.periodDisplayOverride = 'Pre-OT Break';
        }
      } else {
        // End of a regular period, not the final one
        newGameStateAfterTransition.live.clock.currentTime = defaultBreakDuration;
        newGameStateAfterTransition.live.clock.isClockRunning =
          autoStartBreaks && defaultBreakDuration > 0;
        newGameStateAfterTransition.live.clock.periodDisplayOverride = 'Break';
      }
      break;

    default: // No transition, e.g. "End of Game"
      break;
  }

  if (!newGameStateAfterTransition.live.clock.isClockRunning) {
    newGameStateAfterTransition.live.clock.clockStartTimeMs = null;
    newGameStateAfterTransition.live.clock.remainingTimeAtStartCs = null;
  } else {
    newGameStateAfterTransition.live.clock.clockStartTimeMs = Date.now();
    newGameStateAfterTransition.live.clock.remainingTimeAtStartCs =
      newGameStateAfterTransition.live.clock.currentTime;
  }

  newGameStateAfterTransition.live.clock.isFlashingZero = false;
  newGameStateAfterTransition.live.clock.flashingZeroEndTime = undefined;

  return newGameStateAfterTransition;
};

/**
 * Status order for sorting penalties
 */
const statusOrderValues: Record<NonNullable<Penalty['_status']>, number> = {
  running: 1,
  pending_concurrent: 2,
  pending_puck: 3,
};

/**
 * Sorts penalties by status (running first, then pending)
 */
const sortPenaltiesByStatus = (penalties: Penalty[]): Penalty[] => {
  const penaltiesToSort = [...penalties];
  return penaltiesToSort.sort((a, b) => {
    if (!a.reducesPlayerCount && b.reducesPlayerCount) return 1;
    if (a.reducesPlayerCount && !b.reducesPlayerCount) return -1;

    const aStatusVal = a._status ? statusOrderValues[a._status] ?? 5 : 0;
    const bStatusVal = b._status ? statusOrderValues[b._status] ?? 5 : 0;
    if (aStatusVal !== bStatusVal) return aStatusVal - bStatusVal;
    return 0;
  });
};

/**
 * Applies a format and timings profile to the state
 */
const applyFormatAndTimingsProfileToState = (
  state: GameState,
  profileId: string | null
): GameState => {
  const profiles = state.config.formatAndTimingsProfiles || [];
  const profileToApply =
    profiles.find((p) => p.id === profileId) || profiles[0] || createDefaultFormatAndTimingsProfile();
  if (!profileToApply) return state;

  return {
    ...state,
    config: {
      ...state.config,
      selectedFormatAndTimingsProfileId: profileToApply.id,
      // Apply all settings from the profile to the main config object
      ...profileToApply,
    },
  };
};

/**
 * Applies a scoreboard layout profile to the state
 */
const applyScoreboardLayoutProfileToState = (
  state: GameState,
  profileId: string | null
): GameState => {
  const profiles = state.config.scoreboardLayoutProfiles || [];
  const profileToApply =
    profiles.find((p) => p.id === profileId) ||
    profiles[0] ||
    createDefaultScoreboardLayoutProfile();
  if (!profileToApply) return state;

  // Ensure all properties from INITIAL_LAYOUT_SETTINGS have a default
  const layoutSettingsWithDefaults = {
    ...INITIAL_LAYOUT_SETTINGS,
    ...profileToApply,
  };

  const { id, name, ...layoutSettings } = layoutSettingsWithDefaults;

  return {
    ...state,
    config: {
      ...state.config,
      selectedScoreboardLayoutProfileId: id,
      scoreboardLayout: layoutSettings,
    },
  };
};

// Export helper functions for testing
export {
  calculateAbsoluteTimeForPeriod,
  finalizeMatch,
  handleAutoTransition,
  sortPenaltiesByStatus,
  applyFormatAndTimingsProfileToState,
  applyScoreboardLayoutProfileToState,
};
