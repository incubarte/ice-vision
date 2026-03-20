import type { GameState, GameSummary, SummaryPlayerStats, GoalLog, ShotLog, Team, PlayerData, PenaltyLog, VoiceGameEvent, SummaryRosterEntry, SummaryGoalEntry, SummaryPenaltyEntry, SummaryPeriodStats, SummaryPeriodSummary, SummaryGoalkeeperChange, SummaryShootoutAttempt, GoalkeeperChangeLog } from "@/types";

// Helper: look up a player by number in a roster, return their id
function findPlayerIdByNumber(number: string, roster: PlayerData[]): string | undefined {
    return roster.find(p => p.number === number)?.id;
}

// Helper: convert a live GoalLog player ref { playerNumber } to summary { playerId }
function convertPlayerRef(ref: { playerNumber: string } | null | undefined, roster: PlayerData[]): { playerId: string } | undefined {
    if (!ref?.playerNumber) return undefined;
    const id = findPlayerIdByNumber(ref.playerNumber, roster);
    if (!id) return undefined;
    return { playerId: id };
}

// Build summary roster from matchContext roster + live attendance.
// Attendance is now a simple string[] of jersey numbers of present players.
// The roster is the source of truth for player data (name, type, id).
function buildSummaryRoster(roster: PlayerData[], attendanceNumbers: string[]): SummaryRosterEntry[] {
    const attendanceSet = new Set(attendanceNumbers);

    // Build from roster, marking isPresent based on attendance set
    return roster.map(p => ({
        id: p.id,
        number: p.number,
        name: p.name,
        type: p.type,
        isPresent: attendanceSet.has(p.number),
    }));
}

// Convert live GoalLog → SummaryGoalEntry
function convertGoalToSummary(goal: GoalLog, roster: PlayerData[]): SummaryGoalEntry {
    return {
        id: goal.id,
        team: goal.team,
        timestamp: goal.timestamp,
        gameTime: goal.gameTime,
        periodText: goal.periodText,
        scorer: convertPlayerRef(goal.scorer, roster),
        assist: convertPlayerRef(goal.assist, roster),
        assist2: convertPlayerRef(goal.assist2, roster),
        positives: goal.positives?.map(p => p ? convertPlayerRef(p, roster) || null : null),
        negatives: goal.negatives?.map(n => n ? convertPlayerRef(n, roster) || null : null),
    };
}

// Convert live PenaltyLog → SummaryPenaltyEntry
function convertPenaltyToSummary(penalty: PenaltyLog, roster: PlayerData[]): SummaryPenaltyEntry {
    const playerId = findPlayerIdByNumber(penalty.playerNumber, roster) || `unknown-${penalty.playerNumber}`;
    return {
        id: penalty.id,
        team: penalty.team,
        playerId,
        penaltyName: penalty.penaltyName,
        initialDuration: penalty.initialDuration,
        reducesPlayerCount: penalty.reducesPlayerCount,
        clearsOnGoal: penalty.clearsOnGoal,
        isBenchPenalty: penalty.isBenchPenalty,
        addTimestamp: penalty.addTimestamp,
        addGameTime: penalty.addGameTime,
        addPeriodText: penalty.addPeriodText,
        endTimestamp: penalty.endTimestamp,
        endGameTime: penalty.endGameTime,
        endPeriodText: penalty.endPeriodText,
        endReason: penalty.endReason,
        timeServed: penalty.timeServed,
    };
}

// Convert live GoalkeeperChangeLog → SummaryGoalkeeperChange
function convertGKChangeToSummary(gc: GoalkeeperChangeLog, roster: PlayerData[]): SummaryGoalkeeperChange {
    const playerId = gc.playerId || findPlayerIdByNumber(gc.playerNumber, roster) || `unknown-${gc.playerNumber}`;
    return {
        timestamp: gc.timestamp,
        gameTime: gc.gameTime,
        periodText: gc.periodText,
        playerId,
    };
}

/**
 * Recalculate player stats from goals and shots logs.
 * Works with both live data (playerNumber-based) and summary data (playerId-based).
 * The roster is used to map numbers to IDs for stat aggregation.
 */
