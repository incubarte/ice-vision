"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useGameState } from "@/contexts/game-state-context";
import type { ClubData } from "@/types";
import { UploadCloud, XCircle, Image as ImageIcon, Loader2 } from "lucide-react";
import { DefaultTeamLogo } from "@/components/teams/default-team-logo";
import { getSpecificDefaultLogoUrlForCsv as getSpecificDefaultLogoUrl } from "@/components/teams/create-edit-team-dialog";
import { useAdminMode } from "@/hooks/use-admin-mode";
import { saveTournamentOnServer } from "@/app/actions";

interface CreateEditClubDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  clubToEdit?: ClubData | null;
  tournamentId: string;
}

export function CreateEditClubDialog({ isOpen, onOpenChange, clubToEdit, tournamentId }: CreateEditClubDialogProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const { isAdminMode, isReadOnly } = useAdminMode();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("IceVision");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!clubToEdit;
  const clubs = state.config.activeTournament?.clubs || [];

  useEffect(() => {
    if (isOpen) {
      if (isEditing && clubToEdit) {
        setName(clubToEdit.name);
        setPassword(clubToEdit.password || 'IceVision');
        setLogoPreview(clubToEdit.logoDataUrl?.startsWith('data:image') ? clubToEdit.logoDataUrl : null);
      } else {
        setName("");
        setPassword("IceVision");
        setLogoPreview(null);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [isOpen, clubToEdit, isEditing]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Archivo no soportado", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Archivo demasiado grande", description: "Máximo 2MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: "Nombre requerido", variant: "destructive" });
      return;
    }

    const isDuplicate = clubs.some(
      c => c.id !== clubToEdit?.id && c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      toast({ title: "Club duplicado", description: `Ya existe un club llamado "${trimmedName}".`, variant: "destructive" });
      return;
    }

    let logoDataUrl: string | null = null;
    if (logoPreview?.startsWith('data:image')) {
      logoDataUrl = logoPreview;
    } else {
      logoDataUrl = getSpecificDefaultLogoUrl(trimmedName);
      if (!logoDataUrl && isEditing && clubToEdit?.logoDataUrl && !clubToEdit.logoDataUrl.startsWith('data:image') && logoPreview !== null) {
        logoDataUrl = clubToEdit.logoDataUrl;
      }
    }

    const trimmedPassword = password.trim() || 'IceVision';
    const passwordChanged = isEditing && trimmedPassword !== (clubToEdit?.password || 'IceVision');

    // If admin and password changed, must sync to cloud first
    if (!isReadOnly && passwordChanged && state.config.activeTournament) {
      setIsSaving(true);
      const updatedTournament = {
        ...state.config.activeTournament,
        clubs: (state.config.activeTournament.clubs ?? []).map(c =>
          c.id === clubToEdit!.id ? { ...c, name: trimmedName, logoDataUrl: logoDataUrl ?? c.logoDataUrl, password: trimmedPassword } : c
        ),
      };
      try {
        const result = await saveTournamentOnServer(updatedTournament, { mirrorClubsToCloud: true });
        if (result?.success === false) throw new Error(result.message);
      } catch {
        toast({ title: 'Error al guardar clave', description: 'No se pudo guardar en la nube. La clave no fue cambiada.', variant: 'destructive' });
        setIsSaving(false);
        return;
      } finally {
        setIsSaving(false);
      }
    }

    if (isEditing && clubToEdit) {
      dispatch({
        type: 'UPDATE_CLUB_IN_TOURNAMENT',
        payload: { tournamentId, clubId: clubToEdit.id, name: trimmedName, logoDataUrl, password: trimmedPassword },
      });
      toast({ title: "Club actualizado" });
    } else {
      dispatch({
        type: 'ADD_CLUB_TO_TOURNAMENT',
        payload: { tournamentId, club: { name: trimmedName, logoDataUrl, password: trimmedPassword } },
      });
      toast({ title: "Club creado", description: `"${trimmedName}" fue agregado al torneo.` });
    }
    onOpenChange(false);
  };

  const displayLogoSrc = logoPreview?.startsWith('data:image')
    ? logoPreview
    : getSpecificDefaultLogoUrl(name.trim())
      ?? (isEditing && clubToEdit?.logoDataUrl && !clubToEdit.logoDataUrl.startsWith('data:image') && logoPreview !== null
        ? clubToEdit.logoDataUrl
        : null);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Club" : "Crear Club"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Modificá los datos del club." : "Agregá un nuevo club al torneo."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="clubName" className="text-right">Nombre</Label>
            <Input
              id="clubName"
              value={name}
              onChange={e => { setName(e.target.value); if (!logoPreview?.startsWith('data:image')) setLogoPreview(null); }}
              className="col-span-3"
              placeholder="Nombre del club"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Logo</Label>
            <div className="col-span-3 space-y-2">
              <div className="flex items-center gap-4">
                {displayLogoSrc ? (
                  <Image src={displayLogoSrc} alt="Logo" width={64} height={64} className="rounded-md border object-contain w-16 h-16" />
                ) : name.trim() ? (
                  <DefaultTeamLogo teamName={name} size="lg" />
                ) : (
                  <div className="w-16 h-16 rounded-md border bg-muted flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <UploadCloud className="mr-2 h-4 w-4" /> Cargar Logo
                  </Button>
                  {logoPreview?.startsWith('data:image') && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setLogoPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-destructive hover:text-destructive">
                      <XCircle className="mr-2 h-4 w-4" /> Quitar Logo
                    </Button>
                  )}
                </div>
              </div>
              <Input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              <p className="text-xs text-muted-foreground">Opcional. Máximo 2MB. Si el nombre coincide con un club conocido se usará un logo predeterminado.</p>
            </div>
          </div>
          {!isReadOnly && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="clubPassword" className="text-right">Clave pre-partido</Label>
              <Input
                id="clubPassword"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="col-span-3"
                placeholder="IceVision"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={isSaving}>Cancelar</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Guardar Cambios" : "Crear Club"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
