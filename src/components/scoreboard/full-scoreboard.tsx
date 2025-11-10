
"use client";

import { useEffect, useState, useRef } from 'react';
import { useGameState, type GameAction } from '@/contexts/game-state-context';
import { CompactHeaderScoreboard } from './compact-header-scoreboard';
import { PenaltiesDisplay } from './penalties-display';
import { ShootoutDisplay, MAX_DISPLAY_SLOTS } from './shootout-display';
import { StandingsDisplay } from './standings-display';
import { GoalCelebrationOverlay } from './goal-celebration-overlay';
import { ReplayOverlay } from './replay-overlay';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import type { RemoteCommand } from '@/types';
import { HockeyPuckSpinner } from '../ui/hockey-puck-spinner';

const ValentinoCaffeAd = () => {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-8 overflow-hidden">
            <h1 
                className="text-4xl md:text-5xl font-semibold text-foreground animate-slide-in-pulse-out"
                style={{ animationDelay: '0s' }}
            >
                Este partido esta muy frio?
            </h1>
            <h2 
                className="text-3xl md:text-4xl font-medium text-muted-foreground animate-slide-in-pulse-out"
                style={{ animationDelay: '1.5s' }}
            >
                Mejor tomate un cafe
            </h2>
            <h3 
                className="text-6xl md:text-7xl font-bold text-accent animate-slide-in-pulse-out"
                style={{ animationDelay: '3s' }}
            >
                Valentino Caffe!
            </h3>
        </div>
    );
};


