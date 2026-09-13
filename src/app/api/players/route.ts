import { NextResponse } from 'next/server';
import type { PlayerProfile } from '@/types';
import { readPlayerProfiles, upsertPlayerProfile } from '@/lib/data-access';
import { createAdminStorageProvider } from '@/lib/storage';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

function isAdminRequest(request: Request): boolean {
  const secret = request.headers.get('x-admin-secret');
  return !!process.env.ADMIN_WRITE_SECRET && secret === process.env.ADMIN_WRITE_SECRET;
}

function checkWriteAccess(request: Request): NextResponse | null {
  if (process.env.NEXT_PUBLIC_READ_ONLY === 'true' && !isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Modo solo lectura.' }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim().toLowerCase();
  let players = await readPlayerProfiles();
  if (q) {
    players = players.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.document?.docNumber?.toLowerCase().includes(q))
    );
  }
  return NextResponse.json({ players });
}

export async function POST(request: Request) {
  const denied = checkWriteAccess(request);
  if (denied) return denied;

  let body: { player: Omit<PlayerProfile, 'id' | 'createdAt' | 'updatedAt'> & { id?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const player: PlayerProfile = {
    ...body.player,
    id: body.player.id ?? randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  const provider = isAdminRequest(request) ? createAdminStorageProvider() : undefined;
  await upsertPlayerProfile(player, provider);
  return NextResponse.json({ success: true, player });
}
