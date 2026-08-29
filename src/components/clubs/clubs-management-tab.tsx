"use client";

import { useState } from "react";
import { useGameState } from "@/contexts/game-state-context";
import type { ClubData } from "@/types";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import { DefaultTeamLogo } from "@/components/teams/default-team-logo";
import { getSpecificDefaultLogoUrlForCsv as getSpecificDefaultLogoUrl } from "@/components/teams/create-edit-team-dialog";
import { CreateEditClubDialog } from "./create-edit-club-dialog";
import Image from "next/image";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface ClubsManagementTabProps {
  tournamentId: string;
}

export function ClubsManagementTab({ tournamentId }: ClubsManagementTabProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const clubs = state.config.activeTournament?.clubs || [];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [clubToEdit, setClubToEdit] = useState<ClubData | null>(null);
  const [clubToDelete, setClubToDelete] = useState<ClubData | null>(null);

  function handleEdit(club: ClubData) {
    setClubToEdit(club);
    setIsDialogOpen(true);
  }

  function handleNew() {
    setClubToEdit(null);
    setIsDialogOpen(true);
  }

  function handleDeleteConfirm() {
    if (!clubToDelete) return;
    dispatch({ type: 'DELETE_CLUB_FROM_TOURNAMENT', payload: { tournamentId, clubId: clubToDelete.id } });
    toast({ title: "Club eliminado", description: `"${clubToDelete.name}" fue eliminado. Los equipos del club mantienen su nombre.` });
    setClubToDelete(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {clubs.length === 0 ? "No hay clubes en este torneo." : `${clubs.length} club${clubs.length !== 1 ? 'es' : ''}`}
        </p>
        <Button size="sm" onClick={handleNew}>
          <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Club
        </Button>
      </div>

      <div className="space-y-2">
        {clubs.map(club => {
          const logoSrc = club.logoDataUrl?.startsWith('data:image')
            ? club.logoDataUrl
            : getSpecificDefaultLogoUrl(club.name);

          return (
            <div key={club.id} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
              <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                {logoSrc ? (
                  <Image src={logoSrc} alt={club.name} width={40} height={40} className="object-contain w-10 h-10 rounded" />
                ) : (
                  <DefaultTeamLogo teamName={club.name} size="sm" />
                )}
              </div>
              <span className="flex-1 font-medium">{club.name}</span>
              <Button variant="ghost" size="icon" onClick={() => handleEdit(club)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setClubToDelete(club)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <CreateEditClubDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        clubToEdit={clubToEdit}
        tournamentId={tournamentId}
      />

      <AlertDialog open={!!clubToDelete} onOpenChange={open => !open && setClubToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar club "{clubToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Los equipos asociados a este club mantendrán su nombre pero perderán la asociación. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
