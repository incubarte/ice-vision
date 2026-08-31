// Force rebuild 1
import { createClient } from '@supabase/supabase-js';
import { readManifest, hashContent, writeManifest, getGMTTimestamp, updatePreviousVersionAfterSync } from './sync-manifest';
import type { SyncManifest, FileMetadata, SyncPlan, SyncPlanConflict, SyncLogFileEntry } from '@/types';
import { storageProvider } from './storage';
import { addSyncLog, addSyncError } from './sync-logs';
import { writePlan, deletePlan, readPlan, updatePlanStatus } from './sync-plan';
import { systemEmitter } from './server-side-store';
import path from 'path';
import fs from 'fs/promises';

/**
 * Check if a file is binary based on extension
 */
function isBinaryFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf'].includes(ext);
}

/**
 * Check if a file is a player photo (should not be auto-downloaded during sync).
 * Photos are uploaded local→cloud but fetched on-demand in the app.
 */
function isPlayerPhoto(filePath: string): boolean {
    return isBinaryFile(filePath) && /^tournaments\/[^/]+\/players\//.test(filePath);
}

/**
 * Get content type for a file based on extension
 */
function getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.pdf': 'application/pdf',
        '.json': 'application/json'
    };
    return contentTypeMap[ext] || 'application/octet-stream';
}

/**
 * Prepare content for Supabase upload
 * Converts Buffer to Blob with correct content type for binary files
 */
function prepareContentForUpload(content: string | Buffer, filePath: string): Blob | string {
    if (content instanceof Buffer) {
        const contentType = getContentType(filePath);
        return new Blob([content], { type: contentType });
    }
    return content;
}

/**
 * Read local file with correct encoding (binary or utf-8)
 */
async function readLocalFile(filePath: string): Promise<string | Buffer> {
    if (isBinaryFile(filePath)) {
        return await storageProvider.readBinaryFile(filePath);
    }
    return await storageProvider.readFile(filePath);
}

export interface SyncDifference {
    filePath: string;
    action: 'upload' | 'download' | 'conflict' | 'skip';
    reason: string;
    localVersion?: FileMetadata;
    remoteVersion?: FileMetadata;
}

export interface SyncAnalysis {
    toUpload: SyncDifference[];
    toDownload: SyncDifference[];
    conflicts: SyncDifference[];
    unchanged: SyncDifference[];
    summary: {
        totalFiles: number;
        uploadCount: number;
        downloadCount: number;
        conflictCount: number;
        unchangedCount: number;
    };
}

/**
 * Compare local and remote manifests and create a sync plan
 * The plan is saved to sync-plan.json
 */
