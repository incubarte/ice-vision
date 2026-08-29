import { NextResponse } from 'next/server';
import { findTournamentByCode, readTournament, readPreMatchData } from '@/lib/data-access';
import type { ClubData, TeamData } from '@/types';

export const dynamic = 'force-dynamic';

const normalize = (s: string) => decodeURIComponent(s).toLowerCase().replace(/\s+/g, '');

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tournamentCode: string; matchId: string }> }
) {
  const { tournamentCode, matchId } = await params;

  const tournamentId = await findTournamentByCode(tournamentCode);
  if (!tournamentId) return NextResponse.json({ message: 'Torneo no encontrado' }, { status: 404 });

  const tournament = await readTournament(tournamentId, { includeSummaries: false });
  if (!tournament) return NextResponse.json({ message: 'Torneo no encontrado' }, { status: 404 });

  const match = (tournament.matches ?? []).find(m => m.id === matchId);
  if (!match) return NextResponse.json({ message: 'Partido no encontrado' }, { status: 404 });

  const getTeam = (teamId: string | undefined) =>
    teamId ? (tournament.teams ?? []).find((t: TeamData) => t.id === teamId) ?? null : null;

  const resolveCategory = (categoryId: string) =>
    (tournament.categories ?? []).find((c: { id: string; name: string }) => c.id === categoryId)?.name ?? categoryId;

  const homeTeamRaw = getTeam(match.homeTeamId);
  const awayTeamRaw = getTeam(match.awayTeamId);

  const enrichTeam = (team: TeamData | null) => {
    if (!team) return null;
    return { ...team, category: resolveCategory(team.category) };
  };

  const [homeInitialData, awayInitialData] = await Promise.all([
    homeTeamRaw ? readPreMatchData(tournamentId, matchId, homeTeamRaw.id) : Promise.resolve(null),
    awayTeamRaw ? readPreMatchData(tournamentId, matchId, awayTeamRaw.id) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    tournamentId,
    match,
    homeTeam: enrichTeam(homeTeamRaw),
    awayTeam: enrichTeam(awayTeamRaw),
    homeInitialData,
    awayInitialData,
  });
}
