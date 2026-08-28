

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
  id: string;
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

export interface MatchExpulsion {
  id: string;
  team: Team;
  playerNumber: string;
  playerName?: string;
  gameTime: number;
  periodText: string;
  timestamp: number;
}

export type Team = 'home' | 'away';
export type PlayerType = 'player' | 'goalkeeper';

export interface PlayerData {
  id: string;
  number: string;
  type: PlayerType;
  name: string;
  photoFileName?: string; // Optional filename for player photo (e.g., "john_doe_a3f2.png")
  celebrationVideoFileName?: string; // Optional .webm filename for goal celebration animation
  celebrationMediaType?: 'photo' | 'video' | 'none'; // What to show in goal celebration (default: none)
}

export type MatchPhase = 'clasificacion' | 'playoffs' | 'playoffs-5-8' | 'relegation';
export type PlayoffMatchType = 'semifinal' | 'final' | '3er-puesto';
export type PlayoffMatchup = '1vs2' | '1vs3' | '1vs4' | '2vs3' | '2vs4' | '3vs4'; // Para semifinales
export type Playoff58MatchType = 'semifinal' | 'final' | '3er-puesto';
export type Playoff58Matchup = '5vs8' | '6vs7'; // Para semifinales del mini-torneo 5°-8°

export interface MatchData {
  id: string;
  date: string; // ISO string
  categoryId: string;
  homeTeamId?: string; // Opcional para playoffs - ID del equipo real
  awayTeamId?: string; // Opcional para playoffs - ID del equipo real
  playersPerTeam: number;
  summary?: GameSummary;
  phase: MatchPhase; // Clasificación, Playoffs, Playoffs 5-8, o Relegation
  playoffType?: PlayoffMatchType; // Solo para partidos de playoffs (ganadores)
  playoffMatchup?: PlayoffMatchup; // Solo para semifinales ganadores (ej: '1vs4')
  playoff58Type?: Playoff58MatchType; // Solo para playoffs-5-8
  playoff58Matchup?: Playoff58Matchup; // Solo para semifinales de playoffs-5-8
  playoff58Name?: string; // Nombre del mini-torneo (ej: 'Copa Plata'), bloqueado una vez definido
  // Note: Score and overtime info are calculated from summary using match-helpers
  // Note: Staff is stored in summary.staff, not in MatchData
}


export interface TeamData {
  id: string;
  name: string;
  subName?: string;
  logoDataUrl?: string | null;
  players: PlayerData[];
  category: string;
}

export type SanctionType = 'calendar_days' | 'matches' | 'pending_review';

export interface DisciplinarySanction {
  id: string;
  playerId: string;
  playerName: string;   // denormalized
  playerNumber: string; // denormalized
  teamId: string;
  categoryId: string;
  reason?: string;
  startDate: string;    // YYYY-MM-DD
  sanctionType: SanctionType;
  sanctionValue?: number; // calendar days OR number of matches missed
  notes?: string;
  createdAt: string;    // ISO
}

export interface SummarySanctionedPlayer {
  playerId: string;
  playerName: string;
  playerNumber: string;
  teamId: string;
  sanctionId: string;
  matchNumberInSanction: number; // 1-based position within the sanction
  played: boolean;               // whether the player actually appeared in attendance
}

export type StaffRole = 'mesa' | 'referee';

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  roles: StaffRole[];  // Can have both roles
}

export interface MatchStaffAssignment {
  mesa: (string | null)[];  // Staff IDs assigned to mesa [required, optional, optional]
  referees: (string | null)[];  // Staff IDs assigned as referees [required, optional, optional]
}

export interface AssignedStaffInfo {
  id: string;
  firstName: string;
  lastName: string;
  order: number;  // 1 = Principal, 2 = Segundo, 3 = Tercero
}

export interface TournamentMetadata {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'finished';
}

export interface Tournament extends TournamentMetadata {
  teams: TeamData[];
  categories: CategoryData[];
  matches: MatchData[];
  staff?: StaffMember[];
  disciplinarySanctions?: DisciplinarySanction[];
}

/** Type guard to check if a TournamentMetadata has been fully hydrated into a Tournament */
export function isTournamentHydrated(t: TournamentMetadata | Tournament | null | undefined): t is Tournament {
  return !!t && 'matches' in t && 'teams' in t && 'categories' in t;
}

