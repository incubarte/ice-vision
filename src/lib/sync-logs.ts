import { storageProvider } from './storage';
import type { SyncLogEntry, SyncErrorLogEntry } from '@/types';

const SYNC_LOGS_FILE = 'sync-logs.json';
const SYNC_ERRORS_FILE = 'sync-errors.json';
const MAX_LOG_ENTRIES = 100; // Keep last 100 entries
const MAX_ERROR_ENTRIES = 50; // Keep last 50 errors

/**
 * Read sync logs
 */
export async function readSyncLogs(): Promise<SyncLogEntry[]> {
    try {
        const data = await storageProvider.readFile(SYNC_LOGS_FILE);
        return JSON.parse(data) as SyncLogEntry[];
    } catch {
        return [];
    }
}

/**
 * Add entry to sync logs
 */
export async function addSyncLog(entry: SyncLogEntry): Promise<void> {
    try {
        const logs = await readSyncLogs();
        logs.unshift(entry); // Add to beginning

        // Keep only last MAX_LOG_ENTRIES
        const trimmedLogs = logs.slice(0, MAX_LOG_ENTRIES);

        await storageProvider.writeFile(SYNC_LOGS_FILE, JSON.stringify(trimmedLogs, null, 2));
        console.log('[Sync Logs] Added entry:', entry.action, entry.result);
    } catch (error) {
        console.error('[Sync Logs] Error writing log:', error);
    }
}

/**
 * Read sync error logs
 */
export async function readSyncErrors(): Promise<SyncErrorLogEntry[]> {
    try {
        const data = await storageProvider.readFile(SYNC_ERRORS_FILE);
        return JSON.parse(data) as SyncErrorLogEntry[];
    } catch {
        return [];
    }
}

/**
 * Add entry to sync error logs
 */
export async function addSyncError(entry: SyncErrorLogEntry): Promise<void> {
    try {
        const errors = await readSyncErrors();
        errors.unshift(entry); // Add to beginning

        // Keep only last MAX_ERROR_ENTRIES
        const trimmedErrors = errors.slice(0, MAX_ERROR_ENTRIES);

        await storageProvider.writeFile(SYNC_ERRORS_FILE, JSON.stringify(trimmedErrors, null, 2));
        console.log('[Sync Errors] Added error for:', entry.filePath);
    } catch (error) {
        console.error('[Sync Errors] Error writing error log:', error);
    }
}

/**
 * Clear sync error logs
 */
export async function clearSyncErrors(): Promise<void> {
    try {
        await storageProvider.writeFile(SYNC_ERRORS_FILE, JSON.stringify([], null, 2));
        console.log('[Sync Errors] Cleared all error logs');
    } catch (error) {
        console.error('[Sync Errors] Error clearing error logs:', error);
    }
}
