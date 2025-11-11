

"use client";

export interface PenaltyTypeDefinition {
  id: string;
  name: string;
  duration: number;
  reducesPlayerCount: boolean; 
  clearsOnGoal: boolean;      
  isBenchPenalty?: boolean;
}

export interface Penalty {
  id:string;
  playerNumber: string;
  startTime?: number; 
  expirationTime?: number;
  initialDuration: number; 
  _status?: 'running' | 'pending_concurrent' | 'pending_puck'; 
  reducesPlayerCount: boolean;
  clearsOnGoal: boolean;
  isBenchPenalty?: boolean;
  _limitReached?: ('quantity')[];
  _doesNotReducePlayerCountOverride?: boolean;
}

export type Team = 'home' | 'away';
export type PlayerType = 'player' | 'goalkeeper';

export interface PlayerData {
  id: string;
  number: string;
  type: PlayerType;
  name: string; 
}

export interface MatchData {
  id: string;
  date: string; // ISO string
  categoryId: string;
  homeTeamId: string;
  awayTeamId: string;
  playersPerTeam: number;
  summary?: GameSummary;
  homeScore?: number;
  awayScore?: number;
  overTimeOrShootouts?: boolean;
}


export interface TeamData {
  id: string;
  name: string;
  subName?: string; 
  logoDataUrl?: string | null; 
  players: PlayerData[];
  category: string; 
}

export interface Tournament {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'finished';
  teams: TeamData[];
  categories: CategoryData[];
  matches: MatchData[];
}

export interface CategoryData {
  id: string; 
  name: string;
}

export interface FormatAndTimingsProfileData {
  id: string; // Add ID here to ensure it's always part of the data
  name: string; // Add name here for the same reason
  defaultWarmUpDuration: number;
  defaultPeriodDuration: number;
  defaultOTPeriodDuration: number;
  defaultBreakDuration: number;
  defaultPreOTBreakDuration: number;
  defaultTimeoutDuration: number;
  maxConcurrentPenalties: number;
  autoStartWarmUp: boolean;
  autoStartBreaks: boolean;
  autoStartPreOTBreaks: boolean;
  autoStartTimeouts: boolean;
  numberOfRegularPeriods: number;
  numberOfOvertimePeriods: number;
  playersPerTeamOnIce: number;
  penaltyTypes: PenaltyTypeDefinition[];
  defaultPenaltyTypeId: string | null;
  enableMaxPenaltiesLimit: boolean;
  maxPenaltiesPerPlayer: number;
  gameTimeMode: 'running' | 'stopped';
  autoActivatePuckPenalties: boolean;
  enableStoppedTimeAlert: boolean;
  stoppedTimeAlertGoalDiff: number;
  stoppedTimeAlertTimeRemaining: number;
}

export type FormatAndTimingsProfile = FormatAndTimingsProfileData;

export interface ScoreboardLayoutSettings {
  scoreboardVerticalPosition: number;
  scoreboardHorizontalPosition: number;
  clockSize: number;
  teamNameSize: number;
  teamNameWidth: number;
  scoreSize: number;
  periodSize: number;
  playersOnIceIconSize: number;
  categorySize: number;
  teamLabelSize: number;
  penaltiesTitleSize: number;
  penaltyPlayerNumberSize: number;
  penaltyTimeSize: number;
  penaltyPlayerIconSize: number;
  standingsTableFontSize: number;
  standingsTableRowHeight: number;
  teamLogoOpacity: number;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  mainContentGap: number;
  scoreLabelGap: number;
}

export interface ScoreboardLayoutProfile extends ScoreboardLayoutSettings {
  id: string;
  name: string;
}

export interface ReplaySettings {
  syncUrl: string;
  downloadUrlBase: string;
}

export interface GoalLog {
  id: string;
  team: Team;
  timestamp: number; 
  gameTime: number; 
  periodText: string;
  scorer?: {
    playerNumber: string;
    playerName?: string;
  };
  assist?: {
    playerNumber: string;
    playerName?: string;
  };
}

export interface PenaltyLog {
  id: string; 
  team: Team;
  playerNumber: string;
  playerName?: string;
  penaltyName?: string;
  initialDuration: number;
  reducesPlayerCount: boolean;
  clearsOnGoal: boolean;
  isBenchPenalty?: boolean;
  addTimestamp: number;
  addGameTime: number;
  addPeriodText: string;
  endTimestamp?: number;
  endGameTime?: number;
  endPeriodText?: string;
  endReason?: 'completed' | 'deleted' | 'goal_on_pp';
  timeServed?: number;
}

