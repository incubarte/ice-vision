"use client";

import { useEffect, useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface PreWarmupIntroProps {
  logo: string | null;
  onComplete: () => void;
}

// Generar posiciones de partículas una sola vez (fuera del componente)
const PARTICLE_POSITIONS = Array.from({ length: 30 }, () => ({
  left: Math.random() * 100,
  top: Math.random() * 100,
  duration: 2.1 + Math.random() * 2,
  delay: Math.random() * 2,
}));

export function PreWarmupIntro({ logo, onComplete }: PreWarmupIntroProps) {
  const [phase, setPhase] = useState<'pulsing' | 'explosion'>('pulsing');
  const onCompleteRef = useRef(onComplete);

  // Keep ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!logo) {
      onCompleteRef.current();
      return;
    }

    console.log('[PreWarmupIntro] Starting animation - Version 2.0');

    // Fase de palpitación: cambiar a explosión a los 5.58s (justo en el keyframe 0.93 = scale 1.55)
    const pulsingTimer = setTimeout(() => {
      console.log('[PreWarmupIntro] Switching to EXPLOSION phase (durante crecimiento)');
      setPhase('explosion');
    }, 5580);

    // Explosión final: llamar onComplete cuando el último flash llega a blanco total
    const explosionTimer = setTimeout(() => {
      console.log('[PreWarmupIntro] Calling onComplete - transitioning to warmup');
      onCompleteRef.current();
    }, 9300); // 6s (pulsing) + 3.0s (explosion delay) + 0.3s (flash duration) = 9.3s

    return () => {
      clearTimeout(pulsingTimer);
      clearTimeout(explosionTimer);
    };
  }, [logo]);

  if (!logo) {
    return null;
  }

  return (
    <div className="relative w-full h-screen bg-black" style={{ overflow: phase === 'pulsing' ? 'hidden' : 'visible' }}>
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
        {PARTICLE_POSITIONS.map((particle, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-primary/70 rounded-full"
            style={{
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              boxShadow: '0 0 3px rgba(255,255,255,0.5)',
              transform: 'translateZ(0)', // Forzar GPU compositing
            }}
            animate={{
              scale: [0, 1.6, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: particle.delay,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* Logo central con animación */}
      <div className="absolute inset-0 flex items-center justify-center z-10" style={{ overflow: 'visible' }}>
        {phase === 'pulsing' ? (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{
              // Cada par es: valle (baja) → pico (sube)
              // Los valles van subiendo: 0.5 → 0.65 → 0.8 → 0.95 → 1.1 → 1.25
              // Los picos MÁS GRANDES: 0.75 → 0.9 → 1.05 → 1.2 → 1.35 → 1.45
              // Al final (últimos 0.5s): crecimiento continuo 1.45 → 1.55 → 1.7 → 1.85 para transición suave
              scale: [0.5, 0.75, 0.65, 0.9, 0.8, 1.05, 0.95, 1.2, 1.1, 1.35, 1.25, 1.45, 1.55, 1.7, 1.85],
              opacity: 1,
            }}
            transition={{
              scale: {
                duration: 6,
                times: [0, 0.08, 0.17, 0.25, 0.33, 0.42, 0.5, 0.58, 0.67, 0.75, 0.83, 0.88, 0.93, 0.97, 1],
                ease: "easeInOut",
              },
              opacity: {
                duration: 0.5,
                ease: "easeOut",
              },
            }}
            style={{
              willChange: 'transform, opacity',
              overflow: 'visible',
              width: '300px',
              height: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: 'translateZ(0)', // GPU compositing
              backfaceVisibility: 'hidden', // Prevenir flickering
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt="Tournament logo"
              style={{
                width: '300px',
                height: '300px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.5))'
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 1.55 }}
            animate={{
              scale: 15,
              opacity: 0.15,
            }}
            transition={{
              scale: {
                duration: 4.5,
                ease: [0.5, 0, 0.5, 1.2], // Empieza lento, acelera constantemente hasta el final (no desacelera)
              },
              opacity: {
                duration: 3,
                delay: 1,
                ease: "easeIn",
              },
            }}
            style={{
              willChange: 'transform, opacity',
              overflow: 'visible',
              width: '300px',
              height: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: 'translateZ(0)', // GPU compositing
              backfaceVisibility: 'hidden', // Prevenir flickering
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt="Tournament logo"
              style={{
                width: '300px',
                height: '300px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.5))'
              }}
            />
          </motion.div>
        )}
      </div>

      {/* Flashes blancos - tanto en palpitación como en explosión */}
      <>
        {/* Flash 1: En la 2da palpitación (~1 segundo) */}
        {phase === 'pulsing' && (
          <motion.div
            className="absolute inset-0 bg-white z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.4, times: [0, 0.25, 1], ease: "linear", delay: 1.0 }}
            onAnimationStart={() => console.log('[Flash 1] 2da palpitación')}
          />
        )}

        {/* Flash 2 y 3: Justo antes de empezar a crecer indefinidamente (tapan transición) */}
        {phase === 'pulsing' && (
          <>
            <motion.div
              className="absolute inset-0 bg-white z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.35, times: [0, 0.3, 1], ease: "linear", delay: 4.4 }}
              onAnimationStart={() => console.log('[Flash 2] Antes de crecer - primero')}
            />
            <motion.div
              className="absolute inset-0 bg-white z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.3, times: [0, 0.3, 1], ease: "linear", delay: 4.75 }}
              onAnimationStart={() => console.log('[Flash 3] Antes de crecer - segundo (tapa transición)')}
            />
          </>
        )}

        {/* Flash 4: Durante explosión (segundo 6.5) - corto estilo Flash 1 */}
        {phase === 'explosion' && (
          <motion.div
            className="absolute inset-0 bg-white z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.4, times: [0, 0.25, 1], ease: "linear", delay: 1.0 }}
            onAnimationStart={() => console.log('[Flash 4] Durante explosión - segundo 6.5')}
          />
        )}

        {/* Flash 5: FINAL cuando el logo llega a pantalla completa - SE QUEDA EN BLANCO */}
        {phase === 'explosion' && (
          <motion.div
            className="absolute inset-0 bg-white z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: "easeIn", delay: 3.5 }}
            onAnimationStart={() => console.log('[Flash 5 FINAL] Logo a pantalla completa - QUEDA EN BLANCO')}
          />
        )}
      </>
    </div>
  );
}
