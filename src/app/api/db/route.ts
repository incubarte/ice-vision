
import { NextResponse } from 'next/server';
import type { GameState, ConfigState, LiveState, TournamentsData, ShotsMetrics, Tournament } from '@/types';
import { setGameState, setConfig, getGameState, getConfig, setTournaments, getTournaments, setShotsMetrics, getShotsMetrics } from '@/lib/server-side-store';
import { readConfig, writeConfig, readLiveState, writeLiveState, readTournaments, writeTournaments, readShotsMetrics, writeShotsMetrics, readTournament } from '@/lib/data-access';
import { checkAndTriggerStartupSync } from '@/lib/sync-dirty-tracker';
import { readPendingSyncs } from '@/lib/pending-syncs-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // On first request after process start, recover any pending sync from a previous session
  const origin = new URL(request.url).origin;
  checkAndTriggerStartupSync(origin);

  try {
    const [config, liveState, shotsMetrics, tournamentsData] = await Promise.all([
        getConfig(),
        getGameState(),
        getShotsMetrics(),
        getTournaments()
    ]);
    const pendingSyncs = readPendingSyncs();

    // Server-side hydration: If a tournament is selected, load its full data
    const persistedSelectedTournamentId = (config as Record<string, unknown>)?.selectedTournamentId as string | null | undefined;
    const persistedSelectedMatchCategory = (config as Record<string, unknown>)?.selectedMatchCategory as string | undefined;
    let activeTournament: Tournament | null = null;
    if (persistedSelectedTournamentId) {
      const tournamentMeta = tournamentsData?.tournaments?.find(t => t.id === persistedSelectedTournamentId);
      if (tournamentMeta) {
        const fullTournament = await readTournament(persistedSelectedTournamentId);
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
      config: config ? { ...config } : undefined,
      tournament: {
        tournaments: tournamentsData?.tournaments || [],
        activeTournament,
        selectedTournamentId: persistedSelectedTournamentId || null,
        selectedMatchCategory: persistedSelectedMatchCategory || '',
      },
      live: mergedLiveState,
      _initialConfigLoadComplete: false,
      _pendingSyncs: pendingSyncs,
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
        // Save config to config.json
        await writeConfig(config);
        setConfig(config); // Update in-memory cache
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
