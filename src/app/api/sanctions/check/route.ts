import { NextResponse } from 'next/server';
import type { PlayerData, MatchData } from '@/types';
import { readTournament, readTournaments, readOrgSanctions } from '@/lib/data-access';
import { isSanctionActive } from '@/lib/discipline-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId');
  const teamId = searchParams.get('teamId');
  const matchId = searchParams.get('matchId');

  if (!tournamentId || !teamId) {
    return NextResponse.json({ message: 'tournamentId and teamId are required' }, { status: 400 });
  }

  // 1. Load the tournament to get roster and match date
  const tournament = await readTournament(tournamentId, { includeSummaries: false });
  if (!tournament) {
    return NextResponse.json({ message: 'Torneo no encontrado' }, { status: 404 });
  }

  // 2. Find the team roster
  const team = tournament.teams?.find(t => t.id === teamId);
  if (!team) {
    return NextResponse.json({ sanctionedPlayerIds: [] });
  }
  const players: PlayerData[] = team.players ?? [];

  // 3. Determine match date
  const matchDate = matchId
    ? (tournament.matches?.find(m => m.id === matchId)?.date?.split('T')[0] ?? new Date().toISOString().split('T')[0])
    : new Date().toISOString().split('T')[0];

  // 4 & 5. Load org-level and tournament-level sanctions, combine + deduplicate by id
  const [orgSanctions, tournamentSanctions] = await Promise.all([
    readOrgSanctions(),
    Promise.resolve(tournament.disciplinarySanctions ?? []),
  ]);

  const sanctionMap = new Map(orgSanctions.map(s => [s.id, s]));
  for (const s of tournamentSanctions) {
    if (!sanctionMap.has(s.id)) sanctionMap.set(s.id, s);
  }
  const allSanctions = Array.from(sanctionMap.values());

  // Filter to sanctions that could affect this team
  const teamSanctions = allSanctions.filter(s => s.teamId === teamId);
  if (teamSanctions.length === 0) {
    return NextResponse.json({ sanctionedPlayerIds: [] });
  }

  // 6. For match-counting sanctions, load all tournament matches across ALL tournaments
  const hasByMatchSanction = teamSanctions.some(s => s.sanctionType === 'matches');
  let allMatchesCombined: MatchData[] = tournament.matches ?? [];

  if (hasByMatchSanction) {
    const { tournaments: metaList = [] } = await readTournaments();
    const otherIds = metaList.map(t => t.id).filter(id => id !== tournamentId);
    const otherTournaments = await Promise.all(
      otherIds.map(id => readTournament(id, { includeSummaries: false }))
    );
    for (const t of otherTournaments) {
      if (t?.matches) allMatchesCombined = allMatchesCombined.concat(t.matches);
    }
  }

  // 7. Evaluate each player
  const sanctionedPlayerIds: string[] = [];
  for (const player of players) {
    const playerSanctions = teamSanctions.filter(s =>
      s.playerId === player.id ||
      (s.globalPlayerId && player.globalPlayerId && s.globalPlayerId === player.globalPlayerId) ||
      (s.docNumber && player.document?.docNumber && s.docNumber === player.document.docNumber && s.docType === player.document.docType)
    );
    const isActive = playerSanctions.some(s => isSanctionActive(s, allMatchesCombined, matchDate));
    if (isActive) sanctionedPlayerIds.push(player.id);
  }

  return NextResponse.json({ sanctionedPlayerIds });
}
