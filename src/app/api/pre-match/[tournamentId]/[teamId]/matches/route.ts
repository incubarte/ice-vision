import { NextResponse } from 'next/server';
import { readTournament } from '@/lib/data-access';
import type { MatchData, TeamData } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tournamentId: string; teamId: string }> }
) {
  const { tournamentId, teamId } = await params;

  const tournament = await readTournament(tournamentId, { includeSummaries: false });
  if (!tournament) {
    return NextResponse.json({ message: 'Tournament not found' }, { status: 404 });
  }

  const team = (tournament.teams ?? []).find((t: TeamData) => t.id === teamId);
  if (!team) {
    return NextResponse.json({ message: 'Team not found' }, { status: 404 });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const todayMatches = (tournament.matches ?? []).filter((m: MatchData) => {
    const matchDay = m.date?.split('T')[0];
    return matchDay === todayStr && (m.homeTeamId === teamId || m.awayTeamId === teamId);
  });

  return NextResponse.json({ matches: todayMatches, team });
}
