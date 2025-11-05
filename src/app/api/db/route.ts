
import { NextResponse } from 'next/server';
import type { GameState, ConfigState, LiveState } from '@/types';
import { setGameState, setConfig } from '@/lib/server-side-store';
import { readConfig, writeConfig, readLiveState, writeLiveState } from '@/lib/storage';

export async function GET(request: Request) {
  try {
    const [config, liveState] = await Promise.all([
        readConfig(),
        readLiveState()
    ]);
    
    // Si la lectura falla (ej. archivo no encontrado en Drive), el proveedor devolverá {} o null.
    // Lo manejamos aquí para asegurar que siempre haya una estructura válida.
    const validConfig = config || {};
    const validLiveState = liveState || {};

    // Store in-memory for other API routes to access
    setConfig(validConfig as ConfigState);
    setGameState(validLiveState as LiveState);

    const initialState: Partial<GameState> = {
      config: validConfig,
      live: validLiveState,
      _initialConfigLoadComplete: false,
    }

    return NextResponse.json(initialState);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred.';
    console.error(`[API/DB] CRITICAL ERROR fetching initial data:`, errorMessage);
    // Devolvemos un error 500 con el mensaje específico para que el cliente pueda mostrarlo.
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_READ_ONLY === 'true') {
    return NextResponse.json({ success: false, message: 'La aplicación está en modo de solo lectura. No se permiten escrituras.' }, { status: 403 });
  }

  try {
    const { config, live } = await request.json() as { config?: ConfigState; live?: LiveState };

    if (config) {
        const { tournaments, ...baseConfig } = config;
        const tournamentMetas = (tournaments || []).map(t => ({ id: t.id, name: t.name, status: t.status }));
        const configToSave = { ...baseConfig, tournaments: tournamentMetas };
        
        await writeConfig(configToSave as ConfigState);
        setConfig(config); // Update in-memory store
    }
    
    if (live) {
        await writeLiveState(live);
        setGameState(live); // Update in-memory store and emit event
    }

    return NextResponse.json({ success: true, message: 'Data saved successfully.' });
  } catch (error) {
     if (error instanceof Error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unknown server error occurred.'}, { status: 500 });
  }
}
