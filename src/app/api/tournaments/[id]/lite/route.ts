import { NextResponse } from 'next/server';
import { readTournament, readTournaments, readMatchResultsFromSummaries } from '@/lib/data-access';

/**
 * Lightweight tournament endpoint — teams, clubs, categories, matches (with results).
 * No summaries, no staff.
 *
 * Reads from storageProvider: local disk (LOCAL_MODE / STORAGE_PROVIDER=local)
 * or Supabase (cloud deployments). No caching — disk is the source of truth.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: tournamentId } = await params;

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
            return NextResponse.json({
                tournament: { ...tournamentMeta, id: tournamentId, teams: [], categories: [], clubs: [], matches: [] },
                matchResults: {},
            });
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
