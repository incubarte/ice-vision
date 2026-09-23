import { NextRequest, NextResponse } from 'next/server';
import { readTournament, writeTournament, writeSingleMatchSummary } from '@/lib/data-access';
import { generateSummaryData } from '@/lib/summary-generator';
import { createAdminStorageProvider } from '@/lib/storage';
import { calculateScoreFromSummary } from '@/lib/match-helpers';
import type { GameState, MatchResult, PendingSyncSyncMatch, Tournament } from '@/types';
import defaultSettings from '@/config/defaults.json';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // 1. Auth
  const adminSecret = request.headers.get('x-admin-secret');
  const isAdminRequest = !!process.env.ADMIN_WRITE_SECRET
    && adminSecret === process.env.ADMIN_WRITE_SECRET;

  if (process.env.NEXT_PUBLIC_READ_ONLY === 'true' && !isAdminRequest) {
    return NextResponse.json({ success: false, message: 'Modo solo lectura.' }, { status: 403 });
  }

  try {
    const body = await request.json() as {
      matchId: string;
      tournamentId: string;
      result: MatchResult;
      liveSnapshot: PendingSyncSyncMatch['liveSnapshot'];
    };

    const { matchId, tournamentId, result, liveSnapshot } = body;

    if (!matchId || !tournamentId || !result || !liveSnapshot) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // 2. Load tournament
    const tournament = await readTournament(tournamentId);
    if (!tournament) {
      return NextResponse.json({ success: false, error: `Tournament ${tournamentId} not found` }, { status: 404 });
    }

    const match = (tournament.matches || []).find(m => m.id === matchId);
    if (!match) {
      return NextResponse.json({ success: false, error: `Match ${matchId} not found` }, { status: 404 });
    }

    const provider = isAdminRequest ? createAdminStorageProvider() : undefined;

    // 3. Build GameState for summary generation.
    // liveSnapshot.goalsLog maps to LiveState.goals (the field was renamed in the snapshot
    // to avoid confusion with the summary goals; here we map it back for the generator).
    // We cast to GameState['live'] because the snapshot omits ephemeral UI-only fields
    // (active penalties, overlays, replay state, etc.) that summary generation doesn't need.
    const state: GameState = {
      live: {
        ...liveSnapshot,
        // Map snapshot field names back to LiveState field names
        goals: liveSnapshot.goalsLog,
        matchExpulsions: liveSnapshot.expulsions || [],
        // Safe defaults for required LiveState fields not present in liveSnapshot
        clock: {
          currentTime: 0,
          currentPeriod: 1,
          isClockRunning: false,
          isFlashingZero: false,
          periodDisplayOverride: 'End of Game',
          absoluteElapsedTimeCs: 0,
          _liveAbsoluteElapsedTimeCs: 0,
          clockStartTimeMs: null,
          remainingTimeAtStartCs: null,
          preTimeoutState: null,
        },
        penalties: { home: [], away: [] },
        substitutionsLog: { home: [], away: [] },
        playersOnField: { home: [], away: [] },
        homeActiveGoalkeeperNumber: null,
        awayActiveGoalkeeperNumber: null,
        playHornTrigger: 0,
        playPenaltyBeepTrigger: 0,
        pendingPowerPlayGoal: null,
        overlayMessage: null,
        replayLoadRequest: null,
        replayOverlay: null,
        goalCelebration: null,
        expulsionDisplay: null,
        periodStartTimestamps: {},
        matchId: liveSnapshot.matchId,
      } as GameState['live'],
      config: defaultSettings as unknown as GameState['config'],
      tournament: {
        tournaments: [{ id: tournament.id!, name: tournament.name || '', status: tournament.status || 'active' }],
        activeTournament: {
          id: tournament.id!,
          name: tournament.name || '',
          status: tournament.status || 'active',
          clubs: tournament.clubs || [],
          teams: tournament.teams || [],
          categories: tournament.categories || [],
          matches: tournament.matches || [],
          staff: tournament.staff,
        },
        selectedTournamentId: tournamentId,
        selectedMatchCategory: match.categoryId || '',
        offlineMode: false,
      },
      _initialConfigLoadComplete: true,
      _pendingSyncs: [],
    };

    // 4. Generate full summary
    let summary = null;
    try {
      summary = generateSummaryData(state);
    } catch (err) {
      console.error('[sync/match] Summary generation failed:', err);
      // Continue without summary — at least save the result
    }

    // 5. Save summary
    if (summary) {
      await writeSingleMatchSummary(tournamentId, matchId, summary, provider);
      console.log(`[sync/match] Summary saved for match ${matchId}`);
    }

    // 6. Update tournament match with result + advance playoff bracket
    let updatedMatches = (tournament.matches || []).map(m =>
      m.id === matchId ? { ...m, result, ...(summary ? { summary } : {}) } : m
    );

    // Playoff bracket advancement (mirrors UPDATE_MATCH_SUMMARY_IN_STATE logic)
    if (match.phase === 'playoffs' && match.playoffType === 'semifinal' && summary) {
      try {
        const scores = calculateScoreFromSummary(summary);
        if (scores.home !== scores.away) {
          const winnerId = scores.home > scores.away ? match.homeTeamId : match.awayTeamId;
          const loserId = scores.home > scores.away ? match.awayTeamId : match.homeTeamId;

          if (winnerId && loserId) {
            updatedMatches = updatedMatches.map(m => {
              if (m.categoryId !== match.categoryId || m.phase !== 'playoffs') return m;
              if (m.playoffType === 'final') {
                const hasHome = !!(m.homeTeamId?.trim());
                const hasAway = !!(m.awayTeamId?.trim());
                if (!hasHome && m.awayTeamId !== winnerId) return { ...m, homeTeamId: winnerId };
                if (!hasAway && m.homeTeamId !== winnerId) return { ...m, awayTeamId: winnerId };
              }
              if (m.playoffType === '3er-puesto') {
                const hasHome = !!(m.homeTeamId?.trim());
                const hasAway = !!(m.awayTeamId?.trim());
                if (!hasHome && m.awayTeamId !== loserId) return { ...m, homeTeamId: loserId };
                if (!hasAway && m.homeTeamId !== loserId) return { ...m, awayTeamId: loserId };
              }
              return m;
            });
          }
        }
      } catch (err) {
        console.error('[sync/match] Playoff advancement failed:', err);
      }
    }

    // 7. Save tournament with updated matches
    const updatedTournament: Tournament = {
      id: tournament.id!,
      name: tournament.name || '',
      status: tournament.status || 'active',
      clubs: tournament.clubs || [],
      teams: tournament.teams || [],
      categories: tournament.categories || [],
      staff: tournament.staff,
      matches: updatedMatches,
    };
    await writeTournament(updatedTournament, provider);
    console.log(`[sync/match] Tournament ${tournamentId} updated`);

    // 8. Trigger cloud sync (fire-and-forget)
    const baseUrl = request.url.split('/api/')[0];
    fetch(`${baseUrl}/api/sync-trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'after-summary-edit' }),
    }).catch(err => console.error('[sync/match] Sync trigger failed:', err));

    return NextResponse.json({
      success: true,
      matchId,
      summaryGenerated: !!summary,
      playoffAdvanced: match.phase === 'playoffs' && match.playoffType === 'semifinal',
    });

  } catch (error) {
    console.error('[sync/match] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
