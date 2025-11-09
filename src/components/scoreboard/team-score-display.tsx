
"use client";

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';
import type { ScoreboardLayoutSettings } from '@/types';
import { Button } from '../ui/button';
import Image from 'next/image';
import { motion } from 'framer-motion';


interface TeamScoreDisplayProps {
  teamActualName: string;
  teamDisplayName: "Local" | "Visitante";
  score: number;
  playersOnIce?: number;
  configuredPlayersPerTeam?: number;
  layout?: ScoreboardLayoutSettings;
  logoDataUrl?: string | null;
  className?: string;
  onScoreClick?: () => void;
}

export function TeamScoreDisplay({
  teamActualName,
  teamDisplayName,
  score,
  playersOnIce = 0,
  configuredPlayersPerTeam = 0,
  layout,
  logoDataUrl,
  className,
  onScoreClick
}: TeamScoreDisplayProps) {
  const [flash, setFlash] = useState(false);
  const [prevScore, setPrevScore] = useState(score);
  
  const [isOverflowing, setIsOverflowing] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  
  useEffect(() => {
    if (score !== prevScore) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 500);
      setPrevScore(score);
      return () => clearTimeout(timer);
    }
  }, [score, prevScore]);

  useLayoutEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const isOverflow = textRef.current.scrollWidth > containerRef.current.clientWidth;
        setIsOverflowing(isOverflow);
      } else {
        setIsOverflowing(false);
      }
    };
    
    // Check on mount and on name change
    checkOverflow();

    const resizeObserver = new ResizeObserver(checkOverflow);
    if(containerRef.current) {
        resizeObserver.observe(containerRef.current);
    }
    
    return () => resizeObserver.disconnect();

  }, [teamActualName, layout?.teamNameWidth]);


  if (!layout) {
    return null;
  }
  
  const calculatedOffset = isOverflowing && textRef.current && containerRef.current
    ? textRef.current.scrollWidth - containerRef.current.clientWidth
    : 0;

  const animationDuration = 3; // seconds for one-way travel
  const initialPause = 10; // seconds
  const endPause = 5; // seconds
  const totalCycleDuration = initialPause + animationDuration + endPause + animationDuration;

  return (
    <div className={cn(
        "relative flex flex-col items-center text-center p-4 rounded-lg",
        className
      )}
      style={{ width: `${layout.teamNameWidth}rem`}}
      >
        {logoDataUrl && (
            <Image
                src={logoDataUrl}
                alt={`${teamActualName} background logo`}
                fill
                style={{
                    objectFit: "contain",
                    opacity: layout.teamLogoOpacity / 100
                }}
                className="absolute inset-0 z-0 pointer-events-none"
                sizes="20vw"
                data-ai-hint="team logo"
                priority
            />
        )}
        <div className="relative z-10 w-full flex flex-col items-center">
            <div className="flex items-center gap-4">
                <div className="flex justify-center items-center gap-1 mb-1 h-5 md:h-6 lg:h-7">
                    {playersOnIce > 0 && Array(playersOnIce).fill(null).map((_, index) => (
                    <User 
                        key={index} 
                        className="text-primary-foreground/80" 
                        style={{ 
                        height: `${layout.playersOnIceIconSize}rem`,
                        width: `${layout.playersOnIceIconSize}rem`
                        }}
                    />
                    ))}
                    {configuredPlayersPerTeam > 0 && playersOnIce === 0 && (
                    <span className="text-sm md:text-base lg:text-lg text-destructive animate-pulse">0 JUGADORES</span>
                    )}
                </div>
            </div>

          <div
            ref={containerRef} 
            className={cn(
              "w-full h-[1.2em] relative overflow-hidden",
               !isOverflowing && "flex justify-center"
            )}
            style={{ fontSize: `${layout.teamNameSize}rem` }}
            title={teamActualName}
          >
              <motion.span
                ref={textRef}
                className={cn(
                  "font-bold uppercase whitespace-nowrap",
                   isOverflowing ? "absolute left-0" : "text-center w-full"
                )}
                 animate={isOverflowing ? {
                   x: [0, 0, -calculatedOffset, -calculatedOffset, 0],
                } : { x: 0 }}
                transition={isOverflowing ? {
                  duration: totalCycleDuration,
                  repeat: Infinity,
                  repeatType: "loop",
                  ease: "easeInOut",
                  times: [
                    0, // Start at x: 0
                    initialPause / totalCycleDuration, // Hold at start until this point
                    (initialPause + animationDuration) / totalCycleDuration, // Move to end
                    (initialPause + animationDuration + endPause) / totalCycleDuration, // Hold at end
                    1, // Move back to start
                  ],
                } : {}}
              >
                {teamActualName}
              </motion.span>
          </div>

          <p 
            className="text-muted-foreground -mt-0.5 md:-mt-1"
            style={{ fontSize: `${layout.teamLabelSize}rem`}}
          >
            ({teamDisplayName})
          </p>
           <Button 
              variant="link" 
              onClick={onScoreClick} 
              className={cn(
                  "font-bold font-headline text-accent tabular-nums tracking-tighter p-0 h-auto hover:no-underline hover:text-accent/80",
                  flash && "animate-score-flash"
                )}
              style={{
                fontSize: `${layout.scoreSize}rem`,
                marginTop: `${layout.scoreLabelGap}rem`
              }}
            >
            {score}
          </Button>
        </div>
    </div>
  );
}
