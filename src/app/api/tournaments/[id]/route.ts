
import { NextResponse } from 'next/server';
import type { Tournament } from '@/types';
import { readTournament, writeTournament, readTournaments } from '@/lib/data-access';
import { createAdminStorageProvider } from '@/lib/storage';
import { setDirty } from '@/lib/sync-dirty-tracker';
import { readTournamentCache, writeTournamentCache, isTournamentCacheFresh } from '@/lib/tournament-cache-store';

const LOCAL_MODE = process.env.NEXT_PUBLIC_LOCAL_MODE === 'true';
const CLOUD_ADMIN_URL = process.env.NEXT_PUBLIC_CLOUD_ADMIN_URL || 'https://ice-vision.vercel.app';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: tournamentId } = await params;

    // In LOCAL_MODE the local disk is stale — use cache-first, proxy to cloud when stale.
    if (LOCAL_MODE) {
        const force = new URL(request.url).searchParams.get('force') === 'true';

        if (!force && isTournamentCacheFresh(tournamentId)) {
            const cached = readTournamentCache(tournamentId)!;
            return NextResponse.json({ tournament: cached.tournament });
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const cloudRes = await fetch(`${CLOUD_ADMIN_URL}/api/tournaments/${tournamentId}`, {
                cache: 'no-store',
                signal: controller.signal,
            });
            clearTimeout(timeout);
            if (cloudRes.ok) {
                const data = await cloudRes.json();
                if (data.tournament) writeTournamentCache(data.tournament);
                return NextResponse.json(data);
            }
            console.warn(`[tournament] Cloud returned ${cloudRes.status} for ${tournamentId}`);
        } catch (err) {
            console.warn(`[tournament] Cloud unreachable for ${tournamentId}:`, err instanceof Error ? err.message : err);
        }

        // Cloud failed — serve stale cache if available
        const staleCache = readTournamentCache(tournamentId);
        if (staleCache) return NextResponse.json({ tournament: staleCache.tournament });

        return NextResponse.json(
            { message: 'Cloud unavailable. Use tournament-cache fallback.' },
            { status: 503 }
        );
    }

    try {
        const tournamentDetails = await readTournament(tournamentId, { includeSummaries: true });

        if (!tournamentDetails) {
            // If tournament directory doesn't exist, we find its metadata and return a valid empty structure.
            const tournamentsData = await readTournaments();
            const tournamentMeta = (tournamentsData?.tournaments || []).find((t: any) => t.id === tournamentId);

            if (!tournamentMeta) {
                 return NextResponse.json({ message: `Tournament metadata with id ${tournamentId} not found in tournaments.json` }, { status: 404 });
            }
            // Return a valid, empty tournament structure. This is NOT an error.
            return NextResponse.json({ tournament: { ...tournamentMeta, teams: [], categories: [], matches: [] } });
        }

        const tournamentsData = await readTournaments();
        const tournamentMeta = (tournamentsData?.tournaments || []).find((t: any) => t.id === tournamentId);
        
        const fullTournament = {
            ...tournamentMeta,
            ...tournamentDetails,
            id: tournamentId, // Always use the URL param — prevents id: undefined if meta is missing
        };

        return NextResponse.json({ tournament: fullTournament });
    } catch (error) {
        if (error instanceof Error) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
        return NextResponse.json({ message: 'An unknown server error occurred.' }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const adminSecret = request.headers.get('x-admin-secret');
    const isAdminRequest = !!process.env.ADMIN_WRITE_SECRET
        && adminSecret === process.env.ADMIN_WRITE_SECRET;

    if (process.env.NEXT_PUBLIC_READ_ONLY === 'true' && !isAdminRequest) {
        return NextResponse.json({ success: false, message: 'La aplicación está en modo de solo lectura. No se permiten escrituras.' }, { status: 403 });
    }

    const { id: tournamentId } = await params;
    try {
        const { tournament, mirrorClubsToCloud } = await request.json() as { tournament: Tournament; mirrorClubsToCloud?: boolean };

        if (!tournament || tournament.id !== tournamentId) {
            return NextResponse.json({ message: 'Invalid tournament data provided.' }, { status: 400 });
        }

        const provider = isAdminRequest ? createAdminStorageProvider() : undefined;
        await writeTournament(tournament, provider);

        // Mark as pending sync (persists across restarts; cleared on successful sync)
        if (!isAdminRequest) {
            setDirty().catch(err => console.error('[Tournament] Failed to set dirty flag:', err));
        }

        // In local mode, mirror clubs to the cloud when explicitly requested (e.g. password change).
        // Only writes teams.json (clubs/passwords), not the full fixture.
        if (!isAdminRequest && mirrorClubsToCloud && process.env.STORAGE_PROVIDER === 'local' && process.env.SUPABASE_SERVICE_KEY) {
            writeTournament(tournament, createAdminStorageProvider())
                .catch(err => console.error('[Tournament] Cloud clubs mirror failed:', err));
        }

        // Trigger sync if configured (fire and forget - don't wait)
        if (process.env.STORAGE_PROVIDER !== 'supabase_rw') {
            fetch(`${request.url.split('/api/')[0]}/api/sync-trigger`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trigger: 'after-summary-edit' })
            }).catch(err => console.error('[Tournament] Sync trigger failed:', err));
        }

        return NextResponse.json({ success: true, message: `Tournament ${tournamentId} saved successfully.` });
    } catch (error) {
        if (error instanceof Error) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
        return NextResponse.json({ message: 'An unknown server error occurred.' }, { status: 500 });
    }
}
