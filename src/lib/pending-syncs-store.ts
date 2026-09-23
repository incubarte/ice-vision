import fs from 'fs';
import path from 'path';
import type { PendingSync } from '@/types';

function getPendingSyncsPath(): string {
  const storagePath = process.env.STORAGE_PATH
    ? path.resolve(process.cwd(), process.env.STORAGE_PATH)
    : path.join(process.cwd(), 'storage');
  return path.join(storagePath, 'data', 'pending-syncs.json');
}

export function readPendingSyncs(): PendingSync[] {
  try {
    const filePath = getPendingSyncsPath();
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as PendingSync[];
  } catch {
    return [];
  }
}

export function writePendingSyncs(syncs: PendingSync[]): void {
  try {
    const filePath = getPendingSyncsPath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(syncs, null, 2), 'utf-8');
  } catch (err) {
    console.error('[PendingSyncs] Failed to write:', err);
  }
}
