
import { NextResponse } from 'next/server';
import { getRemoteAccessPassword } from '@/lib/server-side-store';

export const dynamic = 'force-dynamic';

const IPIFY_SERVICES = [
  'https://api64.ipify.org?format=json',
  'https://api.ipify.org?format=json',
];

async function fetchPublicIp(): Promise<string | null> {
  for (const url of IPIFY_SERVICES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.ip) return data.ip;
    } catch {
      // try next service
    }
  }
  return null;
}

export async function GET(request: Request) {
  const publicIp = await fetchPublicIp();

  if (!publicIp) {
    // Offline or all external services unreachable — not a server error
    return NextResponse.json(
      { error: 'Sin conexión a internet. No se puede determinar la IP pública.' },
      { status: 503 }
    );
  }

  const password = getRemoteAccessPassword();
  return NextResponse.json({ ip: publicIp, password });
}