export interface CategoryData {
  id: string;
  name: string;
  classificationRounds: number; // Número de vueltas de todos contra todos (1, 2, 3...). Default: 1
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
  enableMatchExpulsion: boolean;
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
  goalCelebrationPhotoSize: number;
  teamLogoSize: number;
  penaltyGap: number;
  penaltyBottomMargin: number;
  penaltyTextColor: string;
  scoreNumberStrokeWidth: number;
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
  scorer?: { playerNumber: string };
  assist?: { playerNumber: string };
  assist2?: { playerNumber: string };
  positives?: Array<{ playerNumber: string } | null>;
  negatives?: Array<{ playerNumber: string } | null>;
}

export interface PenaltyLog {
  id: string;
  team: Team;
  playerNumber: string;
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
  playerNumber: string;
}

// Live attendance: only present players stored. id/isPresent kept optional for backward compat with old data.
export interface AttendedPlayerInfo {
  number: string;
  name: string;
  type?: PlayerType;
  id?: string; // Backward compat only - not set in new code
  isPresent?: boolean; // Backward compat only - not set in new code
}

export interface PlayerSubstitutionLog {
  id: string;
  team: Team;
  timestamp: number; // Wall clock timestamp
  gameTime: number; // Game time in centiseconds
  periodText: string; // Period when the substitution occurred
  playerId: string;
  playerNumber: string;
  playerName?: string;
  action: 'enter' | 'exit'; // 'enter' = player enters the field, 'exit' = player exits the field
}

export interface GoalkeeperChangeLog {
  timestamp: number; // Wall clock timestamp
  gameTime: number; // Game time in centiseconds
  periodText: string; // Period when the change occurred
  playerNumber: string;
  playerId?: string; // Backward compat only
}

// --- Legacy live-context period types (kept for backward compat) ---
export interface PeriodStats {
  goals: { home: GoalLog[], away: GoalLog[] };
  penalties: { home: PenaltyLog[], away: PenaltyLog[] };
  playerStats: { home: SummaryPlayerStats[], away: SummaryPlayerStats[] };
}

export interface PeriodSummary {
  period: string;
  stats: PeriodStats;
  goalkeeperChangesLog?: { home: GoalkeeperChangeLog[], away: GoalkeeperChangeLog[] };
  periodDuration?: number;
  startTimestamp?: string;
}

// --- Summary types (playerId-based, self-contained) ---

export interface SummaryRosterEntry {
  id: string;
  number: string;
  name: string;
  type?: PlayerType;
  isPresent: boolean;
}

export interface SummaryGoalEntry {
  id: string;
  team: Team;
  timestamp: number;
  gameTime: number;
  periodText: string;
  scorer?: { playerId: string };
  assist?: { playerId: string };
  assist2?: { playerId: string };
  positives?: Array<{ playerId: string } | null>;
  negatives?: Array<{ playerId: string } | null>;
}

