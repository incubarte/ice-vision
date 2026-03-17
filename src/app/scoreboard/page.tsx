
"use client";

import { useEffect } from 'react';
import { FullScoreboard } from '@/components/scoreboard/full-scoreboard';

export default function ScoreboardPage() {

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
