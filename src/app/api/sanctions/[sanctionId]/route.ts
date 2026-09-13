import { NextResponse } from 'next/server';
import type { DisciplinarySanction } from '@/types';
import { readOrgSanctions, upsertOrgSanction, deleteOrgSanction } from '@/lib/data-access';
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
  { params }: { params: Promise<{ sanctionId: string }> }
) {
  const { sanctionId } = await params;
  const sanctions = await readOrgSanctions();
  const sanction = sanctions.find(s => s.id === sanctionId);
  if (!sanction) return NextResponse.json({ message: 'Sanción no encontrada' }, { status: 404 });
  return NextResponse.json({ sanction });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ sanctionId: string }> }
) {
  const denied = checkWrite(request);
  if (denied) return denied;

  const { sanctionId } = await params;
  const sanctions = await readOrgSanctions();
  const existing = sanctions.find(s => s.id === sanctionId);
  if (!existing) return NextResponse.json({ message: 'Sanción no encontrada' }, { status: 404 });

  let body: { sanction: Partial<DisciplinarySanction> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const updated: DisciplinarySanction = {
    ...existing,
    ...body.sanction,
    id: sanctionId,              // never override id
    createdAt: existing.createdAt, // never override createdAt
  };

  const provider = isAdmin(request) ? createAdminStorageProvider() : undefined;
  await upsertOrgSanction(updated, provider);
  return NextResponse.json({ success: true, sanction: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sanctionId: string }> }
) {
  const denied = checkWrite(request);
  if (denied) return denied;

  const { sanctionId } = await params;
  const provider = isAdmin(request) ? createAdminStorageProvider() : undefined;
  await deleteOrgSanction(sanctionId, provider);
  return NextResponse.json({ success: true });
}
