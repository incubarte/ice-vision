
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useGameState, getCategoryNameById } from "@/contexts/game-state-context";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Trash2, Users, Info, ListFilter, LayoutGrid, LayoutList, Shield, User, Calendar, Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddPlayerForm } from "@/components/teams/add-player-form";
import { usePlayerStats } from "@/hooks/use-player-stats";
import { PlayerListItem } from "@/components/teams/player-list-item";
import { DefaultTeamLogo } from "@/components/teams/default-team-logo";
import { CreateEditTeamDialog } from "@/components/teams/create-edit-team-dialog";
import { EditPlayerDialog } from "@/components/teams/edit-player-dialog";
import { FixtureListView } from "@/components/fixture/fixture-list-view";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { type PlayerData, type Tournament, isTournamentHydrated } from "@/types";
import { Badge } from "@/components/ui/badge";
import { HockeyPuckSpinner } from "@/components/ui/hockey-puck-spinner";

type ViewMode = 'list' | 'grid';

export default function ManageTeamPage() {
  const params = useParams();
  const router = useRouter();
  const { state, dispatch, isLoading } = useGameState();
  const { toast } = useToast();
  const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY === 'true';
  const { activeTournament, tournaments } = state.config;

  const teamId = typeof params.teamId === 'string' ? params.teamId : undefined;

  const tournament = useMemo(() => {
    if (activeTournament && activeTournament.teams?.some(tm => tm.id === teamId)) {
      return activeTournament;
    }
    return null;
  }, [activeTournament, teamId]);

  const team = useMemo(() => {
    return tournament?.teams?.find(tm => tm.id === teamId);
  }, [tournament, teamId]);

  const isHydrated = isTournamentHydrated(tournament) && !!team;

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [editingPlayer, setEditingPlayer] = useState<PlayerData | null>(null);
  const [playerToDelete, setPlayerToDelete] = useState<PlayerData | null>(null);

  const sortedPlayers = useMemo(() => {
    if (!team?.players) return [];
    return [...team.players].sort((a: PlayerData, b: PlayerData) => {
      if (a.type === 'goalkeeper' && b.type !== 'goalkeeper') return -1;
      if (a.type !== 'goalkeeper' && b.type === 'goalkeeper') return 1;

      const numA = parseInt(a.number, 10);
      const numB = parseInt(b.number, 10);
      if (isNaN(numA) && isNaN(numB)) return 0;
      if (isNaN(numA)) return 1;
      if (!isNaN(numA) && isNaN(numB)) return -1;
      return numA - numB;
    });
  }, [team?.players]);

  // Count team matches
  const teamMatchesCount = useMemo(() => {
    if (!tournament?.matches || !team) return 0;
    return tournament.matches.filter(match => {
      const isDirectlyPlaying = match.homeTeamId === team.id || match.awayTeamId === team.id;
      const couldPlayInPlayoff = match.phase === 'playoffs' && !match.homeTeamId && !match.awayTeamId &&
        (match.playoffType === 'semifinal' || match.playoffType === 'final' || match.playoffType === '3er-puesto');
      return isDirectlyPlaying || couldPlayInPlayoff;
    }).length;
  }, [tournament?.matches, team]);

  // Get player statistics
  const playerStats = usePlayerStats(tournament, null);

  // Find top scorer within this team only
  const topScorer = useMemo(() => {
    if (!playerStats || playerStats.length === 0 || !team) return null;

    // Filter only players from this team
    const teamPlayerStats = playerStats.filter(p => p.teamId === team.id);

    if (teamPlayerStats.length === 0) return null;

    return teamPlayerStats.reduce((max, player) =>
      player.points > max.points ? player : max
    );
  }, [playerStats, team]);

  if (isLoading || !isHydrated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <HockeyPuckSpinner />
        <p className="text-muted-foreground animate-pulse">Cargando datos del equipo...</p>
      </div>
    );
  }

  if (!team || !tournament) {
    return (
      <div className="text-center py-10">
        <Info className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive-foreground mb-2">Equipo no encontrado</h2>
        <p className="text-muted-foreground mb-6">
          El equipo que estás buscando no existe o ha sido eliminado.
        </p>
        <Button onClick={() => router.push(`/tournaments/${state.config.selectedTournamentId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a la Gestión del Torneo
        </Button>
      </div>
    );
  }

  const handleRemovePlayer = (playerId: string) => {
    dispatch({ type: "REMOVE_PLAYER_FROM_TEAM", payload: { teamId: team.id, playerId } });
    toast({
      title: "Jugador Eliminado",
      description: "El jugador ha sido eliminado del equipo.",
    });
  };

  const handleDeleteTeam = () => {
    dispatch({ type: "DELETE_TEAMS_FROM_TOURNAMENT", payload: { tournamentId: tournament.id, teamIds: [team.id] } });
    toast({
      title: "Equipo Eliminado",
      description: `El equipo "${team.name}" ha sido eliminado.`,
      variant: "destructive",
    });
    router.push(`/tournaments/${tournament.id}`);
  };

  const categoryName = getCategoryNameById(team.category, tournament.categories);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
      <Button variant="outline" onClick={() => router.push(`/tournaments/${tournament.id}`)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver a {tournament.name}
      </Button>

      <div className="flex flex-col sm:flex-row items-center gap-6 p-6 border rounded-lg bg-card shadow-md">
        {team.logoDataUrl ? (
          <Image
            src={team.logoDataUrl}
            alt={`${team.name} logo`}
            width={100}
            height={100}
            className="rounded-lg border object-contain w-24 h-24 sm:w-28 sm:h-28"
            data-ai-hint="team logo"
          />
        ) : (
          <DefaultTeamLogo teamName={team.name} size="lg" className="w-24 h-24 sm:w-28 sm:h-28 text-4xl" />
        )}
        <div className="flex-grow text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-bold text-primary-foreground">{team.name}</h1>
          {team.subName && (
            <p className="text-lg sm:text-xl text-muted-foreground -mt-1">{team.subName}</p>
          )}
          {categoryName && (
            <Badge variant="outline" className="mt-1.5 mb-1 text-sm">
              <ListFilter className="mr-1.5 h-3.5 w-3.5" /> {categoryName}
            </Badge>
          )}
          <div className="flex items-center justify-center sm:justify-start gap-2 mt-2 text-muted-foreground">
            <Users className="h-5 w-5" />
            <span>{team.players.length} Jugador{team.players.length !== 1 ? 'es' : ''}</span>
          </div>
        </div>
        {!isReadOnly && (
          <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0 self-center sm:self-start">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
              <Edit className="mr-2 h-4 w-4" /> Editar Equipo
            </Button>
            <Button variant="destructive" onClick={() => setIsDeleteConfirmOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar Equipo
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="players" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="players" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Jugadores ({sortedPlayers.length})
          </TabsTrigger>
          <TabsTrigger value="matches" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Partidos ({teamMatchesCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="space-y-6">
          {!isReadOnly && (
            <>
              <Separator />
              <AddPlayerForm teamId={team.id} />
              <Separator />
            </>
          )}

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-primary-foreground">Lista de Jugadores</h2>
              <div className="flex gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 px-3"
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-8 px-3"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {sortedPlayers.length > 0 ? (
          viewMode === 'list' ? (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {sortedPlayers.map(player => (
                <PlayerListItem key={player.id} player={player} teamId={team.id} onRemovePlayer={(playerId) => { const p = team.players.find(pl => pl.id === playerId); if (p) setPlayerToDelete(p); }} allPlayers={team.players} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-h-[600px] overflow-y-auto pr-2">
              {sortedPlayers.map(player => {
                const currentPhotoUrl = player.photoFileName && tournament
                  ? `/api/storage/read?path=${encodeURIComponent(`tournaments/${tournament.id}/players/${team.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}/${player.photoFileName}`)}`
                  : null;

                // Get player stats
                const stats = playerStats.find(s => s.playerId === player.id);
                const isTopScorer = topScorer && stats && stats.playerId === topScorer.playerId && topScorer.points > 0;

                return (
                  <div
                    key={player.id}
                    className="relative group perspective-1000 cursor-pointer"
                    onClick={() => !isReadOnly && setEditingPlayer(player)}
                  >
                    {/* Delete button */}
                    {!isReadOnly && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setPlayerToDelete(player); }}
                        className="absolute top-1 right-1 z-10 p-1 rounded-full bg-black/60 text-white/80 hover:bg-destructive hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Eliminar jugador ${player.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <div className="relative aspect-[3/4] preserve-3d transition-transform duration-500 group-hover:rotate-y-180">
                      {/* FRONT - Photo */}
                      <div className={`absolute inset-0 backface-hidden rounded-lg overflow-hidden border-2 transition-colors ${isTopScorer ? 'border-amber-400' : 'border-primary/20 group-hover:border-primary'}`}>
                      {/* Holographic background - only for top scorer */}
                      {isTopScorer && (
                        <div className="absolute inset-0 holographic-bg" />
                      )}

                      {/* Photo content on top of holographic background */}
                      <div className="relative w-full h-full">
                      {currentPhotoUrl ? (
                        <Image
                          src={currentPhotoUrl}
                          alt={player.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                          {player.type === 'goalkeeper' ? (
                            <Shield className="h-15 w-15 text-primary/30" />
                          ) : (
                            <User className="h-15 w-15 text-primary/30" />
                          )}
                        </div>
                      )}

                      {/* Gradient overlay with player info */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2">
                        <p className="text-white font-bold text-base">
                          #{player.number || 'S/N'}
                        </p>
                        <p className="text-white/90 text-xs font-semibold truncate">
                          {player.name}
                        </p>
                      </div>
                      </div>
                      </div>

                      {/* BACK - Stats */}
                      <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-lg border-2 border-primary bg-gradient-to-br from-primary/5 to-primary/10 p-2 overflow-hidden">
                        <div className="h-full flex flex-col justify-center">
                          {stats ? (
                            <div className="space-y-1.5">
                              <div className="grid grid-cols-2 gap-1.5">
                                <div className="bg-background/50 rounded-lg p-1.5 text-center">
                                  <p className="text-[8px] text-muted-foreground mb-0.5">Goles</p>
                                  <p className="text-lg font-bold">{stats.goals}</p>
                                </div>
                                <div className="bg-background/50 rounded-lg p-1.5 text-center">
                                  <p className="text-[8px] text-muted-foreground mb-0.5">Asist.</p>
                                  <p className="text-lg font-bold">{stats.assists}</p>
                                </div>
                              </div>
                              <div className="bg-primary/20 rounded-lg p-1.5 text-center">
                                <p className="text-[9px] text-muted-foreground mb-0.5">Puntos Totales</p>
                                <p className="text-2xl font-bold text-primary">{stats.points}</p>
                              </div>
                              <div className="space-y-1 text-[9px]">
                                <div className="flex justify-between px-1.5 py-1 bg-background/30 rounded">
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Tiros</span>
                                    <span className="font-semibold">{stats.shots}</span>
                                  </div>
                                  {stats.shots > 0 && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-primary font-semibold">{stats.shootingPercentage}%</span>
                                    </div>
                                  )}
                                </div>
                                {stats.penaltyCount > 0 && (
                                  <div className="flex justify-between px-1.5 py-1 bg-orange-100 dark:bg-orange-950 rounded">
                                    <span className="text-orange-700 dark:text-orange-300">Penalid.</span>
                                    <span className="font-semibold text-orange-700 dark:text-orange-300">{stats.penaltyCount} ({stats.penaltyMinutes}')</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-4 flex-1 flex items-center justify-center">
                              <p className="text-[10px] text-muted-foreground">Sin estadísticas</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
            ) : (
              <div className="text-center py-8 px-4 border border-dashed rounded-md bg-card">
                <Info className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Este equipo aún no tiene jugadores.</p>
                {!isReadOnly && <p className="text-sm text-muted-foreground">Usa el formulario de arriba para añadir el primero.</p>}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="matches" className="space-y-6 mt-6">
          <FixtureListView
            teamFilter={team.id}
            hideFilters={false}
            hideTitle={true}
          />
        </TabsContent>
      </Tabs>

      <CreateEditTeamDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        teamToEdit={team}
        onTeamSaved={() => { /* Could refresh data or rely on state update */ }}
      />

      {isDeleteConfirmOpen && (
        <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que quieres eliminar el equipo "{team.name}"? Esta acción eliminará también a todos sus jugadores y no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTeam} className="bg-destructive hover:bg-destructive/90">
                Eliminar Equipo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {editingPlayer && tournament && (
        <EditPlayerDialog
          player={editingPlayer}
          teamId={team.id}
          tournamentId={tournament.id}
          teamName={team.name}
          isOpen={!!editingPlayer}
          onOpenChange={(open) => !open && setEditingPlayer(null)}
        />
      )}

      <AlertDialog open={!!playerToDelete} onOpenChange={(open) => !open && setPlayerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar al jugador #{playerToDelete?.number || 'S/N'} {playerToDelete?.name}? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (playerToDelete) {
                  handleRemovePlayer(playerToDelete.id);
                  setPlayerToDelete(null);
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
