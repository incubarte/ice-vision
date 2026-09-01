import { NextRequest, NextResponse } from 'next/server';
import { writeSingleMatchSummary } from '@/lib/data-access';
import { createAdminStorageProvider } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * POST /api/match-summary
 * Saves a single match summary without touching other files
 */
export async function POST(request: NextRequest) {
  const adminSecret = request.headers.get('x-admin-secret');
  const isAdminRequest = !!process.env.ADMIN_WRITE_SECRET
      && adminSecret === process.env.ADMIN_WRITE_SECRET;

  if (process.env.NEXT_PUBLIC_READ_ONLY === 'true' && !isAdminRequest) {
    return NextResponse.json(
      { success: false, message: 'La aplicación está en modo de solo lectura.' },
      { status: 403 }
    );
  }

  try {
    const { tournamentId, matchId, summary } = await request.json();

    if (!tournamentId || !matchId || !summary) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: tournamentId, matchId, summary' },
        { status: 400 }
      );
    }

    // Admin requests use a dedicated rw provider; normal writes use the default provider
    const provider = isAdminRequest ? createAdminStorageProvider() : undefined;
    await writeSingleMatchSummary(tournamentId, matchId, summary, provider);

    // In local mode, mirror summary to Supabase so the cloud (read-only) deployment sees it
    if (!isAdminRequest && process.env.STORAGE_PROVIDER === 'local' && process.env.SUPABASE_SERVICE_KEY) {
      writeSingleMatchSummary(tournamentId, matchId, summary, createAdminStorageProvider())
        .catch(err => console.error('[match-summary] Cloud mirror failed:', err));
    }

    return NextResponse.json({
      success: true,
      message: `Summary for match ${matchId} saved successfully`
    });

  } catch (error) {
    console.error('[API /match-summary] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save match summary',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
