
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Home, Settings, Wrench, MonitorPlay, Loader2, Trophy, ChevronsUpDown, Video } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { FullscreenToggle } from './fullscreen-toggle';
import { HockeyPuckSpinner } from '../ui/hockey-puck-spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGameState } from '@/contexts/game-state-context';
import { TournamentLogo } from '../tournaments/tournament-logo';

const EXTERNAL_WINDOW_CONFIG_KEY = 'externalWindowConfig';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { state, dispatch } = useGameState();
  const { tournaments, selectedTournamentId } = state.config;

  const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY === 'true';

  const isScoreboardPage = pathname === '/';
  const isControlsPage = pathname === '/controls';

  const [isVisible, setIsVisible] = useState(!isScoreboardPage);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // When the pathname changes, the new page has loaded, so we hide the loader.
    setIsLoading(false);
  }, [pathname]);

  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // If we are already on the destination page, do nothing.
    if (pathname === href) {
        e.preventDefault();
        return;
    }
    // Otherwise, activate the loader.
    setIsLoading(true);
    // The Link navigation will continue normally.
  };

  const activeTournaments = useMemo(() => {
    return (tournaments || []).filter(t => t.status === 'active');
  }, [tournaments]);
  
  const otherActiveTournaments = useMemo(() => {
    return activeTournaments.filter(t => t.id !== selectedTournamentId);
  }, [activeTournaments, selectedTournamentId]);


  const selectedTournament = useMemo(() => {
    return (tournaments || []).find(t => t.id === selectedTournamentId);
  }, [tournaments, selectedTournamentId]);

  const handleSelectTournament = (tournamentId: string) => {
    dispatch({ type: 'SET_ACTIVE_TOURNAMENT', payload: { tournamentId } });
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (tournament) {
      toast({ title: 'Torneo Activo Cambiado', description: `Ahora estás viendo "${tournament.name}".` });
    }
  };


  const handleOpenExternalWindow = async () => {
    let config = null;
    try {
        const savedConfigRaw = localStorage.getItem(EXTERNAL_WINDOW_CONFIG_KEY);
        if (savedConfigRaw) {
            config = JSON.parse(savedConfigRaw);
        }
    } catch (e) { console.error("Error parsing window config from localStorage", e); }
    
    // If no config, get it from the server
    if (!config || !config.binaryPath) {
        try {
            const res = await fetch('/api/system-info');
            if (!res.ok) throw new Error('Failed to fetch system info');
            const systemInfo = await res.json();
            config = {
                binaryPath: systemInfo.defaultBrowserPath,
                posX: '1920',
                posY: '0',
                width: '1920',
                height: '1080',
            };
            localStorage.setItem(EXTERNAL_WINDOW_CONFIG_KEY, JSON.stringify(config));
        } catch (error) {
            toast({
                title: "Error de Configuración",
                description: "No se pudo obtener la configuración por defecto para abrir la ventana. Por favor, configúrala manualmente.",
                variant: "destructive",
            });
            return;
        }
    }

    const payload = {
        binaryPath: config.binaryPath,
        url: `${window.location.protocol}//${window.location.host}/`, // Dynamic scoreboard URL
        position: { x: config.posX, y: config.posY },
        size: { width: config.width, height: config.height },
    };

    try {
        const response = await fetch('/api/open-window', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (data.success) {
            toast({ title: "Acción Enviada", description: data.message });
        } else {
            toast({ title: "Error al Abrir Ventana", description: data.message, variant: "destructive" });
        }
    } catch (error) {
        toast({ title: "Error de Red", description: "No se pudo comunicar con el servidor.", variant: "destructive" });
    }
  };


  // Prefetch all main routes as soon as the header loads to make navigation instant
  useEffect(() => {
    router.prefetch('/');
    router.prefetch('/controls');
    router.prefetch('/config');
    router.prefetch('/tournaments');
    router.prefetch('/replays');
  }, [router]);

  useEffect(() => {
    if (isScoreboardPage) {
      setIsVisible(false); 
    } else {
      setIsVisible(true);  
    }
  }, [isScoreboardPage]); 

  useEffect(() => {
    if (!isScoreboardPage) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (event.clientY < 80) { 
        setIsVisible(true);
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isScoreboardPage]);

  const handleHeaderMouseEnter = () => {
    if (isScoreboardPage) {
      setIsVisible(true);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    }
  };

  const handleHeaderMouseLeave = () => {
    if (isScoreboardPage) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hideTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 300); 
    }
  };

  return (
    <>
    {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <HockeyPuckSpinner className="h-24 w-24 text-primary" />
        </div>
    )}
    <header
      onMouseEnter={handleHeaderMouseEnter}
      onMouseLeave={handleHeaderMouseLeave}
      className={cn(
        "top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        "transition-all duration-300 ease-in-out",
        isScoreboardPage
          ? (isVisible ? "absolute opacity-100 translate-y-0 pointer-events-auto" : "absolute opacity-0 -translate-y-full pointer-events-none")
          : "sticky opacity-100 translate-y-0 pointer-events-auto"
      )}
    >
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2" onClick={(e) => handleNav(e, '/')}>
          <span className="font-headline text-xl font-bold text-primary-foreground">IceVision</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-4 text-sm">
          <Link
            href="/"
            onClick={(e) => handleNav(e, '/')}
            className={cn(
              "transition-colors hover:text-foreground/80",
              pathname === "/" ? "text-foreground" : "text-foreground/60"
            )}
          >
            Scoreboard
          </Link>
          {!isReadOnly && (
            <>
              <Link
                href="/controls"
                onClick={(e) => handleNav(e, '/controls')}
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  pathname === "/controls" ? "text-foreground" : "text-foreground/60"
                )}
              >
                Controles
              </Link>
              <Link
                href="/replays"
                onClick={(e) => handleNav(e, '/replays')}
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  pathname === "/replays" ? "text-foreground" : "text-foreground/60"
                )}
              >
                Replays (VAR)
              </Link>
            </>
          )}
        </nav>
        <div className="flex flex-1 items-center justify-end space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="hidden md:flex items-center gap-2 text-sm text-amber-400 mr-4 hover:text-amber-300 transition-colors">
                  {selectedTournament ? (
                      <>
                        <TournamentLogo tournamentId={selectedTournament.id} size={48} />
                        <span className="font-medium truncate max-w-[200px]">{selectedTournament.name}</span>
                      </>
                  ) : (
                      <>
                        <Trophy className="h-12 w-12 text-muted-foreground" />
                        <span className="text-muted-foreground">Sin Torneo</span>
                      </>
                  )}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {selectedTournament && (
                  <>
                  <DropdownMenuItem onClick={() => router.push(`/tournaments/${selectedTournament.id}`)}>
                    Ver Torneo Actual
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuLabel>Cambiar Torneo Activo</DropdownMenuLabel>
                 {otherActiveTournaments.length > 0 ? (
                  otherActiveTournaments.map(tournament => (
                    <DropdownMenuItem key={tournament.id} onClick={() => handleSelectTournament(tournament.id)}>
                      {tournament.name}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>No hay otros torneos activos</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {!isReadOnly && (
                  <DropdownMenuItem onClick={() => router.push('/tournaments')}>
                    Administrar Torneos
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

           <div className="flex items-center">
             <Button variant="ghost" size="icon" asChild className={cn("hidden sm:inline-flex", pathname === "/" ? "text-primary-foreground bg-primary/80" : "text-foreground/60")}>
              <Link href="/" aria-label="Scoreboard" onClick={(e) => handleNav(e, '/')}>
                <Home className="h-5 w-5" />
              </Link>
            </Button>
            {!isReadOnly && (
              <>
                <Button variant="ghost" size="icon" asChild className={cn("hidden sm:inline-flex", pathname === "/controls" ? "text-primary-foreground bg-primary/80" : "text-foreground/60")}>
                  <Link href="/controls" aria-label="Controls" onClick={(e) => handleNav(e, '/controls')}>
                    <Settings className="h-5 w-5" />
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" asChild className={cn("hidden sm:inline-flex", pathname === "/replays" ? "text-primary-foreground bg-primary/80" : "text-foreground/60")}>
                  <Link href="/replays" aria-label="Replays (VAR)" onClick={(e) => handleNav(e, '/replays')}>
                    <Video className="h-5 w-5" />
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" asChild className={cn("hidden sm:inline-flex", pathname === "/config" ? "text-primary-foreground bg-primary/80" : "text-foreground/60")}>
                  <Link href="/config" aria-label="Configuración General" onClick={(e) => handleNav(e, '/config')}>
                    <Wrench className="h-5 w-5" />
                  </Link>
                </Button>
              </>
            )}
          </div>

          {isControlsPage && !isReadOnly && (
            <Button variant="ghost" size="icon" onClick={handleOpenExternalWindow} aria-label="Abrir ventana de scoreboard externa">
                <MonitorPlay className="h-5 w-5" />
            </Button>
          )}

          {isScoreboardPage && (
            <FullscreenToggle />
          )}

        </div>
      </div>
    </header>
    </>
  );
}
