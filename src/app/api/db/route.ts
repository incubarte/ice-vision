
import { NextResponse } from 'next/server';
import type { GameState } from '@/types';
import { getGameState, getConfig, setGameState, setConfig } from '@/lib/server-side-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Estas funciones ahora esperan a que la inicialización termine.
    // Garantizan que siempre se devolverá un estado válido.
    const [config, liveState] = await Promise.all([
        getConfig(),
        getGameState()
    ]);

    const initialState: Partial<GameState> = {
      config,
      live: liveState,
      _initialConfigLoadComplete: false, // This will be set to true on the client
    }

    return NextResponse.json(initialState);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred.';
    console.error(`[API/DB] CRITICAL ERROR fetching initial data:`, errorMessage);
    // Este error ahora solo debería ocurrir si la inicialización falla catastróficamente.
    return NextResponse.json({ message: `El servidor de datos no está listo o falló al iniciar. Revisa los logs del servidor.`, error: errorMessage }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_READ_ONLY === 'true') {
    return NextResponse.json({ success: false, message: 'La aplicación está en modo de solo lectura. No se permiten escrituras.' }, { status: 403 });
  }

  try {
    const { config, live } = await request.json() as { config?: GameState['config']; live?: GameState['live'] };

    // The `setConfig` and `setGameState` functions now handle both
    // updating the in-memory cache and asynchronously writing to the provider.
    if (config) {
        setConfig(config);
    }
    
    if (live) {
        setGameState(live);
    }

    return NextResponse.json({ success: true, message: 'Data saved successfully.' });
  } catch (error) {
     if (error instanceof Error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unknown server error occurred.'}, { status: 500 });
  }
}
