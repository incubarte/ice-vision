'use client';
import { useState } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Clock, RefreshCw, User, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export function PendingSyncsCard() {
  const { state, dispatch, triggerSync } = useGameState();
  const pending = state._pendingSyncs || [];
  const [isSyncing, setIsSyncing] = useState(false);

  const typeLabel = (type: string) => type === 'ADD_PLAYER' ? 'Jugador' : 'Summary';
  const typeIcon = (type: string) => type === 'ADD_PLAYER'
    ? <User className="h-4 w-4" />
    : <FileText className="h-4 w-4" />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Sync Pendiente
              {pending.length > 0 && (
                <Badge variant="destructive">{pending.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Operaciones realizadas sin internet, pendientes de sincronización.
              Se reintentan automáticamente cada 3 minutos o al recuperar conexión.
            </CardDescription>
          </div>
          {pending.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={isSyncing}
              onClick={async () => {
                setIsSyncing(true);
                await triggerSync();
                setIsSyncing(false);
              }}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Reintentar ahora'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {pending.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Todo sincronizado
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(sync => (
              <div key={sync.id} className="flex items-start justify-between p-3 border rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-muted-foreground">{typeIcon(sync.payload.type)}</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{typeLabel(sync.payload.type)}</span>
                      {sync.payload.type === 'ADD_PLAYER' && (
                        <span className="text-sm text-muted-foreground">
                          #{sync.payload.player.number} {sync.payload.player.name}
                        </span>
                      )}
                      {sync.payload.type === 'SAVE_SUMMARY' && (
                        <span className="text-sm text-muted-foreground font-mono text-xs">
                          {sync.payload.matchId.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(sync.createdAt), { addSuffix: true, locale: es })}
                      </span>
                      {sync.attempts > 0 && (
                        <span>{sync.attempts} intento{sync.attempts !== 1 ? 's' : ''} fallido{sync.attempts !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    {sync.lastError && (
                      <div className="flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        {sync.lastError}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dispatch({ type: 'RESOLVE_SYNC', payload: { id: sync.id } })}
                  className="text-xs text-muted-foreground"
                >
                  Descartar
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