export async function analyzeSync(): Promise<SyncPlan> {
    try {
        console.log('[Sync] Starting analysis...');

        // 1. Read local manifest
        const localManifest = await readManifest();
        console.log('[Sync] Local manifest loaded:', Object.keys(localManifest.files).length, 'files');

        // 2. Read remote manifest from Supabase
        const remoteManifest = await fetchRemoteManifest();
        const hasRemoteManifest = remoteManifest !== null;
        console.log('[Sync] Remote manifest loaded:', hasRemoteManifest ? Object.keys(remoteManifest!.files).length + ' files' : 'NOT FOUND (first sync)');

        // 3. Build the plan
        const plan: SyncPlan = {
            timestamp: new Date().toISOString(),
            status: 'pending',
            toUpload: [],
            toDownload: [],
            skippedPhotoDownloads: [],
            toDeleteLocally: [],
            toDeleteRemotely: [],
            conflicts: [],
            summary: {
                uploadCount: 0,
                downloadCount: 0,
                skippedPhotoCount: 0,
                deleteLocalCount: 0,
                deleteRemoteCount: 0,
                conflictCount: 0,
                unchangedCount: 0
            }
        };

        // 4. If no remote manifest exists, all local files should be uploaded
        if (!hasRemoteManifest) {
            for (const [filePath, metadata] of Object.entries(localManifest.files)) {
                // Skip files marked as deleted
                if (metadata.deleted) {
                    continue;
                }

                plan.toUpload.push({
                    filePath,
                    hash: metadata.hash
                });
            }
            plan.summary.uploadCount = plan.toUpload.length;
            plan.status = 'ready'; // No conflicts, ready to execute
            await writePlan(plan);
            console.log('[Sync] Plan created: first sync, uploading', plan.toUpload.length, 'files');
            return plan;
        }

        // 5. Compare files
        const allFiles = new Set([
            ...Object.keys(localManifest.files),
            ...Object.keys(remoteManifest.files)
        ]);

        let unchangedCount = 0;

        // Helper: queue a file for download, skipping player photos (fetched on-demand by the app)
        const queueDownload = (filePath: string, hash: string) => {
            if (isPlayerPhoto(filePath)) {
                plan.skippedPhotoDownloads.push({ filePath, hash });
            } else {
                plan.toDownload.push({ filePath, hash });
            }
        };

        // Helper to check for unreferenced files
        // Use readTournaments directly to avoid race conditions/cache issues with server-side-store
        const { readTournaments } = await import('./data-access');
        const tournamentsData = await readTournaments();
        const tournaments: any[] = tournamentsData?.tournaments || [];
        console.log(`[Sync Analysis] Loaded ${tournaments.length} tournaments for unreferenced check from disk directly`);

        // Load fixture.json and teams.json for each tournament
        for (const tournament of tournaments) {
            try {
                const fixturePath = path.join('tournaments', tournament.id, 'fixture.json');
                const fixtureContent = await storageProvider.readFile(fixturePath);
                const fixture = JSON.parse(fixtureContent);
                tournament.matches = fixture.matches || [];
            } catch (error) {
                tournament.matches = [];
            }

            try {
                const teamsPath = path.join('tournaments', tournament.id, 'teams.json');
                const teamsContent = await storageProvider.readFile(teamsPath);
                const teamsData = JSON.parse(teamsContent);
                tournament.teams = teamsData.teams || [];
            } catch (error) {
                tournament.teams = [];
            }
        }

        const extractMatchInfo = (filePath: string) => {
            const summaryMatch = filePath.match(/tournaments\/([^/]+)\/summaries\/([^/]+)\.json/);
            if (!summaryMatch) return null;

            const [, tournamentId, matchId] = summaryMatch;

            // Find the tournament
            let tournament = tournaments.find((t: any) => t.id === tournamentId);

            // If tournament not found, search all tournaments for the match
            if (!tournament) {
                for (const t of tournaments) {
                    if (t.matches?.find((m: any) => m.id === matchId)) {
                        tournament = t;
                        break;
                    }
                }
            }

            // If still no tournament or tournament doesn't have matches loaded
            if (!tournament || !tournament.matches || tournament.matches.length === 0) {
                const tournamentExists = tournaments.find((t: any) => t.id === tournamentId);
                if (tournamentExists) {
                    return { isOutsideFixture: true, tournamentId, matchId };
                }
                return null;
            }

            // Find the match
            const match = tournament.matches.find((m: any) => m.id === matchId);
            if (!match) {
                return { isOutsideFixture: true, tournamentId, matchId };
            }

            return { isOutsideFixture: false, tournamentId, matchId };
        };

        const extractPlayerPhotoInfo = (filePath: string) => {
            // Match pattern: tournaments/{tournamentId}/players/{teamSlug}/{photoFileName}
            const photoMatch = filePath.match(/tournaments\/([^/]+)\/players\/([^/]+)\/([^/]+\.(png|jpg|jpeg|webp))$/i);
            if (!photoMatch) return null;

            const [, tournamentId, teamSlug, photoFileName] = photoMatch;
            const tournament = tournaments.find((t: any) => t.id === tournamentId);

            if (!tournament || !tournament.teams) {
                return { isUnreferenced: true, tournamentId, teamSlug, photoFileName };
            }

            // Check if any team references this player photo by photoFileName
            const isReferenced = tournament.teams.some((team: any) =>
                team.players?.some((player: any) => (player as any).photoFileName === photoFileName)
            );

            return { isUnreferenced: !isReferenced, tournamentId, teamSlug, photoFileName };
        };

        const isUnreferencedFile = (filePath: string): boolean => {
            // Safety check: if we failed to load tournaments (or list is empty), 
            // don't mark anything as unreferenced junk to avoid false positives (deleting valid files).
            if (!tournaments || tournaments.length === 0) {
                return false;
            }

            const matchInfo = extractMatchInfo(filePath);
            if (matchInfo?.isOutsideFixture) return true;

            const photoInfo = extractPlayerPhotoInfo(filePath);
            if (photoInfo?.isUnreferenced) return true;

            return false;
        };

        for (const filePath of allFiles) {
            const local = localManifest.files[filePath];
            const remote = remoteManifest.files[filePath];

            // Case 0: Handle deletions marked in remote manifest
            if (remote?.deleted) {
                const localFileExists = await checkFileExistsLocally(filePath);

                // Only delete locally if the file exists AND has the same hash as when it was deleted remotely
                if (localFileExists) {
                    const localContent = await readLocalFile(filePath);
                    const localHash = hashContent(localContent);

                    // Only delete if hash matches (same file) - if hash is different, it's a new file with same name
                    if (localHash === remote.deletedHash) {
                        plan.toDeleteLocally.push({
                            filePath,
                            reason: 'deleted-remotely'
                        });
                        console.log(`[Sync] File marked for local deletion (matches deleted remote): ${filePath}`);
                    } else {
                        console.log(`[Sync] File ${filePath} was deleted remotely but local version is different (new file with same name) - keeping local`);
                        // Upload the new local file
                        plan.toUpload.push({
                            filePath,
                            hash: localHash
                        });
                    }
                } else {
                    // File already deleted locally, just clean up manifest entry
                    console.log(`[Sync] File ${filePath} already deleted locally, cleaning up`);
                }
                continue;
            }

            // Case 0b: Handle deletions marked in local manifest
            if (local?.deleted) {
                const remoteFileExists = await checkFileExistsRemotely(filePath);

                // Only delete remotely if the file exists AND has the same hash as when it was deleted locally
                if (remoteFileExists) {
                    // Download to check hash
                    const remoteContent = await fetchRemoteFileContent(filePath);
                    if (remoteContent) {
                        const remoteHash = hashContent(remoteContent);

                        // Only delete if hash matches (same file)
                        if (remoteHash === local.deletedHash) {
                            plan.toDeleteRemotely.push({
                                filePath,
                                reason: 'deleted-locally'
                            });
                            console.log(`[Sync] File marked for remote deletion (matches deleted local): ${filePath}`);
                        } else {
                            console.log(`[Sync] File ${filePath} was deleted locally but remote version is different (new file with same name) - keeping remote`);
                            // Download the new remote file
                            queueDownload(filePath, remoteHash);
                        }
                    }
                } else {
                    // File already deleted remotely, just clean up manifest entry
                    console.log(`[Sync] File ${filePath} already deleted remotely, cleaning up`);
                }
                continue;
            }

            // Case 1: File only exists in local manifest
            if (local && !remote) {
                // Check if file actually exists locally
                const fileExists = await checkFileExistsLocally(filePath);

                if (fileExists) {
                    // File exists locally but not in remote manifest = new file to upload
                    // (We'll let the user decide if they want to upload unreferenced files via the UI badges)
                    plan.toUpload.push({
                        filePath,
                        hash: local.hash
                    });
                } else {
                    // File in manifest but doesn't exist locally = was deleted locally
                    // Mark for remote deletion
                    plan.toDeleteRemotely.push({
                        filePath,
                        reason: 'deleted-locally'
                    });
                    console.log(`[Sync] File deleted locally, will delete from remote: ${filePath}`);
                }
                continue;
            }

            // Case 2: File only exists in remote manifest
            if (!local && remote) {
                // Check if file actually exists remotely
                const fileExists = await checkFileExistsRemotely(filePath);

                if (fileExists) {
                    // File exists remotely but not in local manifest = new file to download
                    // (We'll let the user decide if they want to download unreferenced files via the UI badges)
                    queueDownload(filePath, remote.hash);
                } else {
                    // File in remote manifest but doesn't exist remotely = was deleted remotely
                    // Should delete from local if it exists
                    const localFileExists = await checkFileExistsLocally(filePath);
                    if (localFileExists) {
                        plan.toDeleteLocally.push({
                            filePath,
                            reason: 'deleted-remotely'
                        });
                    }
                }
                continue;
            }

            // Case 3: File exists in both places
            if (local && remote) {
                // Same hash = no changes (check this FIRST before unreferenced check)
                if (local.hash === remote.hash) {
                    unchangedCount++;
                    continue;
                }

                // Different content - check for conflicts
                const isConflict = detectConflict(local, remote);

                if (isConflict) {
                    // CONFLICT: Both sides changed since last sync
                    plan.conflicts.push({
                        filePath,
                        localHash: local.hash,
                        remoteHash: remote.hash,
                        localMetadata: local,
                        remoteMetadata: remote
                        // decision is undefined - needs to be set by user or auto-sync
                    });
                } else if (isLocalNewer(local, remote)) {
                    // Local is newer, upload
                    plan.toUpload.push({
                        filePath,
                        hash: local.hash
                    });
                } else {
                    // Remote is newer, download
                    queueDownload(filePath, remote.hash);
                }
            }
        }

        // 6. Update summary
        plan.summary.uploadCount = plan.toUpload.length;
        plan.summary.downloadCount = plan.toDownload.length;
        plan.summary.skippedPhotoCount = plan.skippedPhotoDownloads.length;
        plan.summary.deleteLocalCount = plan.toDeleteLocally.length;
        plan.summary.deleteRemoteCount = plan.toDeleteRemotely.length;
        plan.summary.conflictCount = plan.conflicts.length;
        plan.summary.unchangedCount = unchangedCount;

        // 7. Determine plan status
        if (plan.conflicts.length === 0) {
            plan.status = 'ready'; // No conflicts, ready to execute
        } else {
            plan.status = 'pending'; // Has conflicts that need resolution
        }

        // 8. Download remote files in conflict for comparison (skip unreferenced ones as they might be missing or we don't care to diff them visually usually)
        const diffableConflicts = plan.conflicts.filter(c => !c.isUnreferenced);
        if (diffableConflicts.length > 0) {
            console.log('[Sync] Downloading remote files for', diffableConflicts.length, 'conflicts...');
            await downloadConflictRemoteFiles(diffableConflicts);
        }

        // 9. Save plan
        await writePlan(plan);
        console.log('[Sync] Plan created:', {
            status: plan.status,
            uploads: plan.toUpload.length,
            downloads: plan.toDownload.length,
            deleteLocal: plan.toDeleteLocally.length,
            deleteRemote: plan.toDeleteRemotely.length,
            conflicts: plan.conflicts.length,
            unchanged: unchangedCount
        });

        return plan;

    } catch (error) {
        console.error('[Sync] Error analyzing sync:', error);
        throw error;
    }
}

