import { NextResponse } from 'next/server';
import { disconnectTunnel, connectTunnel, getConfig } from '@/lib/server-side-store';

export async function POST(request: Request) {
  const { action, port } = await request.json();
  const currentConfig = await getConfig(); // Now async
  let tunnelState = currentConfig?.tunnel;

  if (action === 'connect') {
    if (!port) {
      return NextResponse.json({ success: false, message: 'El puerto es requerido.' }, { status: 400 });
    }
    
    // Always disconnect first to ensure no stale tunnels
    await disconnectTunnel();
    
    const result = await connectTunnel(port);

    return NextResponse.json({
        success: result.status === 'connected',
        message: result.lastMessage || (result.status === 'connected' ? 'Túnel conectado.' : 'Iniciando conexión...'),
        ...result
    });

  } else if (action === 'disconnect') {
    await disconnectTunnel();
    return NextResponse.json({ success: true, message: 'Túnel desconectado.', status: 'disconnected', url: null, subdomain: null });
  
  } else if (action === 'status') {
    // Re-fetch config to get the most current state after potential updates.
    tunnelState = (await getConfig())?.tunnel;
    return NextResponse.json({ success: true, ...tunnelState });

  } else if (action === 'health-check') {
    tunnelState = (await getConfig())?.tunnel;
    if (!tunnelState || tunnelState.status !== 'connected' || !tunnelState.url) {
        return NextResponse.json({ success: true, status: 'disconnected' });
    }
    try {
        const response = await fetch(tunnelState.url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        if (response.status >= 500) { // Localtunnel shows a page with 502/504 if the tunnel is down
            return NextResponse.json({ success: true, status: 'error', message: `Tunnel is unresponsive (status: ${response.status})` });
        }
        return NextResponse.json({ success: true, status: 'connected' });
    } catch (error) {
        console.warn("[Tunnel Health Check] Error:", error);
        return NextResponse.json({ success: true, status: 'error', message: 'Tunnel fetch failed.' });
    }
  }

  return NextResponse.json({ success: false, message: 'Acción no válida.' }, { status: 400 });
}
