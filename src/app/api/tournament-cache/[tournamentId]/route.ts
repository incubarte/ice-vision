import { NextRequest, NextResponse } from 'next/server';
import { readTournamentCache, writeTournamentCache } from '@/lib/tournament-cache-store';
import type { Tournament } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  const cache = readTournamentCache(tournamentId);
  if (!cache) return NextResponse.json(null);
  return NextResponse.json(cache);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tournamentId: string }> }) {
  await params; // ensure params is resolved (unused but follows async pattern)
  try {
    const tournament = await req.json() as Tournament;
    writeTournamentCache(tournament);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
