import { NextResponse } from 'next/server';
import { readTournament, readTournaments } from '@/lib/data-access';
import { readTournamentCache, writeTournamentCache, isTournamentCacheFresh } from '@/lib/tournament-cache-store';

const LOCAL_MODE = process.env.NEXT_PUBLIC_LOCAL_MODE === 'true';
const CLOUD_ADMIN_URL = process.env.NEXT_PUBLIC_CLOUD_ADMIN_URL || 'https://ice-vision.vercel.app';

/**
 * Lightweight tournament endpoint — teams, clubs, categories, matches (with results).
 * No summaries, no staff.
 *
 * LOCAL_MODE:  cache-first proxy. Serves local cache if < 5 min old (no cloud call).
 *              If stale or missing, fetches cloud, updates cache, returns fresh data.
 *              Pass ?force=true to bypass the cache (e.g. manual "Actualizar" button).
 *              Returns 503 when cloud is unreachable and cache is also absent.
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
            return NextResponse.json({ tournament: cached.tournament });
        }

        // Fetch from cloud, update cache
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            // Try /lite first, fall back to full endpoint for older deployments that don't have it
            let cloudRes = await fetch(`${CLOUD_ADMIN_URL}/api/tournaments/${tournamentId}/lite`, {
                cache: 'no-store',
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (cloudRes.status === 404) {
                // /lite not deployed yet on the cloud — use the full endpoint and strip summaries
                const controller2 = new AbortController();
                const timeout2 = setTimeout(() => controller2.abort(), 8000);
                cloudRes = await fetch(`${CLOUD_ADMIN_URL}/api/tournaments/${tournamentId}`, {
                    cache: 'no-store',
                    signal: controller2.signal,
                });
                clearTimeout(timeout2);

                if (cloudRes.ok) {
                    const data = await cloudRes.json();
                    if (data.tournament) {
                        data.tournament.matches = (data.tournament.matches || []).map(
                            ({ summary: _s, ...m }: any) => m
                        );
                        delete data.tournament.staff;
                        writeTournamentCache(data.tournament);
                    }
                    return NextResponse.json(data);
                }
            }

            if (cloudRes.ok) {
                const data = await cloudRes.json();
                if (data.tournament) writeTournamentCache(data.tournament);
                return NextResponse.json(data);
            }

            console.warn(`[lite] Cloud returned ${cloudRes.status} for ${tournamentId}`);
        } catch (err) {
            console.warn(`[lite] Cloud unreachable for ${tournamentId}:`, err instanceof Error ? err.message : err);
        }

        // Cloud failed — try stale cache before giving up
        const staleCache = readTournamentCache(tournamentId);
        if (staleCache) {
            console.warn(`[lite] Using stale cache (age: ${Math.round((Date.now() - new Date(staleCache.cachedAt).getTime()) / 1000)}s)`);
            return NextResponse.json({ tournament: staleCache.tournament });
        }

        return NextResponse.json(
            { message: 'Cloud unavailable. Use tournament-cache fallback.' },
            { status: 503 }
        );
    }

    // Non-LOCAL_MODE: read from storageProvider (Supabase in cloud deployments)
    try {
        const tournamentDetails = await readTournament(tournamentId, { includeSummaries: true });

        if (!tournamentDetails) {
            const tournamentsData = await readTournaments();
            const tournamentMeta = (tournamentsData?.tournaments || []).find((t: any) => t.id === tournamentId);
            if (!tournamentMeta) {
                return NextResponse.json({ message: `Tournament ${tournamentId} not found` }, { status: 404 });
            }
            return NextResponse.json({ tournament: { ...tournamentMeta, teams: [], categories: [], clubs: [], matches: [] } });
        }

        const tournamentsData = await readTournaments();
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
        });
    } catch (error) {
        if (error instanceof Error) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
        return NextResponse.json({ message: 'An unknown server error occurred.' }, { status: 500 });
    }
}
