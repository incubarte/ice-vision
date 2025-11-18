"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface PreWarmupIntroProps {
  logo: string | null;
  onComplete: () => void;
}

export function PreWarmupIntro({ logo, onComplete }: PreWarmupIntroProps) {
  const [phase, setPhase] = useState<'pulsing' | 'explosion'>('pulsing');

  useEffect(() => {
    if (!logo) {
      onComplete();
      return;
    }

    // Fase de palpitación: 8 segundos
    const pulsingTimer = setTimeout(() => {
      setPhase('explosion');
    }, 8000);

    // Explosión final: 2 segundos
    const explosionTimer = setTimeout(() => {
      onComplete();
    }, 10000);

    return () => {
      clearTimeout(pulsingTimer);
      clearTimeout(explosionTimer);
    };
  }, [onComplete, logo]);

  if (!logo) {
    return null;
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Líneas diagonales animadas estilo warmup */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ zIndex: 1 }}
      >
        <defs>
          {/* Gradiente blanco-hielo para las líneas */}
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.6)" stopOpacity="0.6" />
            <stop offset="50%" stopColor="rgba(200, 230, 255, 0.9)" stopOpacity="1" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.6)" stopOpacity="0.6" />
          </linearGradient>

          {/* Filtro de glow */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Línea zigzag 1 - diagonal simétrica */}
        <motion.path
          d="M 0,100 L 8,92 L 4,84 L 12,76 L 8,68 L 18,58 L 25,65 L 32,58 L 38,64 L 44,56 L 50,50 L 56,44 L 62,50 L 68,42 L 75,49 L 82,42 L 88,32 L 92,24 L 96,16 L 100,0"
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          filter="url(#glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: [0, 1, 1, 0],
            opacity: [0, 1, 1, 0]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            repeatDelay: 1,
            ease: "easeInOut"
          }}
        />

        {/* Línea zigzag 2 - offset */}
        <motion.path
          d="M 0,98 L 6,90 L 3,82 L 10,74 L 6,66 L 16,56 L 23,63 L 30,56 L 36,62 L 42,54 L 50,50 L 58,46 L 64,52 L 70,44 L 77,51 L 84,44 L 90,34 L 94,26 L 97,18 L 100,2"
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          filter="url(#glow)"
          opacity="0.6"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: [0, 1, 1, 0],
            opacity: [0, 0.6, 0.6, 0]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            repeatDelay: 1,
            delay: 0.3,
            ease: "easeInOut"
          }}
        />
      </svg>

      {/* Partículas/estrellas de fondo */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-primary/60 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              scale: [0, 1.5, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* Logo central con animación */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        {phase === 'pulsing' ? (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{
              scale: [0.5, 1, 0.95, 1.05, 0.9, 1.1, 0.85, 1.15, 0.8, 1.2],
              opacity: 1,
            }}
            transition={{
              scale: {
                duration: 8,
                times: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1],
                ease: "easeInOut",
              },
              opacity: {
                duration: 0.5,
                ease: "easeOut",
              },
            }}
            className="relative"
            style={{ willChange: 'transform, opacity' }}
          >
            <Image
              src={logo}
              alt="Tournament logo"
              width={300}
              height={300}
              className="object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]"
              priority
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 1.2 }}
            animate={{
              scale: 25,
              opacity: 0,
            }}
            transition={{
              scale: {
                duration: 2,
                ease: [0.34, 1.56, 0.64, 1],
              },
              opacity: {
                duration: 1.8,
                ease: "easeIn",
              },
            }}
            className="relative"
            style={{ willChange: 'transform, opacity' }}
          >
            <Image
              src={logo}
              alt="Tournament logo"
              width={300}
              height={300}
              className="object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]"
              priority
            />
          </motion.div>
        )}
      </div>

      {/* Flash blanco en la explosión */}
      {phase === 'explosion' && (
        <motion.div
          className="absolute inset-0 bg-white z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1, times: [0, 0.3, 1], ease: "easeOut" }}
        />
      )}
    </div>
  );
}
