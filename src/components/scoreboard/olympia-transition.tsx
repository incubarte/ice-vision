"use client";

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

interface OlympiaTransitionProps {
  onComplete: () => void;
  oldContent: React.ReactNode;
  newContent: React.ReactNode;
}

export function OlympiaTransition({ onComplete, oldContent, newContent }: OlympiaTransitionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  const [isAnimating, setIsAnimating] = useState(false);

  // Keep ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Iniciar animación después del mount
    const timer = setTimeout(() => {
      setIsAnimating(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isAnimating) return;

    // Una sola pasada enorme de izquierda a derecha
    const startX = -150;
    const endX = 250;
    const duration = 4;

    // Actualizar CSS variable mientras la Olympia se mueve - SIN causar re-renders
    const startTime = Date.now();

    const updatePosition = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      const currentX = startX + (endX - startX) * progress;

      // Actualizar CSS variable directamente - NO causa re-render
      if (containerRef.current) {
        containerRef.current.style.setProperty('--olympia-x', String(currentX));
      }

      if (progress < 1) {
        requestAnimationFrame(updatePosition);
      }
    };

    requestAnimationFrame(updatePosition);

    // Llamar onComplete cuando la animación termine
    const completeTimer = setTimeout(() => {
      onCompleteRef.current();
    }, (duration * 1000) + 100);

    return () => clearTimeout(completeTimer);
  }, [isAnimating]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-background" style={{ '--olympia-x': '-150' } as React.CSSProperties}>
      {/* New content que se va revelando (DEBAJO - z-0) */}
      <div className="absolute inset-0 z-0">
        {newContent}
      </div>

      {/* Old content (warmup) que el Olympia "se lleva" (ENCIMA - z-10) */}
      <div
        className="absolute inset-0 z-10"
        style={{
          clipPath: 'polygon(clamp(0%, calc((var(--olympia-x) + 30) * 1%), 100%) 0%, 100% 0%, 100% 100%, clamp(0%, calc((var(--olympia-x) + 30) * 1%), 100%) 100%)',
          willChange: 'clip-path',
        }}
      >
        {oldContent}
      </div>

      {/* Olympia animado - ENORME - por encima de todo (z-50) */}
      <motion.div
        className="absolute z-50 pointer-events-none"
        initial={{ x: '-150%', y: '-50%', rotate: 90 }}
        animate={isAnimating ? { x: '250%', y: '-50%' } : { x: '-150%', y: '-50%' }}
        transition={{
          duration: 4,
          ease: "linear",
        }}
        style={{
          width: '60vw',
          height: 'auto',
          aspectRatio: '1',
          top: '50%',
          left: 0,
        }}
      >
        <div className="relative w-full h-full drop-shadow-2xl">
          <Image
            src="/olympia.png"
            alt="Olympia Ice Resurfacer"
            fill
            sizes="60vw"
            style={{ objectFit: 'contain' }}
            priority
            unoptimized
          />
        </div>
      </motion.div>
    </div>
  );
}
