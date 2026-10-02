import { NextResponse } from 'next/server';
import { readTournament, readTournaments } from '@/lib/data-access';
import type { MatchData, MatchResult } from '@/types';

/**
 * Tournament endpoint — teams, clubs, categories, matches with full summaries.
 * Summaries are needed for standings, player stats, and the fixture summary dialog.
 *
 * Reads from storageProvider: local disk (LOCAL_MODE / STORAGE_PROVIDER=local)
 * or Supabase (cloud deployments). No caching — disk is the source of truth.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: tournamentId } = await params;

    try {
        const [tournamentDetails, tournamentsData] = await Promise.all([
            readTournament(tournamentId, { includeSummaries: true }),
            readTournaments(),
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

        // Derive matchResults from already-loaded match data (avoids a second summary scan)
        const matchResults: Record<string, MatchResult> = {};
        for (const match of (tournamentDetails.matches || []) as MatchData[]) {
            if (match.result) {
                matchResults[match.id] = match.result;
            }
        }

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
