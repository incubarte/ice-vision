import { NextResponse } from 'next/server';
import type { Tournament } from '@/types';
import { readTournament, readTournaments, readMatchResultsFromSummaries } from '@/lib/data-access';
import { readTournamentCache, writeTournamentCache, isTournamentCacheFresh } from '@/lib/tournament-cache-store';

const LOCAL_MODE = process.env.NEXT_PUBLIC_LOCAL_MODE === 'true';

/**
 * Lightweight tournament endpoint — teams, clubs, categories, matches (with results).
 * No summaries, no staff.
 *
 * LOCAL_MODE:  local-first. Serves from cache if < 5 min old (no disk read).
 *              If stale or forced, reads from local filesystem (STORAGE_PROVIDER=local),
 *              updates cache, and returns fresh data. No cloud call — local disk is truth.
 *              Pass ?force=true to bypass the cache (e.g. manual "Actualizar" button).
 *
 * Cloud/non-LOCAL_MODE: reads from storageProvider directly (Supabase).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: tournamentId } = await params;

    if (LOCAL_MODE) {
        const force = new URL(request.url).searchParams.get('force') === 'true';

        // Serve from cache if fresh and not forced
        if (!force && isTournamentCacheFresh(tournamentId)) {
            const cached = readTournamentCache(tournamentId)!;
            console.log(`[lite] Serving from cache (age: ${Math.round((Date.now() - new Date(cached.cachedAt).getTime()) / 1000)}s)`);
            return NextResponse.json({ tournament: cached.tournament, matchResults: cached.matchResults ?? {} });
        }

        // LOCAL_MODE: read from local filesystem (source of truth).
        // STORAGE_PROVIDER=local means readTournament/readTournaments/readMatchResultsFromSummaries
        // all read from local disk — no cloud call needed.
        try {
            const [tournamentDetails, tournamentsData, matchResults] = await Promise.all([
                readTournament(tournamentId, { includeSummaries: false }),
                readTournaments(),
                readMatchResultsFromSummaries(tournamentId),
            ]);

            if (!tournamentDetails) {
                const tournamentMeta = (tournamentsData?.tournaments || []).find((t: any) => t.id === tournamentId);
                if (!tournamentMeta) {
                    return NextResponse.json({ message: `Tournament ${tournamentId} not found` }, { status: 404 });
                }
                return NextResponse.json({ tournament: { ...tournamentMeta, id: tournamentId, teams: [], categories: [], clubs: [], matches: [] }, matchResults: {} });
            }

            const tournamentMeta = (tournamentsData?.tournaments || []).find((t: any) => t.id === tournamentId);
            const tournament = {
                ...tournamentMeta,
                id: tournamentId,
                clubs: tournamentDetails.clubs || [],
                teams: tournamentDetails.teams || [],
                categories: tournamentDetails.categories || [],
                matches: tournamentDetails.matches || [],
            };

            // Keep cache warm so display windows (scoreboard) get fresh data without disk reads
            writeTournamentCache(tournament as Tournament, matchResults);

            return NextResponse.json({ tournament, matchResults });
        } catch (err) {
            console.error(`[lite] Local read failed for ${tournamentId}:`, err instanceof Error ? err.message : err);

            // Fall back to stale cache if local read fails
            const staleCache = readTournamentCache(tournamentId);
            if (staleCache) {
                console.warn(`[lite] Using stale cache (age: ${Math.round((Date.now() - new Date(staleCache.cachedAt).getTime()) / 1000)}s)`);
                return NextResponse.json({ tournament: staleCache.tournament, matchResults: staleCache.matchResults ?? {} });
            }

            return NextResponse.json(
                { message: 'Local read failed and no cache available.' },
                { status: 503 }
            );
        }
    }

    // Non-LOCAL_MODE: read from storageProvider (Supabase in cloud deployments)
    try {
        const [tournamentDetails, tournamentsData, matchResults] = await Promise.all([
            readTournament(tournamentId, { includeSummaries: false }),
            readTournaments(),
            readMatchResultsFromSummaries(tournamentId),
        ]);

        if (!tournamentDetails) {
            const tournamentMeta = (tournamentsData?.tournaments || []).find((t: any) => t.id === tournamentId);
            if (!tournamentMeta) {
                return NextResponse.json({ message: `Tournament ${tournamentId} not found` }, { status: 404 });
            }
            return NextResponse.json({ tournament: { ...tournamentMeta, teams: [], categories: [], clubs: [], matches: [] }, matchResults: {} });
        }

        const tournamentMeta = (tournamentsData?.tournaments || []).find((t: any) => t.id === tournamentId);

        return NextResponse.json({
            tournament: {
                ...tournamentMeta,
                id: tournamentId,
                clubs: tournamentDetails.clubs || [],
                teams: tournamentDetails.teams || [],
                categories: tournamentDetails.categories || [],
                matches: tournamentDetails.matches || [],
            },
            matchResults,
        });
    } catch (error) {
        if (error instanceof Error) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
        return NextResponse.json({ message: 'An unknown server error occurred.' }, { status: 500 });
    }
}
