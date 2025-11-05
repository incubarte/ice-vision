import defaultSettings from '@/config/defaults.json';
import type { GameState, FormatAndTimingsProfile, ScoreboardLayoutProfile, ScoreboardLayoutSettings, PenaltyTypeDefinition, LiveState, ShootoutState } from '@/types';

const safeUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
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

export const createDefaultFormatAndTimingsProfile = (): FormatAndTimingsProfile => ({
  id: safeUUID(),
  name: "Predeterminado (App)",
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

export const createDefaultScoreboardLayoutProfile = (): ScoreboardLayoutProfile => ({
    id: safeUUID(),
    name: "Diseño Predeterminado (App)",
    ...INITIAL_LAYOUT_SETTINGS
});

const INITIAL_SHOOTOUT_STATE: ShootoutState = {
  isActive: false,
  rounds: 5,
  homeAttempts: [],
  awayAttempts: [],
  initiator: null,
};

// Función para crear un estado por defecto completo.
export const getInitialState = (): GameState => {
  const defaultFormatProfile = createDefaultFormatAndTimingsProfile();
  const defaultLayoutProfile = createDefaultScoreboardLayoutProfile();
  
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
      formatAndTimingsProfiles: [defaultFormatProfile],
      selectedFormatAndTimingsProfileId: defaultFormatProfile.id,
      playSoundAtPeriodEnd: true,
      customHornSoundDataUrl: null,
      enableTeamSelectionInMiniScoreboard: true,
      enablePlayerSelectionForPenalties: true,
      showAliasInPenaltyPlayerSelector: true,
      showAliasInControlsPenaltyList: true,
      showAliasInScoreboardPenalties: true,
      enablePenaltyCountdownSound: true,
      penaltyCountdownStartTime: 10,
      customPenaltyBeepSoundDataUrl: null,
      enableDebugMode: false,
      tickIntervalMs: 200,
      scoreboardLayout: INITIAL_LAYOUT_SETTINGS,
      scoreboardLayoutProfiles: [defaultLayoutProfile],
      selectedScoreboardLayoutProfileId: defaultLayoutProfile.id,
      selectedMatchCategory: '',
      tournaments: [],
      selectedTournamentId: null,
      tunnel: {
        subdomain: defaultSettings.tunnel.subdomainPrefix,
        port: defaultSettings.tunnel.port,
        status: 'disconnected',
        url: null,
        lastMessage: null,
      },
      replays: {
        syncUrl: "https://hockeando-default-rtdb.firebaseio.com/Replays.json",
        downloadUrlBase: "https://firebasestorage.googleapis.com/v0/b/hockeando.appspot.com/o/"
      },
    },
    live: {
      score: { home: 0, away: 0, homeShots: 0, awayShots: 0 },
      penalties: { home: [], away: [] },
      goals: { home: [], away: [] },
      penaltiesLog: { home: [], away: [] },
      shotsLog: { home: [], away: [] },
      attendance: { home: [], away: [] },
      clock: {
        currentTime: defaultFormatProfile.defaultWarmUpDuration,
        currentPeriod: 0,
        isClockRunning: false,
        periodDisplayOverride: 'Warm-up',
        preTimeoutState: null,
        clockStartTimeMs: null,
        remainingTimeAtStartCs: null,
        absoluteElapsedTimeCs: 0,
        _liveAbsoluteElapsedTimeCs: 0,
        isFlashingZero: false,
      },
      shootout: INITIAL_SHOOTOUT_STATE,
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
    },
    _initialConfigLoadComplete: false,
  };
};