export interface SummaryPenaltyEntry {
  id: string;
  team: Team;
  playerId: string;
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

export interface SummaryGoalkeeperChange {
  timestamp: number;
  gameTime: number;
  periodText: string;
  playerId: string;
}

export interface SummaryShootoutAttempt {
  id: string;
  round: number;
  playerId: string;
  isGoal: boolean | null;
}

export interface SummaryPeriodStats {
  goals: { home: SummaryGoalEntry[], away: SummaryGoalEntry[] };
  penalties: { home: SummaryPenaltyEntry[], away: SummaryPenaltyEntry[] };
  playerStats: { home: SummaryPlayerStats[], away: SummaryPlayerStats[] };
}

export interface SummaryPeriodSummary {
  period: string;
  stats: SummaryPeriodStats;
  goalkeeperChangesLog?: { home: SummaryGoalkeeperChange[], away: SummaryGoalkeeperChange[] };
  periodDuration?: number;
  startTimestamp?: string;
}

// This is the model for post-game summaries. It should be self-contained.
export interface GameSummary {
  attendance: {
    home: SummaryRosterEntry[];
    away: SummaryRosterEntry[];
  };
  sanctionedPlayers?: SummarySanctionedPlayer[];
  expulsions?: MatchExpulsion[];
  shootout?: Omit<ShootoutState, 'isActive'> & {
    homeAttempts: SummaryShootoutAttempt[];
    awayAttempts: SummaryShootoutAttempt[];
  };
  statsByPeriod?: SummaryPeriodSummary[];
  overTimeOrShootouts?: boolean;
  playedPeriods: string[];
  staff?: {
    mesa: AssignedStaffInfo[];
    referees: AssignedStaffInfo[];
  };
}


export interface TunnelState {
  subdomain: string | null;
  port: number;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  url: string | null;
  lastMessage: string | null;
}

export type PlayoffBracketHighlightStyle = 'pulse' | 'border' | 'glow' | 'trophy';

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
  flashingZeroDurationMs: number;
  tunnel: TunnelState;
  replays: ReplaySettings;
  showStandingsInWarmup: boolean;
  forceStandingsInWarmup: boolean; // For testing: always show standings/bracket in warmup
  playoffBracketHighlightStyle: PlayoffBracketHighlightStyle;
  showShotsData: boolean;
  enableOlympiaTransition: boolean;
  // Auto-sync configuration
  autoSyncAnalysisIntervalMinutes: number;
  autoSyncEnabled: boolean;
  autoSyncResolveConflicts: boolean;
  autoSyncSkipDuringMatch: boolean;
  autoSyncAfterSummaryEdit: boolean; // Triggers after saving tournament (includes match finish + summary edits)
  enableLiveSync: boolean; // Backup: Upload live.json from local storage to Supabase when clock stops (only works in local mode)
  showPlayerPhotosInGoalCelebration: boolean; // Show player photos during goal celebrations
  // Roster presentation configuration
  showRosterPresentation: boolean; // Show roster presentation during last 30s of warmup
  rosterPresentationDuration: number; // Seconds before warmup ends to start showing roster (default: 30)
  rosterPresentationMinPhotoPercentage: number; // Minimum percentage of players with photos to enable (0.0-1.0, default: 0.5)
  rosterPresentationShowIfOnlyOneTeam: boolean; // Show roster even if only one team meets criteria
}

// Separate type for tournaments data (stored in tournaments.json)
export interface TournamentsData {
  tournaments: TournamentMetadata[];
}

// Sync manifest types
export interface FileVersion {
  lastModified: string; // ISO 8601 GMT+0
  hash: string;         // MD5 or SHA256 of content
}

export interface FileMetadata extends FileVersion {
  size?: number; // Optional because deleted files don't have size
  previousVersion?: FileVersion; // Track previous state for conflict detection
  // Sync status tracking
  syncAttempts?: number; // Number of failed sync attempts
  lastSyncError?: string; // Last error message when trying to sync
  hasConflict?: boolean; // True if this file has a detected conflict
  conflictDetectedAt?: string; // ISO 8601 timestamp when conflict was detected
  // Deletion tracking
  deleted?: boolean; // True if this file was deleted
  deletedAt?: string; // ISO 8601 timestamp when file was deleted
  deletedHash?: string; // Hash of the file at the time it was deleted (for validation)
}

export interface SyncManifest {
  lastSync: string; // ISO 8601 GMT+0 - when last successful sync completed
  files: Record<string, FileMetadata>; // key = relative file path
}

// Sync logs
export interface SyncLogEntry {
  timestamp: string; // ISO 8601
  action: 'sync';
  trigger?: 'manual' | 'auto-interval' | 'after-summary-edit';
  result: 'success' | 'partial' | 'error';
  files: SyncLogFileEntry[]; // Detailed info per file
  errorCount?: number;
  message?: string;
}

export interface SyncErrorLogEntry {
  timestamp: string; // ISO 8601
  filePath: string;
  action: 'upload' | 'download' | 'conflict-resolve';
  error: string;
  attempt: number; // Which attempt number failed
}

// Sync plan (stored temporarily on server)
export interface SyncPlanConflict {
  filePath: string;
  localHash: string;
  remoteHash: string;
  localMetadata: FileMetadata;
  remoteMetadata: FileMetadata;
  decision?: 'local-wins' | 'remote-wins' | 'skip' | 'delete';
  isUnreferenced?: boolean;
}

