

"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Goal, ArrowLeft, Send, WifiOff, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendRemoteCommand } from '@/app/actions';
import { HockeyPuckSpinner } from '@/components/ui/hockey-puck-spinner';
import type { LiveGameState, Team, MobileData } from '@/types';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const AUTH_KEY = 'icevision-remote-auth-key';

function AddGoalForm({ homeTeamName, awayTeamName, onGoalSent }: { homeTeamName: string; awayTeamName: string; onGoalSent: () => void }) {
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [scorerNumber, setScorerNumber] = useState('');
    const [assistNumber, setAssistNumber] = useState('');
    const [isSending, setIsSending] = useState(false);
    const { toast } = useToast();
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedTeam) {
        toast({ title: "Error", description: "Debes seleccionar un equipo.", variant: "destructive" });
        return;
      }
      if (!scorerNumber.trim()) {
        toast({ title: "Error", description: "El número del goleador es obligatorio.", variant: "destructive" });
        return;
      }
  
      setIsSending(true);
      const result = await sendRemoteCommand({
        type: 'ADD_GOAL',
        payload: {
          team: selectedTeam,
          scorerNumber: scorerNumber.trim(),
          assistNumber: assistNumber.trim() || undefined,
        }
      });
      setIsSending(false);
  
      if (result.success) {
        toast({ title: "Comando Enviado", description: "El gol ha sido enviado al operador principal." });
        onGoalSent(); // Close dialog
      } else {
        toast({ title: "Error al Enviar", description: result.message, variant: "destructive" });
      }
    };
  
    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label className="text-base">Equipo que Anotó</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button
              type="button"
              variant={selectedTeam === 'home' ? 'default' : 'outline'}
              onClick={() => setSelectedTeam('home')}
              className="h-12 text-base truncate"
              title={homeTeamName}
            >
              {homeTeamName}
            </Button>
            <Button
              type="button"
              variant={selectedTeam === 'away' ? 'default' : 'outline'}
              onClick={() => setSelectedTeam('away')}
              className="h-12 text-base truncate"
              title={awayTeamName}
            >
              {awayTeamName}
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="scorer-number"># Goleador</Label>
            <Input
              id="scorer-number"
              type="number"
              inputMode="numeric"
              value={scorerNumber}
              onChange={(e) => setScorerNumber(e.target.value)}
              placeholder="Ej: 99"
              className="h-12 text-lg"
              required
            />
          </div>
          <div>
            <Label htmlFor="assist-number"># Asistente</Label>
            <Input
              id="assist-number"
              type="number"
              inputMode="numeric"
              value={assistNumber}
              onChange={(e) => setAssistNumber(e.target.value)}
              placeholder="(Opcional)"
              className="h-12 text-lg"
            />
          </div>
        </div>

        <DialogFooter className="pt-6">
          <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
          <Button type="submit" disabled={isSending} className="h-14 text-lg">
            {isSending ? <HockeyPuckSpinner className="h-6 w-6 mr-2" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar Gol
          </Button>
        </DialogFooter>
      </form>
    );
}

