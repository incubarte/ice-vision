"use client";

import { useEffect, useRef } from 'react';
import type { LiveState } from '@/types';

export function useGoalConfetti(goalCelebration: LiveState['goalCelebration']) {
  const prevIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!goalCelebration) {
      prevIdRef.current = null;
      return;
    }

    // Only fire once per new celebration
    if (goalCelebration.id === prevIdRef.current) return;
    prevIdRef.current = goalCelebration.id;

    let cancelled = false;

    const fire = async () => {
      const confetti = (await import('canvas-confetti')).default;
      if (cancelled) return;

      const colors = ['#fb923c', '#fbbf24', '#ffffff', '#f97316', '#fde68a'];

      // Left cannon
      confetti({
        particleCount: 80,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors,
        gravity: 1.2,
        scalar: 1.1,
      });

      // Right cannon
      confetti({
        particleCount: 80,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors,
        gravity: 1.2,
        scalar: 1.1,
      });

      // Second burst with a short delay for more volume
      setTimeout(() => {
        if (cancelled) return;
        confetti({
          particleCount: 50,
          angle: 70,
          spread: 70,
          origin: { x: 0.1, y: 0.5 },
          colors,
          gravity: 1,
          scalar: 0.9,
        });
        confetti({
          particleCount: 50,
          angle: 110,
          spread: 70,
          origin: { x: 0.9, y: 0.5 },
          colors,
          gravity: 1,
          scalar: 0.9,
        });
      }, 300);
    };

    fire();

    return () => { cancelled = true; };
  }, [goalCelebration?.id]);
}
