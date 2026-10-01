import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_PATHS = new Set([
  '/api/auth-ping',
  '/api/admin/verify',
  '/api/sync/match',
  '/api/sync/staff',
  '/api/sync/team-players',
  '/api/sync/add-match',
  '/api/sync/delete-match',
]);

/**
 * Server-side relay to the cloud admin URL.
 * The browser cannot call the cloud directly (CORS), so it calls this
 * same-origin route, which forwards the request server-to-server.
 *
 * Body: { path: string; payload: unknown; adminSecret?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { path, payload, adminSecret } = await request.json() as {
      path: string;
      payload: unknown;
      adminSecret?: string;
    };

    if (!path || !ALLOWED_PATHS.has(path)) {
      return NextResponse.json({ success: false, error: 'Invalid relay path' }, { status: 400 });
    }

    const cloudUrl = process.env.NEXT_PUBLIC_CLOUD_ADMIN_URL || 'https://ice-vision.vercel.app';
    const targetUrl = `${cloudUrl}${path}`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminSecret) headers['x-admin-secret'] = adminSecret;

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ...data, _relayTarget: targetUrl, _relayStatus: res.status }, { status: res.status });
  } catch (error) {
    console.error('[CloudRelay] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