export const recalculateAllStatsFromLogs = (
    partialSummary: Partial<{
        goals: { home: any[], away: any[] },
        home: { homeShotsLog?: ShotLog[] },
        away: { awayShotsLog?: ShotLog[] },
        attendance?: { home: string[] | SummaryRosterEntry[], away: string[] | SummaryRosterEntry[] }
    }>,
    homeTeamRoster: PlayerData[],
    awayTeamRoster: PlayerData[]
): { home: SummaryPlayerStats[], away: SummaryPlayerStats[] } => {
    const homePlayerStatsMap = new Map<string, SummaryPlayerStats>();
    const awayPlayerStatsMap = new Map<string, SummaryPlayerStats>();

    // Initialize from roster (always has id)
    homeTeamRoster.forEach(p => homePlayerStatsMap.set(p.id, { id: p.id, shots: 0, goals: 0, assists: 0 }));
    awayTeamRoster.forEach(p => awayPlayerStatsMap.set(p.id, { id: p.id, shots: 0, goals: 0, assists: 0 }));

    // Helper to resolve a player reference to an ID
    const resolvePlayerId = (ref: any, roster: PlayerData[]): string | undefined => {
        if (!ref) return undefined;
        // Try playerId first (summary format), then playerNumber (live format)
        if (ref.playerId) return ref.playerId;
        if (ref.playerNumber) return roster.find(p => p.number === ref.playerNumber)?.id;
        return undefined;
    };

    // Process goals
    const processGoals = (goals: any[], statsMap: Map<string, SummaryPlayerStats>, roster: PlayerData[]) => {
        goals.forEach(goal => {
            const scorerId = resolvePlayerId(goal.scorer, roster);
            if (scorerId && statsMap.has(scorerId)) {
                statsMap.get(scorerId)!.goals++;
            }
            const assistId = resolvePlayerId(goal.assist, roster);
            if (assistId && statsMap.has(assistId)) {
                statsMap.get(assistId)!.assists++;
            }
        });
    };

    processGoals(partialSummary.goals?.home || [], homePlayerStatsMap, homeTeamRoster);
    processGoals(partialSummary.goals?.away || [], awayPlayerStatsMap, awayTeamRoster);

    // Process shots (playerNumber-based in new format)
    const processShots = (shots: ShotLog[], statsMap: Map<string, SummaryPlayerStats>, roster: PlayerData[]) => {
        shots.forEach(shot => {
            // New format: only playerNumber. Old format: playerId.
            const playerId = (shot as any).playerId || roster.find(p => p.number === shot.playerNumber)?.id;
            if (playerId && statsMap.has(playerId)) {
                statsMap.get(playerId)!.shots++;
            }
        });
    };

    processShots(partialSummary.home?.homeShotsLog || [], homePlayerStatsMap, homeTeamRoster);
    processShots(partialSummary.away?.awayShotsLog || [], awayPlayerStatsMap, awayTeamRoster);

    return { home: Array.from(homePlayerStatsMap.values()), away: Array.from(awayPlayerStatsMap.values()) };
};


