import { promises as fs } from 'fs';
import path from 'path';
import type { SyncPlan } from '@/types';

const PLAN_FILE = 'sync-plan.json';

// Get the data directory path
function getDataDir(): string {
    const storagePath = process.env.STORAGE_PATH;
    if (storagePath) {
        if (path.isAbsolute(storagePath)) {
            return path.join(storagePath, 'data');
        }
        return path.join(process.cwd(), storagePath, 'data');
    }
    return path.join(process.cwd(), 'storage', 'data');
}

function getPlanPath(): string {
    return path.join(getDataDir(), PLAN_FILE);
}

/**
 * Read sync plan
 */
export async function readPlan(): Promise<SyncPlan | null> {
    try {
        const planPath = getPlanPath();
        const content = await fs.readFile(planPath, 'utf-8');
        return JSON.parse(content) as SyncPlan;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }
        console.error('[Sync Plan] Error reading plan:', error);
        throw error;
    }
}

/**
 * Write sync plan
 */
export async function writePlan(plan: SyncPlan): Promise<void> {
    try {
        const planPath = getPlanPath();
        await fs.writeFile(planPath, JSON.stringify(plan, null, 2), 'utf-8');
        console.log('[Sync Plan] Plan saved:', {
            status: plan.status,
            uploads: plan.toUpload.length,
            downloads: plan.toDownload.length,
            conflicts: plan.conflicts.length
        });
    } catch (error) {
        console.error('[Sync Plan] Error writing plan:', error);
        throw error;
    }
}

/**
 * Delete sync plan
 */
export async function deletePlan(): Promise<void> {
    try {
        const planPath = getPlanPath();
        await fs.unlink(planPath);
        console.log('[Sync Plan] Plan deleted');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            // File doesn't exist, that's fine
            return;
        }
        console.error('[Sync Plan] Error deleting plan:', error);
        throw error;
    }
}

/**
 * Check if plan is valid (files haven't changed since plan was created)
 */
export async function validatePlan(plan: SyncPlan, currentFileHashes: Record<string, string>): Promise<boolean> {
    // Check if any files in the plan have changed
    for (const item of [...plan.toUpload, ...plan.conflicts]) {
        const currentHash = currentFileHashes[item.filePath];
        if (!currentHash) {
            // File was deleted
            console.log(`[Sync Plan] File deleted since plan creation: ${item.filePath}`);
            return false;
        }
        if (currentHash !== item.hash && currentHash !== (item as any).localHash) {
            // File changed
            console.log(`[Sync Plan] File changed since plan creation: ${item.filePath}`);
            return false;
        }
    }

    return true;
}

/**
 * Mark plan as invalid
 */
export async function invalidatePlan(): Promise<void> {
    const plan = await readPlan();
    if (plan) {
        plan.status = 'invalid';
        await writePlan(plan);
        console.log('[Sync Plan] Plan marked as invalid');
    }
}

/**
 * Update plan status
 */
export async function updatePlanStatus(status: SyncPlan['status']): Promise<void> {
    const plan = await readPlan();
    if (plan) {
        plan.status = status;
        await writePlan(plan);
        console.log(`[Sync Plan] Plan status updated to: ${status}`);
    }
}

/**
 * Update conflict decisions in plan
 */
export async function updateConflictDecisions(
    decisions: Array<{ filePath: string; decision: 'local-wins' | 'remote-wins' | 'skip' }>
): Promise<SyncPlan | null> {
    const plan = await readPlan();
    if (!plan) {
        return null;
    }

    // Update decisions
    for (const { filePath, decision } of decisions) {
        const conflict = plan.conflicts.find(c => c.filePath === filePath);
        if (conflict) {
            conflict.decision = decision;
        }
    }

    // Check if all conflicts have decisions (except 'skip')
    const allResolved = plan.conflicts.every(c => c.decision !== undefined);
    if (allResolved) {
        plan.status = 'ready';
    }

    await writePlan(plan);
    return plan;
}
