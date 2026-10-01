import fs from 'fs';
import path from 'path';
import type { Tournament } from '@/types';

export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface TournamentCache {
  cachedAt: string;
  tournament: Tournament;
}

function getCachePath(tournamentId: string): string {
  const storagePath = process.env.STORAGE_PATH
    ? path.resolve(process.cwd(), process.env.STORAGE_PATH)
    : path.join(process.cwd(), 'storage');
  return path.join(storagePath, 'data', `tournament-cache-${tournamentId}.json`);
}

export function readTournamentCache(tournamentId: string): TournamentCache | null {
  try {
    const filePath = getCachePath(tournamentId);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as TournamentCache;
  } catch {
    return null;
  }
}

export function isTournamentCacheFresh(tournamentId: string): boolean {
  const cache = readTournamentCache(tournamentId);
  if (!cache) return false;
  return Date.now() - new Date(cache.cachedAt).getTime() < CACHE_TTL_MS;
}

export function writeTournamentCache(tournament: Tournament): void {
  try {
    const filePath = getCachePath(tournament.id);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const cache: TournamentCache = { cachedAt: new Date().toISOString(), tournament };
    fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[TournamentCache] Failed to write:', err);
  }
}
