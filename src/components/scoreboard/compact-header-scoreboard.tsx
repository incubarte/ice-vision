"use client";

import { useGameState } from '@/contexts/game-state-context';
import { User } from 'lucide-react';
import { TournamentLogo } from '../tournaments/tournament-logo';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import Image from 'next/image';
import { cn, getTeamDisplayName } from '@/lib/utils';
import { motion } from 'framer-motion';

export function useTeamLogos() {
  const { state } = useGameState();
  if (!state.config || !state.live) return { homeLogoDataUrl: null, awayLogoDataUrl: null };
  const matchContext = state.live.matchContext;
  return {
    homeLogoDataUrl: matchContext?.homeTeamLogoDataUrl || null,
    awayLogoDataUrl: matchContext?.awayTeamLogoDataUrl || null,
  };
}

function ScoreDigit({ score, sizeRem }: { score: number; sizeRem: number }) {
  const [flash, setFlash] = useState(false);
  const [prevScore, setPrevScore] = useState(score);

  useEffect(() => {
    if (score !== prevScore) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      setPrevScore(score);
      return () => clearTimeout(t);
    }
  }, [score, prevScore]);

  return (
    <span
      className={cn(
        "font-bold font-headline tabular-nums tracking-tighter text-white leading-none",
        flash && "animate-score-flash"
      )}
      style={{ fontSize: `${sizeRem}rem` }}
    >
      {score}
    </span>
  );
}

