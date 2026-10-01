import { NextRequest, NextResponse } from 'next/server';
import { readTournament, writeTournament } from '@/lib/data-access';
import { createAdminStorageProvider } from '@/lib/storage';
import { FileNotFoundError } from '@/lib/storage/providers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const adminSecret = request.headers.get('x-admin-secret');
  const isAdminRequest = !!process.env.ADMIN_WRITE_SECRET
    && adminSecret === process.env.ADMIN_WRITE_SECRET;

  if (process.env.NEXT_PUBLIC_READ_ONLY === 'true' && !isAdminRequest) {
    return NextResponse.json({ success: false, message: 'Modo solo lectura.' }, { status: 403 });
  }

  try {
    const body = await request.json() as { tournamentId: string; matchId: string };
    const { tournamentId, matchId } = body;

    if (!tournamentId || !matchId) {
      return NextResponse.json({ success: false, error: 'tournamentId and matchId are required' }, { status: 400 });
    }

    const tournament = await readTournament(tournamentId);
    if (!tournament) {
      return NextResponse.json({ success: false, error: `Tournament ${tournamentId} not found` }, { status: 404 });
    }

    const existed = (tournament.matches || []).some(m => m.id === matchId);
    const updatedMatches = (tournament.matches || []).filter(m => m.id !== matchId);

    const provider = isAdminRequest ? createAdminStorageProvider() : undefined;
    await writeTournament({ ...tournament, id: tournamentId, matches: updatedMatches } as any, provider);

    // Move summary to deleted-matches folder if it exists
    const p = provider || createAdminStorageProvider();
    const summaryKey = `tournaments/${tournamentId}/summaries/${matchId}.json`;
    const deletedKey = `tournaments/${tournamentId}/deleted-matches/${matchId}.json`;
    try {
      const summaryContent = await p.readFile(summaryKey);
      await p.writeFile(deletedKey, summaryContent);
      await p.deleteFile(summaryKey);
      console.log(`[Sync/DeleteMatch] Summary moved to deleted-matches for ${matchId}`);
    } catch (err) {
      if (!(err instanceof FileNotFoundError)) {
        console.warn(`[Sync/DeleteMatch] Could not move summary for ${matchId}:`, err);
      }
      // No summary is fine — match may never have been played
    }

    // Verify the match is gone
    const verifyTournament = await readTournament(tournamentId);
    const stillExists = (verifyTournament?.matches || []).some(m => m.id === matchId);
    if (stillExists) {
      console.error(`[Sync/DeleteMatch] Write verification failed: match ${matchId} still present after delete`);
      return NextResponse.json({ success: false, error: 'Write verification failed: match not deleted' }, { status: 500 });
    }

    console.log(`[Sync/DeleteMatch] Match ${matchId} ${existed ? 'deleted' : 'was already absent'} from tournament ${tournamentId}`);
    return NextResponse.json({ success: true, matchId, existed });
  } catch (error) {
    console.error('[Sync/DeleteMatch] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
