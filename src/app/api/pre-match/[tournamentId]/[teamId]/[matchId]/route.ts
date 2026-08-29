import { NextResponse } from 'next/server';
import { readPreMatchData, writePreMatchData, deletePreMatchData } from '@/lib/data-access';
import { createPreMatchStorageProvider } from '@/lib/storage';
import type { PreMatchData } from '@/types';

export const dynamic = 'force-dynamic';

const PASSWORD = 'IceVision';

function checkPassword(request: Request): boolean {
  return request.headers.get('x-pre-match-password') === PASSWORD;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tournamentId: string; teamId: string; matchId: string }> }
) {
  const { tournamentId, teamId, matchId } = await params;
  let data = await readPreMatchData(tournamentId, matchId, teamId);

  // Fallback: if not found locally, try Supabase (local instance reading cloud-saved data)
  if (!data && process.env.SUPABASE_URL) {
    try {
      data = await readPreMatchData(tournamentId, matchId, teamId, createPreMatchStorageProvider());
    } catch {
      // Supabase not reachable — no fallback available
    }
  }

  if (!data) {
    return NextResponse.json({ exists: false }, { status: 404 });
  }
  return NextResponse.json({ exists: true, data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string; teamId: string; matchId: string }> }
) {
  if (!checkPassword(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { tournamentId, teamId, matchId } = await params;

  let body: { data: PreMatchData };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const { data } = body;
  if (data.tournamentId !== tournamentId || data.matchId !== matchId || data.teamId !== teamId) {
    return NextResponse.json({ message: 'Mismatched IDs' }, { status: 400 });
  }

  await writePreMatchData(data);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string; teamId: string; matchId: string }> }
) {
  if (!checkPassword(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { tournamentId, teamId, matchId } = await params;
  await deletePreMatchData(tournamentId, matchId, teamId);
  return NextResponse.json({ success: true });
}
