import { NextResponse } from 'next/server';
import { findTournamentByCode, readTournament } from '@/lib/data-access';
import type { ClubData, MatchData, TeamData } from '@/types';

export const dynamic = 'force-dynamic';

const normalize = (s: string) => decodeURIComponent(s).toLowerCase().replace(/\s+/g, '');

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tournamentCode: string; clubName: string }> }
) {
  const { tournamentCode, clubName } = await params;
  const normalizedClubName = normalize(clubName);

  const tournamentId = await findTournamentByCode(tournamentCode);
  if (!tournamentId) {
    return NextResponse.json({ message: 'Torneo no encontrado' }, { status: 404 });
  }

  const tournament = await readTournament(tournamentId, { includeSummaries: false });
  if (!tournament) {
    return NextResponse.json({ message: 'Torneo no encontrado' }, { status: 404 });
  }

  // Find club by normalized name
  const club = (tournament.clubs ?? []).find(
    (c: ClubData) => normalize(c.name) === normalizedClubName
  );

  if (!club) {
    return NextResponse.json({ message: 'Club no encontrado en este torneo' }, { status: 404 });
  }

  // All teams belonging to this club
  const matchingTeams = (tournament.teams ?? []).filter(
    (t: TeamData) => t.clubId === club.id
  );

  if (matchingTeams.length === 0) {
    return NextResponse.json({ message: 'No hay equipos asociados a este club' }, { status: 404 });
  }

  const matchingTeamIds = new Set(matchingTeams.map((t: TeamData) => t.id));
  const now = Date.now();
  const windowStart = now - 6 * 60 * 60 * 1000;   // 6 horas atrás
  const windowEnd   = now + 12 * 60 * 60 * 1000;  // 12 horas adelante

  const todayMatches = (tournament.matches ?? [])
    .filter((m: MatchData) => {
      const matchTime = m.date ? new Date(m.date).getTime() : 0;
      return matchTime >= windowStart && matchTime <= windowEnd && (
        (m.homeTeamId && matchingTeamIds.has(m.homeTeamId)) ||
        (m.awayTeamId && matchingTeamIds.has(m.awayTeamId))
      );
    })
    .map((m: MatchData) => {
      const teamId = matchingTeamIds.has(m.homeTeamId ?? '') ? m.homeTeamId! : m.awayTeamId!;
      const team = matchingTeams.find((t: TeamData) => t.id === teamId)!;
      const role = m.homeTeamId === teamId ? 'home' : 'away';

      const opponentId = role === 'home' ? m.awayTeamId : m.homeTeamId;
      const opponent = (tournament.teams ?? []).find((t: TeamData) => t.id === opponentId);
      const opponentDisplayName = opponent
        ? (opponent.subName ? `${opponent.name} ${opponent.subName}` : opponent.name)
        : null;

      const categoryName = (tournament.categories ?? []).find(
        (c: { id: string; name: string }) => c.id === team.category
      )?.name ?? team.category;

      return { match: m, team: { ...team, category: categoryName }, role, opponentName: opponentDisplayName };
    });

  return NextResponse.json({ tournamentId, matches: todayMatches });
}
