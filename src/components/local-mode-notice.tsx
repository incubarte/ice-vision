'use client';
import { ExternalLink, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CLOUD_ADMIN_URL } from '@/lib/app-mode';

interface LocalModeNoticeProps {
  message?: string;
  className?: string;
}

export function LocalModeNotice({ message, className }: LocalModeNoticeProps) {
  return (
    <Alert className={className}>
      <Cloud className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>{message || 'Estás en modo local. La administración del torneo se realiza desde la nube.'}</span>
        <Button
          variant="outline"
          size="sm"
          className="ml-4 shrink-0"
          onClick={() => window.open(CLOUD_ADMIN_URL, '_blank')}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Administrar Torneo
        </Button>
      </AlertDescription>
    </Alert>
  );
}
