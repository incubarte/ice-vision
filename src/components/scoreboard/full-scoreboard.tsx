
"use client";

import { useEffect, useState, useRef } from 'react';
import { useGameState, type GameAction } from '@/contexts/game-state-context';
import { CompactHeaderScoreboard, useTeamLogos } from './compact-header-scoreboard';
import { PenaltiesDisplay } from './penalties-display';
import { ShootoutDisplay, MAX_DISPLAY_SLOTS } from './shootout-display';
import { StandingsDisplay } from './standings-display';
import { WarmupDisplay } from './warmup-display';
import { WarmupDisplayStatic } from './warmup-display-static';
import { EndOfGameDisplay } from './end-of-game-display';
import { GoalCelebrationOverlay } from './goal-celebration-overlay';
import { ReplayOverlay } from './replay-overlay';
import { OlympiaTransition } from './olympia-transition';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import type { RemoteCommand } from '@/types';
import { HockeyPuckSpinner } from '../ui/hockey-puck-spinner';
import Image from 'next/image';
import { TournamentLogo } from '../tournaments/tournament-logo';
import { PreWarmupIntro } from './pre-warmup-intro';
import { useTournamentLogo } from '@/hooks/use-tournament-logo';

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
  const [isOlympiaTransitioning, setIsOlympiaTransitioning] = useState(false);
  const [frozenWarmupContent, setFrozenWarmupContent] = useState<React.ReactNode>(null);
  const [wasWarmup, setWasWarmup] = useState(false);
  const [wasEndOfGame, setWasEndOfGame] = useState(false);
  const [showStandingsInWarmup, setShowStandingsInWarmup] = useState(false);
  const [showPreWarmupIntro, setShowPreWarmupIntro] = useState(false);
  const [hasShownIntro, setHasShownIntro] = useState(false);
  const [wasShowingStandingsBeforeTransition, setWasShowingStandingsBeforeTransition] = useState(false);
  const { homeLogoDataUrl, awayLogoDataUrl } = useTeamLogos();

  const { config, live } = state;
  const scoreboardLayout = config?.scoreboardLayout;

  const { logo: tournamentLogo } = useTournamentLogo(config.selectedTournamentId);

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

  // Detectar cuando el período cambia de Warmup a otro período y activar transición de Olympia
  useEffect(() => {
    if (!config || !live) return;

    const isWarmup = live.clock.periodDisplayOverride === 'Warm-up';
    const isFixtureMatch = !!live.matchId;

    // Detectar transición de warmup a otro período
    if (wasWarmup && !isWarmup && isFixtureMatch && !isOlympiaTransitioning) {
      console.log('Period changed from Warmup!');

      // Si el Olympia está desactivado, no hacer transición
      if (!config.enableOlympiaTransition) {
        console.log('Olympia transition disabled, skipping...');
        setWasWarmup(false);
        return;
      }

      console.log('Capturing warmup content and starting Olympia transition...');

      // Usar el estado guardado de lo que realmente se estaba mostrando
      console.log('Was showing standings before transition:', wasShowingStandingsBeforeTransition);

      // Capturar el contenido COMPLETO de warmup ESTÁTICO (sin animaciones) para la transición
      const warmupContent = wasShowingStandingsBeforeTransition ? (
        <div className="w-full h-screen" style={{ pointerEvents: 'none' }}>
          <WarmupDisplayStatic
            homeLogoDataUrl={homeLogoDataUrl}
            awayLogoDataUrl={awayLogoDataUrl}
            clockPosition="top"
            showClock={true}
            tournamentLogoId={config.selectedTournamentId}
          >
            <StandingsDisplay />
          </WarmupDisplayStatic>
        </div>
      ) : (
        <div className="w-full h-screen" style={{ pointerEvents: 'none' }}>
          <WarmupDisplayStatic
            homeLogoDataUrl={homeLogoDataUrl}
            awayLogoDataUrl={awayLogoDataUrl}
            clockPosition="center"
            showClock={true}
            tournamentLogoId={config.selectedTournamentId}
          />
        </div>
      );

      setFrozenWarmupContent(warmupContent);

      // Iniciar transición inmediatamente
      setIsOlympiaTransitioning(true);
    }

    // Actualizar el estado de wasWarmup y detectar inicio de warmup para intro
    if (isWarmup && isFixtureMatch) {
      // Si acabamos de entrar en warmup y no hemos mostrado la intro
      if (!wasWarmup && !hasShownIntro && tournamentLogo) {
        console.log('[Pre-Warmup Intro] ACTIVATING intro!');
        setShowPreWarmupIntro(true);
        setHasShownIntro(true);
      }
      setWasWarmup(true);
    } else if (!isFixtureMatch) {
      setWasWarmup(false);
      setHasShownIntro(false); // Reset para el próximo partido
    }
  }, [config, live, wasWarmup, isOlympiaTransitioning, homeLogoDataUrl, awayLogoDataUrl, hasShownIntro, tournamentLogo]);

  // Detectar cuando el partido termina - ya no usa Olympia, solo marca el estado
  useEffect(() => {
    if (!config || !live) return;

    const isEndOfGame = live.clock.periodDisplayOverride === 'End of Game';
    const isFixtureMatch = !!live.matchId;

    // Actualizar el estado de wasEndOfGame
    if (isEndOfGame && isFixtureMatch) {
      setWasEndOfGame(true);
    } else if (!isFixtureMatch) {
      setWasEndOfGame(false);
    }
  }, [config, live, wasEndOfGame]);

  // Efecto para alternar entre tabla y warmup display durante el warmup
  // 20 segundos CON tabla, 30 segundos SIN tabla
  // NO mostrar tabla en el primer minuto de pantalla
  // NO mostrar tabla si quedan menos de 7 segundos en el reloj
  useEffect(() => {
    if (!config || !live) return;

    const isWarmup = live.clock.periodDisplayOverride === 'Warm-up';
    const isFixtureMatch = !!live.matchId;

    if (isWarmup && isFixtureMatch && config.showStandingsInWarmup) {
      console.log('[Standings] Warmup detected, starting table logic');

      // Marcar el tiempo de inicio de la pantalla de warmup
      const warmupStartTime = Date.now();

      // NO empezar mostrando la tabla
      setShowStandingsInWarmup(false);

      // Intervalo para verificar constantemente las condiciones
      const checkInterval = setInterval(() => {
        const elapsedTime = Date.now() - warmupStartTime;
        const remainingSeconds = live.clock.minutes * 60 + live.clock.seconds;

        console.log('[Standings] Check - Elapsed:', Math.floor(elapsedTime / 1000), 's, Remaining:', remainingSeconds, 's');

        // Regla 1: Primeros 30 segundos de pantalla -> NUNCA mostrar
        if (elapsedTime < 30000) {
          console.log('[Standings] First 30s of screen time - NEVER show');
          setShowStandingsInWarmup(false);
          return;
        }

        // Regla 2: Últimos 20 segundos del reloj -> SIEMPRE mostrar
        if (remainingSeconds <= 20) {
          console.log('[Standings] Last 20s of clock - ALWAYS show');
          setShowStandingsInWarmup(true);
          return;
        }

        // Regla 3: Entre esos momentos -> alternar en ciclos de 60s
        // El ciclo comienza exactamente a los 30s de screen time MOSTRANDO la tabla
        // Ciclo: 30s con tabla, 30s sin tabla (siempre que no rompa reglas 1 o 2)
        // Ejemplo timeline desde inicio de warmup:
        //   0-30s:   NO (regla 1 - primeros 30s de pantalla)
        //   30-60s:  SÍ (primer ciclo EMPIEZA MOSTRANDO, primeros 30s con tabla)
        //   60-90s:  NO (primer ciclo, siguientes 30s sin tabla)
        //   90-120s: SÍ (segundo ciclo, primeros 30s con tabla)
        //   120-150s: NO (segundo ciclo, siguientes 30s sin tabla)
        //   etc.
        const cycleTime = (elapsedTime - 30000) % 60000; // Tiempo dentro del ciclo actual (0-59999ms)
        const shouldShow = cycleTime < 30000; // Si cycleTime < 30s → mostrar (los 30s iniciales del ciclo)

        console.log('[Standings] Cycle time:', Math.floor(cycleTime / 1000), 's, Should show:', shouldShow);

        // Si estamos por ocultar la tabla pero quedan menos de 40 segundos en el reloj,
        // NO la ocultamos para que se quede visible hasta que entre en la regla 2
        if (!shouldShow && remainingSeconds < 40) {
          console.log('[Standings] Would hide but <40s remaining - keeping visible');
          setShowStandingsInWarmup(true);
          return;
        }

        setShowStandingsInWarmup(shouldShow);
      }, 1000); // Verificar cada segundo

      return () => {
        clearInterval(checkInterval);
      };
    } else {
      // Si no estamos en warmup, resetear a false
      setShowStandingsInWarmup(false);
    }
  }, [live.clock.periodDisplayOverride, live.matchId, config.showStandingsInWarmup, live.clock.minutes, live.clock.seconds]);

  // Guardar el estado actual de si se está mostrando la tabla para usarlo en la transición de Olympia
  useEffect(() => {
    if (!config || !live) return;

    const isWarmup = live.clock.periodDisplayOverride === 'Warm-up';
    const isFixtureMatch = !!live.matchId;
    const shouldShowStandings = config.showStandingsInWarmup && isWarmup && isFixtureMatch && showStandingsInWarmup;

    if (isWarmup && isFixtureMatch) {
      setWasShowingStandingsBeforeTransition(shouldShowStandings);
      console.log('[Standings State] shouldShowStandings:', shouldShowStandings, 'config.showStandingsInWarmup:', config.showStandingsInWarmup, 'showStandingsInWarmup (local):', showStandingsInWarmup);
    }
  }, [config, live, showStandingsInWarmup]);

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

  const showMainScoreboard = clock.periodDisplayOverride !== 'Shootout' && clock.periodDisplayOverride !== 'Warm-up';

  // Determinar qué vista mostrar durante warm-up
  const isWarmup = clock.periodDisplayOverride === 'Warm-up';
  const isFixtureMatch = !!matchId;

  // Mostrar tabla si estamos en warmup, es partido de fixture, la opción está activada Y el estado indica mostrar
  const shouldShowStandings = config.showStandingsInWarmup && isWarmup && isFixtureMatch && showStandingsInWarmup;
  const shouldShowWarmupDisplay = isWarmup && isFixtureMatch && !shouldShowStandings;

  const handleTransitionComplete = () => {
    setIsOlympiaTransitioning(false);
    setWasWarmup(false);
    setFrozenWarmupContent(null);
  };

  return (
    <div
      className={cn("w-full h-screen relative", className)}
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

      {isOlympiaTransitioning ? (
        <OlympiaTransition
          onComplete={handleTransitionComplete}
          oldContent={frozenWarmupContent}
          newContent={
            // Transition from Warmup to Game
            <div className="w-full h-screen grid grid-rows-[auto_1fr]">
              <div
                className="relative z-10"
                style={{
                  paddingTop: `${scoreboardLayout.scoreboardVerticalPosition}rem`,
                }}
              >
                <CompactHeaderScoreboard />
              </div>
              <div
                className="relative"
                style={{
                  marginTop: `${scoreboardLayout.mainContentGap}rem`,
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-10 xl:gap-12 h-full">
                  <PenaltiesDisplay teamDisplayType="Local" teamName={homeTeamName} penalties={penalties.home} />
                  <PenaltiesDisplay teamDisplayType="Visitante" teamName={awayTeamName} penalties={penalties.away} />
                </div>
              </div>
            </div>
          }
        />
      ) : showPreWarmupIntro ? (
        // Show Pre-Warmup Intro animation
        <PreWarmupIntro
          logo={tournamentLogo}
          onComplete={() => setShowPreWarmupIntro(false)}
        />
      ) : clock.periodDisplayOverride === 'End of Game' && isFixtureMatch ? (
        // Show End of Game screen (after transition has completed)
        <div className="w-full h-screen">
          <EndOfGameDisplay
            homeLogoDataUrl={homeLogoDataUrl}
            awayLogoDataUrl={awayLogoDataUrl}
          />
        </div>
      ) : (
        <div className="w-full h-screen grid grid-rows-[auto_1fr]">
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
                        {shouldShowWarmupDisplay ? (
                            <WarmupDisplay
                                homeLogoDataUrl={homeLogoDataUrl}
                                awayLogoDataUrl={awayLogoDataUrl}
                                tournamentLogoId={config.selectedTournamentId}
                            />
                        ) : shouldShowStandings ? (
                            <WarmupDisplay
                                homeLogoDataUrl={homeLogoDataUrl}
                                awayLogoDataUrl={awayLogoDataUrl}
                                clockPosition="top"
                                tournamentLogoId={config.selectedTournamentId}
                            >
                                <div style={{ transform: 'scale(1.1)', transformOrigin: 'center center' }}>
                                    <StandingsDisplay />
                                </div>
                            </WarmupDisplay>
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

          {/* Tournament Logo Watermark - Only show when NOT in warmup */}
          {config.selectedTournamentId && !isOlympiaTransitioning && !isWarmup && (
            <div className="absolute bottom-8 right-8 z-5 opacity-40 pointer-events-none">
              <TournamentLogo
                tournamentId={config.selectedTournamentId}
                size={400}
                showFallback={false}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
