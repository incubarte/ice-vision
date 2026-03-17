/**
 * Game State Reducer — Helper Functions
 *
 * Pure helper functions used by the main gameReducer in game-state-context.tsx.
 * The actual reducer lives in the context file; these helpers are extracted
 * here so they can be imported without pulling in React dependencies.
 */

import type {
  GameState,
  GameAction,
  LiveState,
  ScoreState,
  Penalty,
  PeriodDisplayOverrideType,
} from '@/types';
import { getPeriodText } from './game-helpers';
import {
  createDefaultFormatAndTimingsProfile,
  createDefaultScoreboardLayoutProfile,
  INITIAL_LAYOUT_SETTINGS,
} from './game-constants';

// Import for recursive calls - will be set by the context
// This is a workaround to avoid circular dependencies
let gameReducerRef: ((state: GameState, action: GameAction) => GameState) | null = null;

export const setGameReducerRef = (reducer: (state: GameState, action: GameAction) => GameState) => {
  gameReducerRef = reducer;
};

/**
 * Calculates absolute time elapsed for a given period
 */
export const calculateAbsoluteTimeForPeriod = (
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
export const finalizeMatch = (state: GameState): GameState => {
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
    // If not set yet (e.g. in tests), we can just return the state with updated live state
    const newState = { ...state, live: finalLiveState };
    if (newState.live.matchId) {
      return {
        ...newState,
        _pendingSummaryGeneration: {
          matchId: newState.live.matchId,
          tournamentId: state.config.selectedTournamentId as string
        }
      };
    }
    return newState;
  }

  let newState = gameReducerRef(state, { type: 'UPDATE_LIVE_STATE', payload: finalLiveState });

  if (newState.live.matchId) {
    return gameReducerRef(newState, {
      type: 'TRIGGER_SUMMARY_GENERATION',
      payload: { matchId: newState.live.matchId },
    });
  }

  return newState;
};

/**
 * Handles automatic transitions between periods, breaks, and game end
 */
export const handleAutoTransition = (currentState: GameState): GameState => {
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
      newGameStateAfterTransition.live.clock.currentPeriod = 1;
      newGameStateAfterTransition.live.clock.currentTime = defaultPeriodDuration;
      newGameStateAfterTransition.live.clock.periodDisplayOverride = null;
      newGameStateAfterTransition.live.clock.isClockRunning = false;
      break;

    case 'Break':
    case 'Pre-OT Break':
      const nextPeriod = currentPeriod + 1;
      newGameStateAfterTransition.live.clock.currentPeriod = nextPeriod;
      newGameStateAfterTransition.live.clock.currentTime =
        nextPeriod > numberOfRegularPeriods ? defaultOTPeriodDuration : defaultPeriodDuration;
      newGameStateAfterTransition.live.clock.periodDisplayOverride = null;
      newGameStateAfterTransition.live.clock.isClockRunning = false;
      break;

    case 'Time Out':
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

      const finishedPeriodText = getPeriodText(currentPeriod, numberOfRegularPeriods);
      let playedPeriods = [...(newGameStateAfterTransition.live.playedPeriods || [])];
      if (!playedPeriods.includes(finishedPeriodText)) {
        playedPeriods.push(finishedPeriodText);
      }
      newGameStateAfterTransition.live.playedPeriods = playedPeriods;

      if (currentPeriod >= totalGamePeriods) {
        if (score.home !== score.away) {
          return finalizeMatch(newGameStateAfterTransition);
        } else {
          newGameStateAfterTransition.live.clock.periodDisplayOverride = 'AwaitingDecision';
          newGameStateAfterTransition.live.shootout.isActive = false;
        }
      } else if (currentPeriod >= numberOfRegularPeriods) {
        if (score.home !== score.away) {
          return finalizeMatch(newGameStateAfterTransition);
        } else {
          newGameStateAfterTransition.live.clock.currentTime = defaultPreOTBreakDuration;
          newGameStateAfterTransition.live.clock.isClockRunning =
            autoStartPreOTBreaks && defaultPreOTBreakDuration > 0;
          newGameStateAfterTransition.live.clock.periodDisplayOverride = 'Pre-OT Break';
        }
      } else {
        newGameStateAfterTransition.live.clock.currentTime = defaultBreakDuration;
        newGameStateAfterTransition.live.clock.isClockRunning =
          autoStartBreaks && defaultBreakDuration > 0;
        newGameStateAfterTransition.live.clock.periodDisplayOverride = 'Break';
      }
      break;

    default:
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
 * Sorts penalties by status (running first, then pending)
 */
const statusOrderValues: Record<NonNullable<Penalty['_status']>, number> = {
  running: 1,
  pending_concurrent: 2,
  pending_puck: 3,
};

export const sortPenaltiesByStatus = (penalties: Penalty[]): Penalty[] => {
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
export const applyFormatAndTimingsProfileToState = (
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
      ...profileToApply,
    },
  };
};

/**
 * Applies a scoreboard layout profile to the state
 */
export const applyScoreboardLayoutProfileToState = (
  state: GameState,
  profileId: string | null
): GameState => {
  const profiles = state.config.scoreboardLayoutProfiles || [];
  const profileToApply =
    profiles.find((p) => p.id === profileId) ||
    profiles[0] ||
    createDefaultScoreboardLayoutProfile();
  if (!profileToApply) return state;

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