export function FullScoreboard({ className }: { className?: string }) {
  const { state, dispatch, isLoading } = useGameState();
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayText, setOverlayText] = useState('');
  
  const { config, live } = state;
  const scoreboardLayout = config?.scoreboardLayout;
  
  const videoPreloaderRef = useRef<HTMLVideoElement>(null);
  
  // Listen for remote commands specifically for this scoreboard component
  useEffect(() => {
    const eventSource = new EventSource('/api/remote-commands/events');

    eventSource.onmessage = async (event) => {
      try {
        if (!event.data) return;
        const command: RemoteCommand = JSON.parse(event.data);
        
        if (command.type === 'START_LOADING_REPLAY') {
             dispatch({ type: 'START_LOADING_REPLAY', payload: command.payload });
        }
        else if (command.type === 'SHOW_OVERLAY_MESSAGE') {
             dispatch({ type: 'SHOW_OVERLAY_MESSAGE', payload: command.payload });
        }
      } catch (e) {
        console.error("Failed to parse remote command in scoreboard:", e);
      }
    };
    
    eventSource.onerror = (e) => {
        console.warn("Scoreboard SSE connection error.", e);
    };

    return () => {
      eventSource.close();
    };
  }, [dispatch]);


  // Effect to handle video preloading and showing the overlay
  useEffect(() => {
    const videoElement = videoPreloaderRef.current;
    if (videoElement && live.replayLoadRequest?.url) {
        const canPlayHandler = () => {
            if(videoElement.src) {
                dispatch({
                    type: 'SHOW_REPLAY_OVERLAY',
                    payload: {
                        url: videoElement.src,
                        startTimeSeconds: live.replayLoadRequest.startTimeSeconds
                    }
                });
            }
        };

        videoElement.addEventListener('canplaythrough', canPlayHandler);

        videoElement.src = live.replayLoadRequest.url;
        videoElement.load();

        return () => {
            videoElement.removeEventListener('canplaythrough', canPlayHandler);
        }
    }
  }, [live.replayLoadRequest, dispatch]);

  
  useEffect(() => {
    if (live?.overlayMessage && live.overlayMessage.id) {
      setOverlayText(live.overlayMessage.text);
      setShowOverlay(true);

      const timer = setTimeout(() => {
        dispatch({ type: 'HIDE_OVERLAY_MESSAGE' });
      }, live.overlayMessage.duration);

      return () => clearTimeout(timer);
    } else {
      setShowOverlay(false);
    }
  }, [live?.overlayMessage, dispatch]);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (live?.goalCelebration) {
        timer = setTimeout(() => {
            dispatch({ type: 'HIDE_GOAL_CELEBRATION' });
        }, 5000); // Overlay lasts for 5 seconds
    }
    return () => clearTimeout(timer);
  }, [live?.goalCelebration, dispatch]);


  if (isLoading || !config || !live || !scoreboardLayout) {
    return null;
  }

  const { penalties, homeTeamName, awayTeamName, shootout, matchId, clock, goalCelebration, replayLoadRequest, replayOverlay } = live;

  const homeAttempts = shootout?.homeAttempts || [];
  const awayAttempts = shootout?.awayAttempts || [];
  const totalRounds = shootout?.rounds || 5;

  const maxAttempts = Math.max(homeAttempts.length, awayAttempts.length);
  const startIdx = Math.max(0, maxAttempts - MAX_DISPLAY_SLOTS);
  const currentRound = homeAttempts.length + awayAttempts.length > 0
    ? Math.max(homeAttempts.length, awayAttempts.length) + (homeAttempts.length === awayAttempts.length ? 1 : 0)
    : 1;

  const showMainScoreboard = clock.periodDisplayOverride !== 'Shootout';

  // Determinar si mostrar la tabla de posiciones
  const isWarmup = clock.periodDisplayOverride === 'Warm-up';
  const isFixtureMatch = !!matchId;
  const showStandings = config.showStandingsInWarmup && isWarmup && isFixtureMatch;

  return (
    <div 
      className={cn("w-full h-screen grid grid-rows-[auto_1fr] relative", className)}
      style={{
        transform: `translateX(${scoreboardLayout.scoreboardHorizontalPosition}rem)`
      }}
    >
       <video ref={videoPreloaderRef} style={{ display: 'none' }} muted playsInline />
       
       {/* --- TEMPORARY LOADING INDICATOR --- */}
       {replayLoadRequest && !replayOverlay && (
           <div className="absolute top-4 left-4 z-50 flex items-center gap-2 p-2 bg-blue-900/50 text-white rounded-lg backdrop-blur-sm">
                <HockeyPuckSpinner className="h-6 w-6" />
                <span className="text-sm font-medium">Cargando replay...</span>
           </div>
       )}
       {/* --- END TEMPORARY --- */}

      <div 
        className="relative z-10" // Header container
        style={{
            paddingTop: `${scoreboardLayout.scoreboardVerticalPosition}rem`,
        }}
      >
        {showMainScoreboard && <CompactHeaderScoreboard />}
      </div>

      {/* Transparent container that takes all remaining space */}
      <div 
        className="relative" // Content container
        style={{
            marginTop: `${scoreboardLayout.mainContentGap}rem`,
        }}
      >
        <AnimatePresence>
          {replayOverlay && (
            <motion.div
              key={replayOverlay.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30"
            >
              <ReplayOverlay
                url={replayOverlay.url}
                startTimeSeconds={replayOverlay.startTimeSeconds}
                onFinish={() => dispatch({ type: 'HIDE_REPLAY_OVERLAY' })}
              />
            </motion.div>
          )}
          {showOverlay && !replayOverlay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            >
              {overlayText === "Valentino Caffe" ? <ValentinoCaffeAd /> : <p className="text-6xl font-bold text-accent animate-pulse-text">{overlayText}</p>}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Penalties/Shootout/Standings/Goal Celebration content positioned within the transparent container */}
        <div className="relative z-0 h-full">
            <AnimatePresence>
                {goalCelebration && (
                    <motion.div
                        key={goalCelebration.id}
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -50 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="absolute inset-0 z-10"
                    >
                        <GoalCelebrationOverlay celebration={goalCelebration} />
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {!goalCelebration && (
                     <motion.div
                        key="main-content"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="h-full"
                    >
                        {showStandings ? (
                            <div className="px-4 sm:px-8 md:px-12 lg:px-16 h-full">
                                <StandingsDisplay />
                            </div>
                        ) : clock.periodDisplayOverride !== 'Shootout' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-10 xl:gap-12 h-full">
                                <PenaltiesDisplay teamDisplayType="Local" teamName={homeTeamName} penalties={penalties.home} />
                                <PenaltiesDisplay teamDisplayType="Visitante" teamName={awayTeamName} penalties={penalties.away} />
                            </div>
                        ) : clock.periodDisplayOverride === 'Shootout' && shootout?.isActive ? (
                            <div className="flex flex-col items-center gap-4">
                            <h1 
                                className="text-accent font-bold uppercase tracking-widest flex items-baseline gap-x-3"
                                style={{ fontSize: `${scoreboardLayout.periodSize * 1.5}rem` }}
                            >
                                <span>Penales</span>
                                <span 
                                    className="text-foreground/80 font-normal"
                                    style={{ fontSize: `${scoreboardLayout.periodSize * 1.5 * 0.5}rem` }}
                                >
                                    (Ronda {currentRound})
                                </span>
                            </h1>
                            <div className="w-full max-w-4xl space-y-4">
                                <ShootoutDisplay team="home" teamName={homeTeamName} attempts={homeAttempts} totalRounds={totalRounds} startIdx={startIdx} />
                                <ShootoutDisplay team="away" teamName={awayTeamName} attempts={awayAttempts} totalRounds={totalRounds} startIdx={startIdx} />
                            </div>
                            </div>
                        ) : null}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
