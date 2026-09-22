import { NextRequest, NextResponse } from 'next/server';
import { readConfig } from '@/lib/data-access';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { matchId } = await request.json();

    if (!matchId) {
      return NextResponse.json({ success: false, error: 'matchId is required' }, { status: 400 });
    }

    // Read config to get selectedTournamentId (still persisted in config.json for now)
    const config = await readConfig() as Record<string, unknown>;
    const tournamentId = config?.selectedTournamentId as string | undefined;

    if (!tournamentId) {
      return NextResponse.json({ success: false, error: 'No tournament selected' }, { status: 400 });
    }

    // Build path to voice events file
    const voiceEventsPath = path.join(
      process.cwd(),
      'tmp', 'new-storage', 'data', 'tournaments',
      tournamentId,
      'voice-events',
      `${matchId}.json`
    );

    // Delete the file if it exists
    if (fs.existsSync(voiceEventsPath)) {
      fs.unlinkSync(voiceEventsPath);
      console.log(`[Clear Voice Events API] Deleted voice events file for match ${matchId}`);
    } else {
      console.log(`[Clear Voice Events API] No voice events file found for match ${matchId}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Clear Voice Events API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
