import { NextRequest, NextResponse } from 'next/server';
import { readTournament, writeTournament } from '@/lib/data-access';
import { createAdminStorageProvider } from '@/lib/storage';
import type { StaffMember } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * Replaces the staff array for a tournament.
 * Called by the local scoreboard app when ADD/UPDATE/REMOVE_STAFF actions
 * are processed from the pending sync queue.
 * The full staff array is sent each time (last-write-wins, idempotent).
 */
export async function POST(request: NextRequest) {
  const adminSecret = request.headers.get('x-admin-secret');
  const isAdminRequest = !!process.env.ADMIN_WRITE_SECRET
    && adminSecret === process.env.ADMIN_WRITE_SECRET;

  if (process.env.NEXT_PUBLIC_READ_ONLY === 'true' && !isAdminRequest) {
    return NextResponse.json({ success: false, message: 'Modo solo lectura.' }, { status: 403 });
  }

  try {
    const body = await request.json() as { tournamentId: string; staff: StaffMember[] };
    const { tournamentId, staff } = body;

    if (!tournamentId || !Array.isArray(staff)) {
      return NextResponse.json({ success: false, error: 'tournamentId and staff array are required' }, { status: 400 });
    }

    const tournament = await readTournament(tournamentId);
    if (!tournament) {
      return NextResponse.json({ success: false, error: `Tournament ${tournamentId} not found` }, { status: 404 });
    }

    const provider = isAdminRequest ? createAdminStorageProvider() : undefined;
    await writeTournament({ ...tournament, staff } as any, provider);

    console.log(`[Sync/Staff] Updated ${staff.length} staff member(s) for tournament ${tournamentId}`);
    return NextResponse.json({ success: true, count: staff.length });
  } catch (error) {
    console.error('[Sync/Staff] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
