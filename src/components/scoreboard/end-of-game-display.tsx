"use client";

import { useState, useEffect } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles } from 'lucide-react';
import { StandingsDisplayWithChanges } from './standings-display-with-changes';

interface EndOfGameDisplayProps {
  homeLogoDataUrl?: string | null;
  awayLogoDataUrl?: string | null;
}

export function EndOfGameDisplay({
  homeLogoDataUrl,
  awayLogoDataUrl,
}: EndOfGameDisplayProps) {
  const { state } = useGameState();
  const [showStandings, setShowStandings] = useState(false);

  if (!state.config || !state.live) {
    return null;
  }

  const { score, homeTeamName, awayTeamName } = state.live;
  const homeScore = score.home;
  const awayScore = score.away;

  const isDraw = homeScore === awayScore;
  const homeWon = homeScore > awayScore;
  const awayWon = awayScore > homeScore;

  const winnerTeamName = homeWon ? homeTeamName : awayTeamName;
  const winnerLogoDataUrl = homeWon ? homeLogoDataUrl : awayLogoDataUrl;

  // Alternate standings: hide 10s, show 15s, hide 10s, show 15s...
  useEffect(() => {
    let currentTimer: NodeJS.Timeout;

    const scheduleToggle = (show: boolean, delay: number) => {
      currentTimer = setTimeout(() => {
        setShowStandings(show);
        // Schedule next toggle
        if (show) {
          // Currently showing, hide after 15s
          scheduleToggle(false, 15000);
        } else {
          // Currently hiding, show after 10s
          scheduleToggle(true, 10000);
        }
      }, delay);
    };

    // Start: hide for 10s, then show
    scheduleToggle(true, 10000);

    return () => {
      clearTimeout(currentTimer);
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-background via-slate-900 to-background">
      {/* Animated background effects */}
      <div className="absolute inset-0 z-0">
        {/* Radial gradient pulses */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: isDraw
              ? 'radial-gradient(circle at 30% 40%, hsl(var(--accent) / 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 60%, hsl(var(--accent) / 0.15) 0%, transparent 50%)'
              : 'radial-gradient(circle at 50% 50%, hsl(var(--accent) / 0.2) 0%, transparent 60%)'
          }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Animated lightning bolts/rays - multiple directions */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ zIndex: 1 }}
        >
          <defs>
            <linearGradient id="victoryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 215, 0, 0.6)" stopOpacity="0.6" />
              <stop offset="50%" stopColor="rgba(255, 255, 255, 0.9)" stopOpacity="1" />
              <stop offset="100%" stopColor="rgba(255, 215, 0, 0.6)" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="drawGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(200, 230, 255, 0.6)" stopOpacity="0.6" />
              <stop offset="50%" stopColor="rgba(255, 255, 255, 0.8)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="rgba(200, 230, 255, 0.6)" stopOpacity="0.6" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Multiple animated lightning paths */}
          {!isDraw && (
            <>
              <motion.path
                d="M 50,0 L 52,15 L 48,20 L 54,35 L 50,50 L 60,65 L 55,80 L 65,100"
                fill="none"
                stroke="url(#victoryGradient)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                filter="url(#glow)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: [0, 1, 1, 0],
                  opacity: [0, 1, 1, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 0.5,
                  ease: "easeInOut"
                }}
              />
              <motion.path
                d="M 0,50 L 15,48 L 20,52 L 35,46 L 50,50 L 65,40 L 80,45 L 100,35"
                fill="none"
                stroke="url(#victoryGradient)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                filter="url(#glow)"
                opacity="0.7"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: [0, 1, 1, 0],
                  opacity: [0, 0.7, 0.7, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 0.5,
                  delay: 0.4,
                  ease: "easeInOut"
                }}
              />
            </>
          )}
        </svg>

        {/* Fireworks/sparkles particles */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(isDraw ? 15 : 30)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: isDraw ? '3px' : '4px',
                height: isDraw ? '3px' : '4px',
                background: isDraw
                  ? 'radial-gradient(circle, rgba(200, 230, 255, 1) 0%, rgba(255, 255, 255, 0.8) 50%, transparent 100%)'
                  : 'radial-gradient(circle, rgba(255, 215, 0, 1) 0%, rgba(255, 255, 255, 0.9) 50%, transparent 100%)',
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                boxShadow: isDraw
                  ? '0 0 10px rgba(200, 230, 255, 0.8)'
                  : '0 0 15px rgba(255, 215, 0, 0.9)'
              }}
              animate={{
                scale: [0, 1.5, 0],
                opacity: [0, 1, 0],
                y: [0, -50, -100],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 3,
                ease: "easeOut"
              }}
            />
          ))}
        </div>
      </div>

      {/* DRAW LAYOUT - Both logos side by side */}
      {isDraw && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          {/* EMPATE Title */}
          <motion.div
            className="mb-12"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
          >
            <h1 className="text-9xl font-bold font-headline text-white tracking-wider" style={{ textShadow: '0 0 40px rgba(200, 230, 255, 0.8), 0 0 80px rgba(200, 230, 255, 0.5)' }}>
              EMPATE
            </h1>
          </motion.div>

          {/* Both logos */}
          <div className="flex items-center gap-20">
            {/* Home Logo */}
            {homeLogoDataUrl && (
              <motion.div
                className="relative w-[25vw] h-[25vw] max-w-[350px] max-h-[350px]"
                initial={{ opacity: 0, x: -100 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 1, delay: 0.5 }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full blur-3xl"
                  style={{ background: 'radial-gradient(circle, hsl(var(--accent) / 0.4) 0%, transparent 70%)' }}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.4, 0.6, 0.4]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                <motion.div
                  className="relative w-full h-full"
                  animate={{
                    y: [0, -15, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Image
                    src={homeLogoDataUrl}
                    alt={homeTeamName || "Home team"}
                    fill
                    style={{
                      objectFit: "contain",
                      filter: "drop-shadow(0 0 25px hsl(var(--accent) / 0.6))"
                    }}
                    sizes="25vw"
                    priority
                  />
                </motion.div>
              </motion.div>
            )}

            {/* Away Logo */}
            {awayLogoDataUrl && (
              <motion.div
                className="relative w-[25vw] h-[25vw] max-w-[350px] max-h-[350px]"
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 1, delay: 0.5 }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full blur-3xl"
                  style={{ background: 'radial-gradient(circle, hsl(var(--accent) / 0.4) 0%, transparent 70%)' }}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.4, 0.6, 0.4]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1
                  }}
                />
                <motion.div
                  className="relative w-full h-full"
                  animate={{
                    y: [0, -15, 0],
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
                    alt={awayTeamName || "Away team"}
                    fill
                    style={{
                      objectFit: "contain",
                      filter: "drop-shadow(0 0 25px hsl(var(--accent) / 0.6))"
                    }}
                    sizes="25vw"
                    priority
                  />
                </motion.div>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* WINNER LAYOUT - Large winner logo centered */}
      {!isDraw && winnerLogoDataUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          {/* GANADOR Title with Trophy */}
          <motion.div
            className="flex items-center gap-6 mb-8"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, type: "spring", bounce: 0.4 }}
          >
            <motion.div
              animate={{
                rotate: [0, 10, -10, 10, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3,
              }}
            >
              <Trophy className="w-24 h-24 text-amber-400" style={{ filter: 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.8))' }} />
            </motion.div>
            <h1 className="text-9xl font-bold font-headline text-amber-400 tracking-wider" style={{ textShadow: '0 0 40px rgba(255, 215, 0, 0.8), 0 0 80px rgba(255, 215, 0, 0.5), 0 4px 6px rgba(0, 0, 0, 0.6)' }}>
              GANADOR
            </h1>
            <motion.div
              animate={{
                rotate: [0, -10, 10, -10, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3,
              }}
            >
              <Trophy className="w-24 h-24 text-amber-400" style={{ filter: 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.8))' }} />
            </motion.div>
          </motion.div>

          {/* Winner Logo - HUGE */}
          <motion.div
            className="relative w-[55vw] h-[55vw] max-w-[700px] max-h-[700px]"
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.4, type: "spring", bounce: 0.3 }}
          >
            {/* Golden glow effect */}
            <motion.div
              className="absolute inset-0 rounded-full blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(255, 215, 0, 0.5) 0%, rgba(255, 215, 0, 0.3) 40%, transparent 70%)' }}
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.5, 0.8, 0.5]
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />

            {/* Rotating sparkle ring */}
            <motion.div
              className="absolute inset-0"
              animate={{
                rotate: 360
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              {[...Array(12)].map((_, i) => {
                const angle = (i * 30) * (Math.PI / 180);
                const radius = 45; // percentage
                const x = 50 + radius * Math.cos(angle);
                const y = 50 + radius * Math.sin(angle);
                return (
                  <motion.div
                    key={i}
                    className="absolute"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.6, 1, 0.6]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.1,
                      ease: "easeInOut"
                    }}
                  >
                    <Sparkles className="w-8 h-8 text-amber-300" style={{ filter: 'drop-shadow(0 0 8px rgba(255, 215, 0, 1))' }} />
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Logo with float animation */}
            <motion.div
              className="relative w-full h-full z-10"
              animate={{
                y: [0, -20, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Image
                src={winnerLogoDataUrl}
                alt={winnerTeamName || "Winner"}
                fill
                style={{
                  objectFit: "contain",
                  filter: "drop-shadow(0 0 40px rgba(255, 215, 0, 0.7)) drop-shadow(0 4px 20px rgba(0, 0, 0, 0.5))"
                }}
                sizes="55vw"
                priority
              />
            </motion.div>
          </motion.div>

          {/* Winner team name */}
          <motion.div
            className="mt-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            <h2 className="text-7xl font-bold font-headline text-white tracking-wide text-center" style={{ textShadow: '0 0 30px rgba(255, 215, 0, 0.6), 0 4px 10px rgba(0, 0, 0, 0.7)' }}>
              {winnerTeamName}
            </h2>
          </motion.div>
        </div>
      )}

      {/* Score display - bottom right corner */}
      <motion.div
        className="absolute bottom-8 right-8 z-20 bg-background/80 backdrop-blur-md rounded-2xl px-8 py-6 shadow-2xl border border-primary/30"
        style={{ transform: 'scale(0.95)' }}
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 1 }}
      >
        <div className="flex items-center gap-6">
          {/* Home team */}
          <div className="flex flex-col items-center gap-2">
            {homeLogoDataUrl && (
              <div className="relative w-16 h-16">
                <Image
                  src={homeLogoDataUrl}
                  alt={homeTeamName || "Home"}
                  fill
                  style={{ objectFit: "contain" }}
                  sizes="64px"
                />
              </div>
            )}
            <span className="text-sm font-semibold text-primary-foreground max-w-[120px] text-center truncate">
              {homeTeamName}
            </span>
          </div>

          {/* Score */}
          <div className="flex items-center gap-4">
            <span className={`text-5xl font-bold font-headline tabular-nums ${homeWon ? 'text-amber-400' : 'text-primary-foreground'}`}>
              {homeScore}
            </span>
            <span className="text-3xl font-bold text-muted-foreground">-</span>
            <span className={`text-5xl font-bold font-headline tabular-nums ${awayWon ? 'text-amber-400' : 'text-primary-foreground'}`}>
              {awayScore}
            </span>
          </div>

          {/* Away team */}
          <div className="flex flex-col items-center gap-2">
            {awayLogoDataUrl && (
              <div className="relative w-16 h-16">
                <Image
                  src={awayLogoDataUrl}
                  alt={awayTeamName || "Away"}
                  fill
                  style={{ objectFit: "contain" }}
                  sizes="64px"
                />
              </div>
            )}
            <span className="text-sm font-semibold text-primary-foreground max-w-[120px] text-center truncate">
              {awayTeamName}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Standings overlay - alternates every 10 seconds */}
      <AnimatePresence>
        {showStandings && (
          <motion.div
            className="absolute inset-0 z-30 flex items-center justify-center px-4 sm:px-8 md:px-12 lg:px-16 py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              className="w-full max-w-7xl"
              style={{ maxHeight: '85vh' }}
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              transition={{ duration: 0.6, delay: 0.2, type: "spring", bounce: 0.3 }}
            >
              <StandingsDisplayWithChanges />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
