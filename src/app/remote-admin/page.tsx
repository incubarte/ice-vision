'use client';

import { useState, useEffect } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const STORAGE_KEY = 'adminAccess';
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

interface AdminAccess {
    secret: string;
    expiresAt: number;
}

function formatRemainingTime(expiresAt: number): string {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return '0m';
    const totalMinutes = Math.floor(remaining / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

export default function RemoteAdminPage() {
    const [unlocked, setUnlocked] = useState(false);
    const [expiresAt, setExpiresAt] = useState<number | null>(null);
    const [secret, setSecret] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed: AdminAccess = JSON.parse(stored);
                if (parsed.expiresAt > Date.now()) {
                    setUnlocked(true);
                    setExpiresAt(parsed.expiresAt);
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                }
            } catch {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
        setHydrated(true);
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/admin/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret }),
            });
            const data = await res.json();

            if (data.valid) {
                const newExpiresAt = Date.now() + SESSION_DURATION_MS;
                const access: AdminAccess = { secret, expiresAt: newExpiresAt };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(access));
                setExpiresAt(newExpiresAt);
                setUnlocked(true);
                setSecret('');
            } else {
                setError('Clave incorrecta');
            }
        } catch {
            setError('Error al verificar la clave');
        } finally {
            setLoading(false);
        }
    }

    function handleRevoke() {
        localStorage.removeItem(STORAGE_KEY);
        setUnlocked(false);
        setExpiresAt(null);
        setSecret('');
        setError('');
    }

    if (!hydrated) return null;

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-sm">
                {unlocked && expiresAt ? (
                    <Card>
                        <CardHeader className="flex flex-col items-center gap-2 pb-2">
                            <LockOpen className="h-10 w-10 text-green-400" />
                            <CardTitle className="text-center">Acceso de administrador activo</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center gap-4">
                            <p className="text-sm text-muted-foreground">
                                Acceso válido por {formatRemainingTime(expiresAt)}
                            </p>
                            <Button variant="destructive" className="w-full" onClick={handleRevoke}>
                                Revocar acceso
                            </Button>
                            <p className="text-xs text-muted-foreground text-center">
                                El acceso se revoca automáticamente al expirar.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader className="flex flex-col items-center gap-2 pb-2">
                            <Lock className="h-10 w-10" />
                            <CardTitle className="text-center">Acceso Restringido</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="secret">Clave de administrador</Label>
                                    <Input
                                        id="secret"
                                        type="password"
                                        value={secret}
                                        onChange={(e) => setSecret(e.target.value)}
                                        disabled={loading}
                                        autoComplete="current-password"
                                    />
                                </div>
                                {error && (
                                    <p className="text-sm text-destructive">{error}</p>
                                )}
                                <Button type="submit" className="w-full" disabled={loading || !secret}>
                                    {loading ? 'Verificando...' : 'Desbloquear'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
