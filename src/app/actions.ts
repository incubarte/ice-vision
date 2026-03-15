
'use client';

import type { GameState, ConfigState, LiveState, Tournament, RemoteCommand } from '@/types';
export async function updateConfigOnServer(config: ConfigState) {
  try {
    // Exclude full active tournament data from the main config save
    const { activeTournament, ...configToSave } = config;

    const response = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: configToSave }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save config data.');
    }
    return await response.json();
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
        const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ live }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to save live game state.');
        }
        return await response.json();
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
    const response = await fetch(`/api/tournaments/${tournament.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tournament }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save tournament data.');
    }
    return await response.json();
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

export async function clearVoiceEventsOnServer(matchId: string | null) {
  if (!matchId) return { success: true }; // No matchId, nothing to clear

  try {
    const response = await fetch('/api/voice-events/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to clear voice events.');
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to clear voice events on server:', error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: 'An unknown error occurred while clearing voice events.' };
  }
}

    