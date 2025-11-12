import { createClient } from '@supabase/supabase-js';
import { readManifest, hashContent, writeManifest, getGMTTimestamp, updatePreviousVersionAfterSync } from './sync-manifest';
import type { SyncManifest, FileMetadata, SyncPlan, SyncPlanConflict, SyncLogFileEntry } from '@/types';
import { storageProvider } from './storage';
import { addSyncLog, addSyncError } from './sync-logs';
import { writePlan, deletePlan, readPlan, updatePlanStatus } from './sync-plan';
import path from 'path';
import fs from 'fs/promises';

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
            toDeleteLocally: [],
            toDeleteRemotely: [],
            conflicts: [],
            summary: {
                uploadCount: 0,
                downloadCount: 0,
                deleteLocalCount: 0,
                deleteRemoteCount: 0,
                conflictCount: 0,
                unchangedCount: 0
            }
        };

        // 4. If no remote manifest exists, all local files should be uploaded
        if (!hasRemoteManifest) {
            for (const [filePath, metadata] of Object.entries(localManifest.files)) {
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

        for (const filePath of allFiles) {
            const local = localManifest.files[filePath];
            const remote = remoteManifest.files[filePath];

            // Case 1: File only exists in local manifest
            if (local && !remote) {
                // Check if file actually exists locally
                const fileExists = await checkFileExistsLocally(filePath);

                if (fileExists) {
                    // File exists locally but not in remote manifest = new file to upload
                    plan.toUpload.push({
                        filePath,
                        hash: local.hash
                    });
                } else {
                    // File in manifest but doesn't exist locally = was deleted locally
                    // This is a stale manifest entry, just remove it (don't add to plan)
                    console.log(`[Sync] Stale manifest entry detected for local file: ${filePath} (file doesn't exist)`);
                }
                continue;
            }

            // Case 2: File only exists in remote manifest
            if (!local && remote) {
                // Check if file actually exists remotely
                const fileExists = await checkFileExistsRemotely(filePath);

                if (fileExists) {
                    // File exists remotely but not in local manifest = new file to download
                    plan.toDownload.push({
                        filePath,
                        hash: remote.hash
                    });
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
                // Same hash = no changes
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
                    plan.toDownload.push({
                        filePath,
                        hash: remote.hash
                    });
                }
            }
        }

        // 6. Update summary
        plan.summary.uploadCount = plan.toUpload.length;
        plan.summary.downloadCount = plan.toDownload.length;
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

        // 8. Save plan
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
        const { data, error } = await supabase.storage.from(bucket).download(filePath);

        if (error) {
            if ('status' in error && error.status === 404) {
                return false;
            }
            // For other errors, assume file exists (to be safe)
            console.error(`[Sync] Error checking if file exists remotely: ${filePath}`, error);
            return true;
        }

        return !!data;
    } catch (error) {
        console.error(`[Sync] Error checking if file exists remotely: ${filePath}`, error);
        return true; // Assume exists on error to be safe
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

    // Local changed if it has a previousVersion (was modified at least once)
    const localChanged = true; // If previousVersion exists, local was modified

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

                    if (remoteData) {
                        const remoteContent = await remoteData.text();
                        // Keep the full path structure in backup
                        const backupPath = `${backupDir}/${conflict.filePath}`;

                        console.log('[Sync] Attempting to backup to:', backupPath);

                        // Upload to backup location with contentType
                        const { error: backupError } = await supabase.storage
                            .from(bucket)
                            .upload(backupPath, remoteContent, {
                                upsert: true,
                                contentType: 'application/json'
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
                    const localContent = await storageProvider.readFile(conflict.filePath);
                    const { error: uploadError } = await supabase.storage
                        .from(bucket)
                        .upload(conflict.filePath, localContent, { upsert: true });

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
                const content = await storageProvider.readFile(item.filePath);

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

                const { error } = await supabase.storage
                    .from(bucket)
                    .upload(item.filePath, content, {
                        upsert: true,
                        contentType: 'application/json'
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
        const filesAffected = [
            ...filesToUpload.map(i => i.filePath),
            ...analysis.toDownload.map(i => i.filePath),
            ...analysis.conflicts.map(i => i.filePath)
        ];

        await addSyncLog({
            timestamp: new Date().toISOString(),
            action: 'sync',
            trigger: options.trigger,
            analysis: {
                uploadCount: analysis.summary.uploadCount,
                downloadCount: analysis.summary.downloadCount,
                conflictCount: analysis.summary.conflictCount,
                unchangedCount: analysis.summary.unchangedCount
            },
            result: result.success ? 'success' : (result.filesUploaded > 0 || result.filesDownloaded > 0 ? 'partial' : 'error'),
            filesAffected,
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
            trigger: options.trigger,
            result: 'error',
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
        // 1. Read the plan
        const plan = await readPlan();
        if (!plan) {
            throw new Error('No sync plan found. Run analysis first.');
        }

        if (plan.status !== 'ready') {
            throw new Error(`Plan is not ready (status: ${plan.status}). Resolve conflicts first.`);
        }

        console.log('[Sync] Executing plan...');
        await updatePlanStatus('executing');

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
                const content = await storageProvider.readFile(item.filePath);
                const { error } = await supabase.storage
                    .from(bucket)
                    .upload(item.filePath, content, { upsert: true });

                if (error) throw error;

                // Update local manifest with the uploaded content
                // This ensures manifest reflects what was actually uploaded
                const { updateManifestEntry } = await import('./sync-manifest');
                await updateManifestEntry(item.filePath, content);

                result.filesUploaded++;
                logFiles.push({
                    filePath: item.filePath,
                    action: 'uploaded'
                });
                console.log(`[Sync] Uploaded: ${item.filePath}`);
            } catch (error) {
                result.errors.push({
                    filePath: item.filePath,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
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
                result.errors.push({
                    filePath: item.filePath,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
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
                result.errors.push({
                    filePath: item.filePath,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
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
                result.errors.push({
                    filePath: item.filePath,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
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

            try {
                if (conflict.decision === 'local-wins') {
                    // Upload local version
                    const content = await storageProvider.readFile(conflict.filePath);
                    const { error } = await supabase.storage
                        .from(bucket)
                        .upload(conflict.filePath, content, { upsert: true });

                    if (error) throw error;

                    // Update local manifest with the uploaded content
                    const { updateManifestEntry } = await import('./sync-manifest');
                    await updateManifestEntry(conflict.filePath, content);

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
                result.errors.push({
                    filePath: conflict.filePath,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        // 8. Update manifests
        await updateManifestsAfterSync();

        // 9. Add log entry
        result.success = result.errors.length === 0;
        const totalOperations = result.filesUploaded + result.filesDownloaded + result.conflictsResolved +
                                plan.toDeleteLocally.length + plan.toDeleteRemotely.length;
        await addSyncLog({
            timestamp: new Date().toISOString(),
            action: 'sync',
            trigger: options.trigger,
            result: result.success ? 'success' : 'partial',
            files: logFiles,
            errorCount: result.errors.length,
            message: `Synced ${totalOperations} files (${result.filesUploaded} up, ${result.filesDownloaded} down, ${plan.toDeleteLocally.length} del local, ${plan.toDeleteRemotely.length} del remote, ${result.conflictsResolved} conflicts)`
        });

        // 10. Delete the plan
        await deletePlan();

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
            trigger: options.trigger,
            result: 'error',
            files: [],
            errorCount: 1,
            message: error instanceof Error ? error.message : 'Unknown error'
        });

        return result;
    }
}

/**
 * Helper: Update both local and remote manifests after sync
 * CRITICAL: After sync, all 4 timestamps must be identical:
 * - local.lastModified
 * - local.previousVersion.lastModified
 * - remote.lastModified
 * - remote.previousVersion.lastModified
 *
 * Note: The manifest is already up-to-date because storageProvider.writeFile()
 * automatically updates it when files are downloaded. This function just marks
 * previousVersion to indicate everything is now synced.
 */
async function updateManifestsAfterSync(): Promise<void> {
    const syncTime = new Date().toISOString();

    // Read current local manifest (already updated by writeFile() calls during sync)
    const localManifest = await readManifest();
    localManifest.lastSync = syncTime;

    // For each file in the manifest: update previousVersion to match current version
    // This marks the current state as the new "synced baseline"
    for (const filePath in localManifest.files) {
        const metadata = localManifest.files[filePath];

        // Clear error/conflict flags
        delete metadata.hasConflict;
        delete metadata.conflictDetectedAt;
        delete metadata.syncAttempts;
        delete metadata.lastSyncError;

        // Update previousVersion to current version
        // This is the KEY: after sync, current = previous = synced baseline
        metadata.previousVersion = {
            hash: metadata.hash,
            lastModified: metadata.lastModified
        };

        localManifest.files[filePath] = metadata;
    }

    console.log('[Sync] Updated manifest with', Object.keys(localManifest.files).length, 'files');

    // Save updated local manifest
    await writeManifest(localManifest);

    // Upload the SAME manifest to remote
    // This ensures local and remote have identical timestamps
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
    const bucket = process.env.SUPABASE_BUCKET!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    const { error } = await supabase.storage
        .from(bucket)
        .upload('sync-manifest.json', JSON.stringify(localManifest, null, 2), { upsert: true });

    if (error) {
        console.error('[Sync] Error uploading manifest:', error);
        throw error;
    }

    console.log('[Sync] Manifests updated - all timestamps synchronized');
}
