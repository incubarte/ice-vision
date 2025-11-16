
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useGameState, getCategoryNameById } from "@/contexts/game-state-context";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Trash2, Users, Info, ListFilter } from "lucide-react";
import { AddPlayerForm } from "@/components/teams/add-player-form";
import { PlayerListItem } from "@/components/teams/player-list-item";
import { DefaultTeamLogo } from "@/components/teams/default-team-logo";
import { CreateEditTeamDialog } from "@/components/teams/create-edit-team-dialog";
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
import type { PlayerData, Tournament } from "@/types";
import { Badge } from "@/components/ui/badge";

export default function ManageTeamPage() {
  const params = useParams();
  const router = useRouter();
  const { state, dispatch, isLoading } = useGameState();
  const { toast } = useToast();

  const teamId = typeof params.teamId === 'string' ? params.teamId : undefined;
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [team, setTeam] = useState(teamId ? tournament?.teams.find(t => t.id === teamId) : undefined);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (teamId) {
      for (const t of (state.config.tournaments || [])) {
        if (t.teams) { // Check if the teams array exists
          const foundTeam = t.teams.find(tm => tm.id === teamId);
          if (foundTeam) {
            setTeam(foundTeam);
            setTournament(t);
            break;
          }
        }
      }
    }
  }, [teamId, state.config.tournaments]);

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

  if (isLoading) {
    return <div className="text-center text-muted-foreground py-10">Cargando datos del equipo...</div>;
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
    <div className="w-full max-w-3xl mx-auto space-y-8">
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
        <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0 self-center sm:self-start">
          <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
            <Edit className="mr-2 h-4 w-4" /> Editar Equipo
          </Button>
           <Button variant="destructive" onClick={() => setIsDeleteConfirmOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Eliminar Equipo
          </Button>
        </div>
      </div>

      <Separator />

      <AddPlayerForm teamId={team.id} />

      <Separator />
      
      <div>
        <h2 className="text-2xl font-semibold text-primary-foreground mb-4">Lista de Jugadores</h2>
        {sortedPlayers.length > 0 ? (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {sortedPlayers.map(player => (
              <PlayerListItem key={player.id} player={player} teamId={team.id} onRemovePlayer={handleRemovePlayer} allPlayers={team.players} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 px-4 border border-dashed rounded-md bg-card">
            <Info className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Este equipo aún no tiene jugadores.</p>
            <p className="text-sm text-muted-foreground">Usa el formulario de arriba para añadir el primero.</p>
          </div>
        )}
      </div>

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
    </div>
  );
}
