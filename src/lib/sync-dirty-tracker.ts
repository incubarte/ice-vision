import { promises as fs } from 'fs';
import path from 'path';

const DIRTY_FILENAME = 'sync-dirty.json';

interface SyncDirtyState {
  pendingSync: boolean;
  dirtyAt: string | null;
  lastSyncedAt: string | null;
}

function getDirtyFilePath(): string {
  const storagePath = process.env.STORAGE_PATH;
  if (storagePath) {
    if (path.isAbsolute(storagePath)) {
      return path.join(storagePath, 'data', DIRTY_FILENAME);
    }
    return path.join(process.cwd(), storagePath, 'data', DIRTY_FILENAME);
  }
  return path.join(process.cwd(), 'storage', 'data', DIRTY_FILENAME);
}

export async function getDirtyState(): Promise<SyncDirtyState> {
  try {
    const content = await fs.readFile(getDirtyFilePath(), 'utf-8');
    return JSON.parse(content);
  } catch {
    return { pendingSync: false, dirtyAt: null, lastSyncedAt: null };
  }
}

export async function setDirty(): Promise<void> {
  // Only relevant in local mode with Supabase configured
  if (!process.env.SUPABASE_SERVICE_KEY || process.env.STORAGE_PROVIDER === 'supabase_rw') return;
  try {
    const current = await getDirtyState();
    const filePath = getDirtyFilePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({
      pendingSync: true,
      dirtyAt: new Date().toISOString(),
      lastSyncedAt: current.lastSyncedAt,
    }, null, 2), 'utf-8');
  } catch (err) {
    console.error('[SyncDirty] Failed to set dirty flag:', err);
  }
}

export async function clearDirty(): Promise<void> {
  try {
    const current = await getDirtyState();
    const filePath = getDirtyFilePath();
    await fs.writeFile(filePath, JSON.stringify({
      pendingSync: false,
      dirtyAt: current.dirtyAt,
      lastSyncedAt: new Date().toISOString(),
    }, null, 2), 'utf-8');
  } catch (err) {
    console.error('[SyncDirty] Failed to clear dirty flag:', err);
  }
}

// Module-level flag: only check on startup once per process
let startupSyncTriggered = false;

/**
 * On first request after process start, checks if there is a pending sync
 * from a previous session (e.g., machine was shut down mid-sync).
 * Fires a sync-trigger if so. Runs at most once per process.
 */
export function checkAndTriggerStartupSync(baseUrl: string): void {
  if (startupSyncTriggered) return;
  startupSyncTriggered = true;

  // Only relevant in local mode with Supabase configured
  if (!process.env.SUPABASE_SERVICE_KEY || process.env.STORAGE_PROVIDER === 'supabase_rw') return;

  getDirtyState().then(state => {
    if (!state.pendingSync) return;
    console.log('[SyncDirty] Pending sync detected on startup (dirtyAt:', state.dirtyAt, '), triggering recovery sync...');
    fetch(`${baseUrl}/api/sync-trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'after-summary-edit' }),
    }).catch(err => console.error('[SyncDirty] Startup sync request failed:', err));
  }).catch(err => console.error('[SyncDirty] Failed to read dirty state on startup:', err));
}