export default function MobileShotsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [liveState, setLiveState] = useState<LiveGameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAddGoalDialogOpen, setIsAddGoalDialogOpen] = useState(false);

  const fetchAndSetState = useCallback(async () => {
    try {
      const initialStateRes = await fetch('/api/game-state');
      if (!initialStateRes.ok) throw new Error("Could not fetch initial game state");
      const initialData: MobileData = await initialStateRes.json();
      
      if (initialData.gameState) {
        setLiveState(initialData.gameState);
        setError(null);
      } else {
        throw new Error("No active game state from server.");
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Error de conexión.";
      console.error("Fetch state failed", e);
      setError(errorMessage);
    }
  }, []);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connect = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const password = localStorage.getItem(AUTH_KEY);
        if (!password) {
            router.replace('/mobile-controls/login');
            return;
        }

        const authRes = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });
        if (!authRes.ok) throw new Error("Authentication failed");
        const authData = await authRes.json();
        
        if (!authData.authenticated) {
            router.replace('/mobile-controls/login');
            return;
        }
        
        await fetchAndSetState();

        eventSource = new EventSource('/api/game-state/events');
        eventSource.onopen = () => {
          setIsConnected(true);
          setError(null);
        };
        eventSource.onmessage = (event) => {
          try {
            const updatedLiveState: LiveGameState = JSON.parse(event.data);
            setLiveState(updatedLiveState);
          } catch(e) {
             console.error("Error parsing SSE data", e);
             setError("Error al procesar datos del servidor.");
          }
        };
        eventSource.onerror = () => {
          setIsConnected(false);
          setError("Conexión perdida. Intentando reconectar...");
        }

      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Error de autenticación o conexión inicial.";
        console.error("Connection failed", e);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };
    
    connect();

    return () => {
        if (eventSource) {
            eventSource.close();
        }
    }
  }, [router, fetchAndSetState]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAndSetState();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchAndSetState]);

  const handleShot = async (team: 'home' | 'away', playerNumber: string) => {
    if (!playerNumber) {
        toast({ title: "Error", description: "El jugador no tiene un número asignado.", variant: 'destructive' });
        return;
    }
    const teamName = team === 'home' ? liveState?.homeTeamName : liveState?.awayTeamName;
    toast({
        title: "Registrando Tiro",
        description: `Enviando tiro para el jugador #${playerNumber} de ${teamName}.`,
        duration: 1500,
    });
    const result = await sendRemoteCommand({ type: 'ADD_SHOT', payload: { team, playerNumber } });
    if (!result.success) {
      toast({ title: "Error de Envío", description: result.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <HockeyPuckSpinner className="h-24 w-24" />
      </div>
    );
  }

  if (error || !liveState) {
     return (
      <div className="flex flex-col justify-center items-center h-screen text-center text-destructive p-4">
       <WifiOff className="h-12 w-12 mb-4" />
       <p className="font-semibold">{error || 'No se pudo obtener el estado del partido.'}</p>
        <Button onClick={() => window.location.reload()} className="mt-6">
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
        </Button>
      </div>
    );
  }

  const homeTeamName = liveState.homeTeamName || 'Local';
  const awayTeamName = liveState.awayTeamName || 'Visitante';
  // Attendance is now string[] of jersey numbers. Build player objects from roster.
  const homeRoster = liveState.matchContext?.homeRoster || [];
  const awayRoster = liveState.matchContext?.awayRoster || [];
  const homeAttendanceSet = new Set(liveState.attendance?.home || []);
  const awayAttendanceSet = new Set(liveState.attendance?.away || []);
  const homeAttendedPlayers = homeRoster
    .filter(p => homeAttendanceSet.has(p.number))
    .sort((a, b) => (parseInt(a.number) || 999) - (parseInt(b.number) || 999));
  const awayAttendedPlayers = awayRoster
    .filter(p => awayAttendanceSet.has(p.number))
    .sort((a, b) => (parseInt(a.number) || 999) - (parseInt(b.number) || 999));
  const homeShots = liveState.score?.homeShots || 0;
  const awayShots = liveState.score?.awayShots || 0;


  return (
    <main className="w-full max-w-lg mx-auto p-4 space-y-6">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-primary-foreground">Registrar Tiros</h1>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-3 text-center">
            <h2 className="font-bold text-lg mb-1 truncate">{homeTeamName}</h2>
            <p className="text-5xl font-bold text-accent mb-3">{liveState.score.home}</p>
            <p className="text-sm text-muted-foreground mb-3">Tiros Totales: {homeShots}</p>
            <div className="grid grid-cols-3 gap-2">
              {homeAttendedPlayers.map(player => (
                <Button key={player.id} onClick={() => handleShot('home', player.number)} className="h-24 text-3xl">
                  {player.number}
                </Button>
              ))}
            </div>
            {homeAttendedPlayers.length === 0 && <p className="text-center text-sm text-muted-foreground p-4">Sin jugadores</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <h2 className="font-bold text-lg mb-1 truncate">{awayTeamName}</h2>
            <p className="text-5xl font-bold text-accent mb-3">{liveState.score.away}</p>
            <p className="text-sm text-muted-foreground mb-3">Tiros Totales: {awayShots}</p>
            <div className="grid grid-cols-3 gap-2">
               {awayAttendedPlayers.map(player => (
                <Button key={player.id} onClick={() => handleShot('away', player.number)} className="h-24 text-3xl">
                  {player.number}
                </Button>
              ))}
            </div>
            {awayAttendedPlayers.length === 0 && <p className="text-center text-sm text-muted-foreground p-4">Sin jugadores</p>}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Button className="w-full h-16 text-xl" onClick={() => setIsAddGoalDialogOpen(true)}>
        <Goal className="mr-4 h-6 w-6" /> Añadir Gol
      </Button>

      <Dialog open={isAddGoalDialogOpen} onOpenChange={setIsAddGoalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar un Nuevo Gol</DialogTitle>
            <DialogDescription>
              Selecciona el equipo y los números de los jugadores. El comando será enviado al operador principal.
            </DialogDescription>
          </DialogHeader>
          <AddGoalForm 
            homeTeamName={homeTeamName}
            awayTeamName={awayTeamName}
            onGoalSent={() => setIsAddGoalDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}
