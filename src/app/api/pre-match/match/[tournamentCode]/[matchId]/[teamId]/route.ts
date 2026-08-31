import { NextResponse } from 'next/server';
import { findTournamentByCode, readPreMatchData, writePreMatchData, deletePreMatchData, readTournament } from '@/lib/data-access';
import { createPreMatchStorageProvider, isReadOnlyMode } from '@/lib/storage';
import type { PreMatchData } from '@/types';

export const dynamic = 'force-dynamic';

const DEFAULT_PASSWORD = 'IceVision';

async function getClubPassword(tournamentId: string, teamId: string): Promise<string> {
  try {
    const tournament = await readTournament(tournamentId, { includeSummaries: false });
    const team = (tournament?.teams ?? []).find(t => t.id === teamId);
    if (!team?.clubId) return DEFAULT_PASSWORD;
    const club = (tournament?.clubs ?? []).find(c => c.id === team.clubId);
    return club?.password || DEFAULT_PASSWORD;
  } catch { return DEFAULT_PASSWORD; }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tournamentCode: string; matchId: string; teamId: string }> }
) {
  const { tournamentCode, matchId, teamId } = await params;
  const tournamentId = await findTournamentByCode(tournamentCode);
  if (!tournamentId) return NextResponse.json({ exists: false }, { status: 404 });

  const data = await readPreMatchData(tournamentId, matchId, teamId);
  if (!data) return NextResponse.json({ exists: false }, { status: 404 });
  return NextResponse.json({ exists: true, data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tournamentCode: string; matchId: string; teamId: string }> }
) {
  const { tournamentCode, matchId, teamId } = await params;
  const tournamentId = await findTournamentByCode(tournamentCode);
  if (!tournamentId) return NextResponse.json({ message: 'Torneo no encontrado' }, { status: 404 });
  const clubPassword = await getClubPassword(tournamentId, teamId);
  if (request.headers.get('x-pre-match-password') !== clubPassword) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  let body: { data: PreMatchData };
  try { body = await request.json(); } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const normalized: PreMatchData = {
    ...body.data,
    tournamentId,
    matchId,
    teamId,
  };

  const provider = isReadOnlyMode() ? createPreMatchStorageProvider() : undefined;
  await writePreMatchData(normalized, provider);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tournamentCode: string; matchId: string; teamId: string }> }
) {
  const { tournamentCode, matchId, teamId } = await params;
  const tournamentId = await findTournamentByCode(tournamentCode);
  if (!tournamentId) return NextResponse.json({ message: 'Torneo no encontrado' }, { status: 404 });
  const clubPassword = await getClubPassword(tournamentId, teamId);
  if (request.headers.get('x-pre-match-password') !== clubPassword) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const provider = isReadOnlyMode() ? createPreMatchStorageProvider() : undefined;
  await deletePreMatchData(tournamentId, matchId, teamId, provider);
  return NextResponse.json({ success: true });
}
