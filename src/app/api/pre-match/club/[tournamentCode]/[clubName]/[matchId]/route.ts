import { NextResponse } from 'next/server';
import { findTournamentByCode, readTournament, readPreMatchData, writePreMatchData, deletePreMatchData } from '@/lib/data-access';
import { createPreMatchStorageProvider, isReadOnlyMode } from '@/lib/storage';
import type { PreMatchData, TeamData } from '@/types';

export const dynamic = 'force-dynamic';

const DEFAULT_PASSWORD = 'IceVision';

const normalize = (s: string) => decodeURIComponent(s).toLowerCase().replace(/\s+/g, '');

async function resolveIds(tournamentCode: string, clubName: string, matchId: string, explicitTeamId?: string) {
  const tournamentId = await findTournamentByCode(tournamentCode);
  if (!tournamentId) return null;
  const tournament = await readTournament(tournamentId, { includeSummaries: false });
  if (!tournament) return null;
  const normalizedClubName = normalize(clubName);
  const match = (tournament.matches ?? []).find(m => m.id === matchId);
  if (!match) return null;

  const club = (tournament.clubs ?? []).find((c: any) => normalize(c.name) === normalizedClubName);

  // If caller provides explicit teamId (e.g. both teams belong to same club), use it directly
  if (explicitTeamId) {
    const team = (tournament.teams ?? []).find(
      (t: TeamData) => t.id === explicitTeamId && (t.id === match.homeTeamId || t.id === match.awayTeamId)
    );
    if (team) return { tournamentId, teamId: team.id, clubPassword: club?.password || DEFAULT_PASSWORD };
  }

  // Fallback: find first team of the club in this match
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
  return { tournamentId, teamId: matchingTeam.id, clubPassword: club?.password || DEFAULT_PASSWORD };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tournamentCode: string; clubName: string; matchId: string }> }
) {
  const { tournamentCode, clubName, matchId } = await params;
  const teamId = new URL(request.url).searchParams.get('teamId') ?? undefined;
  const ids = await resolveIds(tournamentCode, clubName, matchId, teamId);
  if (!ids) return NextResponse.json({ exists: false }, { status: 404 });

  const data = await readPreMatchData(ids.tournamentId, matchId, ids.teamId);
  if (!data) return NextResponse.json({ exists: false }, { status: 404 });
  return NextResponse.json({ exists: true, data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tournamentCode: string; clubName: string; matchId: string }> }
) {
  const { tournamentCode, clubName, matchId } = await params;
  const teamId = new URL(request.url).searchParams.get('teamId') ?? undefined;
  const ids = await resolveIds(tournamentCode, clubName, matchId, teamId);
  if (!ids) return NextResponse.json({ message: 'Partido o club no encontrado' }, { status: 404 });
  if (request.headers.get('x-pre-match-password') !== ids.clubPassword) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tournamentCode: string; clubName: string; matchId: string }> }
) {
  const { tournamentCode, clubName, matchId } = await params;
  const teamId = new URL(request.url).searchParams.get('teamId') ?? undefined;
  const ids = await resolveIds(tournamentCode, clubName, matchId, teamId);
  if (!ids) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  if (request.headers.get('x-pre-match-password') !== ids.clubPassword) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  let body: { playerId: string; consentSentAt: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  let existing = await readPreMatchData(ids.tournamentId, matchId, ids.teamId);

  if (!existing) {
    // Pre-match not saved yet — create a stub so consent is persisted
    const tournamentId = ids.tournamentId;
    const tournament = await readTournament(tournamentId, { includeSummaries: false });
    const team = tournament ? (tournament.teams ?? []).find((t: TeamData) => t.id === ids.teamId) : null;
    const players = team
      ? (team.players ?? []).map((p: { id: string; name: string; number: string; type: string }) => ({
          playerId: p.id,
          name: p.name,
          number: p.number ?? '',
          type: p.type,
          isPresent: false,
        }))
      : [];
    existing = {
      tournamentId,
      matchId,
      teamId: ids.teamId,
      submittedAt: new Date().toISOString(),
      version: 1,
      players,
      extraPlayers: [],
      coach: '',
    };
  }

  const updated: PreMatchData = {
    ...existing,
    players: existing.players.map(p =>
      p.playerId === body.playerId ? { ...p, consentSentAt: body.consentSentAt } : p
    ),
  };

  const provider = isReadOnlyMode() ? createPreMatchStorageProvider() : undefined;
  await writePreMatchData(updated, provider);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tournamentCode: string; clubName: string; matchId: string }> }
) {
  const { tournamentCode, clubName, matchId } = await params;
  const teamId = new URL(request.url).searchParams.get('teamId') ?? undefined;
  const ids = await resolveIds(tournamentCode, clubName, matchId, teamId);
  if (!ids) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  if (request.headers.get('x-pre-match-password') !== ids.clubPassword) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const provider = isReadOnlyMode() ? createPreMatchStorageProvider() : undefined;
  await deletePreMatchData(ids.tournamentId, matchId, ids.teamId, provider);
  return NextResponse.json({ success: true });
}
