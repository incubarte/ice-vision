
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useGameState } from "@/contexts/game-state-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Trophy, PlusCircle, Edit, Trash2, Info, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Tournament } from "@/types";
import { cn } from "@/lib/utils";
import { useRouter } from 'next/navigation';
import { TournamentLogo } from "@/components/tournaments/tournament-logo";


const statusMap: Record<Tournament['status'], { text: string; className: string }> = {
  active: { text: "Activo", className: "bg-green-600 hover:bg-green-700" },
  inactive: { text: "Inactivo", className: "bg-yellow-600 hover:bg-yellow-700 text-black" },
  finished: { text: "Finalizado", className: "bg-gray-500 hover:bg-gray-600" },
};

function CreateEditTournamentDialog({
  isOpen,
  onOpenChange,
  tournamentToEdit,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  tournamentToEdit?: Tournament | null;
}) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Tournament['status']>("inactive");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  const isEditing = !!tournamentToEdit;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && tournamentToEdit) {
        setName(tournamentToEdit.name);
        setStatus(tournamentToEdit.status);
        setLogoFile(null);
        setLogoPreview(null);
        setRemoveLogo(false);
        // Load existing logo
        fetch(`/api/tournaments/${tournamentToEdit.id}/logo`)
          .then(res => res.json())
          .then(data => {
            if (data.logo) {
              setLogoPreview(data.logo);
            }
          })
          .catch(console.error);
      } else {
        setName("");
        setStatus("inactive");
        setLogoFile(null);
        setLogoPreview(null);
        setRemoveLogo(false);
      }
    }
  }, [isOpen, tournamentToEdit, isEditing]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
        toast({
          title: "Formato Inv\u00e1lido",
          description: "El logo debe ser una imagen PNG o JPG.",
          variant: "destructive",
        });
        return;
      }
      setLogoFile(file);
      setRemoveLogo(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({
        title: "Nombre Requerido",
        description: "El nombre del torneo no puede estar vacío.",
        variant: "destructive",
      });
      return;
    }

    const isDuplicate = (state.config.tournaments || []).some(
      (t) => t.id !== tournamentToEdit?.id && t.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      toast({
        title: "Torneo Duplicado",
        description: `Ya existe un torneo con el nombre "${trimmedName}".`,
        variant: "destructive",
      });
      return;
    }

    let tournamentId: string;

    if (isEditing && tournamentToEdit) {
      tournamentId = tournamentToEdit.id;
      dispatch({
        type: "UPDATE_TOURNAMENT",
        payload: { id: tournamentId, name: trimmedName, status },
      });
      toast({ title: "Torneo Actualizado", description: `"${trimmedName}" ha sido actualizado.` });
    } else {
      const newTournament = { name: trimmedName, status: status || 'inactive' };
      dispatch({ type: "ADD_TOURNAMENT", payload: newTournament });
      // Get the tournament ID from the state after it's added
      const tournaments = state.config.tournaments || [];
      const addedTournament = tournaments.find(t => t.name === trimmedName);
      if (addedTournament) {
        tournamentId = addedTournament.id;
      } else {
        toast({ title: "Torneo Creado", description: `"${trimmedName}" ha sido creado.` });
        onOpenChange(false);
        return;
      }
      toast({ title: "Torneo Creado", description: `"${trimmedName}" ha sido creado.` });
    }

    // Handle logo upload/removal
    if (logoFile) {
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          await fetch(`/api/tournaments/${tournamentId}/logo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logo: reader.result }),
          });
        };
        reader.readAsDataURL(logoFile);
      } catch (error) {
        console.error('Error uploading logo:', error);
      }
    } else if (removeLogo) {
      try {
        await fetch(`/api/tournaments/${tournamentId}/logo`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('Error removing logo:', error);
      }
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Torneo" : "Crear Nuevo Torneo"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Nombre
            </Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">
              Estado
            </Label>
            <Select value={status} onValueChange={(value) => setStatus(value as Tournament['status'])}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inactive">Inactivo</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="finished">Finalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="logo" className="text-right pt-2">
              Logo
            </Label>
            <div className="col-span-3 space-y-2">
              {logoPreview && (
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 border rounded flex items-center justify-center bg-muted">
                    <img src={logoPreview} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                  </div>
                  <Button type="button" variant="destructive" size="sm" onClick={handleRemoveLogo}>
                    Eliminar Logo
                  </Button>
                </div>
              )}
              {!logoPreview && (
                <div className="flex items-center gap-4">
                  <Trophy className="w-16 h-16 text-amber-400" />
                  <span className="text-sm text-muted-foreground">Sin logo (se mostrará la copa)</span>
                </div>
              )}
              <Input
                id="logo"
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleLogoChange}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">Sube una imagen PNG o JPG para el logo del torneo</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit}>
            {isEditing ? "Guardar Cambios" : "Crear Torneo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TournamentsPage() {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const router = useRouter();
  const [isCreateEditDialogOpen, setIsCreateEditDialogOpen] = useState(false);
  const [tournamentToEdit, setTournamentToEdit] = useState<Tournament | null>(null);
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);
  const [isLoadingTournament, setIsLoadingTournament] = useState<string | null>(null);

  const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY === 'true';

  const tournaments = useMemo(() => {
    const allTournaments = state.config.tournaments || [];
    if (isReadOnly) {
      return allTournaments.filter(t => t.status === 'active' || t.status === 'finished');
    }
    return allTournaments;
  }, [state.config.tournaments, isReadOnly]);


  const handleEdit = (tournament: Tournament) => {
    setTournamentToEdit(tournament);
    setIsCreateEditDialogOpen(true);
  };

  const handleDelete = (tournament: Tournament) => {
    setTournamentToDelete(tournament);
  };
  
  const handleTournamentClick = (tournamentId: string) => {
    setIsLoadingTournament(tournamentId);
    router.push(`/tournaments/${tournamentId}`);
  };

  const confirmDelete = () => {
    if (tournamentToDelete) {
      dispatch({ type: "DELETE_TOURNAMENT", payload: { id: tournamentToDelete.id } });
      toast({
        title: "Torneo Eliminado",
        description: `El torneo "${tournamentToDelete.name}" ha sido eliminado.`,
        variant: "destructive",
      });
      setTournamentToDelete(null);
    }
  };


  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 py-10">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-primary-foreground">Gestión de Torneos</h1>
        </div>
        {!isReadOnly && (
          <Button onClick={() => { setTournamentToEdit(null); setIsCreateEditDialogOpen(true); }}>
            <PlusCircle className="mr-2 h-4 w-4" /> Crear Nuevo Torneo
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {tournaments.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No has creado ningún torneo todavía.</p>
            {!isReadOnly && <p className="text-sm text-muted-foreground">¡Usa el botón de arriba para crear el primero!</p>}
          </div>
        ) : (
          tournaments.map((tournament) => (
            <Card 
              key={tournament.id}
              className={cn("hover:shadow-lg transition-shadow cursor-pointer", isLoadingTournament === tournament.id && "animate-pulse")}
              onClick={() => handleTournamentClick(tournament.id)}
            >
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <TournamentLogo tournamentId={tournament.id} size={96} />
                  <div className="flex flex-col">
                    <span className="font-semibold text-lg text-card-foreground">{tournament.name}</span>
                    <Badge className={cn("w-fit", statusMap[tournament.status]?.className)}>
                      {statusMap[tournament.status]?.text || tournament.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                    {isLoadingTournament === tournament.id && (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    )}
                    {!isReadOnly && (
                        <>
                            <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(tournament); }}>
                            <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(tournament); }}>
                            <Trash2 className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {!isReadOnly && (
        <>
          <CreateEditTournamentDialog
            isOpen={isCreateEditDialogOpen}
            onOpenChange={setIsCreateEditDialogOpen}
            tournamentToEdit={tournamentToEdit}
          />

          {tournamentToDelete && (
            <AlertDialog open={!!tournamentToDelete} onOpenChange={() => setTournamentToDelete(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿Estás seguro de que quieres eliminar el torneo "{tournamentToDelete.name}"? Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </>
      )}
    </div>
  );
}
