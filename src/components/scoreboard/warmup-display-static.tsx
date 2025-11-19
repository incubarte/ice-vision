"use client";

import { useGameState } from '@/contexts/game-state-context';
import Image from 'next/image';
import { ClockDisplay } from './clock-display';
import { TournamentLogo } from '../tournaments/tournament-logo';

interface WarmupDisplayStaticProps {
  homeLogoDataUrl?: string | null;
  awayLogoDataUrl?: string | null;
  clockPosition?: 'center' | 'top';
  showClock?: boolean;
  children?: React.ReactNode;
  tournamentLogoId?: string | null;
}

/**
 * Static version of WarmupDisplay without animations
 * Used during Olympia transition to reduce performance impact
 */
export function WarmupDisplayStatic({
  homeLogoDataUrl,
  awayLogoDataUrl,
  clockPosition = 'center',
  showClock = true,
  children,
  tournamentLogoId
}: WarmupDisplayStaticProps) {
  const { state } = useGameState();

  if (!state.config || !state.live) {
    return null;
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      {/* Static lightning bolts diagonal effect */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ zIndex: 1 }}
      >
        <defs>
          <linearGradient id="lineGradientStatic" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.6)" stopOpacity="0.6" />
            <stop offset="50%" stopColor="rgba(200, 230, 255, 0.9)" stopOpacity="1" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.6)" stopOpacity="0.6" />
          </linearGradient>

          <filter id="glowStatic">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Static lightning bolt lines - no animation */}
        <path
          d="M 0,100 L 8,92 L 4,84 L 12,76 L 8,68 L 18,58 L 25,65 L 32,58 L 38,64 L 44,56 L 50,50 L 56,44 L 62,50 L 68,42 L 75,49 L 82,42 L 88,32 L 92,24 L 96,16 L 100,0"
          fill="none"
          stroke="url(#lineGradientStatic)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          filter="url(#glowStatic)"
          opacity="0.8"
        />

        <path
          d="M 0,98 L 6,90 L 3,82 L 10,74 L 6,66 L 16,56 L 23,63 L 30,56 L 36,62 L 42,54 L 50,50 L 58,46 L 64,52 L 70,44 L 77,51 L 84,44 L 90,34 L 94,26 L 97,18 L 100,2"
          fill="none"
          stroke="url(#lineGradientStatic)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          filter="url(#glowStatic)"
          opacity="0.5"
        />
      </svg>

      {/* Home logo - LEFT SIDE - STATIC */}
      {homeLogoDataUrl && (
        <div className="absolute left-[18%] top-[28%] -translate-x-1/2 -translate-y-1/2 w-[42.5vw] h-[42.5vw] max-w-[510px] max-h-[510px] z-10">
          {/* Static glow background */}
          <div
            className="absolute inset-0 rounded-full blur-3xl"
            style={{
              background: 'radial-gradient(circle, hsl(var(--accent) / 0.35) 0%, transparent 70%)',
              opacity: 0.4
            }}
          />

          {/* Logo - no animation */}
          <div className="relative w-full h-full">
            <Image
              src={homeLogoDataUrl}
              alt="Home team logo"
              fill
              style={{
                objectFit: "contain",
                filter: "drop-shadow(0 0 20px hsl(var(--accent) / 0.5))"
              }}
              sizes="42.5vw"
              priority
            />
          </div>
        </div>
      )}

      {/* Away logo - RIGHT SIDE - STATIC */}
      {awayLogoDataUrl && (
        <div className="absolute right-[18%] bottom-[28%] translate-x-1/2 translate-y-1/2 w-[42.5vw] h-[42.5vw] max-w-[510px] max-h-[510px] z-10">
          {/* Static glow background */}
          <div
            className="absolute inset-0 rounded-full blur-3xl"
            style={{
              background: 'radial-gradient(circle, hsl(var(--accent) / 0.35) 0%, transparent 70%)',
              opacity: 0.4
            }}
          />

          {/* Logo - no animation */}
          <div className="relative w-full h-full">
            <Image
              src={awayLogoDataUrl}
              alt="Away team logo"
              fill
              style={{
                objectFit: "contain",
                filter: "drop-shadow(0 0 20px hsl(var(--accent) / 0.5))"
              }}
              sizes="42.5vw"
              priority
            />
          </div>
        </div>
      )}

      {/* Tournament Logo - Behind the clock */}
      {tournamentLogoId && (
        <div className={clockPosition === 'top'
          ? "absolute left-1/2 top-8 -translate-x-1/2 z-15 opacity-15 pointer-events-none"
          : "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-15 opacity-15 pointer-events-none"
        }>
          <TournamentLogo tournamentId={tournamentLogoId} size={1200} showFallback={false} />
        </div>
      )}

      {/* Warmup clock - Static */}
      {showClock && (
        <div className={clockPosition === 'top'
          ? "absolute left-1/2 top-8 -translate-x-1/2 z-20"
          : "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
        }>
          <ClockDisplay />
        </div>
      )}

      {/* Static particles/stars - visible but not animating */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary/60 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.6 + 0.2
            }}
          />
        ))}
      </div>

      {/* Children content */}
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
