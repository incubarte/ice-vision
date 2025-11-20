"use client";

import { useEffect, useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface PreWarmupIntroProps {
  logo: string | null;
  onComplete: () => void;
  mode?: 'loop' | 'explosion'; // 'loop' para Pre Warm-up infinito, 'explosion' para transición a Warm-up
}

// Generar posiciones de partículas una sola vez (fuera del componente)
const PARTICLE_POSITIONS = Array.from({ length: 30 }, () => {
  const rand = Math.random();
  let colorType: 'whiter' | 'medium' | 'normal';

  if (rand < 0.6) {
    colorType = 'whiter'; // 60%
  } else if (rand < 0.8) {
    colorType = 'medium'; // 20%
  } else {
    colorType = 'normal'; // 20%
  }

  return {
    left: Math.random() * 100,
    top: Math.random() * 100,
    duration: 2.1 + Math.random() * 2,
    delay: Math.random() * 2,
    colorType,
  };
});

export function PreWarmupIntro({ logo, onComplete, mode = 'explosion' }: PreWarmupIntroProps) {
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

    // Modo 'loop': Solo palpitación infinita, nunca llama onComplete ni cambia a explosion
    if (mode === 'loop') {
      console.log('[PreWarmupIntro] LOOP MODE - Infinite pulsing');
      return; // No hay timers, solo queda en fase 'pulsing' indefinidamente
    }

    // Modo 'explosion': Animación completa con transición
    console.log('[PreWarmupIntro] EXPLOSION MODE - Starting animation');

    // Fase de heartbeat + crecimiento exponencial: cambiar a explosión a los 3.5s
    const pulsingTimer = setTimeout(() => {
      console.log('[PreWarmupIntro] Switching to EXPLOSION phase (exponential growth completed)');
      setPhase('explosion');
    }, 3500);

    // Explosión final: llamar onComplete cuando el último flash llega a blanco total
    const explosionTimer = setTimeout(() => {
      console.log('[PreWarmupIntro] Calling onComplete - transitioning to warmup');
      onCompleteRef.current();
    }, 6300); // 3.5s (heartbeat + crecimiento) + 2.5s (explosion) + 0.3s (flash duration) = 6.3s

    return () => {
      clearTimeout(pulsingTimer);
      clearTimeout(explosionTimer);
    };
  }, [logo, mode]);

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
        {PARTICLE_POSITIONS.map((particle, i) => {
          // Definir estilos según el tipo de color
          const getParticleStyles = () => {
            switch (particle.colorType) {
              case 'whiter':
                return {
                  backgroundColor: 'rgba(240, 248, 255, 0.85)', // Blanco-azulado más brillante
                  boxShadow: '0 0 4px rgba(255,255,255,0.7)',
                };
              case 'medium':
                return {
                  backgroundColor: 'rgba(200, 220, 240, 0.78)', // Color intermedio
                  boxShadow: '0 0 3.5px rgba(255,255,255,0.6)',
                };
              case 'normal':
              default:
                return {
                  backgroundColor: undefined, // Usa bg-primary/70 del className
                  boxShadow: '0 0 3px rgba(255,255,255,0.5)',
                };
            }
          };

          const styles = getParticleStyles();

          return (
            <motion.div
              key={i}
              className={particle.colorType === 'normal' ? "absolute w-1 h-1 bg-primary/70 rounded-full" : "absolute w-1 h-1 rounded-full"}
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                backgroundColor: styles.backgroundColor,
                boxShadow: styles.boxShadow,
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
          );
        })}
      </div>

      {/* Logo central con animación */}
      <div className="absolute inset-0 flex items-center justify-center z-10" style={{ overflow: 'visible' }}>
        {phase === 'pulsing' ? (
          <motion.div
            initial={{ scale: 1.0, opacity: 0, x: 0, y: 0 }}
            animate={{
              // Ritmo de corazón mejorado: normal → achica → rebota (crece) → achica de nuevo → vuelve → pausa
              // Cada ciclo: 1.0 → 0.85 → 0.91 → 0.87 → 1.0 → (pausa)
              scale: mode === 'loop'
                ? [1.0, 0.85, 0.91, 0.87, 1.0, 1.0] // Loop mode: ritmo constante con doble rebote
                : [
                    // Fase 1: Vibración + crecimiento leve (0-20%)
                    1.0, 1.05, 1.08, 1.1, 1.12, 1.15,
                    // Fase 2: Continúa vibrando y creciendo (20-35%)
                    1.18, 1.22, 1.25,
                    // Fase 3: Crecimiento continuo sin vibración (35-100%)
                    1.3, 1.5, 1.8, 2.2, 2.8, 3.5, 4.5
                  ],
              opacity: 1,
              // Vibración solo al principio - luego sin vibración
              x: mode === 'explosion'
                ? [-2, 2, -2, 2, -2, 2,  // Fase 1: Vibración con crecimiento leve
                   -3, 3, -3,  // Fase 2: Sigue vibrando (~0.5s)
                   0, 0, 0, 0, 0, 0, 0]  // Fase 3: Sin vibración - crecimiento continuo
                : 0,
              y: mode === 'explosion'
                ? [2, -2, 2, -2, 2, -2,  // Fase 1: Vibración con crecimiento leve
                   3, -3, 3,  // Fase 2: Sigue vibrando (~0.5s)
                   0, 0, 0, 0, 0, 0, 0]  // Fase 3: Sin vibración - crecimiento continuo
                : 0,
            }}
            transition={{
              scale: {
                duration: mode === 'loop' ? 1.4 : 3.5, // 3.5s total para explosion
                times: mode === 'loop'
                  ? [0, 0.15, 0.22, 0.28, 0.35, 1] // Doble rebote + pausa
                  : [
                      // Fase 1: Vibración + crecimiento leve (0-20%)
                      0, 0.03, 0.06, 0.09, 0.12, 0.15,
                      // Fase 2: Continúa vibrando y creciendo (20-35%) - SIN GAPS
                      0.18, 0.25, 0.33,
                      // Fase 3: Crecimiento continuo sin vibración (35-100%) - SIN GAPS
                      0.42, 0.54, 0.66, 0.76, 0.86, 0.94, 1
                    ],
                ease: mode === 'loop' ? "easeInOut" : [0.05, 0, 0.95, 1], // ease-in ultra agresivo (exponencial)
                repeat: mode === 'loop' ? Infinity : 0,
              },
              x: {
                duration: mode === 'explosion' ? 3.5 : 0,
                times: mode === 'explosion'
                  ? [// Fase 1: Vibración con crecimiento leve (0-20%)
                     0, 0.03, 0.06, 0.09, 0.12, 0.15,
                     // Fase 2: Sigue vibrando (20-35%) - SIN GAPS
                     0.18, 0.25, 0.33,
                     // Fase 3: Sin vibración (35-100%) - SIN GAPS
                     0.42, 0.54, 0.66, 0.76, 0.86, 0.94, 1]
                  : [0, 1],
                ease: "linear",
              },
              y: {
                duration: mode === 'explosion' ? 3.5 : 0,
                times: mode === 'explosion'
                  ? [// Fase 1: Vibración con crecimiento leve (0-20%)
                     0, 0.03, 0.06, 0.09, 0.12, 0.15,
                     // Fase 2: Sigue vibrando (20-35%) - SIN GAPS
                     0.18, 0.25, 0.33,
                     // Fase 3: Sin vibración (35-100%) - SIN GAPS
                     0.42, 0.54, 0.66, 0.76, 0.86, 0.94, 1]
                  : [0, 1],
                ease: "linear",
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
            initial={{ scale: 4.5 }}
            animate={{
              scale: 15,
              opacity: 0.15,
            }}
            transition={{
              scale: {
                duration: 2.5,
                ease: [0.5, 0, 0.5, 1.2], // Empieza lento, acelera constantemente hasta el final (no desacelera)
              },
              opacity: {
                duration: 2,
                delay: 0.3,
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

      {/* Flashes blancos - EN TODO MOMENTO */}
      <>
        {/* Flashes durante modo LOOP (Pre Warm-up infinito) - alternando 1 flash y 2 flashes */}
        {phase === 'pulsing' && mode === 'loop' && (
          <>
            {/* Secuencia: 1 flash → pausa → 2 flashes seguidos → pausa → repetir */}
            {/* Flash individual cada 5.6s (ciclo completo) */}
            <motion.div
              className="absolute inset-0 bg-white z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0, 0, 0.9, 0, 0, 0, 0, 0] }}
              transition={{
                duration: 5.6,
                times: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.5, 0.75, 1],
                ease: "linear",
                repeat: Infinity,
              }}
            />
            {/* Doble flash seguido - offset para que aparezca después del flash individual */}
            <motion.div
              className="absolute inset-0 bg-white z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0, 0, 0, 0, 0.9, 0, 0.9, 0] }}
              transition={{
                duration: 5.6,
                times: [0, 0.3, 0.4, 0.5, 0.55, 0.60, 0.65, 0.70, 0.75],
                ease: "linear",
                repeat: Infinity,
              }}
            />
          </>
        )}

        {/* 2 Flashes seguidos después de la vibración (~1.15s = 33% de 3.5s) - SOLO en explosion mode */}
        {phase === 'pulsing' && mode === 'explosion' && (
          <>
            <motion.div
              className="absolute inset-0 bg-white z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.08, times: [0, 0.5, 1], ease: "linear", delay: 1.15 }}
              onAnimationStart={() => console.log('[Flash 1] Primer flash después de vibración')}
            />
            <motion.div
              className="absolute inset-0 bg-white z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 0.0035, times: [0, 0.5, 1], ease: "linear", delay: 1.20 }}
              onAnimationStart={() => console.log('[Flash 2] Segundo flash después de vibración - más corto y pegado')}
            />
          </>
        )}

        {/* Flash 4: Mitad de la explosión */}
        {phase === 'explosion' && (
          <motion.div
            className="absolute inset-0 bg-white z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.4, times: [0, 0.25, 1], ease: "linear", delay: 1.2 }}
            onAnimationStart={() => console.log('[Flash 4] Mitad de explosión')}
          />
        )}

        {/* Flash 5: FINAL cuando el logo llega a pantalla completa - SE QUEDA EN BLANCO */}
        {phase === 'explosion' && (
          <motion.div
            className="absolute inset-0 bg-white z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: "easeIn", delay: 2.0 }}
            onAnimationStart={() => console.log('[Flash 5 FINAL] Logo a pantalla completa - QUEDA EN BLANCO')}
          />
        )}
      </>
    </div>
  );
}
