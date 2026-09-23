import { NextRequest, NextResponse } from 'next/server';
import { readTournament, writeTournament } from '@/lib/data-access';
import { createAdminStorageProvider } from '@/lib/storage';
import type { PlayerData } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * Replaces the player roster for a specific team within a tournament.
 * Called by the local scoreboard when ADD/UPDATE/REMOVE_PLAYER actions
 * are processed from the pending sync queue.
 * The full players array is sent each time (last-write-wins, idempotent).
 */
export async function POST(request: NextRequest) {
  const adminSecret = request.headers.get('x-admin-secret');
  const isAdminRequest = !!process.env.ADMIN_WRITE_SECRET
    && adminSecret === process.env.ADMIN_WRITE_SECRET;

  if (process.env.NEXT_PUBLIC_READ_ONLY === 'true' && !isAdminRequest) {
    return NextResponse.json({ success: false, message: 'Modo solo lectura.' }, { status: 403 });
  }

  try {
    const body = await request.json() as { tournamentId: string; teamId: string; players: PlayerData[] };
    const { tournamentId, teamId, players } = body;

    if (!tournamentId || !teamId || !Array.isArray(players)) {
      return NextResponse.json({ success: false, error: 'tournamentId, teamId and players array are required' }, { status: 400 });
    }

    const tournament = await readTournament(tournamentId);
    if (!tournament) {
      return NextResponse.json({ success: false, error: `Tournament ${tournamentId} not found` }, { status: 404 });
    }

    const updatedTeams = (tournament.teams || []).map(t =>
      t.id === teamId ? { ...t, players } : t
    );

    const provider = isAdminRequest ? createAdminStorageProvider() : undefined;
    await writeTournament({ ...tournament, teams: updatedTeams } as any, provider);

    console.log(`[Sync/TeamPlayers] Updated ${players.length} player(s) for team ${teamId} in tournament ${tournamentId}`);
    return NextResponse.json({ success: true, count: players.length });
  } catch (error) {
    console.error('[Sync/TeamPlayers] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