function ScrollingTeamName({ name, sizeRem }: { name: string; sizeRem: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [calculatedOffset, setCalculatedOffset] = useState(0);

  useLayoutEffect(() => {
    const check = () => {
      if (containerRef.current && textRef.current) {
        const overflow = textRef.current.scrollWidth > containerRef.current.clientWidth;
        setIsOverflowing(overflow);
        setCalculatedOffset(
          overflow ? textRef.current.scrollWidth - containerRef.current.clientWidth : 0
        );
      }
    };
    check();
    const observer = new ResizeObserver(check);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [name]);

  const animationDuration = 3;
  const initialPause = 10;
  const endPause = 5;
  const totalCycleDuration = initialPause + animationDuration + endPause + animationDuration;

  return (
    <div
      ref={containerRef}
      className={cn("w-full overflow-hidden", !isOverflowing && "text-center")}
      style={{ fontSize: `${sizeRem}rem`, height: '1.2em' }}
    >
      <motion.span
        ref={textRef}
        className="font-bold uppercase whitespace-nowrap"
        style={{ display: 'inline-block' }}
        animate={isOverflowing ? { x: [0, 0, -calculatedOffset, -calculatedOffset, 0] } : { x: 0 }}
        transition={isOverflowing ? {
          duration: totalCycleDuration,
          repeat: Infinity,
          repeatType: "loop",
          ease: "easeInOut",
          times: [
            0,
            initialPause / totalCycleDuration,
            (initialPause + animationDuration) / totalCycleDuration,
            (initialPause + animationDuration + endPause) / totalCycleDuration,
            1,
          ],
        } : {}}
      >
        {name}
      </motion.span>
    </div>
  );
}

export function CompactHeaderScoreboard() {
  const { state } = useGameState();
  if (!state.config || !state.live) return null;

  const { config, live } = state;
  const { scoreboardLayout, playersPerTeamOnIce } = config;
  const { penalties, homeTeamName, awayTeamName, homeTeamSubName, awayTeamSubName, matchContext, shotsLog } = live;

  const activeHomePenaltiesCount = penalties.home.filter(
    p => p._status === 'running' && p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride
  ).length;
  const playersOnIceForHome = Math.max(0, playersPerTeamOnIce - activeHomePenaltiesCount);

  const activeAwayPenaltiesCount = penalties.away.filter(
    p => p._status === 'running' && p.reducesPlayerCount && !p._doesNotReducePlayerCountOverride
  ).length;
  const playersOnIceForAway = Math.max(0, playersPerTeamOnIce - activeAwayPenaltiesCount);

  const homeLogoDataUrl = matchContext?.homeTeamLogoDataUrl || null;
  const awayLogoDataUrl = matchContext?.awayTeamLogoDataUrl || null;

  const scoreSize = scoreboardLayout.scoreSize;
  const logoSize = `${scoreboardLayout.teamLogoSize ?? scoreSize * 1.2}rem`;
  const iconSize = scoreboardLayout.playersOnIceIconSize;
  const showShots = scoreboardLayout.showShotsInHeader ?? false;
  const shotsFontSize = scoreboardLayout.shotsInHeaderSize ?? 3.5;
  const shotsTitleSize = scoreboardLayout.shotsTitleSize ?? 1.0;
  const shotsTitleColor = scoreboardLayout.shotsTitleColor ?? '220 15% 60%';
  const shotsGap = scoreboardLayout.shotsGap ?? 0.25;
  const colWidth = `${scoreboardLayout.scoreColumnWidth ?? 38}%`;
  const homeShotsCount = shotsLog.home.length;
  const awayShotsCount = shotsLog.away.length;

  const PlayersRow = ({ count, align = 'left' }: { count: number; align?: 'left' | 'right' }) => (
    <div className={cn("flex gap-0.5 mt-0.5", align === 'right' && "justify-end")}>
      {count > 0
        ? Array(count).fill(null).map((_, i) => (
            <User key={i} className="text-primary-foreground/70" style={{ height: `${iconSize}rem`, width: `${iconSize}rem` }} />
          ))
        : playersPerTeamOnIce > 0 && (
            <span className="text-destructive animate-pulse text-xs">0 JUG.</span>
          )
      }
    </div>
  );

  const TeamStack = ({ name, logoUrl, playersCount, align = 'left' }: {
    name: string;
    logoUrl: string | null;
    playersCount: number;
    align?: 'left' | 'right';
  }) => (
    <div className="flex flex-col items-center gap-0.5 shrink-0" style={{ width: `${scoreboardLayout.teamNameWidth}rem` }}>
      {logoUrl ? (
        <div className="relative" style={{ width: logoSize, height: logoSize }}>
          <Image src={logoUrl} alt={name} fill style={{ objectFit: 'contain' }} sizes="10vw" priority />
        </div>
      ) : (
        <div style={{ width: logoSize, height: logoSize }} />
      )}
      <ScrollingTeamName name={name} sizeRem={scoreboardLayout.teamNameSize} />
      <PlayersRow count={playersCount} align={align} />
    </div>
  );

  const ShotsBadge = ({ count }: { count: number }) => (
    <div
      className="flex flex-col items-center shrink-0 border border-white/25 rounded px-2 py-1"
      style={{ gap: `${shotsGap}rem` }}
    >
      <span
        className="font-medium leading-none uppercase tracking-wide"
        style={{ fontSize: `${shotsTitleSize}rem`, color: `hsl(${shotsTitleColor})` }}
      >
        Tiros
      </span>
      <span
        className="font-bold tabular-nums text-white leading-none"
        style={{ fontSize: `${shotsFontSize}rem` }}
      >
        {count}
      </span>
    </div>
  );

  return (
    <div className="relative py-3 md:py-4 px-4">
      <div className="flex justify-between items-center">

        {/* HOME */}
        <div className="flex justify-center items-center gap-3" style={{ width: colWidth }}>
          <TeamStack
            name={getTeamDisplayName(homeTeamName, homeTeamSubName)}
            logoUrl={homeLogoDataUrl}
            playersCount={playersOnIceForHome}
            align="left"
          />
          {showShots && <ShotsBadge count={homeShotsCount} />}
        </div>

        {/* CENTER: Tournament logo */}
        <div className="flex-1 flex justify-center items-center opacity-30 pointer-events-none">
          {config.selectedTournamentId && (
            <TournamentLogo
              tournamentId={config.selectedTournamentId}
              size={Math.round(scoreSize * 28.8)}
              showFallback={false}
            />
          )}
        </div>

        {/* AWAY */}
        <div className="flex justify-center items-center gap-3" style={{ width: colWidth }}>
          {showShots && <ShotsBadge count={awayShotsCount} />}
          <TeamStack
            name={getTeamDisplayName(awayTeamName, awayTeamSubName)}
            logoUrl={awayLogoDataUrl}
            playersCount={playersOnIceForAway}
            align="right"
          />
        </div>

      </div>
    </div>
  );
}
