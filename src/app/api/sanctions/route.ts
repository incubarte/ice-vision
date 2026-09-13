import { NextResponse } from 'next/server';
import type { DisciplinarySanction } from '@/types';
import { readOrgSanctions, upsertOrgSanction } from '@/lib/data-access';
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
  const teamId = searchParams.get('teamId');
  let sanctions = await readOrgSanctions();
  if (teamId) {
    sanctions = sanctions.filter(s => s.teamId === teamId);
  }
  return NextResponse.json({ sanctions });
}

export async function POST(request: Request) {
  const denied = checkWriteAccess(request);
  if (denied) return denied;

  let body: { sanction: Omit<DisciplinarySanction, 'id' | 'createdAt'> & { id?: string; createdAt?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const sanction: DisciplinarySanction = {
    ...body.sanction,
    id: body.sanction.id ?? randomUUID(),
    createdAt: body.sanction.createdAt ?? now,
  };

  const provider = isAdminRequest(request) ? createAdminStorageProvider() : undefined;
  await upsertOrgSanction(sanction, provider);
  return NextResponse.json({ success: true, sanction });
}
