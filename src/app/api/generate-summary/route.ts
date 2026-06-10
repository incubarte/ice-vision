import { NextRequest, NextResponse } from 'next/server';
import { readTournament, readConfig, writeSingleMatchSummary, writeRawSummaryFiles, readLiveState, readShotsMetrics } from '@/lib/data-access';
import { generateSummaryData } from '@/lib/summary-generator';
import fs from 'fs';
import path from 'path';
import type { VoiceGameEvent, GameState } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId, liveState: liveStateFromBody } = body;

    if (!matchId) {
      return NextResponse.json({ success: false, error: 'matchId is required' }, { status: 400 });
    }

    // Use live state from request body if provided (avoids race condition where live.json
    // may not be persisted yet when the summary generation is triggered).
    // Fall back to reading from disk for backwards compatibility.
    const config = await readConfig();
    const liveState = liveStateFromBody ?? await readLiveState();

    const tournamentId = liveState.matchContext?.tournamentId;
    if (!tournamentId) {
      return NextResponse.json({ success: false, error: 'No tournament found in matchContext' }, { status: 400 });
    }

    // Read the full tournament data (needed for team rosters)
    const tournament = await readTournament(tournamentId);
    if (!tournament) {
      return NextResponse.json({ success: false, error: 'Tournament not found' }, { status: 404 });
    }

    // Build full config with tournaments array (add id to tournament object)
    const fullConfig = {
      ...config,
      tournaments: [{
        id: tournamentId,
        ...tournament
      }]
    };

    // Read shots metrics (live state already read above)
    const shotsMetrics = await readShotsMetrics();

    // Merge shots metrics into live state for summary generation
    const mergedLiveState = {
      ...liveState,
      shotsLog: shotsMetrics.shotsLog || { home: [], away: [] },
      goalkeeperChangesLog: shotsMetrics.goalkeeperChangesLog || { home: [], away: [] }
    };

    // Read voice events for this match
    let voiceEvents: VoiceGameEvent[] = [];
    const voiceEventsPath = path.join(
      process.cwd(),
      'tmp', 'new-storage', 'data', 'tournaments',
      tournamentId,
      'voice-events',
      `${matchId}.json`
    );

    if (fs.existsSync(voiceEventsPath)) {
      const voiceEventsData = fs.readFileSync(voiceEventsPath, 'utf-8');
      voiceEvents = JSON.parse(voiceEventsData);
      console.log(`[Generate Summary API] Loaded ${voiceEvents.length} voice events for match ${matchId}`);
    } else {
      console.log(`[Generate Summary API] No voice events file found for match ${matchId}`);
    }

    // Build state object for summary generation
    const state: GameState = {
      live: mergedLiveState,
      config: fullConfig
    };

    // Log debug info
    console.log('[Generate Summary API] Generating summary with:');
    console.log('  - Home team:', mergedLiveState.homeTeamName, mergedLiveState.homeTeamSubName || '(no subname)');
    console.log('  - Away team:', mergedLiveState.awayTeamName, mergedLiveState.awayTeamSubName || '(no subname)');
    console.log('  - Selected category:', fullConfig.selectedMatchCategory);
    console.log('  - Tournament teams count:', tournament.teams?.length || 0);
    console.log('  - Voice events count:', voiceEvents.length);
    console.log('  - Shots log (home/away):', mergedLiveState.shotsLog?.home?.length || 0, '/', mergedLiveState.shotsLog?.away?.length || 0);
    console.log('  - GK changes (home/away):', mergedLiveState.goalkeeperChangesLog?.home?.length || 0, '/', mergedLiveState.goalkeeperChangesLog?.away?.length || 0);

    // Generate summary with voice events
    const summary = generateSummaryData(state, voiceEvents);

    if (!summary) {
      return NextResponse.json({ success: false, error: 'Failed to generate summary' }, { status: 500 });
    }

    console.log('[Generate Summary API] Summary generated. Checking 2ND period stats...');
    const period2nd = summary.statsByPeriod?.find((p: any) => p.period === '2ND');
    if (period2nd) {
      const homeShotsCount = period2nd.stats.playerStats.home.filter((p: any) => p.shots > 0).length;
      const awayShotsCount = period2nd.stats.playerStats.away.filter((p: any) => p.shots > 0).length;
      console.log(`  - Home players with shots in 2ND: ${homeShotsCount}`);
      console.log(`  - Away players with shots in 2ND: ${awayShotsCount}`);
    }

    // Add voice events to summary
    summary.voiceEvents = voiceEvents;

    // Save summary
    await writeSingleMatchSummary(tournamentId, matchId, summary);

    // Save raw source files for auditing/debugging
    await writeRawSummaryFiles(tournamentId, matchId, {
      liveState: mergedLiveState,
      shotsMetrics,
      voiceEvents,
    });

    console.log(`[Generate Summary API] Summary generated and saved for match ${matchId} with ${voiceEvents.length} voice events`);

    return NextResponse.json({
      success: true,
      summary,
      voiceEventsCount: voiceEvents.length
    });

  } catch (error) {
    console.error('[Generate Summary API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
