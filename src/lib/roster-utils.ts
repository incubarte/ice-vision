import type { TeamData, PlayerData } from '@/types';

/**
 * Check if a team has enough players with photos to show roster presentation
 * @param team The team to check
 * @param presentPlayers Array of player IDs that are present
 * @param minPhotoPercentage Minimum percentage of present players that must have photos (0.0-1.0)
 * @returns true if team meets criteria for roster presentation
 */
export function teamHasEnoughPhotos(
  team: TeamData,
  presentPlayers: string[],
  minPhotoPercentage: number = 0.5
): boolean {
  if (!team.players || team.players.length === 0) return false;

  const presentTeamPlayers = team.players.filter(p => presentPlayers.includes(p.id));
  if (presentTeamPlayers.length === 0) return false;

  const playersWithPhotos = presentTeamPlayers.filter(p => p.photoFileName).length;
  const photoPercentage = playersWithPhotos / presentTeamPlayers.length;

  return photoPercentage >= minPhotoPercentage;
}

/**
 * Get present players for a team, sorted by position (goalkeepers first) then by jersey number
 * @param team The team
 * @param presentPlayers Array of player IDs that are present
 * @returns Sorted array of present players
 */
export function getPresentPlayersSorted(
  team: TeamData,
  presentPlayers: string[]
): PlayerData[] {
  if (!team.players) {
    return [];
  }

  // Filter present players
  const present = team.players.filter(p => presentPlayers.includes(p.id));

  // Sort: goalkeepers first, then by jersey number
  return present.sort((a, b) => {
    // Goalkeepers first
    if (a.type === 'goalkeeper' && b.type !== 'goalkeeper') return -1;
    if (a.type !== 'goalkeeper' && b.type === 'goalkeeper') return 1;

    // Then sort by number
    const numA = parseInt(a.number, 10);
    const numB = parseInt(b.number, 10);

    if (isNaN(numA) && isNaN(numB)) return 0;
    if (isNaN(numA)) return 1;
    if (isNaN(numB)) return -1;

    return numA - numB;
  });
}

/**
 * Get photo URL for a player
 * @param player The player
 * @param teamName The team name
 * @param tournamentId The tournament ID
 * @returns Photo URL or null if player has no photo
 */
export function getPlayerPhotoUrl(
  player: PlayerData,
  teamName: string,
  tournamentId: string
): string | null {
  if (!player.photoFileName) {
    return null;
  }

  const sanitizedTeamName = teamName
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

  return `/api/storage/read?path=${encodeURIComponent(
    `tournaments/${tournamentId}/players/${sanitizedTeamName}/${player.photoFileName}`
  )}`;
}