export interface SyncPlan {
  timestamp: string; // When plan was created
  status: 'pending' | 'ready' | 'invalid' | 'executing';
  toUpload: { filePath: string; hash: string }[];
  toDownload: { filePath: string; hash: string }[];
  toDeleteLocally: { filePath: string; reason: string }[]; // Files to delete from local storage
  toDeleteRemotely: { filePath: string; reason: string }[]; // Files to delete from remote storage
  conflicts: SyncPlanConflict[];
  summary: {
    uploadCount: number;
    downloadCount: number;
    deleteLocalCount: number;
    deleteRemoteCount: number;
    conflictCount: number;
    unchangedCount: number;
  };
}

// Sync snapshot metadata
export interface SyncSnapshotMetadata {
  timestamp: string; // Snapshot ID
  filePath: string;
  winner: 'local' | 'remote';
  localHash: string;
  remoteHash: string;
}

// Updated sync log entry with conflict info
export interface SyncLogFileEntry {
  filePath: string;
  action: 'uploaded' | 'downloaded' | 'deleted-locally' | 'deleted-remotely' | 'conflict-resolved';
  hadConflict?: boolean;
  conflictWinner?: 'local' | 'remote';
  snapshotId?: string; // timestamp of snapshot if conflict
}

export interface ConfigState extends Omit<FormatAndTimingsProfileData, 'id' | 'name'>, ConfigFields {
  formatAndTimingsProfiles: FormatAndTimingsProfile[];
  selectedFormatAndTimingsProfileId: string | null;
  scoreboardLayout: ScoreboardLayoutSettings;
  selectedScoreboardLayoutProfileId: string | null;
  tournaments: TournamentMetadata[]; // Still part of runtime state, but loaded from tournaments.json
  activeTournament: Tournament | null; // Added for the full hydrated tournament
  selectedTournamentId: string | null;
  selectedMatchCategory: string;
}

export type PeriodDisplayOverrideType = 'Pre Warm-up' | 'Warm-up' | 'Break' | 'Pre-OT Break' | 'Time Out' | 'End of Game' | 'Shootout' | 'AwaitingDecision' | null;

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
  playerNumber: string;
  isGoal: boolean | null; // null for pending, true for goal, false for miss
  playerId?: string; // Backward compat only
  playerName?: string; // Backward compat only
}

export interface ShootoutState {
  isActive: boolean;
  rounds: number;
  homeAttempts: ShootoutAttempt[];
  awayAttempts: ShootoutAttempt[];
  initiator: Team | null; // Track who started the shootout
}

// Voice event data structures for voice command logging
export interface ShotEventData {
  team: 'home' | 'away';
  teamName: string;
  playerNumber: string;
}

export interface GoalEventData {
  team: 'home' | 'away';
  teamName: string;
  scorer: string;
  assists?: string[];
}

export interface PenaltyEventData {
  team: 'home' | 'away';
  teamName: string;
  playerNumber: string;
  penaltyType?: string;
}

export interface TimeoutEventData {
  team: 'home' | 'away';
  teamName: string;
}

export interface VoiceGameEvent {
  action: 'shot' | 'goal' | 'penalty' | 'timeout';
  timestamp: string;
  gameTime?: {
    period: number;
    timeRemaining: number; // in centiseconds
  };
  data: ShotEventData | GoalEventData | PenaltyEventData | TimeoutEventData;
}

// Shots and goalkeeper changes metrics - stored separately from live state for performance
export interface ShotsMetrics {
  shotsLog: { home: ShotLog[], away: ShotLog[] };
  goalkeeperChangesLog: { home: GoalkeeperChangeLog[], away: GoalkeeperChangeLog[] };
}

// Match context snapshot - copied at setup, read-only during game
export interface MatchContext {
  tournamentId: string;
  tournamentName: string;
  categoryId: string;
  categoryName: string;
  matchPhase: MatchPhase | null;
  matchPlayoffType: PlayoffMatchType | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamLogoDataUrl: string | null;
  awayTeamLogoDataUrl: string | null;
  homeRoster: PlayerData[];    // full roster snapshot for photos (has photoFileName)
  awayRoster: PlayerData[];    // full roster snapshot for photos
  staff: StaffMember[];        // resolved staff list
}

