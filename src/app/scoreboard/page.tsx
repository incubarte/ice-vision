
"use client";

import { useEffect } from 'react';
import { FullScoreboard } from '@/components/scoreboard/full-scoreboard';
import { useAutoSwitchTournament } from '@/hooks/use-auto-switch-tournament';

export default function ScoreboardPage() {
  useAutoSwitchTournament();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'REQUEST_FULLSCREEN') {
        const element = document.documentElement;
        if (element.requestFullscreen) {
          element.requestFullscreen().catch(() => {});
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div className="w-full h-full">
        <FullScoreboard />
    </div>
  );
}
