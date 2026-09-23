import { NextRequest, NextResponse } from 'next/server';
import { readTournaments, readTournament, writeTournament } from '@/lib/data-access';
import { createAdminStorageProvider } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * One-time migration: reads each match summary and writes the derived MatchResult
 * back into fixture.json. After running this, the /lite endpoint no longer needs
 * to read summary files to show standings.
 *
 * Safe to run multiple times — skips matches that already have a result.
 */
export async function POST(request: NextRequest) {
  const adminSecret = request.headers.get('x-admin-secret');
  const isAdminRequest = !!process.env.ADMIN_WRITE_SECRET
    && adminSecret === process.env.ADMIN_WRITE_SECRET;

  if (process.env.NEXT_PUBLIC_READ_ONLY === 'true' && !isAdminRequest) {
    return NextResponse.json({ success: false, message: 'Modo solo lectura.' }, { status: 403 });
  }

  try {
    const { tournaments = [] } = await readTournaments();
    const provider = isAdminRequest ? createAdminStorageProvider() : undefined;

    const report: { tournamentId: string; migrated: number; skipped: number; errors: number }[] = [];

    for (const meta of tournaments) {
      // includeSummaries: true reads summaries and derives result for legacy matches
      const tournament = await readTournament(meta.id, { includeSummaries: true });
      if (!tournament || !tournament.matches) {
        report.push({ tournamentId: meta.id, migrated: 0, skipped: 0, errors: 0 });
        continue;
      }

      let migrated = 0;
      let skipped = 0;

      for (const match of tournament.matches) {
        if (match.result) migrated++;
        else skipped++; // no summary found, nothing to derive
      }

      // writeTournament saves fixture.json with the derived results now in place
      await writeTournament({ ...tournament, id: meta.id } as any, provider);

      report.push({ tournamentId: meta.id, migrated, skipped, errors: 0 });
      console.log(`[Migrate/DeriveResults] Tournament ${meta.id}: ${migrated} results written, ${skipped} matches without summary`);
    }

    const totalMigrated = report.reduce((s, r) => s + r.migrated, 0);
    return NextResponse.json({ success: true, report, totalMigrated });
  } catch (error) {
    console.error('[Migrate/DeriveResults] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
