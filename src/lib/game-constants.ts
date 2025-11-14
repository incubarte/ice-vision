/**
 * Constants for game state management
 * Extracted from game-state-context.tsx
 */

import type { ScoreboardLayoutSettings, ReplaySettings, TunnelState, FormatAndTimingsProfile, ScoreboardLayoutProfile, PenaltyTypeDefinition } from '@/types';
import defaultSettings from '@/config/defaults.json';
import { safeUUID } from '@/lib/utils';

// Broadcast channel for cross-tab synchronization
export const BROADCAST_CHANNEL_NAME = 'icevision-game-state-channel';
export const SUMMARY_DATA_STORAGE_KEY = 'icevision-summary-data';

// Time constants (exported for internal use)
const CENTISECONDS_PER_SECOND = 100;
export const FLASHING_ZERO_DURATION_MS = 5000;
export { CENTISECONDS_PER_SECOND };

// Audio paths
export const DEFAULT_HORN_SOUND_PATH = '/audio/default-horn.wav';
export const DEFAULT_PENALTY_BEEP_PATH = '/audio/penalty_beep.wav';

// Initial profile names
export const IN_CODE_INITIAL_PROFILE_NAME = "Predeterminado (App)";
export const IN_CODE_INITIAL_LAYOUT_PROFILE_NAME = "Diseño Predeterminado (App)";

// Sound and Display Defaults
export const IN_CODE_INITIAL_PLAY_SOUND_AT_PERIOD_END = true;
export const IN_CODE_INITIAL_CUSTOM_HORN_SOUND_DATA_URL = null;
export const IN_CODE_INITIAL_ENABLE_TEAM_SELECTION_IN_MINI_SCOREBOARD = true;
export const IN_CODE_INITIAL_ENABLE_PLAYER_SELECTION_FOR_PENALTIES = true;
export const IN_CODE_INITIAL_SHOW_ALIAS_IN_PENALTY_PLAYER_SELECTOR = true;
export const IN_CODE_INITIAL_SHOW_ALIAS_IN_CONTROLS_PENALTY_LIST = true;
export const IN_CODE_INITIAL_SHOW_ALIAS_IN_SCOREBOARD_PENALTIES = true;
export const IN_CODE_INITIAL_ENABLE_PENALTY_COUNTDOWN_SOUND = true;
export const IN_CODE_INITIAL_PENALTY_COUNTDOWN_START_TIME = 10;
export const IN_CODE_INITIAL_CUSTOM_PENALTY_BEEP_SOUND_DATA_URL = null;
export const IN_CODE_INITIAL_ENABLE_DEBUG_MODE = false;
export const IN_CODE_INITIAL_CHROME_BINARY_PATH = "/opt/google/chrome/google-chrome";
export const IN_CODE_INITIAL_SHOW_STANDINGS_IN_WARMUP = true;
export const IN_CODE_INITIAL_SHOW_SHOTS_DATA = process.env.NEXT_PUBLIC_SHOW_PLAYER_STATS === 'false' ? false : true;
export const IN_CODE_INITIAL_ENABLE_OLYMPIA_TRANSITION = process.env.NEXT_PUBLIC_ENABLE_OLYMPIA_TRANSITION === 'false' ? false : true;

export const IN_CODE_INITIAL_TUNNEL_STATE: TunnelState = {
  subdomain: defaultSettings.tunnel.subdomainPrefix,
  port: defaultSettings.tunnel.port,
  status: 'disconnected',
  url: null,
  lastMessage: null,
};

export const INITIAL_LAYOUT_SETTINGS: ScoreboardLayoutSettings = {
  scoreboardVerticalPosition: -4,
  scoreboardHorizontalPosition: 0,
  clockSize: 12,
  teamNameSize: 3,
  teamNameWidth: 16,
  scoreSize: 8,
  periodSize: 4.5,
  playersOnIceIconSize: 1.75,
  categorySize: 1.25,
  teamLabelSize: 1,
  penaltiesTitleSize: 2,
  penaltyPlayerNumberSize: 3.5,
  penaltyTimeSize: 3.5,
  penaltyPlayerIconSize: 2.5,
  standingsTableFontSize: 1.8,
  standingsTableRowHeight: 4.25,
  teamLogoOpacity: 10,
  primaryColor: '223 65% 33%',
  accentColor: '40 100% 67%',
  backgroundColor: '223 70% 11%',
  mainContentGap: 3,
  scoreLabelGap: -2,
};

export const IN_CODE_INITIAL_REPLAYS_SETTINGS: ReplaySettings = {
  syncUrl: "https://hockeando-default-rtdb.firebaseio.com/Replays.json",
  downloadUrlBase: "https://firebasestorage.googleapis.com/v0/b/hockeando.appspot.com/o/"
};

export const IN_CODE_INITIAL_TOURNAMENT_NAME = "torneito";

/**
 * Creates a default format and timings profile
 */
export const createDefaultFormatAndTimingsProfile = (id?: string, name?: string): FormatAndTimingsProfile => ({
  id: id || safeUUID(),
  name: name || IN_CODE_INITIAL_PROFILE_NAME,
  ...defaultSettings.formatAndTimings,
  gameTimeMode: 'stopped',
  autoActivatePuckPenalties: true,
  enableStoppedTimeAlert: false,
  stoppedTimeAlertGoalDiff: 1,
  stoppedTimeAlertTimeRemaining: 2,
  penaltyTypes: defaultSettings.penaltyTypes.map(p => ({
    ...p,
    reducesPlayerCount: p.reducesPlayerCount,
    clearsOnGoal: p.clearsOnGoal,
    isBenchPenalty: p.isBenchPenalty || false,
  })) as PenaltyTypeDefinition[],
  defaultPenaltyTypeId: defaultSettings.defaultPenaltyTypeId,
});

/**
 * Creates a default scoreboard layout profile
 */
export const createDefaultScoreboardLayoutProfile = (id?: string, name?: string): ScoreboardLayoutProfile => ({
  id: id || safeUUID(),
  name: name || IN_CODE_INITIAL_LAYOUT_PROFILE_NAME,
  ...INITIAL_LAYOUT_SETTINGS
});
