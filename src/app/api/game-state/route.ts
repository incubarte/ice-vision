

import { NextResponse } from 'next/server';
import { getGameState, getConfig } from '@/lib/server-side-store';
import type { LiveGameState, PenaltyTypeDefinition, MobileData } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const [liveState, config] = await Promise.all([getGameState(), getConfig()]);

    if (!liveState || !config) {
      return NextResponse.json({ message: 'Game state not initialized on the server yet.' }, { status: 404 });
    }

    const dataForMobile: MobileData = {
        gameState: liveState,
        penaltyConfig: {
            penaltyTypes: config.penaltyTypes || [],
            defaultPenaltyTypeId: config.defaultPenaltyTypeId || null,
        }
    };
    
    return NextResponse.json(dataForMobile);
  } catch (error) {
    console.error("Error fetching live game state:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: `Internal server error: ${errorMessage}` }, { status: 500 });
  }
}
