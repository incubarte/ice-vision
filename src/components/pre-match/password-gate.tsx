"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';

interface PasswordGateProps {
  onSuccess: () => void;
}

const PASSWORD = 'IceVision';

export function PasswordGate({ onSuccess }: PasswordGateProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value === PASSWORD) {
      onSuccess();
    } else {
      setError(true);
      setValue('');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Lock className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Acceso al plantel</h1>
          <p className="text-muted-foreground text-sm">Ingresá la clave de tu equipo para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={value}
              onChange={e => { setValue(e.target.value); setError(false); }}
              autoFocus
              placeholder="••••••••"
            />
            {error && (
              <p className="text-sm text-destructive">Contraseña incorrecta</p>
            )}
          </div>
          <Button type="submit" className="w-full">Ingresar</Button>
        </form>
      </div>
    </div>
  );
}
