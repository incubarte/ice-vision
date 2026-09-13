import { NextResponse } from 'next/server';
import type { PlayerProfile } from '@/types';
import { readPlayerProfile, upsertPlayerProfile, deletePlayerProfile } from '@/lib/data-access';
import { createAdminStorageProvider } from '@/lib/storage';

export const dynamic = 'force-dynamic';

function isAdmin(request: Request): boolean {
  const secret = request.headers.get('x-admin-secret');
  return !!process.env.ADMIN_WRITE_SECRET && secret === process.env.ADMIN_WRITE_SECRET;
}

function checkWrite(request: Request): NextResponse | null {
  if (process.env.NEXT_PUBLIC_READ_ONLY === 'true' && !isAdmin(request)) {
    return NextResponse.json({ success: false, message: 'Modo solo lectura.' }, { status: 403 });
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await params;
  const player = await readPlayerProfile(playerId);
  if (!player) return NextResponse.json({ message: 'Jugador no encontrado' }, { status: 404 });
  return NextResponse.json({ player });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const denied = checkWrite(request);
  if (denied) return denied;

  const { playerId } = await params;
  const existing = await readPlayerProfile(playerId);
  if (!existing) return NextResponse.json({ message: 'Jugador no encontrado' }, { status: 404 });

  let body: { player: Partial<PlayerProfile> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const updated: PlayerProfile = {
    ...existing,
    ...body.player,
    id: playerId,           // never override id
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const provider = isAdmin(request) ? createAdminStorageProvider() : undefined;
  await upsertPlayerProfile(updated, provider);
  return NextResponse.json({ success: true, player: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const denied = checkWrite(request);
  if (denied) return denied;

  const { playerId } = await params;
  const provider = isAdmin(request) ? createAdminStorageProvider() : undefined;
  await deletePlayerProfile(playerId, provider);
  return NextResponse.json({ success: true });
}
