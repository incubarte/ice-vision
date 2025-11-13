"use client";

import { motion, useAnimation } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useState } from 'react';

interface OlympiaTransitionProps {
  onComplete: () => void;
  oldContent: React.ReactNode;
  newContent: React.ReactNode;
}

export function OlympiaTransition({ onComplete, oldContent, newContent }: OlympiaTransitionProps) {
  const controls = useAnimation();
  const [olympiaX, setOlympiaX] = useState(-150);

  useEffect(() => {
    const runAnimation = async () => {
      // Una sola pasada enorme de izquierda a derecha
      const startX = -150;
      const endX = 250;
      const duration = 4;

      // Establecer posición inicial
      await controls.set({
        x: `${startX}%`,
        y: '-50%',
      });

      setOlympiaX(startX);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Animar la Olympia atravesando la pantalla
      const animationPromise = controls.start({
        x: `${endX}%`,
        transition: {
          duration: duration,
          ease: "linear",
        }
      });

      // Actualizar posición X mientras la Olympia se mueve - MÁS SUAVE con requestAnimationFrame
      const startTime = Date.now();

      const updatePosition = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / (duration * 1000), 1);
        const currentX = startX + (endX - startX) * progress;
        setOlympiaX(currentX);

        if (progress < 1) {
          requestAnimationFrame(updatePosition);
        }
      };

      requestAnimationFrame(updatePosition);

      await animationPromise;
      await new Promise(resolve => setTimeout(resolve, 100));
      onComplete();
    };

    runAnimation();
  }, [controls, onComplete]);

  // Calcular el clip-path basado en la posición del Olympia
  const getClipPath = () => {
    // El Olympia mide 60vw de ancho, así que su centro está a 30vw de su posición X
    // Ajustamos para que el "corte" esté en el centro del Olympia
    const olympiaWidthVw = 60;
    const olympiaCenterOffsetVw = olympiaWidthVw / 2;

    // Convertir 30vw a porcentaje del viewport width (30vw = 30% del viewport)
    const centerOffsetPercent = olympiaCenterOffsetVw;

    // Posición del centro del Olympia
    const clipPositionX = olympiaX + centerOffsetPercent;

    // Normalizar a 0-100
    const normalizedX = Math.max(0, Math.min(100, clipPositionX));

    // El Olympia "se lleva" el warmup: mantiene visible lo que está a la DERECHA del centro del Olympia
    return `polygon(${normalizedX}% 0%, 100% 0%, 100% 100%, ${normalizedX}% 100%)`;
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-background">
      {/* New content que se va revelando (DEBAJO - z-0) */}
      <div className="absolute inset-0 z-0">
        {newContent}
      </div>

      {/* Old content (warmup) que el Olympia "se lleva" (ENCIMA - z-10) */}
      <div
        className="absolute inset-0 z-10"
        style={{
          clipPath: getClipPath(),
          willChange: 'clip-path',
        }}
      >
        {oldContent}
      </div>

      {/* Olympia animado - ENORME - por encima de todo (z-50) */}
      <motion.div
        className="absolute z-50 pointer-events-none"
        initial={{ x: '-150%', y: '-50%', rotate: 90 }}
        animate={controls}
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
