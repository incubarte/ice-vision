
import { NextResponse } from 'next/server';
import type { GameState, ConfigState, LiveState } from '@/types';
import { setGameState, setConfig, getGameState, getConfig } from '@/lib/server-side-store';
import { readConfig, writeConfig, readLiveState, writeLiveState } from '@/lib/data-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const [config, liveState] = await Promise.all([
        getConfig(),
        getGameState()
    ]);
    
    const initialState: Partial<GameState> = {
      config: config || undefined,
      live: liveState || undefined,
      _initialConfigLoadComplete: false,
    }

    return NextResponse.json(initialState);
  } catch (error) {
    if (error instanceof Error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unknown server error occurred on the server.'}, { status: 500 });
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
        setConfig(config); // Update in-memory cache
    }
    
    if (live) {
        await writeLiveState(live);
        setGameState(live); // Update in-memory cache and emit event
    }

    return NextResponse.json({ success: true, message: 'Data saved successfully.' });
  } catch (error) {
     if (error instanceof Error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unknown server error occurred.'}, { status: 500 });
  }
}
