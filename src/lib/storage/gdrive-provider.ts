
// Este archivo contendrá la lógica para interactuar con Google Drive.
// Por ahora, contiene funciones placeholder para que la aplicación compile.

import type { ConfigState, LiveState, Tournament } from '@/types';

export async function readConfig(): Promise<Partial<ConfigState>> {
  console.warn("gdrive-provider readConfig not implemented");
  // En el futuro, leerá config.json desde Google Drive
  return {};
}

export async function writeConfig(config: ConfigState): Promise<void> {
  console.warn("gdrive-provider writeConfig not implemented");
  // En el futuro, escribirá config.json en Google Drive
}

export async function readLiveState(): Promise<Partial<LiveState>> {
  console.warn("gdrive-provider readLiveState not implemented");
  // En el futuro, leerá live.json desde Google Drive
  return {};
}

export async function writeLiveState(liveState: LiveState): Promise<void> {
  console.warn("gdrive-provider writeLiveState not implemented");
  // En el futuro, escribirá live.json en Google Drive
}

export async function readTournament(tournamentId: string): Promise<Partial<Tournament> | null> {
    console.warn("gdrive-provider readTournament not implemented");
    // En el futuro, leerá los datos del torneo desde Google Drive
    return null;
}

export async function writeTournament(tournament: Tournament): Promise<void> {
    console.warn("gdrive-provider writeTournament not implemented");
    // En el futuro, escribirá los datos del torneo en Google Drive
}