// This is the model for live, in-game data
export interface LiveState {
  clock: ClockState;
  score: ScoreState;
  penalties: PenaltiesState;
  goals: { home: GoalLog[], away: GoalLog[] };
  penaltiesLog: { home: PenaltyLog[], away: PenaltyLog[] };
  shotsLog: { home: ShotLog[], away: ShotLog[] };
  substitutionsLog: { home: PlayerSubstitutionLog[], away: PlayerSubstitutionLog[] }; // Log of player substitutions
  playersOnField: { home: string[], away: string[] }; // IDs of players currently on the field
  attendance: { home: string[], away: string[] }; // Jersey numbers of present players
  goalkeeperChangesLog: { home: GoalkeeperChangeLog[], away: GoalkeeperChangeLog[] }; // Log of goalkeeper changes during the match
  homeActiveGoalkeeperNumber: string | null; // Number of the currently active home goalkeeper
  awayActiveGoalkeeperNumber: string | null; // Number of the currently active away goalkeeper
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
  } | null;
  matchExpulsions: MatchExpulsion[];
  expulsionDisplay: {
    id: string;
    expulsion: MatchExpulsion;
  } | null;
  matchId: string | null;
  matchContext: MatchContext | null;  // Snapshot of tournament data at game setup
  playedPeriods: string[];
  assignedStaff?: MatchStaffAssignment;  // Staff assigned to this match
  periodStartTimestamps?: Record<string, string>;  // Period name -> ISO timestamp when it started
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
  | { type: 'SHOW_GOAL_CELEBRATION'; payload: { goal: GoalLog } }
  | { type: 'HIDE_GOAL_CELEBRATION' }
  | { type: 'MATCH_EXPULSION'; payload: { team: Team; playerNumber: string; playerName?: string } }
  | { type: 'REMOVE_MATCH_EXPULSION'; payload: { team: Team; expulsionId: string } }
  | { type: 'HIDE_EXPULSION_DISPLAY' }
  | { type: 'TOGGLE_CLOCK' }
  | { type: 'SET_TIME'; payload: { minutes: number; seconds: number } }
  | { type: 'ADJUST_TIME'; payload: number }
  | { type: 'SET_PERIOD'; payload: number }
  | { type: 'RESET_PERIOD_CLOCK' }
  | { type: 'ADD_GOAL'; payload: Omit<GoalLog, 'id' | 'periodText'> & { periodText?: string } }
  | { type: 'EDIT_GOAL'; payload: { goalId: string; updates: Partial<GoalLog> } }
  | { type: 'DELETE_GOAL'; payload: { goalId: string } }
  | { type: 'ADD_PLAYER_SHOT'; payload: { team: Team; playerNumber: string } }
  | { type: 'REMOVE_SHOT'; payload: { team: Team; shotIndex: number } }
  | { type: 'PLAYER_SUBSTITUTION'; payload: { team: Team; playerId: string; playerNumber: string; playerName?: string; action: 'enter' | 'exit' } }
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
  | { type: 'START_WARMUP' }
  | { type: 'START_TIMEOUT'; payload: { team: Team } }
  | { type: 'END_TIMEOUT' }
  | { type: 'MANUAL_END_GAME' }
  | { type: 'ADD_EXTRA_OVERTIME' }
  | { type: 'START_SHOOTOUT' }
  | { type: 'UPDATE_SHOOTOUT_ROUNDS'; payload: number }
  | { type: 'RECORD_SHOOTOUT_ATTEMPT'; payload: { team: Team; playerNumber: string; isGoal: boolean; } }
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
  | { type: 'ADD_MATCH_TO_TOURNAMENT'; payload: { tournamentId: string; match: Omit<MatchData, 'id'> & { id: string } } }
  | { type: 'UPDATE_MATCH_IN_TOURNAMENT'; payload: { tournamentId: string; match: MatchData } }
  | { type: 'DELETE_MATCH_FROM_TOURNAMENT'; payload: { tournamentId: string; matchId: string } }
  | { type: 'CLEAN_MATCH_SUMMARY'; payload: { tournamentId: string; matchId: string } }
  | { type: 'SAVE_MATCH_SUMMARY'; payload: { matchId: string; summary: GameSummary; adminSecret?: string } }
  | { type: 'INITIALIZE_STATE'; payload: Partial<GameState> }
  | { type: 'LOAD_TOURNAMENT_CONTEXT', payload: { tournamentData: Partial<Tournament> } }
  | { type: 'SET_STATE_FROM_LOCAL_BROADCAST'; payload: GameState }
  | { type: 'UPDATE_LIVE_STATE', payload: Partial<LiveState> }
  | { type: 'RESET_CONFIG_TO_DEFAULTS' }
  | { type: 'RESET_GAME_STATE' }
  | { type: 'ADD_TEAM_TO_TOURNAMENT'; payload: { tournamentId: string, team: Omit<TeamData, 'id'> & { id?: string } } }
  | { type: 'DELETE_TEAMS_FROM_TOURNAMENT'; payload: { tournamentId: string, teamIds: string[] } }
  | { type: 'UPDATE_TEAM_DETAILS'; payload: { teamId: string; name: string; subName?: string; category: string; logoDataUrl?: string | null } }
  | { type: 'ADD_PLAYER_TO_TEAM'; payload: { teamId: string; player: Omit<PlayerData, 'id'> & { id?: string } } }
  | { type: 'UPDATE_PLAYER_IN_TEAM'; payload: { teamId: string; playerId: string; updates: Partial<Pick<PlayerData, 'name' | 'number' | 'photoFileName' | 'celebrationVideoFileName' | 'celebrationMediaType'>> } } // celebrationMediaType: 'photo'|'video'|'none'
  | { type: 'REMOVE_PLAYER_FROM_TEAM'; payload: { teamId: string; playerId: string } }
  | { type: 'SET_TEAM_ATTENDANCE'; payload: { team: Team; playerNumbers: string[] } }
  | { type: 'UPDATE_ATTENDANCE_PLAYER'; payload: { team: Team; playerName: string; updates: { number: string } } }
  | { type: 'ADD_STAFF_TO_TOURNAMENT'; payload: { tournamentId: string; staff: Omit<StaffMember, 'id'> & { id?: string } } }
  | { type: 'UPDATE_STAFF_IN_TOURNAMENT'; payload: { tournamentId: string; staffId: string; updates: Partial<Omit<StaffMember, 'id'>> } }
  | { type: 'REMOVE_STAFF_FROM_TOURNAMENT'; payload: { tournamentId: string; staffId: string } }
  | { type: 'ADD_SANCTION_TO_TOURNAMENT'; payload: { tournamentId: string; sanction: Omit<DisciplinarySanction, 'id' | 'createdAt'> } }
  | { type: 'UPDATE_SANCTION_IN_TOURNAMENT'; payload: { tournamentId: string; sanctionId: string; updates: Partial<Omit<DisciplinarySanction, 'id' | 'createdAt'>> } }
  | { type: 'REMOVE_SANCTION_FROM_TOURNAMENT'; payload: { tournamentId: string; sanctionId: string } }
  | { type: 'SET_MATCH_STAFF'; payload: { assignment: MatchStaffAssignment } }
  | { type: 'SET_PLAYER_SHOTS'; payload: { team: Team; playerId: string; periodText: string; shotCount: number } }
  | { type: 'SET_ACTIVE_GOALKEEPER'; payload: { team: Team; playerNumber: string | null } }
  | { type: 'TRIGGER_SUMMARY_GENERATION'; payload: { matchId: string; tournamentId: string } }
  | { type: 'CLEAR_PENDING_SUMMARY_GENERATION' }
  | { type: 'UPDATE_MATCH_SUMMARY_IN_STATE'; payload: { matchId: string; summary: GameSummary } };


export interface GameState {
  config: ConfigState;
  live: LiveState;
  _initialConfigLoadComplete: boolean;
  _lastActionOriginator?: string;
  _lastActionType?: string;
  _lastUpdatedTimestamp?: number;
  _lastToastMessage?: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  } | null;
  _pendingSummaryGeneration?: { matchId: string; tournamentId: string } | null;
}


// --- Type for player stats within the summary component ---
export interface SummaryPlayerStats {
  id: string;
  goals: number;
  assists: number;
  shots: number;
}
