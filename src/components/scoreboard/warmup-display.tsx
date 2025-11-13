"use client";

import { useGameState } from '@/contexts/game-state-context';
import Image from 'next/image';
import { ClockDisplay } from './clock-display';
import { motion } from 'framer-motion';

interface WarmupDisplayProps {
  homeLogoDataUrl?: string | null;
  awayLogoDataUrl?: string | null;
  clockPosition?: 'center' | 'top';
  showClock?: boolean;
  children?: React.ReactNode;
}

export function WarmupDisplay({
  homeLogoDataUrl,
  awayLogoDataUrl,
  clockPosition = 'center',
  showClock = true,
  children
}: WarmupDisplayProps) {
  const { state } = useGameState();

  if (!state.config || !state.live) {
    return null;
  }

  const { scoreboardLayout } = state.config;

  return (
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      {/* Animated lightning bolts diagonal effect - CENTERED DIAGONAL */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ zIndex: 1 }}
      >
        <defs>
          {/* Ice-white glowing gradient for the line */}
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.6)" stopOpacity="0.6" />
            <stop offset="50%" stopColor="rgba(200, 230, 255, 0.9)" stopOpacity="1" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.6)" stopOpacity="0.6" />
          </linearGradient>

          {/* Animated glow filter */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Aggressive zigzag lightning bolt line - SYMMETRIC THROUGH CENTER */}
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

        {/* Second lightning bolt - offset timing - SYMMETRIC THROUGH CENTER */}
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

      {/* Home logo - LEFT SIDE, HIGHER UP - BIGGER SIZE */}
      {homeLogoDataUrl && (
        <div className="absolute left-[18%] top-[20%] -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] z-10">
          {/* Pulsing glow background - REDUCED INTENSITY */}
          <motion.div
            className="absolute inset-0 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, hsl(var(--accent) / 0.35) 0%, transparent 70%)' }}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
          />

          {/* Logo with subtle float animation */}
          <motion.div
            className="relative w-full h-full"
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Image
              src={homeLogoDataUrl}
              alt="Home team logo"
              fill
              style={{
                objectFit: "contain",
                filter: "drop-shadow(0 0 20px hsl(var(--accent) / 0.5))"
              }}
              sizes="50vw"
              priority
            />
          </motion.div>
        </div>
      )}

      {/* Away logo - RIGHT SIDE, LOWER DOWN - BIGGER SIZE */}
      {awayLogoDataUrl && (
        <div className="absolute right-[18%] bottom-[15%] translate-x-1/2 translate-y-1/2 w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] z-10">
          {/* Pulsing glow background - REDUCED INTENSITY - offset timing */}
          <motion.div
            className="absolute inset-0 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, hsl(var(--accent) / 0.35) 0%, transparent 70%)' }}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
          />

          {/* Logo with subtle float animation - offset */}
          <motion.div
            className="relative w-full h-full"
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1.5
            }}
          >
            <Image
              src={awayLogoDataUrl}
              alt="Away team logo"
              fill
              style={{
                objectFit: "contain",
                filter: "drop-shadow(0 0 20px hsl(var(--accent) / 0.5))"
              }}
              sizes="50vw"
              priority
            />
          </motion.div>
        </div>
      )}

      {/* Warmup clock - Position depends on prop */}
      {showClock && (
        <div className={clockPosition === 'top'
          ? "absolute left-1/2 top-8 -translate-x-1/2 z-20"
          : "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
        }>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <ClockDisplay />
          </motion.div>
        </div>
      )}

      {/* Animated particles/stars effect */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-primary/60 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              scale: [0, 1, 0],
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

      {/* Children content - centered with high z-index */}
      {children && (
        <div className="absolute inset-0 flex items-center justify-center px-4 sm:px-8 md:px-12 lg:px-16" style={{ paddingTop: clockPosition === 'top' ? '8rem' : '0', zIndex: 30 }}>
          <div className="w-full max-w-6xl" style={{ maxHeight: '80vh' }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