/**
 * Check if a file exists locally in storage
 */
async function checkFileExistsLocally(filePath: string): Promise<boolean> {
    try {
        await storageProvider.readFile(filePath);
        return true;
    } catch (error: any) {
        if (error.name === 'FileNotFoundError' || error.code === 'ENOENT') {
            return false;
        }
        // For other errors, assume file exists (to be safe)
        console.error(`[Sync] Error checking if file exists locally: ${filePath}`, error);
        return true;
    }
}

/**
 * Check if a file exists remotely in Supabase
 * Uses download with minimal data to check existence
 */
async function checkFileExistsRemotely(filePath: string): Promise<boolean> {
    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
        const bucket = process.env.SUPABASE_BUCKET;

        if (!supabaseUrl || !supabaseKey || !bucket) {
            throw new Error('Supabase configuration missing');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Try to download just to check existence (will not actually download full file if we handle the error)
        const { data, error } = await supabase.storage.from(bucket).download(filePath);

        if (error) {
            // 404 means file doesn't exist
            if ('status' in error && error.status === 404) {
                return false;
            }
            // For other errors (like network issues), log as warning and assume exists to be safe
            console.warn(`[Sync] Warning checking if file exists remotely: ${filePath} - assuming exists`);
            return true;
        }

        return !!data;
    } catch (error) {
        // On unexpected errors, assume file exists to avoid deleting it
        console.warn(`[Sync] Exception checking if file exists remotely: ${filePath} - assuming exists`);
        return true;
    }
}

/**
 * Download remote files in conflict and save them to a temporary directory
 * This allows the UI to display file comparisons without re-downloading
 */
async function downloadConflictRemoteFiles(conflicts: SyncPlanConflict[]): Promise<void> {
    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
        const bucket = process.env.SUPABASE_BUCKET;

        if (!supabaseUrl || !supabaseKey || !bucket) {
            throw new Error('Supabase configuration missing');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get storage directory
        const storagePath = process.env.STORAGE_PATH || 'storage';
        const storageDir = path.isAbsolute(storagePath)
            ? storagePath
            : path.join(process.cwd(), storagePath);

        const conflictsDir = path.join(storageDir, 'sync-conflicts-remote');

        // Create directory if it doesn't exist
        await fs.mkdir(conflictsDir, { recursive: true });

        // Download each conflict file
        for (const conflict of conflicts) {
            try {
                const { data, error } = await supabase.storage
                    .from(bucket)
                    .download(conflict.filePath);

                if (error || !data) {
                    console.error(`[Sync] Failed to download remote conflict file: ${conflict.filePath}`, error);
                    continue;
                }

                // Save to temporary directory preserving the path structure
                const targetPath = path.join(conflictsDir, conflict.filePath);
                const targetDir = path.dirname(targetPath);

                // Create subdirectories if needed
                await fs.mkdir(targetDir, { recursive: true });

                // Convert blob to buffer and write
                const arrayBuffer = await data.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                await fs.writeFile(targetPath, buffer);

                console.log(`[Sync] Downloaded remote conflict file: ${conflict.filePath}`);
            } catch (error) {
                console.error(`[Sync] Error downloading conflict file ${conflict.filePath}:`, error);
            }
        }

        console.log(`[Sync] Downloaded ${conflicts.length} remote conflict files to ${conflictsDir}`);
    } catch (error) {
        console.error('[Sync] Error downloading conflict remote files:', error);
        // Don't throw - this is not critical, just means comparison won't work
    }
}

/**
 * Fetch remote file content (helper for hash checking)
 */
