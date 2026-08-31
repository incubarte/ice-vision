
import { NextResponse } from 'next/server';
import type { Tournament } from '@/types';
import { readTournament, writeTournament, readTournaments } from '@/lib/data-access';
import { createAdminStorageProvider } from '@/lib/storage';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: tournamentId } = await params;
    const url = new URL(request.url);
    const includeSummaries = url.searchParams.get('includeSummaries') === 'true';
    try {
        const tournamentDetails = await readTournament(tournamentId, { includeSummaries });

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
