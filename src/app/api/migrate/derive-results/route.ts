import { NextRequest, NextResponse } from 'next/server';
import { writeTournament } from '@/lib/data-access';
import { calculateScoreFromSummary, hasOvertimeOrShootout } from '@/lib/match-helpers';
import { createAdminStorageProvider } from '@/lib/storage';
import type { GameSummary, MatchData, Tournament, TournamentsData } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * Migration: downloads fixture + summaries from Supabase (cloud), derives the
 * correct MatchResult (including resultType: overtime/shootout/regulation) and
 * writes the corrected fixture.json back to Supabase.
 *
 * Safe to run multiple times — always re-derives from summary when one exists,
 * so it corrects previously-written wrong resultTypes.
 *
 * Requires admin credentials (x-admin-secret header).
 */
export async function POST(request: NextRequest) {
  const adminSecret = request.headers.get('x-admin-secret');
  // If ADMIN_WRITE_SECRET is configured, enforce it. Otherwise allow (local dev without the var set).
  // The actual data access is still protected by SUPABASE_SERVICE_KEY inside createAdminStorageProvider().
  const secretConfigured = !!process.env.ADMIN_WRITE_SECRET;
  const isAdminRequest = !secretConfigured || adminSecret === process.env.ADMIN_WRITE_SECRET;

  if (!isAdminRequest) {
    return NextResponse.json({ success: false, message: 'Se requiere clave de administrador.' }, { status: 403 });
  }

  try {
    // Use the admin (RW Supabase) provider for ALL reads so we always pull from
    // the cloud regardless of the local STORAGE_PROVIDER setting.
    const adminProvider = createAdminStorageProvider();

    // 1. Download tournaments list from cloud
    let tournamentsData: TournamentsData;
    try {
      const raw = await adminProvider.readFile('tournaments.json');
      tournamentsData = JSON.parse(raw) as TournamentsData;
    } catch {
      return NextResponse.json({ success: false, error: 'No se pudo leer tournaments.json desde Supabase' }, { status: 500 });
    }

    const { tournaments = [] } = tournamentsData;
    const report: { tournamentId: string; migrated: number; corrected: number; skipped: number; errors: number }[] = [];

    for (const meta of tournaments) {
      if (!meta.id) continue;
      const tournamentPrefix = `tournaments/${meta.id}/`;
      const fixtureKey = `${tournamentPrefix}fixture.json`;
      const teamsKey = `${tournamentPrefix}teams.json`;

      // 2. Download fixture + teams from cloud
      let fixtureData: { matches: MatchData[] } | null = null;
      let teamsData: Partial<Tournament> | null = null;
      try {
        const [fixtureRaw, teamsRaw] = await Promise.all([
          adminProvider.readFile(fixtureKey).catch(() => null),
          adminProvider.readFile(teamsKey).catch(() => null),
        ]);
        if (fixtureRaw) fixtureData = JSON.parse(fixtureRaw);
        if (teamsRaw) teamsData = JSON.parse(teamsRaw);
      } catch {
        report.push({ tournamentId: meta.id, migrated: 0, corrected: 0, skipped: 0, errors: 1 });
        continue;
      }

      if (!fixtureData?.matches) {
        report.push({ tournamentId: meta.id, migrated: 0, corrected: 0, skipped: 0, errors: 0 });
        continue;
      }

      let migrated = 0;   // had no result, now derived
      let corrected = 0;  // had wrong resultType, now fixed
      let skipped = 0;    // no summary available
      let errors = 0;

      const updatedMatches: MatchData[] = [];

      for (const match of fixtureData.matches) {
        const summaryKey = `${tournamentPrefix}summaries/${match.id}.json`;
        let summary: GameSummary | null = null;
        try {
          const raw = await adminProvider.readFile(summaryKey);
          summary = JSON.parse(raw) as GameSummary;
        } catch { /* no summary in cloud */ }

        if (!summary) {
          updatedMatches.push(match);
          skipped++;
          continue;
        }

        try {
          const scores = calculateScoreFromSummary(summary);
          const wentToOT = hasOvertimeOrShootout(summary);
          const hadShootout = !!(summary.shootout &&
            (summary.shootout.homeAttempts.length > 0 || summary.shootout.awayAttempts.length > 0));
          const correctResultType = hadShootout ? 'shootout' : wentToOT ? 'overtime' : 'regulation';
          const derivedResult = {
            homeScore: scores.home,
            awayScore: scores.away,
            resultType: correctResultType as 'regulation' | 'overtime' | 'shootout',
            finishedAt: (summary as any)?.endedAt || match.result?.finishedAt || new Date().toISOString(),
          };

          const wasWrong = match.result && match.result.resultType !== correctResultType;
          const wasNew = !match.result;
          if (wasNew) migrated++;
          else if (wasWrong) corrected++;

          updatedMatches.push({ ...match, result: derivedResult });
        } catch (e) {
          console.error(`[Migrate/DeriveResults] Error deriving match ${match.id}:`, e);
          updatedMatches.push(match);
          errors++;
        }
      }

      // 3. Write corrected fixture back to cloud via admin provider
      const tournamentToWrite: Tournament = {
        id: meta.id,
        name: (teamsData as any)?.name || meta.name || '',
        status: (teamsData as any)?.status || meta.status || 'active',
        clubs: (teamsData as any)?.clubs || [],
        teams: (teamsData as any)?.teams || [],
        categories: (teamsData as any)?.categories || [],
        staff: (teamsData as any)?.staff,
        matches: updatedMatches,
      };
      await writeTournament(tournamentToWrite, adminProvider);

      report.push({ tournamentId: meta.id, migrated, corrected, skipped, errors });
      console.log(`[Migrate/DeriveResults] ${meta.id}: ${migrated} nuevos, ${corrected} corregidos, ${skipped} sin summary, ${errors} errores`);
    }

    const totalMigrated = report.reduce((s, r) => s + r.migrated + r.corrected, 0);
    return NextResponse.json({ success: true, report, totalMigrated });
  } catch (error) {
    console.error('[Migrate/DeriveResults] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
