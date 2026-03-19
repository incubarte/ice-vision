"use client";

import React, { useState, useMemo } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Minus, Target, Users, ArrowLeftRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { PlayersControlCard } from '@/components/controls/players-control-card';
import type { Team } from '@/types';

type ViewMode = 'home' | 'away' | 'both';
type ContentMode = 'shots' | 'attendance';

export default function ControlAuxiliarPage() {
  const { state, dispatch } = useGameState();
  const router = useRouter();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('both');
  const [contentMode, setContentMode] = useState<ContentMode>('shots');
  const [showSubstitutionControls, setShowSubstitutionControls] = useState(false);

  // When switching to attendance mode, pre-select home team
  const handleContentModeChange = (mode: ContentMode) => {
    setContentMode(mode);
    if (mode === 'attendance') {
      setViewMode('home');
    }
  };

  // Get present players for each team
  const homePresentPlayers = useMemo(() => {
    return (state.live.attendance?.home || [])
      .filter(p => p.isPresent && p.type === 'player')
      .sort((a, b) => {
        const numA = parseInt(a.number) || 999;
        const numB = parseInt(b.number) || 999;
        return numA - numB;
      });
  }, [state.live.attendance?.home]);

  const awayPresentPlayers = useMemo(() => {
    return (state.live.attendance?.away || [])
      .filter(p => p.isPresent && p.type === 'player')
      .sort((a, b) => {
        const numA = parseInt(a.number) || 999;
        const numB = parseInt(b.number) || 999;
        return numA - numB;
      });
  }, [state.live.attendance?.away]);

  const homeTeamName = state.live.homeTeamName || 'Equipo Local';
  const awayTeamName = state.live.awayTeamName || 'Equipo Visitante';

  // Count shots per player
  const getShotsCount = (playerNumber: string, team: Team) => {
    const shotsLog = state.live.shotsLog[team] || [];
    return shotsLog.filter(shot => shot.playerNumber === playerNumber).length;
  };

  // Add shot handler
  const handleAddShot = (playerNumber: string, team: Team) => {
    const shotRoster = state.live.matchContext ? (team === 'home' ? state.live.matchContext.homeRoster : state.live.matchContext.awayRoster) : [];
    if (!shotRoster.some(p => p.number === playerNumber)) {
      toast({ title: "Error", description: `Jugador #${playerNumber} no existe en el plantel.`, variant: "destructive" });
      return;
    }

    dispatch({
      type: 'ADD_PLAYER_SHOT',
      payload: { team, playerNumber }
    });

    toast({
      title: "Tiro Registrado",
      description: `Tiro para #${playerNumber}`,
      duration: 1500
    });
  };

  // Remove shot handler
  const handleRemoveShot = (playerNumber: string, team: Team) => {
    const shotsLog = state.live.shotsLog[team] || [];
    const lastShotIndex = shotsLog.map(s => s.playerNumber).lastIndexOf(playerNumber);

    if (lastShotIndex !== -1) {
      dispatch({
        type: 'REMOVE_SHOT',
        payload: { team, shotIndex: lastShotIndex }
      });

      toast({
        title: "Tiro Eliminado",
        description: `Tiro de #${playerNumber} eliminado`,
        duration: 1500
      });
    }
  };

  // Handle player substitution
  const handleSubstitution = (playerId: string, playerNumber: string, playerName: string, team: Team, action: 'enter' | 'exit') => {
    dispatch({
      type: 'PLAYER_SUBSTITUTION',
      payload: { team, playerId, playerNumber, playerName, action }
    });

    toast({
      title: action === 'enter' ? "Jugador Entra" : "Jugador Sale",
      description: `#${playerNumber} ${playerName} ${action === 'enter' ? 'entra' : 'sale'}`,
      duration: 1500
    });
  };

  // Check if player is on field
  const isPlayerOnField = (playerId: string, team: Team) => {
    return (state.live.playersOnField?.[team] || []).includes(playerId);
  };

  // Render player list for shots mode
  const renderShotsPlayerList = (team: Team, isRightSide = false) => {
    const players = team === 'home' ? homePresentPlayers : awayPresentPlayers;

    if (players.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <p>No hay jugadores presentes registrados</p>
          <p className="text-sm mt-2">Configura la asistencia desde la página de controles principal</p>
        </div>
      );
    }

    // Separate players by on-field status
    const playersOnField = showSubstitutionControls
      ? players.filter(p => p.id ? isPlayerOnField(p.id, team) : false)
      : [];
    const playersOnBench = showSubstitutionControls
      ? players.filter(p => p.id ? !isPlayerOnField(p.id, team) : true)
      : players;

    const renderPlayerCard = (player: any) => {
      const shotsCount = getShotsCount(player.number, team);
      const onField = player.id ? isPlayerOnField(player.id, team) : false;

      return (
        <Card
          key={player.id}
          className="overflow-hidden cursor-pointer hover:bg-accent/50 transition-colors active:scale-[0.98]"
          onClick={() => handleAddShot(player.number, team)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              {/* Substitution button - left side for left team, right side for right team */}
              {showSubstitutionControls && !isRightSide && (
                <Button
                  variant={onField ? "destructive" : "default"}
                  size="sm"
                  className="h-10 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubstitution(player.id ?? '', player.number, player.name, team, onField ? 'exit' : 'enter');
                  }}
                >
                  {onField ? 'Sale' : 'Entra'}
                </Button>
              )}

              {/* Player info */}
              <div className="flex items-center gap-3 flex-1 min-w-0 pointer-events-none">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground font-bold text-xl shrink-0">
                  {player.number}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-xl truncate">{player.name}</p>
                </div>
              </div>

              {/* Shots count and remove button */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary tabular-nums">
                    {shotsCount}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {shotsCount === 1 ? 'tiro' : 'tiros'}
                  </p>
                </div>
                {shotsCount > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveShot(player.number, team);
                    }}
                  >
                    <Minus className="h-5 w-5" />
                  </Button>
                )}
              </div>

              {/* Substitution button - right side for right team */}
              {showSubstitutionControls && isRightSide && (
                <Button
                  variant={onField ? "destructive" : "default"}
                  size="sm"
                  className="h-10 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubstitution(player.id ?? '', player.number, player.name, team, onField ? 'exit' : 'enter');
                  }}
                >
                  {onField ? 'Sale' : 'Entra'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      );
    };

    if (!showSubstitutionControls) {
      return (
        <div className="space-y-2">
          {players.map(renderPlayerCard)}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Players on field */}
        {playersOnField.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">
              En Cancha ({playersOnField.length})
            </div>
            {playersOnField.map(renderPlayerCard)}
          </div>
        )}

        {/* Separator */}
        {playersOnField.length > 0 && playersOnBench.length > 0 && (
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-muted-foreground/20"></div>
            </div>
          </div>
        )}

        {/* Players on bench */}
        {playersOnBench.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">
              En Banco ({playersOnBench.length})
            </div>
            {playersOnBench.map(renderPlayerCard)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Control Auxiliar</h1>
          <p className="text-muted-foreground mt-1">
            {contentMode === 'shots' ? 'Registro rápido de tiros' : 'Edición de números de casaca'}
          </p>
        </div>

        {/* Match info */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <p className="text-sm text-muted-foreground">Local</p>
                <p className="font-bold text-xl">{homeTeamName}</p>
                <Badge variant="secondary" className="mt-1">
                  {homePresentPlayers.length} jugadores
                </Badge>
              </div>
              <div className="text-2xl font-bold text-primary px-4">VS</div>
              <div className="text-center flex-1">
                <p className="text-sm text-muted-foreground">Visitante</p>
                <p className="font-bold text-xl">{awayTeamName}</p>
                <Badge variant="secondary" className="mt-1">
                  {awayPresentPlayers.length} jugadores
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content mode selector - Small and subtle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Modo:</span>
            <Button
              variant={contentMode === 'shots' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleContentModeChange('shots')}
              className="h-8"
            >
              <Target className="h-3 w-3 mr-1.5" />
              Tiros
            </Button>
            <Button
              variant={contentMode === 'attendance' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleContentModeChange('attendance')}
              className="h-8"
            >
              <Users className="h-3 w-3 mr-1.5" />
              Asistencia
            </Button>
          </div>

          {/* Substitution controls toggle - only in shots mode */}
          {contentMode === 'shots' && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="substitution-controls"
                checked={showSubstitutionControls}
                onCheckedChange={setShowSubstitutionControls}
              />
              <Label htmlFor="substitution-controls" className="text-sm cursor-pointer flex items-center gap-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Gestionar entradas/salidas
              </Label>
            </div>
          )}
        </div>

        {/* SHOTS MODE */}
        {contentMode === 'shots' && (
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
            <TabsList className="grid w-full grid-cols-3 h-14">
              <TabsTrigger value="home" className="text-lg font-semibold">
                {homeTeamName}
              </TabsTrigger>
              <TabsTrigger value="both" className="text-lg font-semibold">
                Ambos
              </TabsTrigger>
              <TabsTrigger value="away" className="text-lg font-semibold">
                {awayTeamName}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="home" className="mt-6">
              {renderShotsPlayerList('home')}
            </TabsContent>

            <TabsContent value="away" className="mt-6">
              {renderShotsPlayerList('away')}
            </TabsContent>

            <TabsContent value="both" className="mt-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Home team */}
                <div className="space-y-3">
                  <div className="sticky top-0 bg-background z-10 pb-3">
                    <h2 className="text-xl font-bold text-center p-3 bg-primary/10 rounded-lg border-2 border-primary/20">
                      {homeTeamName}
                    </h2>
                  </div>
                  {renderShotsPlayerList('home', false)}
                </div>

                {/* Away team */}
                <div className="space-y-3">
                  <div className="sticky top-0 bg-background z-10 pb-3">
                    <h2 className="text-xl font-bold text-center p-3 bg-primary/10 rounded-lg border-2 border-primary/20">
                      {awayTeamName}
                    </h2>
                  </div>
                  {renderShotsPlayerList('away', true)}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* ATTENDANCE MODE */}
        {contentMode === 'attendance' && (
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
            <TabsList className="grid w-full grid-cols-2 h-14">
              <TabsTrigger value="home" className="text-lg font-semibold">
                {homeTeamName}
              </TabsTrigger>
              <TabsTrigger value="away" className="text-lg font-semibold">
                {awayTeamName}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="home" className="mt-6">
              <PlayersControlCard team="home" teamName={homeTeamName} />
            </TabsContent>

            <TabsContent value="away" className="mt-6">
              <PlayersControlCard team="away" teamName={awayTeamName} />
            </TabsContent>
          </Tabs>
        )}

        {/* Summary stats - only show in shots mode */}
        {contentMode === 'shots' && (
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-sm">Resumen del Partido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Tiros {homeTeamName}</p>
                  <p className="text-3xl font-bold text-primary">{state.live.shotsLog.home?.length || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tiros {awayTeamName}</p>
                  <p className="text-3xl font-bold text-primary">{state.live.shotsLog.away?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
