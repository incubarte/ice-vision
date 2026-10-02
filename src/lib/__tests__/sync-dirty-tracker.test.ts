import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises before importing the module under test.
// Both the named `promises` export AND `default.promises` must point to the
// same mock object so the module under test (which does
// `import { promises as fs } from 'fs'`) picks up the mocked functions.
vi.mock('fs', () => {
  const readFile = vi.fn();
  const writeFile = vi.fn();
  const mkdir = vi.fn();
  const promises = { readFile, writeFile, mkdir };
  return { default: { promises }, promises };
});

import { promises as fs } from 'fs';
import { getDirtyState, setDirty, clearDirty } from '../sync-dirty-tracker';

const mockReadFile = vi.mocked(fs.readFile);
const mockWriteFile = vi.mocked(fs.writeFile);
const mockMkdir = vi.mocked(fs.mkdir);

beforeEach(() => {
  vi.clearAllMocks();
  mockMkdir.mockResolvedValue(undefined as any);
  mockWriteFile.mockResolvedValue(undefined as any);
  // Enable setDirty by default (requires SUPABASE_SERVICE_KEY, not supabase_rw)
  process.env.SUPABASE_SERVICE_KEY = 'test-key';
  delete process.env.STORAGE_PROVIDER;
});

// ─── getDirtyState ────────────────────────────────────────────────────────────

describe('getDirtyState', () => {
  it('returns parsed file content when file exists', async () => {
    const stored = { pendingSync: true, dirtyAt: '2026-01-01T00:00:00.000Z', lastSyncedAt: null };
    mockReadFile.mockResolvedValueOnce(JSON.stringify(stored) as any);

    const result = await getDirtyState();
    expect(result).toEqual(stored);
  });

  it('returns default state when file does not exist', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));

    const result = await getDirtyState();
    expect(result).toEqual({ pendingSync: false, dirtyAt: null, lastSyncedAt: null });
  });

  it('returns default state when file contains invalid JSON', async () => {
    mockReadFile.mockRejectedValueOnce(new SyntaxError('Unexpected token'));

    const result = await getDirtyState();
    expect(result).toEqual({ pendingSync: false, dirtyAt: null, lastSyncedAt: null });
  });
});

// ─── setDirty ────────────────────────────────────────────────────────────────

describe('setDirty', () => {
  it('writes pendingSync:true and records dirtyAt', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT')); // getDirtyState → default

    await setDirty();

    expect(mockWriteFile).toHaveBeenCalledOnce();
    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(written.pendingSync).toBe(true);
    expect(written.dirtyAt).toBeTruthy();
  });

  it('preserves existing lastSyncedAt', async () => {
    const existing = { pendingSync: false, dirtyAt: null, lastSyncedAt: '2026-01-01T12:00:00.000Z' };
    mockReadFile.mockResolvedValueOnce(JSON.stringify(existing) as any);

    await setDirty();

    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(written.lastSyncedAt).toBe('2026-01-01T12:00:00.000Z');
  });

  it('is a no-op when SUPABASE_SERVICE_KEY is not set', async () => {
    delete process.env.SUPABASE_SERVICE_KEY;

    await setDirty();

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('is a no-op when STORAGE_PROVIDER is supabase_rw', async () => {
    process.env.STORAGE_PROVIDER = 'supabase_rw';

    await setDirty();

    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});

// ─── clearDirty ──────────────────────────────────────────────────────────────

describe('clearDirty', () => {
  it('writes pendingSync:false and records lastSyncedAt', async () => {
    const existing = { pendingSync: true, dirtyAt: '2026-01-01T10:00:00.000Z', lastSyncedAt: null };
    mockReadFile.mockResolvedValueOnce(JSON.stringify(existing) as any);

    await clearDirty();

    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(written.pendingSync).toBe(false);
    expect(written.lastSyncedAt).toBeTruthy();
  });

  it('preserves the original dirtyAt timestamp', async () => {
    const existing = { pendingSync: true, dirtyAt: '2026-01-01T08:00:00.000Z', lastSyncedAt: null };
    mockReadFile.mockResolvedValueOnce(JSON.stringify(existing) as any);

    await clearDirty();

    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(written.dirtyAt).toBe('2026-01-01T08:00:00.000Z');
  });
});

// ─── setDirty → clearDirty cycle ─────────────────────────────────────────────

describe('setDirty → clearDirty cycle', () => {
  it('round-trip: dirty then cleared leaves pendingSync:false', async () => {
    // setDirty: no prior file
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
    await setDirty();
    const afterDirty = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(afterDirty.pendingSync).toBe(true);

    // clearDirty: reads the state written by setDirty
    mockReadFile.mockResolvedValueOnce(JSON.stringify(afterDirty) as any);
    await clearDirty();
    const afterClear = JSON.parse(mockWriteFile.mock.calls[1][1] as string);
    expect(afterClear.pendingSync).toBe(false);
    expect(afterClear.dirtyAt).toBe(afterDirty.dirtyAt); // preserved
    expect(afterClear.lastSyncedAt).toBeTruthy();
  });
});
