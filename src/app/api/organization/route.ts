import { NextResponse } from 'next/server';
import type { Organization } from '@/types';
import { readOrganization, writeOrganization } from '@/lib/data-access';
import { createAdminStorageProvider } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const org = await readOrganization();
  return NextResponse.json({ organization: org });
}

export async function POST(request: Request) {
  const adminSecret = request.headers.get('x-admin-secret');
  const isAdminRequest = !!process.env.ADMIN_WRITE_SECRET
    && adminSecret === process.env.ADMIN_WRITE_SECRET;

  if (process.env.NEXT_PUBLIC_READ_ONLY === 'true' && !isAdminRequest) {
    return NextResponse.json({ success: false, message: 'Modo solo lectura.' }, { status: 403 });
  }

  let body: { organization: Organization };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const provider = isAdminRequest ? createAdminStorageProvider() : undefined;
  await writeOrganization(body.organization, provider);
  return NextResponse.json({ success: true });
}
