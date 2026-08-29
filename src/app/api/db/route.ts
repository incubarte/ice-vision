
import { NextResponse } from 'next/server';
import type { GameState, ConfigState, LiveState, TournamentsData, ShotsMetrics, Tournament } from '@/types';
import { setGameState, setConfig, getGameState, getConfig, setTournaments, getTournaments, setShotsMetrics, getShotsMetrics } from '@/lib/server-side-store';
import { readConfig, writeConfig, readLiveState, writeLiveState, readTournaments, writeTournaments, readShotsMetrics, writeShotsMetrics, readTournament } from '@/lib/data-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const [config, liveState, shotsMetrics, tournamentsData] = await Promise.all([
        getConfig(),
        getGameState(),
        getShotsMetrics(),
        getTournaments()
    ]);

    // Server-side hydration: If a tournament is selected, load its full data
    let activeTournament: Tournament | null = null;
    if (config?.selectedTournamentId) {
      const tournamentMeta = tournamentsData?.tournaments?.find(t => t.id === config.selectedTournamentId);
      if (tournamentMeta) {
        const fullTournament = await readTournament(config.selectedTournamentId, { includeSummaries: false });
        if (fullTournament) {
          activeTournament = {
            ...tournamentMeta,
            clubs: fullTournament.clubs || [],
            teams: fullTournament.teams || [],
            categories: fullTournament.categories || [],
            matches: fullTournament.matches || [],
            staff: fullTournament.staff,
          };
        }
      }
    }

    // Merge shotsMetrics into liveState for backward compatibility
    const mergedLiveState = liveState ? {
      ...liveState,
      shotsLog: shotsMetrics?.shotsLog || liveState.shotsLog || { home: [], away: [] },
      goalkeeperChangesLog: shotsMetrics?.goalkeeperChangesLog || liveState.goalkeeperChangesLog || { home: [], away: [] }
    } : undefined;

    const initialState: Partial<GameState> = {
      config: config ? { 
        ...config, 
        tournaments: tournamentsData?.tournaments || [],
        activeTournament
      } : undefined,
      live: mergedLiveState,
      _initialConfigLoadComplete: false,
    }

    return NextResponse.json(initialState);
  } catch (error) {
    if (error instanceof Error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unknown server error occurred on the server.'}, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_READ_ONLY === 'true') {
    return NextResponse.json({ success: false, message: 'La aplicación está en modo de solo lectura. No se permiten escrituras.' }, { status: 403 });
  }

  try {
    const { config, live } = await request.json() as { config?: ConfigState; live?: LiveState };

    if (config) {
        const { tournaments, ...baseConfig } = config;

        // Save tournaments separately to tournaments.json
        if (tournaments && tournaments.length > 0) {
            const tournamentMetas = tournaments.map(t => ({ id: t.id, name: t.name, code: t.code, status: t.status }));
            await writeTournaments({ tournaments: tournamentMetas });
            setTournaments({ tournaments: tournamentMetas }); // Update in-memory cache
        }

        // Save config without tournaments to config.json
        await writeConfig(baseConfig as ConfigState);
        setConfig(config); // Update in-memory cache with full config (including tournaments)
    }

    if (live) {
        // Separate shotsMetrics from live state for storage optimization
        const { shotsLog, goalkeeperChangesLog, ...liveWithoutMetrics } = live;

        const shotsMetrics: ShotsMetrics = {
          shotsLog: shotsLog || { home: [], away: [] },
          goalkeeperChangesLog: goalkeeperChangesLog || { home: [], away: [] }
        };

        // Write both files in parallel for performance
        await Promise.all([
          writeLiveState(liveWithoutMetrics as LiveState),
          writeShotsMetrics(shotsMetrics)
        ]);

        // Update in-memory caches
        setGameState(live); // Keep full state in memory with metrics
        setShotsMetrics(shotsMetrics);
    }

    return NextResponse.json({ success: true, message: 'Data saved successfully.' });
  } catch (error) {
     if (error instanceof Error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unknown server error occurred.'}, { status: 500 });
  }
}
