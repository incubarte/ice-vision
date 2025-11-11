import { NextResponse } from 'next/server';

// In-memory progress storage (simple solution for single-server deployments)
const progressStore = new Map<string, {
    currentFile: string;
    filesDownloaded: number;
    totalFiles: number;
    isComplete: boolean;
    error?: string;
}>();

export function updateProgress(sessionId: string, data: {
    currentFile?: string;
    filesDownloaded?: number;
    totalFiles?: number;
    isComplete?: boolean;
    error?: string;
}) {
    const current = progressStore.get(sessionId) || {
        currentFile: '',
        filesDownloaded: 0,
        totalFiles: 0,
        isComplete: false,
    };

    progressStore.set(sessionId, { ...current, ...data });
}

export function getProgress(sessionId: string) {
    return progressStore.get(sessionId);
}

export function clearProgress(sessionId: string) {
    progressStore.delete(sessionId);
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
        return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const progress = getProgress(sessionId);

    if (!progress) {
        return NextResponse.json({
            currentFile: '',
            filesDownloaded: 0,
            totalFiles: 0,
            isComplete: false,
        });
    }

    return NextResponse.json(progress);
}
