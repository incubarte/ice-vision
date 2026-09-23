import { NextRequest, NextResponse } from 'next/server';
import { readPendingSyncs, writePendingSyncs } from '@/lib/pending-syncs-store';
import type { PendingSync } from '@/types';

export const dynamic = 'force-dynamic';

// GET — list all pending syncs
export async function GET() {
  const syncs = readPendingSyncs();
  return NextResponse.json(syncs);
}

// POST — replace the entire list (client sends the full updated array)
export async function POST(request: NextRequest) {
  try {
    const syncs = await request.json() as PendingSync[];
    writePendingSyncs(syncs);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
