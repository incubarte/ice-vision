'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'adminAccess';

interface AdminAccess {
    secret: string;
    expiresAt: number;
}

function readValidAccess(): AdminAccess | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed: AdminAccess = JSON.parse(raw);
        if (parsed.expiresAt > Date.now()) return parsed;
        localStorage.removeItem(STORAGE_KEY);
        return null;
    } catch {
        return null;
    }
}

export function useAdminMode() {
    const [adminSecret, setAdminSecret] = useState<string | null>(null);

    useEffect(() => {
        const access = readValidAccess();
        setAdminSecret(access?.secret ?? null);
    }, []);

    const isAdminMode = !!adminSecret;
    const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY === 'true' && !isAdminMode;

    return { isAdminMode, isReadOnly, adminSecret };
}
