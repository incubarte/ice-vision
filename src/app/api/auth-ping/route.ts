import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Simple endpoint to verify whether the provided x-admin-secret is valid.
 * Used by the local app to test the cloud sync key before saving it.
 */
export async function POST(request: NextRequest) {
  const adminSecret = request.headers.get('x-admin-secret');
  const isValid = !!process.env.ADMIN_WRITE_SECRET && adminSecret === process.env.ADMIN_WRITE_SECRET;

  if (!isValid) {
    return NextResponse.json({ ok: false, message: 'Clave incorrecta.' }, { status: 403 });
  }

  return NextResponse.json({ ok: true, message: 'Clave válida.' });
}