export interface ShotLog {
  id: string;
  team: Team;
  timestamp: number;
  gameTime: number;
  periodText: string;
  playerId: string;
  playerNumber: string;
  playerName?: string;
}

export interface AttendedPlayerInfo {
  id: string;
  number: string;
  name: string;
}

export interface PeriodStats {
  goals: { home: GoalLog[], away: GoalLog[] };
  penalties: { home: PenaltyLog[], away: PenaltyLog[] };
  playerStats: { home: SummaryPlayerStats[], away: SummaryPlayerStats[] };
}

export interface PeriodSummary {
    period: string;
    stats: PeriodStats;
}

// This is the model for post-game summaries. It should be self-contained.
export interface GameSummary {
  attendance: {
    home: AttendedPlayerInfo[];
    away: AttendedPlayerInfo[];
  };
  shootout?: Omit<ShootoutState, 'isActive'>;
  statsByPeriod?: PeriodSummary[];
  overTimeOrShootouts?: boolean;
  playedPeriods: string[];
}


export interface TunnelState {
  subdomain: string | null;
  port: number;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  url: string | null;
  lastMessage: string | null;
}

export interface ConfigFields { // Interface for easier picking of fields
  playSoundAtPeriodEnd: boolean;
  customHornSoundDataUrl: string | null;
  enableTeamSelectionInMiniScoreboard: boolean;
  enablePlayerSelectionForPenalties: boolean;
  showAliasInPenaltyPlayerSelector: boolean;
  showAliasInControlsPenaltyList: boolean;
  showAliasInScoreboardPenalties: boolean;
  enablePenaltyCountdownSound: boolean;
  penaltyCountdownStartTime: number;
  customPenaltyBeepSoundDataUrl: string | null;
  scoreboardLayoutProfiles: ScoreboardLayoutProfile[];
  enableDebugMode: boolean;
  tickIntervalMs: number;
  tunnel: TunnelState;
  replays: ReplaySettings;
  showStandingsInWarmup: boolean;
  showShotsData: boolean;
}

// Separate type for tournaments data (stored in tournaments.json)
export interface TournamentsData {
  tournaments: Tournament[];
}

export interface ConfigState extends Omit<FormatAndTimingsProfileData, 'id' | 'name'>, ConfigFields {
  formatAndTimingsProfiles: FormatAndTimingsProfile[];
  selectedFormatAndTimingsProfileId: string | null;
  scoreboardLayout: ScoreboardLayoutSettings;
  selectedScoreboardLayoutProfileId: string | null;
  tournaments: Tournament[]; // Still part of runtime state, but loaded from tournaments.json
  selectedTournamentId: string | null;
  selectedMatchCategory: string;
}

export type PeriodDisplayOverrideType = 'Warm-up' | 'Break' | 'Pre-OT Break' | 'Time Out' | 'End of Game' | 'Shootout' | 'AwaitingDecision' | null;

export interface PreTimeoutState {
  period: number;
  time: number;
  isClockRunning: boolean;
  override: PeriodDisplayOverrideType;
  clockStartTimeMs: number | null;
  remainingTimeAtStartCs: number | null;
  absoluteElapsedTimeCs: number;
  team: Team; // Team that called the timeout
}

export interface ClockState {
  currentTime: number;
  currentPeriod: number;
  isClockRunning: boolean;
  periodDisplayOverride: PeriodDisplayOverrideType;
  preTimeoutState: PreTimeoutState | null;
  clockStartTimeMs: number | null;
  remainingTimeAtStartCs: number | null;
  absoluteElapsedTimeCs: number;
  _liveAbsoluteElapsedTimeCs: number;
  isFlashingZero?: boolean;
  flashingZeroEndTime?: number;
}

export interface ScoreState {
  home: number;
  away: number;
  homeShots: number;
  awayShots: number;
}

export interface PenaltiesState {
  home: Penalty[];
  away: Penalty[];
}

export interface ShootoutAttempt {
  id: string;
  round: number;
  playerId: string;
  playerNumber: string;
  playerName?: string;
  isGoal: boolean | null; // null for pending, true for goal, false for miss
}

