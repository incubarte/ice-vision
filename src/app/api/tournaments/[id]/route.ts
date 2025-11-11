
import { NextResponse } from 'next/server';
import type { Tournament } from '@/types';
import { readTournament, writeTournament, readTournaments } from '@/lib/data-access';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const tournamentId = params.id;
    try {
        const tournamentDetails = await readTournament(tournamentId);

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
        };
        
        return NextResponse.json({ tournament: fullTournament });
    } catch (error) {
        if (error instanceof Error) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
        return NextResponse.json({ message: 'An unknown server error occurred.' }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
    if (process.env.NEXT_PUBLIC_READ_ONLY === 'true') {
        return NextResponse.json({ success: false, message: 'La aplicación está en modo de solo lectura. No se permiten escrituras.' }, { status: 403 });
    }

    const tournamentId = params.id;
    try {
        const { tournament } = await request.json() as { tournament: Tournament };

        if (!tournament || tournament.id !== tournamentId) {
            return NextResponse.json({ message: 'Invalid tournament data provided.' }, { status: 400 });
        }
        
        await writeTournament(tournament);

        return NextResponse.json({ success: true, message: `Tournament ${tournamentId} saved successfully.` });
    } catch (error) {
        if (error instanceof Error) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
        return NextResponse.json({ message: 'An unknown server error occurred.' }, { status: 500 });
    }
}
