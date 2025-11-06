
import { NextResponse } from 'next/server';
import { getRemoteAccessPassword } from '@/lib/server-side-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // To get the server's public IP, we need to make a request to an external service
    // that can see the IP from which the request originates.
    const ipResponse = await fetch('https://api64.ipify.org?format=json', { cache: 'no-store' });

    if (!ipResponse.ok) {
      throw new Error(`External IP service failed with status: ${ipResponse.status}`);
    }

    const data = await ipResponse.json();
    const publicIp = data.ip;

    if (!publicIp) {
      return NextResponse.json({ error: 'No se pudo determinar la IP pública del servidor.' }, { status: 500 });
    }

    // Also return the password
    const password = await getRemoteAccessPassword();

    return NextResponse.json({ ip: publicIp, password: password });
  } catch (error) {
    console.error("Error fetching server's public IP:", error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: `Error interno del servidor al obtener la IP: ${errorMessage}` }, { status: 500 });
  }
}
