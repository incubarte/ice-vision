import { NextResponse } from 'next/server';
import { findTournamentByCode, readTournament, readPreMatchData, writePreMatchData, deletePreMatchData } from '@/lib/data-access';
import { createPreMatchStorageProvider, isReadOnlyMode } from '@/lib/storage';
import type { PreMatchData, TeamData } from '@/types';

export const dynamic = 'force-dynamic';

const PASSWORD = 'IceVision';

function checkPassword(request: Request): boolean {
  return request.headers.get('x-pre-match-password') === PASSWORD;
}

const normalize = (s: string) => decodeURIComponent(s).toLowerCase().replace(/\s+/g, '');

async function resolveIds(tournamentCode: string, clubName: string, matchId: string) {
  const tournamentId = await findTournamentByCode(tournamentCode);
  if (!tournamentId) return null;
  const tournament = await readTournament(tournamentId, { includeSummaries: false });
  if (!tournament) return null;
  const normalizedClubName = normalize(clubName);
  const match = (tournament.matches ?? []).find(m => m.id === matchId);
  if (!match) return null;

  // Find by clubId first
  const club = (tournament.clubs ?? []).find((c: any) => normalize(c.name) === normalizedClubName);
  let matchingTeam;
  if (club) {
    matchingTeam = (tournament.teams ?? []).find(
      (t: TeamData) => t.clubId === club.id && (t.id === match.homeTeamId || t.id === match.awayTeamId)
    );
  }
  if (!matchingTeam) {
    matchingTeam = (tournament.teams ?? []).find(
      (t: TeamData) => normalize(t.name) === normalizedClubName && (t.id === match.homeTeamId || t.id === match.awayTeamId)
    );
  }
  if (!matchingTeam) return null;
  return { tournamentId, teamId: matchingTeam.id };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tournamentCode: string; clubName: string; matchId: string }> }
) {
  const { tournamentCode, clubName, matchId } = await params;
  const ids = await resolveIds(tournamentCode, clubName, matchId);
  if (!ids) return NextResponse.json({ exists: false }, { status: 404 });

  const data = await readPreMatchData(ids.tournamentId, matchId, ids.teamId);
  if (!data) return NextResponse.json({ exists: false }, { status: 404 });
  return NextResponse.json({ exists: true, data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tournamentCode: string; clubName: string; matchId: string }> }
) {
  if (!checkPassword(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { tournamentCode, clubName, matchId } = await params;
  const ids = await resolveIds(tournamentCode, clubName, matchId);
  if (!ids) return NextResponse.json({ message: 'Partido o club no encontrado' }, { status: 404 });

  let body: { data: PreMatchData };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const { data } = body;
  // Ensure IDs are correct before saving
  const normalized: PreMatchData = {
    ...data,
    tournamentId: ids.tournamentId,
    matchId,
    teamId: ids.teamId,
  };

  const provider = isReadOnlyMode() ? createPreMatchStorageProvider() : undefined;
  await writePreMatchData(normalized, provider);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tournamentCode: string; clubName: string; matchId: string }> }
) {
  if (!checkPassword(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { tournamentCode, clubName, matchId } = await params;
  const ids = await resolveIds(tournamentCode, clubName, matchId);
  if (!ids) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const provider = isReadOnlyMode() ? createPreMatchStorageProvider() : undefined;
  await deletePreMatchData(ids.tournamentId, matchId, ids.teamId, provider);
  return NextResponse.json({ success: true });
}
