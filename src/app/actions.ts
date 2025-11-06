
'use server';

import type { GameState, ConfigState, LiveState, Tournament, RemoteCommand } from '@/types';
import { setConfig, setGameState } from '@/lib/server-side-store';
import { writeTournament } from '@/lib/storage';

export async function updateConfigOnServer(config: ConfigState) {
  try {
    // Exclude full tournament data from the main config save
    const { tournaments, ...baseConfig } = config;
    const tournamentMetas = (tournaments || []).map(t => ({ id: t.id, name: t.name, status: t.status }));
    const configToSave = { ...baseConfig, tournaments: tournamentMetas };

    await setConfig(configToSave as ConfigState); // Assuming setConfig is async now
    
    // Note: The actual file write is now handled in the background by setConfig
    return { success: true, message: 'Config updated in memory. Saving to provider.' };
  } catch (error) {
     console.error('Failed to save config on server:', error);
     if (error instanceof Error) {
        return { success: false, message: error.message };
    }
    return { success: false, message: 'An unknown error occurred while saving config data.' };
  }
}

export async function updateGameStateOnServer(live: LiveState) {
    try {
        await setGameState(live); // Assuming setGameState is async now

        // Note: The actual file write is now handled in the background by setGameState
        return { success: true, message: 'Game state updated in memory. Saving to provider.' };
    } catch (error) {
        console.error('Failed to save live game state on server:', error);
        if (error instanceof Error) {
            return { success: false, message: error.message };
        }
        return { success: false, message: 'An unknown error occurred while saving live game state.' };
    }
}


export async function saveTournamentOnServer(tournament: Tournament) {
  try {
    // This function still writes directly to the provider. This is fine.
    await writeTournament(tournament);
    return { success: true, message: `Tournament ${tournament.id} saved.` };
  } catch (error) {
     console.error('Failed to save tournament on server:', error);
     if (error instanceof Error) {
        return { success: false, message: error.message };
    }
    return { success: false, message: 'An unknown error occurred while saving tournament data.' };
  }
}

// Keep sendRemoteCommand as it's used by client components
export async function sendRemoteCommand(command: RemoteCommand) {
  try {
    const response = await fetch('/api/remote-commands', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send command.');
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to send remote command:', error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: 'An unknown error occurred.' };
  }
}