export interface ShootoutState {
  isActive: boolean;
  rounds: number;
  homeAttempts: ShootoutAttempt[];
  awayAttempts: ShootoutAttempt[];
  initiator: Team | null; // Track who started the shootout
}

// This is the model for live, in-game data
export interface LiveState {
  clock: ClockState;
  score: ScoreState;
  penalties: PenaltiesState;
  goals: { home: GoalLog[], away: GoalLog[] };
  penaltiesLog: { home: PenaltyLog[], away: PenaltyLog[] };
  shotsLog: { home: ShotLog[], away: ShotLog[] };
  attendance: { home: AttendedPlayerInfo[], away: AttendedPlayerInfo[] };
  shootout: ShootoutState;
  homeTeamName: string;
  homeTeamSubName?: string;
  awayTeamName: string;
  awayTeamSubName?: string;
  playHornTrigger: number;
  playPenaltyBeepTrigger: number;
  pendingPowerPlayGoal: {
    team: Team; // The team that conceded the goal (and has the penalty)
    penaltyId: string;
  } | null;
  overlayMessage: {
    id: string;
    text: string;
    duration: number; // in milliseconds
  } | null;
  replayLoadRequest: {
    id: string;
    url: string; // The original URL, not a blob
  } | null;
  replayOverlay: {
    id: string;
    url: string;
  } | null;
  goalCelebration: {
    id: string;
    goal: GoalLog;
    teamData?: TeamData;
  } | null;
  matchId: string | null;
  playedPeriods: string[];
}

export interface LiveGameState extends LiveState {
    playersPerTeamOnIce?: number; 
    numberOfRegularPeriods?: number;
    // These optional fields are for backward compatibility during transitions.
    // They will be derived from the selected tournament's data.
    teams?: TeamData[];
    availableCategories?: CategoryData[]; 
    selectedMatchCategory?: string;
    penaltyTypes?: PenaltyTypeDefinition[];
    defaultPenaltyTypeId?: string | null;
}

export interface MobileData {
    gameState: LiveGameState | null;
    penaltyConfig: {
        penaltyTypes: PenaltyTypeDefinition[];
        defaultPenaltyTypeId: string | null;
    }
}


// --- Auth Challenge ---
export interface AccessRequest {
    id: string;
    ip: string;
    timestamp: number;
    userAgent?: string;
    verificationNumber: number;
    approved: boolean;
}


// --- Remote Commands ---
export type RemoteCommand =
  | { type: 'SHOW_OVERLAY_MESSAGE'; payload: { text: string; duration: number } }
  | { type: 'START_LOADING_REPLAY'; payload: { url: string; startTimeSeconds?: number } }
  | { type: 'ADD_GOAL'; payload: { team: Team; scorerNumber: string; assistNumber?: string } }
  | { type: 'ADD_SHOT'; payload: { team: Team; playerNumber: string } }
  | { type: 'ADD_PENALTY'; payload: { team: Team; playerNumber: string; penaltyTypeId: string; } }
  | { type: 'ACTIVATE_PENDING_PUCK_PENALTIES' };