export const generateSummaryData = (state: GameState, voiceEvents?: VoiceGameEvent[]): GameSummary | null => {
    const { live, config } = state;
    if (!live || !config) return null;

    // If voice events not provided and we're on server, try to read them from file
    const matchContextTournamentId = live.matchContext?.tournamentId;
    if (!voiceEvents && live.matchId && matchContextTournamentId && typeof window === 'undefined') {
        try {
            const fs = require('fs');
            const path = require('path');
            const voiceEventsPath = path.join(
                process.cwd(),
                'tmp', 'new-storage', 'data', 'tournaments',
                matchContextTournamentId,
                'voice-events',
                `${live.matchId}.json`
            );
            if (fs.existsSync(voiceEventsPath)) {
                const voiceEventsData = fs.readFileSync(voiceEventsPath, 'utf-8');
                voiceEvents = JSON.parse(voiceEventsData);
                console.log(`[Summary Generator] Loaded ${voiceEvents?.length || 0} voice events from file for match ${live.matchId}`);
            }
        } catch (error) {
            console.warn('[Summary Generator] Could not read voice events file:', error);
        }
    }

    // Use matchContext roster (snapshot at game setup)
    const matchContext = live.matchContext;

    const homeTeamRoster = matchContext?.homeRoster || [];
    const awayTeamRoster = matchContext?.awayRoster || [];

    console.log('[DEBUG Summary] Roster sources:', {
        usingMatchContext: !!matchContext,
        homeRosterSize: homeTeamRoster.length,
        awayRosterSize: awayTeamRoster.length
    });

    // Build summary roster (full roster with isPresent flag)
    const homeRoster: SummaryRosterEntry[] = buildSummaryRoster(homeTeamRoster, live.attendance.home || []);
    const awayRoster: SummaryRosterEntry[] = buildSummaryRoster(awayTeamRoster, live.attendance.away || []);

    const allPlayedPeriods = [...(live.playedPeriods || [])];

    // Helper to get period text from period number
    const getPeriodText = (periodNum: number): string => {
        if (periodNum === 1) return '1ST';
        if (periodNum === 2) return '2ND';
        if (periodNum === 3) return 'OT';
        if (periodNum === 4) return 'OT2';
        return `OT${periodNum - 2}`;
    };

    // Helper to normalize period text (convert P1 -> 1ST, P2 -> 2ND, etc.)
    const normalizePeriodText = (periodText: string): string => {
        if (periodText.startsWith('P')) {
            const periodNum = parseInt(periodText.substring(1));
            if (!isNaN(periodNum)) {
                return getPeriodText(periodNum);
            }
        }
        return periodText;
    };

    const statsByPeriodArray: SummaryPeriodSummary[] = allPlayedPeriods.map((periodText, periodIndex) => {
        // Filter live events for this period
        const homeGoals = (live.goals.home || []).filter(g => normalizePeriodText(g.periodText || '') === periodText);
        const awayGoals = (live.goals.away || []).filter(g => normalizePeriodText(g.periodText || '') === periodText);
        const homePenalties = (live.penaltiesLog.home || []).filter(p => normalizePeriodText(p.addPeriodText || '') === periodText);
        const awayPenalties = (live.penaltiesLog.away || []).filter(p => normalizePeriodText(p.addPeriodText || '') === periodText);

        // Convert to summary format (playerNumber → playerId)
        const summaryGoalsHome: SummaryGoalEntry[] = homeGoals.map(g => convertGoalToSummary(g, homeTeamRoster));
        const summaryGoalsAway: SummaryGoalEntry[] = awayGoals.map(g => convertGoalToSummary(g, awayTeamRoster));
        const summaryPenaltiesHome: SummaryPenaltyEntry[] = homePenalties.map(p => convertPenaltyToSummary(p, homeTeamRoster));
        const summaryPenaltiesAway: SummaryPenaltyEntry[] = awayPenalties.map(p => convertPenaltyToSummary(p, awayTeamRoster));

        // Recalculate player stats for this period
        const periodSummaryForStats = {
          goals: { home: homeGoals, away: awayGoals },
          home: { homeShotsLog: (live.shotsLog.home || []).filter(s => normalizePeriodText(s.periodText || '') === periodText) },
          away: { awayShotsLog: (live.shotsLog.away || []).filter(s => normalizePeriodText(s.periodText || '') === periodText) },
          attendance: live.attendance
        };
        const periodPlayerStats = recalculateAllStatsFromLogs(periodSummaryForStats, homeTeamRoster, awayTeamRoster);

        // Filter voice events for this period (shots from voice commands)
        const voiceEventsForPeriod = (voiceEvents || []).filter((event) => {
            if (!event.gameTime) return false;
            const eventPeriodText = getPeriodText(event.gameTime.period);
            return eventPeriodText === periodText && event.action === 'shot';
        });

        // Add shots from voice events
        voiceEventsForPeriod.forEach((event) => {
            const isHome = event.data.team === 'home';
            const statsArray = isHome ? periodPlayerStats.home : periodPlayerStats.away;
            const roster = isHome ? homeTeamRoster : awayTeamRoster;

            const eventPlayerNumber = 'playerNumber' in event.data ? (event.data as { playerNumber: string }).playerNumber : undefined;
            if (eventPlayerNumber) {
                const playerId = roster.find(p => p.number === eventPlayerNumber)?.id;
                if (playerId) {
                    const playerStats = statsArray.find(s => s.id === playerId);
                    if (playerStats) {
                        playerStats.shots++;
                    }
                }
            }
        });

        const periodData: SummaryPeriodStats = {
            goals: { home: summaryGoalsHome, away: summaryGoalsAway },
            penalties: { home: summaryPenaltiesHome, away: summaryPenaltiesAway },
            playerStats: { home: periodPlayerStats.home, away: periodPlayerStats.away }
        };

        // Get period duration (from config, defaulting to standard period length)
        const periodDuration = config.defaultPeriodDuration || 120000;

        // Goalkeeper changes: convert to summary format
        let homeGKChanges = (live.goalkeeperChangesLog?.home || []).filter(gc => normalizePeriodText(gc.periodText || '') === periodText);
        let awayGKChanges = (live.goalkeeperChangesLog?.away || []).filter(gc => normalizePeriodText(gc.periodText || '') === periodText);

        const isFirstGamePeriod = periodIndex === 0;
        if (isFirstGamePeriod) {
            const preGamePeriods = ['Pre Warm-up', 'Warm-up', 'Break'];
            const preGameGKChangesHome = (live.goalkeeperChangesLog?.home || [])
                .filter(gc => preGamePeriods.includes(gc.periodText || ''))
                .map(gc => ({ ...gc, gameTime: periodDuration }));
            const preGameGKChangesAway = (live.goalkeeperChangesLog?.away || [])
                .filter(gc => preGamePeriods.includes(gc.periodText || ''))
                .map(gc => ({ ...gc, gameTime: periodDuration }));

            homeGKChanges = [...preGameGKChangesHome, ...homeGKChanges];
            awayGKChanges = [...preGameGKChangesAway, ...awayGKChanges];
        }

        const goalkeeperChangesLog: { home: SummaryGoalkeeperChange[], away: SummaryGoalkeeperChange[] } = {
            home: homeGKChanges.map(gc => convertGKChangeToSummary(gc, homeTeamRoster)),
            away: awayGKChanges.map(gc => convertGKChangeToSummary(gc, awayTeamRoster))
        };

        const startTimestamp = live.periodStartTimestamps?.[periodText];

        return { period: periodText, stats: periodData, goalkeeperChangesLog, periodDuration, startTimestamp };
    });

    // Build summary attendance
    const finalSummary: GameSummary = {
        attendance: { home: homeRoster, away: awayRoster },
        statsByPeriod: statsByPeriodArray,
        playedPeriods: live.playedPeriods || [],
    };

    const overTimeOrShootouts = (live.shootout && (live.shootout.homeAttempts.length > 0 || live.shootout.awayAttempts.length > 0)) || allPlayedPeriods.some(p => p.startsWith('OT'));
    finalSummary.overTimeOrShootouts = overTimeOrShootouts;

    // Convert shootout attempts to summary format
    if (live.shootout && (live.shootout.homeAttempts.length > 0 || live.shootout.awayAttempts.length > 0)) {
        const { isActive, ...shootoutSummary } = live.shootout;
        const convertAttempt = (attempt: any, roster: PlayerData[]): SummaryShootoutAttempt => ({
            id: attempt.id,
            round: attempt.round,
            playerId: attempt.playerId || findPlayerIdByNumber(attempt.playerNumber, roster) || `unknown-${attempt.playerNumber}`,
            isGoal: attempt.isGoal,
        });
        finalSummary.shootout = {
            ...shootoutSummary,
            homeAttempts: shootoutSummary.homeAttempts.map(a => convertAttempt(a, homeTeamRoster)) as any,
            awayAttempts: shootoutSummary.awayAttempts.map(a => convertAttempt(a, awayTeamRoster)) as any,
        };
    }

    // Include voice events in the summary for historical record
    if (voiceEvents && voiceEvents.length > 0) {
        (finalSummary as any).voiceEvents = voiceEvents;
    }

    // Include staff assignment in summary
    const staffSource = matchContext?.staff;
    if (live.assignedStaff && staffSource) {
        const mesaStaffInfo = live.assignedStaff.mesa
            .map((id, index) => {
                if (id === null) return null;
                const staff = staffSource.find(s => s.id === id);
                if (!staff) return null;
                return {
                    id: staff.id,
                    firstName: staff.firstName,
                    lastName: staff.lastName,
                    order: index + 1
                };
            })
            .filter((s): s is { id: string; firstName: string; lastName: string; order: number } => s !== null);

        const refereesStaffInfo = live.assignedStaff.referees
            .map((id, index) => {
                if (id === null) return null;
                const staff = staffSource.find(s => s.id === id);
                if (!staff) return null;
                return {
                    id: staff.id,
                    firstName: staff.firstName,
                    lastName: staff.lastName,
                    order: index + 1
                };
            })
            .filter((s): s is { id: string; firstName: string; lastName: string; order: number } => s !== null);

        if (mesaStaffInfo.length > 0 || refereesStaffInfo.length > 0) {
            finalSummary.staff = {
                mesa: mesaStaffInfo,
                referees: refereesStaffInfo
            };
        }
    }

    return finalSummary;
};