async function fetchRemoteFileContent(filePath: string): Promise<string | Buffer | null> {
    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
        const bucket = process.env.SUPABASE_BUCKET;

        if (!supabaseUrl || !supabaseKey || !bucket) {
            throw new Error('Supabase configuration missing');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await supabase.storage.from(bucket).download(filePath);

        if (error || !data) {
            console.error(`[Sync] Failed to fetch remote file: ${filePath}`, error);
            return null;
        }

        if (isBinaryFile(filePath)) {
            const arrayBuffer = await data.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }

        return await data.text();
    } catch (error) {
        console.error(`[Sync] Error fetching remote file: ${filePath}`, error);
        return null;
    }
}

/**
 * Detect if there's a conflict (both sides changed)
 *
 * Conflict exists if:
 * - Remote changed (remote.hash != local.previousVersion.hash)
 * - AND local changed (local has previousVersion, meaning it was modified)
 */
function detectConflict(local: FileMetadata, remote: FileMetadata): boolean {
    // If local doesn't have previousVersion, it's a new file locally, not a conflict
    if (!local.previousVersion) {
        return false;
    }

    // Check if remote is different from what we last synced
    const remoteChanged = remote.hash !== local.previousVersion.hash;

    // Local changed if it differs from the previous version hash
    const localChanged = local.hash !== local.previousVersion.hash;


    return remoteChanged && localChanged;
}

/**
 * Check if local version is newer than remote
 */
function isLocalNewer(local: FileMetadata, remote: FileMetadata): boolean {
    return new Date(local.lastModified) > new Date(remote.lastModified);
}

/**
 * Fetch remote manifest from Supabase
 * Returns null if manifest doesn't exist yet (first sync)
 */
async function fetchRemoteManifest(): Promise<SyncManifest | null> {
    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Service key to bypass RLS
        const bucket = process.env.SUPABASE_BUCKET;

        if (!supabaseUrl || !supabaseKey || !bucket) {
            throw new Error('Supabase configuration missing (SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_BUCKET)');
        }

        if (!supabaseKey.startsWith('eyJ')) {
            throw new Error('SUPABASE_SERVICE_KEY appears to be invalid. It should be a JWT token starting with "eyJ"');
        }

        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });

        const { data, error } = await supabase.storage
            .from(bucket)
            .download('sync-manifest.json');

        if (error) {
            // 404 or 400 means manifest doesn't exist yet - this is OK for first sync
            const errorMessage = error.message?.toLowerCase() || '';
            const originalError = (error as any).originalError;
            const status = originalError?.status;

            if (
                errorMessage.includes('not found') ||
                errorMessage.includes('404') ||
                status === 404 ||
                status === 400  // Supabase returns 400 for non-existent files
            ) {
                console.log('[Sync] Remote manifest not found - treating as first sync');
                return null;
            }
            throw error;
        }

        if (!data) {
            return null;
        }

        const text = await data.text();
        return JSON.parse(text) as SyncManifest;

    } catch (error) {
        console.error('[Sync] Error fetching remote manifest:', error);
        throw error;
    }
}

export interface SyncResult {
    success: boolean;
    filesUploaded: number;
    filesDownloaded: number;
    conflictsResolved: number;
    errors: Array<{ filePath: string; error: string }>;
    backupPath?: string;
}

export type ConflictStrategy = 'local-wins' | 'remote-wins';

export interface SyncOptions {
    trigger?: 'manual' | 'auto-interval' | 'after-match' | 'after-summary-edit'; // What triggered this sync
    plan?: SyncPlan; // Optional: use this plan instead of reading from file
    strategy?: ConflictStrategy;
    filterFiles?: (filePath: string) => boolean;
}

/**
 * Execute sync based on analysis
 * - Uploads files marked for upload (if strategy allows)
 * - Downloads files marked for download
 * - Resolves conflicts based on strategy
 * - Updates both local and remote manifests
 */