export type GameAction =
  | { type: 'SHOW_OVERLAY_MESSAGE'; payload: { text: string, duration: number } }
  | { type: 'HIDE_OVERLAY_MESSAGE' }
  | { type: 'START_LOADING_REPLAY'; payload: { url: string; startTimeSeconds?: number } }
  | { type: 'SHOW_REPLAY_OVERLAY'; payload: { url: string; startTimeSeconds?: number } }
  | { type: 'HIDE_REPLAY_OVERLAY' }
  | { type: 'SHOW_GOAL_CELEBRATION'; payload: { goal: GoalLog, teamData?: TeamData } }
  | { type: 'HIDE_GOAL_CELEBRATION' }
  | { type: 'TOGGLE_CLOCK' }
  | { type: 'SET_TIME'; payload: { minutes: number; seconds: number } }
  | { type: 'ADJUST_TIME'; payload: number }
  | { type: 'SET_PERIOD'; payload: number }
  | { type: 'RESET_PERIOD_CLOCK' }
  | { type: 'ADD_GOAL'; payload: Omit<GoalLog, 'id'| 'periodText'> & { periodText?: string } }
  | { type: 'EDIT_GOAL'; payload: { goalId: string; updates: Partial<GoalLog> } }
  | { type: 'DELETE_GOAL'; payload: { goalId: string } }
  | { type: 'ADD_PLAYER_SHOT'; payload: { team: Team; playerNumber: string } }
  | { type: 'FINISH_GAME_WITH_OT_GOAL'; payload: Omit<GoalLog, 'id'> }
  | { type: 'ADD_PENALTY'; payload: { team: Team; penalty: { playerNumber: string; penaltyTypeId: string; }, addGameTime?: number, addPeriodText?: string } }
  | { type: 'REMOVE_PENALTY'; payload: { team: Team; penaltyId: string } }
  | { type: 'DELETE_PENALTY_LOG', payload: { team: Team, logId: string } }
  | { type: 'END_PENALTY_FOR_GOAL'; payload: { team: Team; penaltyId: string } }
  | { type: 'CLEAR_PENDING_POWER_PLAY_GOAL' }
  | { type: 'TOGGLE_PENALTY_PLAYER_REDUCTION'; payload: { team: Team; penaltyId: string } }
  | { type: 'ADJUST_PENALTY_TIME'; payload: { team: Team; penaltyId: string; delta: number } }
  | { type: 'SET_PENALTY_TIME'; payload: { team: Team; penaltyId: string; time: number } }
  | { type: 'REORDER_PENALTIES'; payload: { team: Team; startIndex: number; endIndex: number } }
  | { type: 'ACTIVATE_PENDING_PUCK_PENALTIES' }
  | { type: 'TICK' }
  | { type: 'SET_HOME_TEAM_NAME'; payload: string }
  | { type: 'SET_HOME_TEAM_SUB_NAME'; payload?: string }
  | { type: 'SET_AWAY_TEAM_NAME'; payload: string }
  | { type: 'SET_AWAY_TEAM_SUB_NAME'; payload?: string }
  | { type: 'START_BREAK' }
  | { type: 'START_PRE_OT_BREAK' }
  | { type: 'START_BREAK_AFTER_PREVIOUS_PERIOD' }
  | { type: 'START_TIMEOUT'; payload: { team: Team } }
  | { type: 'END_TIMEOUT' }
  | { type: 'MANUAL_END_GAME' }
  | { type: 'ADD_EXTRA_OVERTIME' }
  | { type: 'START_SHOOTOUT' }
  | { type: 'UPDATE_SHOOTOUT_ROUNDS'; payload: number }
  | { type: 'RECORD_SHOOTOUT_ATTEMPT'; payload: { team: Team; playerId: string; playerNumber: string; playerName?: string; isGoal: boolean; } }
  | { type: 'UNDO_LAST_SHOOTOUT_ATTEMPT'; payload: { team: Team } }
  | { type: 'FINISH_SHOOTOUT' }
  | { type: 'ADD_FORMAT_AND_TIMINGS_PROFILE'; payload: { name: string; profileData?: Partial<FormatAndTimingsProfileData> } }
  | { type: 'UPDATE_SELECTED_FT_PROFILE_DATA', payload: Partial<FormatAndTimingsProfileData> }
  | { type: 'UPDATE_FORMAT_AND_TIMINGS_PROFILE_NAME'; payload: { profileId: string; newName: string } }
  | { type: 'REORDER_PENALTY_TYPES'; payload: { startIndex: number; endIndex: number } }
  | { type: 'DELETE_FORMAT_AND_TIMINGS_PROFILE'; payload: { profileId: string } }
  | { type: 'SELECT_FORMAT_AND_TIMINGS_PROFILE'; payload: { profileId: string | null } }
  | { type: 'LOAD_FORMAT_AND_TIMINGS_PROFILES'; payload: FormatAndTimingsProfile[] }
  | { type: 'UPDATE_CONFIG_FIELDS'; payload: Partial<ConfigState> }
  | { type: 'UPDATE_LAYOUT_SETTINGS'; payload: Partial<ScoreboardLayoutSettings> }
  | { type: 'ADD_SCOREBOARD_LAYOUT_PROFILE'; payload: { name: string } }
  | { type: 'UPDATE_SCOREBOARD_LAYOUT_PROFILE_NAME'; payload: { profileId: string; newName: string } }
  | { type: 'DELETE_SCOREBOARD_LAYOUT_PROFILE'; payload: { profileId: string } }
  | { type: 'SELECT_SCOREBOARD_LAYOUT_PROFILE'; payload: { profileId: string } }
  | { type: 'SAVE_CURRENT_LAYOUT_TO_PROFILE' }
  | { type: 'LOAD_SOUND_AND_DISPLAY_CONFIG'; payload: Partial<Pick<ConfigState, 'playSoundAtPeriodEnd' | 'customHornSoundDataUrl' | 'enableTeamSelectionInMiniScoreboard' | 'enablePlayerSelectionForPenalties' | 'showAliasInPenaltyPlayerSelector' | 'showAliasInControlsPenaltyList' | 'showAliasInScoreboardPenalties' | 'scoreboardLayoutProfiles' | 'enablePenaltyCountdownSound' | 'penaltyCountdownStartTime' | 'customPenaltyBeepSoundDataUrl' | 'enableDebugMode' | 'tunnel' | 'replays'>> }
  | { type: 'SET_CATEGORIES_FOR_TOURNAMENT'; payload: { tournamentId: string, categories: CategoryData[] } }
  | { type: 'ADD_CATEGORIES_TO_TOURNAMENT'; payload: { tournamentId: string, categories: CategoryData[] } }
  | { type: 'SET_SELECTED_MATCH_CATEGORY'; payload: string }
  | { type: 'UPDATE_TUNNEL_STATE'; payload: Partial<TunnelState> }
  | { type: 'ADD_TOURNAMENT'; payload: { name: string; status: Tournament['status'] } }
  | { type: 'UPDATE_TOURNAMENT'; payload: { id: string; name: string; status: Tournament['status'] } }
  | { type: 'DELETE_TOURNAMENT'; payload: { id: string } }
  | { type: 'SET_ACTIVE_TOURNAMENT'; payload: { tournamentId: string | null } }
  | { type: 'ADD_MATCH_TO_TOURNAMENT'; payload: { tournamentId: string; match: Omit<MatchData, 'id'> & {id: string} } }
  | { type: 'UPDATE_MATCH_IN_TOURNAMENT'; payload: { tournamentId: string; match: MatchData } }
  | { type: 'DELETE_MATCH_FROM_TOURNAMENT'; payload: { tournamentId: string; matchId: string } }
  | { type: 'SAVE_MATCH_SUMMARY'; payload: { matchId: string; summary: GameSummary; } }
  | { type: 'HYDRATE_FROM_SERVER'; payload: Partial<GameState> }
  | { type: 'HYDRATE_TOURNAMENT_DETAILS', payload: { tournamentData: Partial<Tournament> } }
  | { type: 'SET_STATE_FROM_LOCAL_BROADCAST'; payload: GameState }
  | { type: 'UPDATE_LIVE_STATE', payload: Partial<LiveState> }
  | { type: 'RESET_CONFIG_TO_DEFAULTS' }
  | { type: 'RESET_GAME_STATE' }
  | { type: 'ADD_TEAM_TO_TOURNAMENT'; payload: { tournamentId: string, team: Omit<TeamData, 'id'> & { id?: string } } }
  | { type: 'DELETE_TEAMS_FROM_TOURNAMENT'; payload: { tournamentId: string, teamIds: string[] } }
  | { type: 'UPDATE_TEAM_DETAILS'; payload: { teamId: string; name: string; subName?: string; category: string; logoDataUrl?: string | null } }
  | { type: 'ADD_PLAYER_TO_TEAM'; payload: { teamId: string; player: Omit<PlayerData, 'id'> } }
  | { type: 'UPDATE_PLAYER_IN_TEAM'; payload: { teamId: string; playerId: string; updates: Partial<Pick<PlayerData, 'name' | 'number'>> } }
  | { type: 'REMOVE_PLAYER_FROM_TEAM'; payload: { teamId: string; playerId: string } }
  | { type: 'SET_TEAM_ATTENDANCE'; payload: { team: Team; playerIds: string[] } }
  | { type: 'SET_PLAYER_SHOTS'; payload: { team: Team; playerId: string; periodText: string; shotCount: number } };


export interface GameState {
  config: ConfigState;
  live: LiveState;
  _initialConfigLoadComplete: boolean;
  _lastActionOriginator?: string;
  _lastUpdatedTimestamp?: number;
  _lastToastMessage?: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  } | null;
}


// --- Type for player stats within the summary component ---
export interface SummaryPlayerStats {
  id: string;
  number: string;
  name: string;
  goals: number;
  assists: number;
  shots: number;
}
