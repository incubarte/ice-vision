"use client";

import { useState } from "react";
import Link from "next/link";
import { useGameState } from "@/contexts/game-state-context";
import type { ClubData } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Edit, Trash2, ClipboardList, Loader2 } from "lucide-react";
import { DefaultTeamLogo } from "@/components/teams/default-team-logo";
import { getSpecificDefaultLogoUrlForCsv as getSpecificDefaultLogoUrl } from "@/components/teams/create-edit-team-dialog";
import { CreateEditClubDialog } from "./create-edit-club-dialog";
import Image from "next/image";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAdminMode } from "@/hooks/use-admin-mode";
import { saveTournamentOnServer } from "@/app/actions";

interface ClubsManagementTabProps {
  tournamentId: string;
}

const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY === 'true';

export function ClubsManagementTab({ tournamentId }: ClubsManagementTabProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const { isAdminMode } = useAdminMode();
  const clubs = state.config.activeTournament?.clubs || [];

  // Get tournament code for pre-match links (from meta list which always has code)
  const tournamentCode = state.config.tournaments?.find(t => t.id === tournamentId)?.code;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [clubToEdit, setClubToEdit] = useState<ClubData | null>(null);
  const [clubToDelete, setClubToDelete] = useState<ClubData | null>(null);
  const [savingPasswordFor, setSavingPasswordFor] = useState<string | null>(null);
  const [editingPasswords, setEditingPasswords] = useState<Record<string, string>>({});

  function handleEdit(club: ClubData) {
    setClubToEdit(club);
    setIsDialogOpen(true);
  }

  function handleNew() {
    setClubToEdit(null);
    setIsDialogOpen(true);
  }

  async function handleSavePassword(club: ClubData, newPassword: string) {
    if (!state.config.activeTournament) return;
    const updatedTournament = {
      ...state.config.activeTournament,
      clubs: (state.config.activeTournament.clubs ?? []).map(c =>
        c.id === club.id ? { ...c, password: newPassword } : c
      ),
    };
    setSavingPasswordFor(club.id);
    try {
      const result = await saveTournamentOnServer(updatedTournament);
      if (result?.success === false) throw new Error(result.message);
      dispatch({
        type: 'UPDATE_CLUB_IN_TOURNAMENT',
        payload: { tournamentId, clubId: club.id, name: club.name, logoDataUrl: club.logoDataUrl, password: newPassword },
      });
      toast({ title: 'Clave actualizada', description: `La clave del club "${club.name}" fue guardada en la nube.` });
    } catch {
      toast({ title: 'Error al guardar clave', description: 'No se pudo guardar en la nube. La clave no fue cambiada.', variant: 'destructive' });
    } finally {
      setSavingPasswordFor(null);
    }
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
        {!isReadOnly && (
          <Button size="sm" onClick={handleNew}>
            <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Club
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {clubs.map(club => {
          const logoSrc = club.logoDataUrl?.startsWith('data:image')
            ? club.logoDataUrl
            : getSpecificDefaultLogoUrl(club.name);

          return (
            <div key={club.id} className="flex flex-col p-3 border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                  {logoSrc ? (
                    <Image src={logoSrc} alt={club.name} width={40} height={40} className="object-contain w-10 h-10 rounded" />
                  ) : (
                    <DefaultTeamLogo teamName={club.name} size="sm" />
                  )}
                </div>
                <span className="flex-1 font-medium">{club.name}</span>
                {tournamentCode && (
                  <Button variant="ghost" size="icon" title="Planilla pre-partido" asChild>
                    <Link href={`/pre-match/${tournamentCode}/${encodeURIComponent(club.name)}`} target="_blank">
                      <ClipboardList className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
                {!isReadOnly && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(club)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setClubToDelete(club)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              {isAdminMode && (
                <div className="mt-2 flex items-center gap-2 border-t pt-2">
                  <span className="text-xs text-muted-foreground w-20">Clave:</span>
                  <Input
                    type="password"
                    value={editingPasswords[club.id] ?? (club.password || 'IceVision')}
                    onChange={e => setEditingPasswords(prev => ({ ...prev, [club.id]: e.target.value }))}
                    className="h-7 text-sm flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={savingPasswordFor === club.id}
                    onClick={() => handleSavePassword(club, editingPasswords[club.id] ?? club.password ?? 'IceVision')}
                  >
                    {savingPasswordFor === club.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Guardar'}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isReadOnly && (
        <CreateEditClubDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          clubToEdit={clubToEdit}
          tournamentId={tournamentId}
        />
      )}

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