export async function executeSync(analysis: SyncAnalysis, options: SyncOptions = {}): Promise<SyncResult> {
    const strategy = options.strategy || 'local-wins';
    const filterFiles = options.filterFiles;
    const result: SyncResult = {
        success: true,
        filesUploaded: 0,
        filesDownloaded: 0,
        conflictsResolved: 0,
        errors: []
    };

    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Service key to bypass RLS
        const bucket = process.env.SUPABASE_BUCKET;

        if (!supabaseUrl || !supabaseKey || !bucket) {
            throw new Error('Supabase configuration missing (SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_BUCKET)');
        }

        if (!supabaseKey.startsWith('eyJ')) {
            throw new Error('SUPABASE_SERVICE_KEY appears to be invalid. It should be a JWT token starting with "eyJ"');
        }

        console.log('[Sync Execute] Using Supabase URL:', supabaseUrl);
        console.log('[Sync Execute] Using bucket:', bucket);
        console.log('[Sync Execute] Service key starts with:', supabaseKey.substring(0, 20) + '...');

        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });

        console.log('[Sync Execute] Strategy:', strategy);

        // 1. Handle conflicts based on strategy
        if (strategy === 'remote-wins') {
            // Remote wins: treat all conflicts and uploads as downloads
            for (const item of [...analysis.conflicts, ...analysis.toUpload]) {
                analysis.toDownload.push(item);
            }
            analysis.conflicts = [];
            analysis.toUpload = [];
            console.log('[Sync Execute] Remote-wins strategy: converted all conflicts/uploads to downloads');
        }

        // 2. Apply file filter if provided
        if (filterFiles) {
            console.log('[Sync Execute] Applying file filter...');
            console.log('[Sync Execute] Before filter - toDownload files:', analysis.toDownload.map(i => i.filePath));

            analysis.toUpload = analysis.toUpload.filter(item => filterFiles(item.filePath));
            analysis.toDownload = analysis.toDownload.filter(item => filterFiles(item.filePath));
            analysis.conflicts = analysis.conflicts.filter(item => filterFiles(item.filePath));

            console.log('[Sync Execute] After filter - toDownload files:', analysis.toDownload.map(i => i.filePath));
            console.log('[Sync Execute] After filtering:', {
                toUpload: analysis.toUpload.length,
                toDownload: analysis.toDownload.length,
                conflicts: analysis.conflicts.length
            });
        }

        // 2. Handle conflicts (local-wins strategy only)
        if (analysis.conflicts.length > 0) {
            const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
            const backupDir = `mergeConflictsBackup/${timestamp}`;
            result.backupPath = backupDir;

            for (const conflict of analysis.conflicts) {
                try {
                    // Download remote version to backup
                    const { data: remoteData, error: downloadError } = await supabase.storage
                        .from(bucket)
                        .download(conflict.filePath);

                    if (downloadError) {
                        result.errors.push({
                            filePath: conflict.filePath,
                            error: `Failed to download for backup: ${downloadError.message}`
                        });
                        continue;
                    }

                    let backupPath: string | undefined;

                    if (remoteData) {
                        let remoteContent: string | Buffer;
                        if (isBinaryFile(conflict.filePath)) {
                            const arrayBuffer = await remoteData.arrayBuffer();
                            remoteContent = Buffer.from(arrayBuffer);
                        } else {
                            remoteContent = await remoteData.text();
                        }

                        // Keep the full path structure in backup
                        backupPath = `${backupDir}/${conflict.filePath}`;

                        console.log('[Sync] Attempting to backup to:', backupPath);

                        // Upload to backup location with contentType
                        const preparedBackupContent = prepareContentForUpload(remoteContent, conflict.filePath);
                        const { error: backupError } = await supabase.storage
                            .from(bucket)
                            .upload(backupPath, preparedBackupContent, {
                                upsert: true,
                                contentType: getContentType(conflict.filePath)
                            });

                        if (backupError) {
                            console.error('[Sync] Failed to backup conflict:', backupError);
                            result.errors.push({
                                filePath: conflict.filePath,
                                error: `Failed to backup: ${backupError.message}`
                            });
                            continue;
                        }

                        console.log('[Sync] Successfully backed up to:', backupPath);
                    }

                    // Now upload local version (local wins)
                    const localContent = await readLocalFile(conflict.filePath);
                    const preparedLocalContent = prepareContentForUpload(localContent, conflict.filePath);
                    const { error: uploadError } = await supabase.storage
                        .from(bucket)
                        .upload(conflict.filePath, preparedLocalContent, {
                            upsert: true,
                            contentType: getContentType(conflict.filePath)
                        });

                    if (uploadError) {
                        result.errors.push({
                            filePath: conflict.filePath,
                            error: `Failed to upload local: ${uploadError.message}`
                        });
                        continue;
                    }

                    result.conflictsResolved++;
                    console.log('[Sync] Conflict resolved:', conflict.filePath, '- Local wins, remote backed up to', backupPath);

                } catch (error) {
                    result.errors.push({
                        filePath: conflict.filePath,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }
        }

        // 2. Upload files
        const filesToUpload = [...analysis.toUpload];
        for (const item of filesToUpload) {
            try {
                const content = await readLocalFile(item.filePath);

                // Verify hash matches what we analyzed
                const currentHash = hashContent(content);
                if (item.localVersion && currentHash !== item.localVersion.hash) {
                    console.warn('[Sync] File changed since analysis:', item.filePath);
                    result.errors.push({
                        filePath: item.filePath,
                        error: 'File changed since analysis started'
                    });
                    continue;
                }

                const preparedContent = prepareContentForUpload(content, item.filePath);
                const { error } = await supabase.storage
                    .from(bucket)
                    .upload(item.filePath, preparedContent, {
                        upsert: true,
                        contentType: getContentType(item.filePath)
                    });

                if (error) {
                    result.errors.push({
                        filePath: item.filePath,
                        error: `Upload failed: ${error.message}`
                    });
                    continue;
                }

                result.filesUploaded++;
                console.log('[Sync] Uploaded:', item.filePath, 'with hash:', currentHash);

            } catch (error) {
                result.errors.push({
                    filePath: item.filePath,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        // 3. Download files
        for (const item of analysis.toDownload) {
            try {
                const { data, error } = await supabase.storage
                    .from(bucket)
                    .download(item.filePath);

                if (error) {
                    result.errors.push({
                        filePath: item.filePath,
                        error: `Download failed: ${error.message}`
                    });
                    continue;
                }

                if (data) {
                    const content = await data.text();
                    await storageProvider.writeFile(item.filePath, content);
                    result.filesDownloaded++;
                    console.log('[Sync] Downloaded:', item.filePath);
                }

            } catch (error) {
                result.errors.push({
                    filePath: item.filePath,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        // 4. Update local manifest: mark synced files with previousVersion
        const localManifest = await readManifest();

        // For uploaded files: update previousVersion to mark as synced
        for (const item of [...filesToUpload, ...analysis.conflicts]) {
            if (item.localVersion) {
                const currentMetadata = localManifest.files[item.filePath];
                if (currentMetadata && currentMetadata.hash === item.localVersion.hash) {
                    // File hasn't changed since we uploaded it, update previousVersion
                    currentMetadata.previousVersion = {
                        lastModified: currentMetadata.lastModified,
                        hash: currentMetadata.hash
                    };
                    localManifest.files[item.filePath] = currentMetadata;
                } else if (currentMetadata) {
                    console.warn('[Sync] File changed during sync:', item.filePath);
                }
            }
        }

        // For downloaded files: update local manifest with remote metadata
        for (const item of analysis.toDownload) {
            if (item.remoteVersion) {
                localManifest.files[item.filePath] = {
                    ...item.remoteVersion,
                    previousVersion: {
                        lastModified: item.remoteVersion.lastModified,
                        hash: item.remoteVersion.hash
                    }
                };
            }
        }

        localManifest.lastSync = getGMTTimestamp();
        await writeManifest(localManifest);

        console.log('[Sync] Local manifest updated');

        // 5. Upload local manifest to remote (they should be identical after sync)
        const manifestContent = JSON.stringify(localManifest, null, 2);
        const { error: manifestError } = await supabase.storage
            .from(bucket)
            .upload('sync-manifest.json', manifestContent, { upsert: true, contentType: 'application/json' });

        if (manifestError) {
            console.error('[Sync] Failed to upload manifest:', manifestError);
            result.errors.push({
                filePath: 'sync-manifest.json',
                error: `Failed to upload manifest: ${manifestError.message}`
            });
        } else {
            console.log('[Sync] Successfully uploaded manifest to remote');
        }

        result.success = result.errors.length === 0;

        // Update manifest with error status for failed files
        if (result.errors.length > 0) {
            const localManifest = await readManifest();
            for (const err of result.errors) {
                if (err.filePath !== 'sync-manifest.json' && err.filePath !== 'sync-execution') {
                    const fileMetadata = localManifest.files[err.filePath];
                    if (fileMetadata) {
                        fileMetadata.syncAttempts = (fileMetadata.syncAttempts || 0) + 1;
                        fileMetadata.lastSyncError = err.error;
                        localManifest.files[err.filePath] = fileMetadata;

                        // Log error
                        await addSyncError({
                            timestamp: new Date().toISOString(),
                            filePath: err.filePath,
                            action: analysis.toUpload.some(i => i.filePath === err.filePath) ? 'upload' : 'download',
                            error: err.error,
                            attempt: fileMetadata.syncAttempts
                        });
                    }
                }
            }
            await writeManifest(localManifest);
            console.log('[Sync] Updated manifest with error status for', result.errors.length, 'files');
        }

        // Clear error flags for successful files and conflicts resolved
        if (result.filesUploaded > 0 || result.filesDownloaded > 0 || result.conflictsResolved > 0) {
            const localManifest = await readManifest();
            const successfulFiles = [
                ...filesToUpload.map(i => i.filePath).filter(f => !result.errors.some(e => e.filePath === f)),
                ...analysis.toDownload.map(i => i.filePath).filter(f => !result.errors.some(e => e.filePath === f)),
                ...analysis.conflicts.map(i => i.filePath).filter(f => !result.errors.some(e => e.filePath === f))
            ];

            for (const filePath of successfulFiles) {
                const fileMetadata = localManifest.files[filePath];
                if (fileMetadata) {
                    // Clear error status
                    delete fileMetadata.syncAttempts;
                    delete fileMetadata.lastSyncError;
                    delete fileMetadata.hasConflict;
                    delete fileMetadata.conflictDetectedAt;
                    localManifest.files[filePath] = fileMetadata;
                }
            }
            await writeManifest(localManifest);
        }

        // Add sync log
        const filesAffected: SyncLogFileEntry[] = [
            ...filesToUpload.map(i => ({ filePath: i.filePath, action: 'uploaded' as const })),
            ...analysis.toDownload.map(i => ({ filePath: i.filePath, action: 'downloaded' as const })),
            ...analysis.conflicts.map(i => ({ filePath: i.filePath, action: 'conflict-resolved' as const }))
        ];

        await addSyncLog({
            timestamp: new Date().toISOString(),
            action: 'sync',
            trigger: options.trigger as any, // Cast to any to avoid strict check
            // analysis removed to fix type error
            result: result.success ? 'success' : (result.filesUploaded > 0 || result.filesDownloaded > 0 ? 'partial' : 'error'),
            files: filesAffected,
            errorCount: result.errors.length,
            message: result.success
                ? `Sync completed: ${result.filesUploaded} uploaded, ${result.filesDownloaded} downloaded, ${result.conflictsResolved} conflicts resolved`
                : `Sync completed with ${result.errors.length} errors`
        });

        return result;

    } catch (error) {
        console.error('[Sync] Error executing sync:', error);
        result.success = false;
        result.errors.push({
            filePath: 'sync-execution',
            error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Log critical error
        await addSyncLog({
            timestamp: new Date().toISOString(),
            action: 'sync',
            trigger: options.trigger as any, // Cast to any to avoid strict check
            result: 'error',
            files: [],
            errorCount: 1,
            message: error instanceof Error ? error.message : 'Unknown error'
        });

        return result;
    }
}

/**
 * Execute sync plan (NEW simplified version)
 * Reads the saved plan and executes it
 */
export async function executeSyncPlan(options: SyncOptions = {}): Promise<SyncResult> {
    const result: SyncResult = {
        success: true,
        filesUploaded: 0,
        filesDownloaded: 0,
        conflictsResolved: 0,
        errors: []
    };

    try {
        // 1. Get the plan (use provided plan or read from file)
        let plan: SyncPlan | null | undefined = options.plan;

        if (!plan) {
            plan = await readPlan();
            if (!plan) {
                throw new Error('No sync plan found. Run analysis first.');
            }
        }

        if (plan.status !== 'ready') {
            throw new Error(`Plan is not ready (status: ${plan.status}). Resolve conflicts first.`);
        }

        console.log('[Sync] Executing plan...', options.plan ? '(filtered by user selection)' : '(full plan)');

        // Only update plan status if we're using the saved plan (not a filtered one)
        if (!options.plan) {
            await updatePlanStatus('executing');
        }

        // 2. Setup Supabase client
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
        const bucket = process.env.SUPABASE_BUCKET;

        if (!supabaseUrl || !supabaseKey || !bucket) {
            throw new Error('Supabase configuration missing');
        }

        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });

        const logFiles: SyncLogFileEntry[] = [];

        // 3. Execute uploads
        for (const item of plan.toUpload) {
            try {
                const content = await readLocalFile(item.filePath);
                const preparedContent = prepareContentForUpload(content, item.filePath);
                const { error } = await supabase.storage
                    .from(bucket)
                    .upload(item.filePath, preparedContent, {
                        upsert: true,
                        contentType: getContentType(item.filePath)
                    });

                if (error) throw error;

                // Update local manifest with the uploaded content
                // This ensures manifest reflects what was actually uploaded
                if (content instanceof Buffer) {
                    const { updateManifestEntryBinary } = await import('./sync-manifest');
                    await updateManifestEntryBinary(item.filePath, content);
                } else {
                    const { updateManifestEntry } = await import('./sync-manifest');
                    await updateManifestEntry(item.filePath, content);
                }

                result.filesUploaded++;
                logFiles.push({
                    filePath: item.filePath,
                    action: 'uploaded'
                });
                console.log(`[Sync] Uploaded: ${item.filePath}`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                result.errors.push({
                    filePath: item.filePath,
                    error: errorMessage
                });
                // Log individual error for detailed tracking
                await addSyncError({
                    timestamp: new Date().toISOString(),
                    filePath: item.filePath,
                    action: 'upload', // Fixed: 'operation' -> 'action'
                    error: errorMessage,
                    attempt: 1
                });
                console.error(`[Sync] Failed to upload: ${item.filePath} - ${errorMessage}`);
            }
        }

        // 4. Execute downloads
        for (const item of plan.toDownload) {
            try {
                const { data, error } = await supabase.storage
                    .from(bucket)
                    .download(item.filePath);

                if (error) throw error;
                const content = await data.text();
                await storageProvider.writeFile(item.filePath, content);

                result.filesDownloaded++;
                logFiles.push({
                    filePath: item.filePath,
                    action: 'downloaded'
                });
                console.log(`[Sync] Downloaded: ${item.filePath}`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                result.errors.push({
                    filePath: item.filePath,
                    error: errorMessage
                });
                await addSyncError({
                    timestamp: new Date().toISOString(),
                    filePath: item.filePath,
                    action: 'download', // Fixed: 'operation' -> 'action'
                    error: errorMessage,
                    attempt: 1
                });
                console.error(`[Sync] Failed to download: ${item.filePath} - ${errorMessage}`);
            }
        }

        // 5. Execute local deletions (files deleted remotely)
        for (const item of plan.toDeleteLocally) {
            try {
                await storageProvider.deleteFile(item.filePath);
                const { removeManifestEntry } = await import('./sync-manifest');
                await removeManifestEntry(item.filePath);

                logFiles.push({
                    filePath: item.filePath,
                    action: 'deleted-locally'
                });
                console.log(`[Sync] Deleted locally: ${item.filePath} (${item.reason})`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                result.errors.push({
                    filePath: item.filePath,
                    error: errorMessage
                });
                await addSyncError({
                    timestamp: new Date().toISOString(),
                    filePath: item.filePath,
                    action: 'download', // Treated as download (applying remote deletion)
                    error: errorMessage,
                    attempt: 1
                });
                console.error(`[Sync] Failed to delete locally: ${item.filePath} - ${errorMessage}`);
            }
        }

        // 6. Execute remote deletions (files deleted locally)
        for (const item of plan.toDeleteRemotely) {
            try {
                const { error } = await supabase.storage
                    .from(bucket)
                    .remove([item.filePath]);

                if (error) throw error;

                logFiles.push({
                    filePath: item.filePath,
                    action: 'deleted-remotely'
                });
                console.log(`[Sync] Deleted remotely: ${item.filePath} (${item.reason})`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                result.errors.push({
                    filePath: item.filePath,
                    error: errorMessage
                });
                await addSyncError({
                    timestamp: new Date().toISOString(),
                    filePath: item.filePath,
                    action: 'upload', // Fixed: 'operation' -> 'action'. Applying local change to remote = upload
                    error: errorMessage,
                    attempt: 1
                });
                console.error(`[Sync] Failed to delete remotely: ${item.filePath} - ${errorMessage}`);
            }
        }

        // 7. Execute conflicts (based on decisions)
        for (const conflict of plan.conflicts) {
            if (!conflict.decision) {
                console.warn(`[Sync] Skipping conflict without decision: ${conflict.filePath}`);
                continue;
            }

            if (conflict.decision === 'skip') {
                console.log(`[Sync] Skipping: ${conflict.filePath}`);
                continue;
            }

            // Handle unreferenced file deletion (both local and remote)
            if (conflict.isUnreferenced && conflict.decision === 'delete') {
                try {
                    // 1. Delete locally (if exists)
                    const localExists = await storageProvider.readFile(conflict.filePath).then(() => true).catch(() => false);
                    if (localExists) {
                        await storageProvider.deleteFile(conflict.filePath);
                        const { removeManifestEntry } = await import('./sync-manifest');
                        await removeManifestEntry(conflict.filePath);
                        logFiles.push({
                            filePath: conflict.filePath,
                            action: 'deleted-locally'
                        });
                    }

                    // 2. Delete remotely
                    const { error } = await supabase.storage
                        .from(bucket)
                        .remove([conflict.filePath]);

                    if (error) throw error;

                    logFiles.push({
                        filePath: conflict.filePath,
                        action: 'deleted-remotely'
                    });

                    result.conflictsResolved++;
                    console.log(`[Sync] Unreferenced file deleted (local & remote): ${conflict.filePath}`);

                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    result.errors.push({
                        filePath: conflict.filePath,
                        error: errorMessage
                    });
                    await addSyncError({
                        timestamp: new Date().toISOString(),
                        filePath: conflict.filePath,
                        action: 'conflict-resolve', // Fixed: 'operation' -> 'action'
                        error: errorMessage,
                        attempt: 1
                    });
                    console.error(`[Sync] Failed to delete unreferenced file: ${conflict.filePath} - ${errorMessage}`);
                }
                continue;
            }

            try {
                if (conflict.decision === 'local-wins') {
                    // Upload local version
                    const content = await readLocalFile(conflict.filePath);
                    const preparedContent = prepareContentForUpload(content, conflict.filePath);
                    const { error } = await supabase.storage
                        .from(bucket)
                        .upload(conflict.filePath, preparedContent, {
                            upsert: true,
                            contentType: getContentType(conflict.filePath)
                        });

                    if (error) throw error;

                    // Update local manifest with the uploaded content
                    if (content instanceof Buffer) {
                        const { updateManifestEntryBinary } = await import('./sync-manifest');
                        await updateManifestEntryBinary(conflict.filePath, content);
                    } else {
                        const { updateManifestEntry } = await import('./sync-manifest');
                        await updateManifestEntry(conflict.filePath, content);
                    }

                    result.conflictsResolved++;
                    logFiles.push({
                        filePath: conflict.filePath,
                        action: 'conflict-resolved',
                        hadConflict: true,
                        conflictWinner: 'local'
                    });
                    console.log(`[Sync] Conflict resolved (local-wins): ${conflict.filePath}`);
                } else if (conflict.decision === 'remote-wins') {
                    // Download remote version
                    const { data, error } = await supabase.storage
                        .from(bucket)
                        .download(conflict.filePath);

                    if (error) throw error;
                    const content = await data.text();
                    await storageProvider.writeFile(conflict.filePath, content);

                    result.conflictsResolved++;
                    logFiles.push({
                        filePath: conflict.filePath,
                        action: 'conflict-resolved',
                        hadConflict: true,
                        conflictWinner: 'remote'
                    });
                    console.log(`[Sync] Conflict resolved (remote-wins): ${conflict.filePath}`);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                result.errors.push({
                    filePath: conflict.filePath,
                    error: errorMessage
                });
                await addSyncError({
                    timestamp: new Date().toISOString(),
                    filePath: conflict.filePath,
                    action: 'conflict-resolve', // Fixed: 'operation' -> 'action'
                    error: errorMessage,
                    attempt: 1
                });
                console.error(`[Sync] Failed to resolve conflict (${conflict.decision}): ${conflict.filePath} - ${errorMessage}`);
            }
        }

        // 8. Update manifests for successfully synced files
        // Build list of successfully synced files
        const successfulFiles = new Set<string>();
        const deletedFiles = new Set<string>();

        // Add all files that were processed WITHOUT errors
        for (const file of logFiles) {
            if (file.action === 'deleted-locally' || file.action === 'deleted-remotely') {
                deletedFiles.add(file.filePath);
            } else {
                successfulFiles.add(file.filePath);
            }
        }

        if (successfulFiles.size > 0 || deletedFiles.size > 0) {
            await updateManifestsForSuccessfulFiles(
                Array.from(successfulFiles),
                Array.from(deletedFiles)
            );
            console.log(`[Sync] Manifest updated for ${successfulFiles.size} synced files and ${deletedFiles.size} deleted files`);
        }

        if (result.errors.length > 0) {
            console.warn(`[Sync] ${result.errors.length} files failed and will be retried in next sync:`,
                result.errors.map(e => e.filePath).join(', '));
        }

        // 9. Add log entry
        result.success = result.errors.length === 0;
        const totalOperations = result.filesUploaded + result.filesDownloaded + result.conflictsResolved +
            plan.toDeleteLocally.length + plan.toDeleteRemotely.length;
        await addSyncLog({
            timestamp: new Date().toISOString(),
            action: 'sync',
            trigger: options.trigger as any, // Cast to any to avoid strict check
            result: result.success ? 'success' : 'partial',
            files: logFiles,
            errorCount: result.errors.length,
            message: `Synced ${totalOperations} files (${result.filesUploaded} up, ${result.filesDownloaded} down, ${plan.toDeleteLocally.length} del local, ${plan.toDeleteRemotely.length} del remote, ${result.conflictsResolved} conflicts)`
        });

        // 10. Delete the plan (only if using saved plan, not filtered)
        if (!options.plan) {
            await deletePlan();
        }

        // 11. Reload cache from disk and emit sync-complete event
        console.log('[Sync] Reloading cache from disk...');
        const { reloadCacheFromDisk } = await import('./server-side-store');
        await reloadCacheFromDisk();
        console.log('[Sync] Cache reloaded, emitting sync-complete event');
        systemEmitter.emit('sync-complete');

        console.log('[Sync] Plan executed successfully');
        return result;

    } catch (error) {
        console.error('[Sync] Error executing plan:', error);
        result.success = false;
        result.errors.push({
            filePath: 'plan-execution',
            error: error instanceof Error ? error.message : 'Unknown error'
        });

        await addSyncLog({
            timestamp: new Date().toISOString(),
            action: 'sync',
            trigger: options.trigger as any, // Cast to any to avoid strict check
            result: 'error',
            files: [],
            errorCount: 1,
            message: error instanceof Error ? error.message : 'Unknown error'
        });

        return result;
    }
}

/**
 * Helper: Update both local and remote manifests for ONLY successfully synced files
 * This ensures that:
 * 1. Files that synced successfully are marked as "synced baseline" (previousVersion = current)
 * 2. Files that failed to sync remain unchanged in manifest (will retry in next sync)
 * 3. Conflicts that were skipped remain unchanged (correct behavior)
 * 4. Deleted files are removed from manifests completely
 */
async function updateManifestsForSuccessfulFiles(
    successfulFilePaths: string[],
    deletedFilePaths: string[] = []
): Promise<void> {
    const syncTime = new Date().toISOString();

    // Read current local manifest (already updated by writeFile() calls during sync)
    const localManifest = await readManifest();
    localManifest.lastSync = syncTime;

    // Update ONLY the files that were successfully synced
    for (const filePath of successfulFilePaths) {
        const metadata = localManifest.files[filePath];

        // Skip if file no longer exists in manifest (could have been deleted)
        if (!metadata) continue;

        // Clear error/conflict flags for this file
        delete metadata.hasConflict;
        delete metadata.conflictDetectedAt;
        delete metadata.syncAttempts;
        delete metadata.lastSyncError;

        // Update previousVersion to current version
        // This marks this file as "synced baseline"
        metadata.previousVersion = {
            hash: metadata.hash,
            lastModified: metadata.lastModified
        };

        localManifest.files[filePath] = metadata;
    }

    // Remove deleted files from local manifest
    for (const filePath of deletedFilePaths) {
        delete localManifest.files[filePath];
        console.log(`[Sync] Removed ${filePath} from local manifest (deleted)`);
    }

    console.log(`[Sync] Updated local manifest for ${successfulFilePaths.length} successfully synced files and removed ${deletedFilePaths.length} deleted files`);

    // Save updated local manifest
    await writeManifest(localManifest);

    // Now update REMOTE manifest - only update entries for files that were synced
    // Download current remote manifest first
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
    const bucket = process.env.SUPABASE_BUCKET!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    // Fetch existing remote manifest
    let remoteManifest: SyncManifest;
    try {
        const existingRemote = await fetchRemoteManifest();
        remoteManifest = existingRemote || {
            lastSync: syncTime,
            files: {}
        };
    } catch (error) {
        console.warn('[Sync] Could not fetch remote manifest, creating new one');
        remoteManifest = {
            lastSync: syncTime,
            files: {}
        };
    }

    // Update ONLY the successfully synced files in remote manifest
    for (const filePath of successfulFilePaths) {
        const metadata = localManifest.files[filePath];
        if (metadata) {
            remoteManifest.files[filePath] = metadata;
        }
    }

    // Remove deleted files from remote manifest
    for (const filePath of deletedFilePaths) {
        delete remoteManifest.files[filePath];
        console.log(`[Sync] Removed ${filePath} from remote manifest (deleted)`);
    }

    // Update lastSync time
    remoteManifest.lastSync = syncTime;

    // Upload updated remote manifest
    const { error } = await supabase.storage
        .from(bucket)
        .upload('sync-manifest.json', JSON.stringify(remoteManifest, null, 2), { upsert: true });

    if (error) {
        console.error('[Sync] Error uploading manifest:', error);
        throw error;
    }

    console.log('[Sync] Remote manifest updated - synced files modified and deleted files removed');
}
