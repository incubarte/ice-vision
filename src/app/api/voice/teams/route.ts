import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    // Read live game state
    const livePath = path.join(process.cwd(), 'tmp', 'new-storage', 'data', 'live.json');
    const liveData = await readFile(livePath, 'utf-8');
    const liveState = JSON.parse(liveData);

    const homeTeamName = liveState.homeTeamName || 'Equipo Local';
    const awayTeamName = liveState.awayTeamName || 'Equipo Visitante';
    const homeTeamSubName = liveState.homeTeamSubName || undefined;
    const awayTeamSubName = liveState.awayTeamSubName || undefined;

    // Attendance is now string[] of jersey numbers of present players
    const attendanceHomeSet = new Set<string>(liveState.attendance?.home || []);
    const attendanceAwaySet = new Set<string>(liveState.attendance?.away || []);

    // Get full team rosters from tournament
    const configPath = path.join(process.cwd(), 'tmp', 'new-storage', 'data', 'config.json');
    const configData = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    const tournamentId = config.selectedTournamentId;

    let allHomePlayers: any[] = [];
    let allAwayPlayers: any[] = [];

    // First try to use matchContext roster (preferred, snapshot at game setup)
    if (liveState.matchContext?.homeRoster) {
      allHomePlayers = liveState.matchContext.homeRoster.map((p: any) => ({
        id: p.id,
        number: p.number || '',
        name: p.name || 'Sin nombre',
        isPresent: attendanceHomeSet.has(p.number || '')
      }));
    }

    if (liveState.matchContext?.awayRoster) {
      allAwayPlayers = liveState.matchContext.awayRoster.map((p: any) => ({
        id: p.id,
        number: p.number || '',
        name: p.name || 'Sin nombre',
        isPresent: attendanceAwaySet.has(p.number || '')
      }));
    }

    // Fallback: try tournament teams file
    if (allHomePlayers.length === 0 || allAwayPlayers.length === 0) {
      if (tournamentId) {
        try {
          const teamsPath = path.join(
            process.cwd(),
            'tmp', 'new-storage', 'data', 'tournaments',
            tournamentId,
            'teams.json'
          );
          const teamsData = await readFile(teamsPath, 'utf-8');
          const teamsFile = JSON.parse(teamsData);

          if (teamsFile.teams) {
            const homeTeamData = teamsFile.teams.find((t: any) =>
              t.name === homeTeamName &&
              (t.subName || undefined) === homeTeamSubName
            );
            const awayTeamData = teamsFile.teams.find((t: any) =>
              t.name === awayTeamName &&
              (t.subName || undefined) === awayTeamSubName
            );

            if (allHomePlayers.length === 0 && homeTeamData?.players) {
              allHomePlayers = homeTeamData.players.map((p: any) => ({
                id: p.id,
                number: p.number || '',
                name: p.name || 'Sin nombre',
                isPresent: attendanceHomeSet.has(p.number || '')
              }));
            }

            if (allAwayPlayers.length === 0 && awayTeamData?.players) {
              allAwayPlayers = awayTeamData.players.map((p: any) => ({
                id: p.id,
                number: p.number || '',
                name: p.name || 'Sin nombre',
                isPresent: attendanceAwaySet.has(p.number || '')
              }));
            }
          }
        } catch (error) {
          console.error('Could not load full roster:', error);
        }
      }
    }

    // Sort by number (numeric sort)
    const sortByNumber = (a: any, b: any) => {
      const numA = parseInt(a.number) || 999;
      const numB = parseInt(b.number) || 999;
      return numA - numB;
    };

    const homePlayers = allHomePlayers.sort(sortByNumber);
    const awayPlayers = allAwayPlayers.sort(sortByNumber);

    return NextResponse.json({
      success: true,
      homeTeam: {
        name: homeTeamName,
        players: homePlayers
      },
      awayTeam: {
        name: awayTeamName,
        players: awayPlayers
      }
    });

  } catch (error) {
    console.error('Error loading team data:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to load team data'
    }, { status: 500 });
  }
}
