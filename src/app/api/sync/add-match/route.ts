import { NextRequest, NextResponse } from 'next/server';
import { readTournament, writeTournament } from '@/lib/data-access';
import { createAdminStorageProvider } from '@/lib/storage';
import type { MatchData } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * Upserts a match into the cloud tournament fixture.
 * The match ID is set by the client (local app) to ensure coherence across
 * ADD_PLAYER and SYNC_MATCH pending syncs that reference the same matchId.
 * Idempotent: if the match ID already exists, it is updated in place.
 */
export async function POST(request: NextRequest) {
  const adminSecret = request.headers.get('x-admin-secret');
  const isAdminRequest = !!process.env.ADMIN_WRITE_SECRET
    && adminSecret === process.env.ADMIN_WRITE_SECRET;

  if (process.env.NEXT_PUBLIC_READ_ONLY === 'true' && !isAdminRequest) {
    return NextResponse.json({ success: false, message: 'Modo solo lectura.' }, { status: 403 });
  }

  try {
    const body = await request.json() as { tournamentId: string; match: MatchData };
    const { tournamentId, match } = body;

    if (!tournamentId || !match?.id) {
      return NextResponse.json({ success: false, error: 'tournamentId and match.id are required' }, { status: 400 });
    }

    const tournament = await readTournament(tournamentId);
    if (!tournament) {
      return NextResponse.json({ success: false, error: `Tournament ${tournamentId} not found` }, { status: 404 });
    }

    const existingMatches = tournament.matches || [];
    const alreadyExists = existingMatches.some(m => m.id === match.id);
    const updatedMatches = alreadyExists
      ? existingMatches.map(m => m.id === match.id ? match : m)
      : [...existingMatches, match];

    const provider = isAdminRequest ? createAdminStorageProvider() : undefined;
    await writeTournament({ ...tournament, matches: updatedMatches } as any, provider);

    console.log(`[Sync/AddMatch] Match ${match.id} ${alreadyExists ? 'updated' : 'added'} in tournament ${tournamentId}`);
    return NextResponse.json({ success: true, upserted: match.id, wasUpdate: alreadyExists });
  } catch (error) {
    console.error('[Sync/AddMatch] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
