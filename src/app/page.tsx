
"use client";

import { useEffect } from 'react';
import { FullScoreboard } from '@/components/scoreboard/full-scoreboard';
import { useAutoSwitchTournament } from '@/hooks/use-auto-switch-tournament';

export default function ScoreboardPage() {
  useAutoSwitchTournament();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Basic security check: ensure the message is what we expect
      if (event.data === 'REQUEST_FULLSCREEN') {
        const element = document.documentElement;
        if (element.requestFullscreen) {
          element.requestFullscreen().catch(err => {
            // It's fine to swallow the error here, as the user might deny the request.
            // console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
          });
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
