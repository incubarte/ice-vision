'use server';

/**
 * Server actions for managing match summaries (moving, deleting, cleaning)
 * These run on the server side to access filesystem operations
 */

import { storageProvider } from './storage';
import { updateManifestEntry, removeManifestEntry } from './sync-manifest';

/**
 * Move a summary file to a different folder with optional timestamp
 * @param tournamentId The tournament ID
 * @param matchId The match ID
 * @param targetFolder The target folder (e.g., 'deleted-matches', 'deleted-summaries')
 * @param addTimestamp Whether to add a timestamp to the filename
 */
export async function moveSummary(
  tournamentId: string,
  matchId: string,
  targetFolder: 'deleted-matches' | 'deleted-summaries' | 'orphaned-summaries',
  addTimestamp: boolean = false
): Promise<void> {
  const sourcePath = `tournaments/${tournamentId}/summaries/${matchId}.json`;

  // Generate target filename
  let targetFilename = matchId;
  if (addTimestamp) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    targetFilename = `${matchId}_${timestamp}`;
  }

  const targetPath = `tournaments/${tournamentId}/${targetFolder}/${targetFilename}.json`;

  try {
    // Read the summary from source
    const summaryContent = await storageProvider.readFile(sourcePath);

    // Write to target location
    await storageProvider.writeFile(targetPath, summaryContent);

    // Delete from source
    await storageProvider.deleteFile(sourcePath);

    // Update manifest - remove old entry and add new one
    await removeManifestEntry(sourcePath);
    await updateManifestEntry(targetPath, summaryContent);

    console.log(`[Summary Management] Moved ${sourcePath} to ${targetPath}`);
  } catch (error) {
    console.error(`[Summary Management] Error moving summary:`, error);
    throw error;
  }
}

/**
 * Delete a match and move its summary to deleted-matches folder
 * @param tournamentId The tournament ID
 * @param matchId The match ID
 */
export async function deleteMatchWithSummary(
  tournamentId: string,
  matchId: string
): Promise<void> {
  await moveSummary(tournamentId, matchId, 'deleted-matches', false);
}

/**
 * Clean a match (remove summary but keep match in fixture) and move to deleted-summaries
 * @param tournamentId The tournament ID
 * @param matchId The match ID
 */
export async function cleanMatchSummary(
  tournamentId: string,
  matchId: string
): Promise<void> {
  await moveSummary(tournamentId, matchId, 'deleted-summaries', true);
}
