
"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import type { Team, ShootoutAttempt } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Swords, Check, X, Shield, Goal, Flag, Undo2, ChevronsUpDown, Trophy } from 'lucide-react';
import { Separator } from '../ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from '@/lib/utils';
import { Label } from '../ui/label';

const ShooterSelector = ({
  team,
  onSelect,
  disabled,
  keyProp, // Used to force re-render and clear state
}: {
  team: Team;
  onSelect: (number: string, name?: string) => void;
  disabled: boolean;
  keyProp: number;
}) => {
  const { state } = useGameState();
  const [playerNumber, setPlayerNumber] = useState("");
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  const justSelectedPlayerRef = useRef(false);
  
  const attendancePlayers = useMemo(() => state.live.attendance[team] || [], [state.live.attendance, team]);

  const filteredPlayers = useMemo(() => {
    if (attendancePlayers.length === 0) return [];
    let playersToFilter = attendancePlayers.filter(p => p.number && p.number.trim() !== '');
    playersToFilter.sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
    
    const searchTermLower = playerSearchTerm.toLowerCase();
    if (!searchTermLower.trim()) return playersToFilter;

    return playersToFilter.filter(p =>
        p.number.toLowerCase().includes(searchTermLower) ||
        p.name.toLowerCase().includes(searchTermLower)
    );
  }, [attendancePlayers, playerSearchTerm]);
  
  // Effect to handle state clearing via keyProp change
  useEffect(() => {
    setPlayerNumber("");
    setPlayerName(null);
    onSelect("", undefined);
  }, [keyProp, onSelect]);

  const handleManualInput = useCallback((value: string) => {
    if (/^\d*$/.test(value)) {
        setPlayerNumber(value);
        setPlayerName(null); // Clear name if typing manually
        onSelect(value, undefined);
    }
  }, [onSelect]);

  const handleSelectPlayer = useCallback((player: { number: string; name: string }) => {
    setPlayerNumber(player.number);
    setPlayerName(player.name);
    onSelect(player.number, player.name);
    justSelectedPlayerRef.current = true;
    setIsPopoverOpen(false);
  }, [onSelect]);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmedSearch = playerSearchTerm.trim().toUpperCase();
      if (filteredPlayers.length > 0) {
        handleSelectPlayer(filteredPlayers[0]);
      } else if (trimmedSearch && /^\d+$/.test(trimmedSearch)) {
        handleManualInput(trimmedSearch);
      }
      setIsPopoverOpen(false);
    }
  };


  return (
    <Popover
        open={isPopoverOpen}
        onOpenChange={(isOpen) => {
            setIsPopoverOpen(isOpen);
            if (isOpen) setPlayerSearchTerm('');
            justSelectedPlayerRef.current = false; 
        }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isPopoverOpen}
          className="w-full justify-between h-12 text-base"
          disabled={disabled}
        >
          {playerNumber
            ? (
              <span className="truncate flex items-baseline">
                <span className="text-xs text-muted-foreground mr-0.5">#</span>
                <span className="font-semibold">{playerNumber}</span>
                {playerName && (
                  <span className="text-xs text-muted-foreground ml-1 truncate"> - {playerName}</span>
                )}
              </span>
            )
            : <span className="truncate text-muted-foreground">Nº Jugador / Seleccionar...</span>
          }
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar Nº o Nombre..."
            value={playerSearchTerm}
            onValueChange={setPlayerSearchTerm}
            onKeyDown={handleKeyDown}
          />
          <CommandList>
            <CommandEmpty>
                No se encontró jugador.
                {playerSearchTerm.trim() && /^\d+$/.test(playerSearchTerm.trim()) && (
                    <p className="text-xs text-muted-foreground p-2">Enter para usar: #{playerSearchTerm.trim().toUpperCase()}</p>
                )}
            </CommandEmpty>
            <CommandGroup>
              {filteredPlayers.map((player) => (
                <CommandItem key={player.id} value={`${player.number} ${player.name}`} onSelect={() => handleSelectPlayer(player)}>
                  <Check className={cn("mr-2 h-4 w-4", playerNumber === player.number ? "opacity-100" : "opacity-0")} />
                  <span className="font-semibold mr-2">#{player.number}</span>
                  <span className="text-muted-foreground truncate">{player.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};


const ShootoutAttemptRow = ({ attempt }: { attempt: ShootoutAttempt }) => (
    <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
        <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground w-6 text-center">R{attempt.round}</span>
            <p className="text-sm font-medium">#{attempt.playerNumber} - {attempt.playerName || 'Jugador no listado'}</p>
        </div>
        {attempt.isGoal === true && <Check className="h-5 w-5 text-green-500" />}
        {attempt.isGoal === false && <X className="h-5 w-5 text-destructive" />}
    </div>
);


export const ShootoutControl = () => {
    const { state, dispatch } = useGameState();
    const { toast } = useToast();
    const { shootout, homeTeamName, awayTeamName, score } = state.live;

    const [homeSelection, setHomeSelection] = useState<{ number: string, name?: string }>({ number: "" });
    const [awaySelection, setAwaySelection] = useState<{ number: string, name?: string }>({ number: "" });
    
    // Key state to force re-render/reset of ShooterSelector
    const [homeSelectorKey, setHomeSelectorKey] = useState(0);
    const [awaySelectorKey, setAwaySelectorKey] = useState(0);

    const handleHomeSelect = useCallback((number: string, name?: string) => {
        setHomeSelection({ number, name });
    }, []);

    const handleAwaySelect = useCallback((number: string, name?: string) => {
        setAwaySelection({ number, name });
    }, []);
    
    if (!shootout || !shootout.isActive) {
        return null;
    }

    const homeGoals = shootout.homeAttempts.filter(a => a.isGoal).length;
    const awayGoals = shootout.awayAttempts.filter(a => a.isGoal).length;
    const currentRound = Math.max(shootout.homeAttempts.length, shootout.awayAttempts.length) + 1;
    
    const whoseTurn = useMemo((): Team | 'both' | 'none' => {
        const { homeAttempts, awayAttempts, initiator } = shootout;
        const totalAttempts = homeAttempts.length + awayAttempts.length;

        if (totalAttempts === 0) {
            return 'both'; // At the start, anyone can go.
        }

        // If the number of attempts is equal, it's the initiator's turn for the new round.
        if (homeAttempts.length === awayAttempts.length) {
            return initiator || 'both';
        }

        // Otherwise, it's the turn of the team with fewer attempts.
        return homeAttempts.length < awayAttempts.length ? 'home' : 'away';
        
    }, [shootout]);

    const winner = useMemo(() => {
        const homeRoundsLeft = shootout.rounds - shootout.homeAttempts.length;
        const awayRoundsLeft = shootout.rounds - shootout.awayAttempts.length;

        // Check for mathematical win before all rounds are complete
        if (currentRound <= shootout.rounds) {
            if (homeGoals > awayGoals + awayRoundsLeft) return 'home';
            if (awayGoals > homeGoals + homeRoundsLeft) return 'away';
        }

        // Check for sudden death win
        if (currentRound > shootout.rounds && shootout.homeAttempts.length === shootout.awayAttempts.length) {
            if (homeGoals > awayGoals) return 'home';
            if (awayGoals > homeGoals) return 'away';
        }
        
        // Check for win at the end of regulation rounds
        if(currentRound > shootout.rounds && homeGoals !== awayGoals && shootout.homeAttempts.length === shootout.awayAttempts.length) {
            return homeGoals > awayGoals ? 'home' : 'away';
        }

        return null;
    }, [shootout, homeGoals, awayGoals, currentRound]);
    
    const gameIsDecided = !!winner;


    const handleRecordAttempt = (team: Team, isGoal: boolean) => {
        const selection = team === 'home' ? homeSelection : awaySelection;
        if (!selection.number.trim()) {
            toast({ title: "Número de jugador requerido", description: `Por favor, ingresa el número del jugador para el equipo ${team === 'home' ? homeTeamName : awayTeamName}.`, variant: "destructive" });
            return;
        }

        const teamAttendance = state.live.attendance[team] || [];
        const playerDetails = teamAttendance.find(p => p.number === selection.number);

        dispatch({ type: 'RECORD_SHOOTOUT_ATTEMPT', payload: {
          team,
          playerId: playerDetails?.id || `unknown-${selection.number}`,
          playerNumber: selection.number,
          playerName: selection.name || playerDetails?.name,
          isGoal
        }});

        if (team === 'home') {
            setHomeSelectorKey(prev => prev + 1);
        }
        if (team === 'away') {
            setAwaySelectorKey(prev => prev + 1);
        }
    };

    const handleFinishShootout = () => {
        dispatch({ type: 'FINISH_SHOOTOUT' });
        toast({ title: "Tanda de Penales Finalizada", description: "El resultado final ha sido actualizado." });
    };

    const handleUndoAttempt = (team: Team) => {
        dispatch({ type: 'UNDO_LAST_SHOOTOUT_ATTEMPT', payload: { team } });
    };


    return (
        <Card className="w-full max-w-4xl mx-auto shadow-xl border-indigo-500/50">
            <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3 text-indigo-400">
                    <Swords className="h-7 w-7" />
                    Control de Tanda de Penales
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                        <p className="font-bold text-lg truncate">{homeTeamName}</p>
                        <p className="text-6xl font-bold text-accent">{score.home + homeGoals}</p>
                    </div>
                    <div>
                        <p className="font-bold text-lg truncate">{awayTeamName}</p>
                        <p className="text-6xl font-bold text-accent">{score.away + awayGoals}</p>
                    </div>
                </div>
                
                <div className="flex justify-center items-center gap-4">
                    <Label htmlFor="shootout-rounds">Mejor de:</Label>
                    <Input
                        id="shootout-rounds"
                        type="number"
                        className="w-20"
                        value={shootout.rounds}
                        onChange={(e) => dispatch({ type: 'UPDATE_SHOOTOUT_ROUNDS', payload: parseInt(e.target.value, 10) || 1 })}
                        disabled={shootout.homeAttempts.length > 0 || shootout.awayAttempts.length > 0}
                    />
                    <Label>rondas</Label>
                </div>

                <Separator />

                <div className="space-y-4">
                    <div className="flex justify-center items-center gap-4">
                         <h3 className="text-xl font-semibold text-center">Ronda {currentRound}</h3>
                         {winner && (
                             <div className="flex items-center gap-2 text-yellow-400 font-bold animate-pulse">
                                <Trophy className="h-5 w-5" />
                                <span>GANADOR: {winner === 'home' ? homeTeamName : awayTeamName}</span>
                             </div>
                         )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Home Team Shooter */}
                        <div className={cn("space-y-3 p-4 border rounded-lg transition-all", (whoseTurn === 'home' || whoseTurn === 'both') && "border-blue-500 ring-2 ring-blue-500/50 animate-pulse")}>
                            <h4 className="font-medium text-center">{homeTeamName}</h4>
                            <ShooterSelector
                                key={`home-shooter-${homeSelectorKey}`}
                                team="home"
                                onSelect={handleHomeSelect}
                                disabled={false}
                                keyProp={homeSelectorKey}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <Button onClick={() => handleRecordAttempt('home', true)} disabled={!homeSelection.number}><Goal className="mr-2 h-4 w-4" />Gol</Button>
                                <Button onClick={() => handleRecordAttempt('home', false)} disabled={!homeSelection.number} variant="outline"><Shield className="mr-2 h-4 w-4" />Atajado</Button>
                            </div>
                        </div>

                        {/* Away Team Shooter */}
                        <div className={cn("space-y-3 p-4 border rounded-lg transition-all", (whoseTurn === 'away' || whoseTurn === 'both') && "border-blue-500 ring-2 ring-blue-500/50 animate-pulse")}>
                            <h4 className="font-medium text-center">{awayTeamName}</h4>
                            <ShooterSelector
                                key={`away-shooter-${awaySelectorKey}`}
                                team="away"
                                onSelect={handleAwaySelect}
                                disabled={false}
                                keyProp={awaySelectorKey}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <Button onClick={() => handleRecordAttempt('away', true)} disabled={!awaySelection.number}><Goal className="mr-2 h-4 w-4" />Gol</Button>
                                <Button onClick={() => handleRecordAttempt('away', false)} disabled={!awaySelection.number} variant="outline"><Shield className="mr-2 h-4 w-4" />Atajado</Button>
                            </div>
                        </div>
                    </div>
                </div>

                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium text-muted-foreground">Tiros de {homeTeamName}</h4>
                            <Button variant="ghost" size="sm" onClick={() => handleUndoAttempt('home')} disabled={shootout.homeAttempts.length === 0}>
                                <Undo2 className="h-4 w-4 mr-1" /> Deshacer
                            </Button>
                        </div>
                        {shootout.homeAttempts.length > 0 ? shootout.homeAttempts.map(a => <ShootoutAttemptRow key={a.id} attempt={a} />) : <p className="text-sm text-muted-foreground italic">Sin tiros registrados.</p>}
                    </div>
                     <div className="space-y-2">
                         <div className="flex items-center justify-between">
                            <h4 className="font-medium text-muted-foreground">Tiros de {awayTeamName}</h4>
                            <Button variant="ghost" size="sm" onClick={() => handleUndoAttempt('away')} disabled={shootout.awayAttempts.length === 0}>
                                <Undo2 className="h-4 w-4 mr-1" /> Deshacer
                            </Button>
                        </div>
                        {shootout.awayAttempts.length > 0 ? shootout.awayAttempts.map(a => <ShootoutAttemptRow key={a.id} attempt={a} />) : <p className="text-sm text-muted-foreground italic">Sin tiros registrados.</p>}
                    </div>
                </div>

                <div className="pt-4 flex flex-col items-center gap-4">
                    {gameIsDecided && <p className="text-lg font-bold text-green-500">¡El partido está decidido!</p>}
                    <Button onClick={handleFinishShootout} size="lg">
                        <Flag className="mr-2 h-5 w-5" />Finalizar Tanda de Penales
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
