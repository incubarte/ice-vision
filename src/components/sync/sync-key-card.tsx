'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { KeyRound, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const STORAGE_KEY = 'cloudSyncKey';

type TestStatus = 'idle' | 'loading' | 'ok' | 'error';

export function SyncKeyCard() {
  const [keyInput, setKeyInput] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setSavedKey(stored);
    if (stored) setKeyInput(stored);
  }, []);

  const handleTest = async () => {
    const key = keyInput.trim();
    if (!key) return;
    setTestStatus('loading');
    setTestMessage('');
    try {
      const res = await fetch('/api/cloud-relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/api/admin/verify', payload: { secret: key } }),
      });
      const data = await res.json().catch(() => ({}));

      // Relay itself failed (network error reaching Vercel)
      if (res.status === 500) {
        setTestStatus('error');
        setTestMessage(`No se pudo alcanzar la nube. ${data.error || ''} (destino: ${data._relayTarget || '?'})`);
        return;
      }

      if (data.valid) {
        localStorage.setItem(STORAGE_KEY, key);
        setSavedKey(key);
        setTestStatus('ok');
        setTestMessage(`Clave válida y guardada. (${data._relayTarget})`);
      } else if (data.reason === 'not_configured') {
        setTestStatus('error');
        setTestMessage(`ADMIN_WRITE_SECRET no está configurado en Vercel. (${data._relayTarget})`);
      } else {
        setTestStatus('error');
        setTestMessage(`Clave incorrecta — no coincide con ADMIN_WRITE_SECRET en Vercel. (${data._relayTarget})`);
      }
    } catch {
      setTestStatus('error');
      setTestMessage('Error inesperado al conectar.');
    }
  };

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedKey(null);
    setKeyInput('');
    setTestStatus('idle');
    setTestMessage('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Clave de sincronización con la nube
        </CardTitle>
        <CardDescription>
          Clave que usa el sistema local para escribir en el servidor de Vercel.
          Debe coincidir con <code className="text-xs bg-muted px-1 rounded">ADMIN_WRITE_SECRET</code> en Vercel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          {savedKey ? (
            <div className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Clave configurada
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              Sin clave — el sync a la nube fallará
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="sync-key-input" className="sr-only">Clave de sync</Label>
            <Input
              id="sync-key-input"
              type="password"
              placeholder="Ingresá la clave de sync..."
              value={keyInput}
              onChange={e => { setKeyInput(e.target.value); setTestStatus('idle'); setTestMessage(''); }}
              onKeyDown={e => e.key === 'Enter' && handleTest()}
            />
          </div>
          <Button
            onClick={handleTest}
            disabled={testStatus === 'loading' || !keyInput.trim()}
          >
            {testStatus === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {testStatus === 'loading' ? 'Probando...' : 'Probar y guardar'}
          </Button>
          {savedKey && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground">
              Borrar
            </Button>
          )}
        </div>

        {testStatus === 'ok' && (
          <p className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            {testMessage}
          </p>
        )}
        {testStatus === 'error' && (
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <XCircle className="h-4 w-4" />
            {testMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
