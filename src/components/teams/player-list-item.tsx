
"use client";

import React, { useState, useEffect, useRef } from "react";
import type { PlayerData } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Shield, Trash2, CheckCircle, XCircle, Edit3, Upload, X } from "lucide-react";
import { useGameState } from "@/contexts/game-state-context";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

interface PlayerListItemProps {
  player: PlayerData;
  teamId: string;
  onRemovePlayer: (playerId: string) => void;
  allPlayers?: PlayerData[];
}

export function PlayerListItem({ player, teamId, onRemovePlayer, allPlayers = [] }: PlayerListItemProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY === 'true';

  const [isEditing, setIsEditing] = useState(false);
  const [editableNumber, setEditableNumber] = useState(player.number);
  const [editableName, setEditableName] = useState(player.name);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);

  const numberInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if current player's number is duplicated
  const hasDuplicateNumber = allPlayers.filter(p => p.number && p.number.trim() === player.number?.trim()).length > 1;

  // Get tournament and team info from activeTournament
  const tournament = state.config.activeTournament;
  const team = tournament?.teams.find(t => t.id === teamId);

  // Get current photo URL if exists
  const currentPhotoUrl = player.photoFileName && tournament && team
    ? `/api/storage/read?path=${encodeURIComponent(`tournaments/${tournament.id}/players/${team.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}/${player.photoFileName}`)}`
    : null;

  useEffect(() => {
    if (!isEditing) {
      setEditableNumber(player.number);
      setEditableName(player.name);
      setPhotoFile(null);
      setPhotoPreview(null);
    } else {
      numberInputRef.current?.focus();
      numberInputRef.current?.select();
    }
  }, [isEditing, player.number, player.name]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditableNumber(player.number);
    setEditableName(player.name);
    setPhotoFile(null);
    setPhotoPreview(null);
    setIsEditing(false);
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Resize if too large (max 1200px on longest side)
          const maxSize = 1200;
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // For PNG, preserve transparency
          const isPNG = file.type === 'image/png';
          if (!isPNG) {
            // For non-PNG, fill with white background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Determine output format and quality
          const outputType = isPNG ? 'image/png' : 'image/jpeg';
          const quality = isPNG ? 0.9 : 0.8; // PNG: 90%, JPEG: 80%

          // Convert to blob with compression
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Could not compress image'));
                return;
              }

              // Create a new File from the blob
              const extension = isPNG ? 'png' : 'jpg';
              const fileName = file.name.replace(/\.[^/.]+$/, `.${extension}`);

              const compressedFile = new File([blob], fileName, {
                type: outputType,
                lastModified: Date.now(),
              });

              console.log('[PlayerEdit] Image compressed:', {
                originalSize: file.size,
                compressedSize: compressedFile.size,
                reduction: `${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`,
                format: isPNG ? 'PNG (transparency preserved)' : 'JPEG'
              });

              resolve(compressedFile);
            },
            outputType,
            quality
          );
        };
        img.onerror = () => reject(new Error('Could not load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[PlayerEdit] handlePhotoSelect called', { hasFiles: !!e.target.files, fileCount: e.target.files?.length });

    const file = e.target.files?.[0];
    if (!file) {
      console.log('[PlayerEdit] No file selected');
      return;
    }

    console.log('[PlayerEdit] File selected:', { name: file.name, size: file.size, type: file.type });

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.log('[PlayerEdit] Invalid file type');
      toast({ title: "Archivo Inválido", description: "Por favor selecciona una imagen.", variant: "destructive" });
      return;
    }

    try {
      // Compress the image
      console.log('[PlayerEdit] Compressing image...');
      const compressedFile = await compressImage(file);

      // Validate file size (max 5MB after compression)
      if (compressedFile.size > 5 * 1024 * 1024) {
        console.log('[PlayerEdit] Compressed file still too large');
        toast({ title: "Archivo Muy Grande", description: "La imagen no debe superar los 5MB después de la compresión.", variant: "destructive" });
        return;
      }

      console.log('[PlayerEdit] Setting compressed photo file to state');
      setPhotoFile(compressedFile);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log('[PlayerEdit] Preview created');
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('[PlayerEdit] Error compressing image:', error);
      toast({ title: "Error", description: "No se pudo procesar la imagen.", variant: "destructive" });
    }
  };

  const handleRemovePhoto = async () => {
    if (!player.photoFileName || !tournament || !team) return;

    const sanitizedTeamName = team.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const filePath = `tournaments/${tournament.id}/players/${sanitizedTeamName}/${player.photoFileName}`;

    try {
      const response = await fetch(`/api/storage/player-photo?path=${encodeURIComponent(filePath)}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete photo');

      dispatch({
        type: "UPDATE_PLAYER_IN_TEAM",
        payload: { teamId, playerId: player.id, updates: { photoFileName: undefined } }
      });

      toast({ title: "Foto Eliminada", description: "La foto del jugador ha sido eliminada." });
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast({ title: "Error", description: "No se pudo eliminar la foto.", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    console.log('[PlayerEdit] handleSave called', {
      hasPhotoFile: !!photoFile,
      hasTournament: !!tournament,
      hasTeam: !!team,
      photoFileName: photoFile?.name
    });

    const trimmedNumber = editableNumber.trim();
    const trimmedName = editableName.trim();
    let changesMade = false;
    const updates: Partial<Pick<PlayerData, 'name' | 'number' | 'photoFileName'>> = {};

    if (!trimmedName) {
      toast({ title: "Nombre Requerido", description: "El nombre no puede estar vacío.", variant: "destructive" });
      return;
    }
    if (trimmedName !== player.name) {
      updates.name = trimmedName;
      changesMade = true;
    }

    if (trimmedNumber) {
      if (!/^\d+$/.test(trimmedNumber)) {
        toast({ title: "Número Inválido", description: "El número solo debe contener dígitos si se proporciona.", variant: "destructive" });
        return;
      }

      // Get team from active tournament
      const currentTournament = state.config.activeTournament;
      const currentTeam = currentTournament?.teams?.some(tm => tm.id === teamId)
        ? currentTournament.teams.find(t => t.id === teamId)
        : undefined;

      if (currentTeam && currentTeam.players.some(p => p.id !== player.id && p.number === trimmedNumber)) {
        toast({
          title: "Número de Jugador Duplicado",
          description: `El número #${trimmedNumber} ya existe en este equipo.`,
          variant: "destructive",
        });
        return;
      }
    }
    if (trimmedNumber !== player.number) {
      updates.number = trimmedNumber;
      changesMade = true;
    }

    // Handle photo upload if a new photo was selected
    if (photoFile && tournament && team) {
      console.log('[PlayerEdit] Starting photo upload...', { photoFile, tournamentId: tournament.id, teamName: team.name });
      setIsUploadingPhoto(true);
      try {
        const formData = new FormData();
        formData.append('file', photoFile);
        formData.append('tournamentId', tournament.id);
        formData.append('teamName', team.name);
        formData.append('playerName', trimmedName);

        console.log('[PlayerEdit] Sending upload request...');
        const response = await fetch('/api/storage/player-photo', {
          method: 'POST',
          body: formData,
        });

        console.log('[PlayerEdit] Upload response status:', response.status);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[PlayerEdit] Upload failed:', errorData);
          throw new Error('Failed to upload photo');
        }

        const data = await response.json();
        console.log('[PlayerEdit] Upload successful:', data);
        updates.photoFileName = data.fileName;
        changesMade = true;

        // Delete old photo if exists
        if (player.photoFileName) {
          const sanitizedTeamName = team.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          const oldFilePath = `tournaments/${tournament.id}/players/${sanitizedTeamName}/${player.photoFileName}`;
          await fetch(`/api/storage/player-photo?path=${encodeURIComponent(oldFilePath)}`, {
            method: 'DELETE',
          }).catch(console.error); // Don't fail if old photo can't be deleted
        }
      } catch (error) {
        console.error('[PlayerEdit] Error uploading photo:', error);
        toast({ title: "Error", description: "No se pudo subir la foto.", variant: "destructive" });
        setIsUploadingPhoto(false);
        return;
      } finally {
        setIsUploadingPhoto(false);
      }
    } else if (photoFile) {
      console.log('[PlayerEdit] Photo file selected but missing tournament or team:', {
        hasPhotoFile: !!photoFile,
        hasTournament: !!tournament,
        hasTeam: !!team
      });
    }

    if (changesMade) {
      dispatch({ type: "UPDATE_PLAYER_IN_TEAM", payload: { teamId, playerId: player.id, updates } });
      toast({ title: "Jugador Actualizado", description: `Datos del jugador ${updates.number || player.number || 'S/N'} actualizados.` });
    }
    setIsEditing(false);
  };

  const displayPlayerNumber = player.number ? `#${player.number}` : 'S/N';

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-grow min-w-0">
          {player.type === "goalkeeper" ? (
            <Shield className="h-6 w-6 text-primary shrink-0" />
          ) : (
            <User className="h-6 w-6 text-primary shrink-0" />
          )}
          <div className="flex-grow min-w-0">
            {isEditing ? (
              <>
                <div className="flex flex-col sm:flex-row gap-2 items-baseline">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm text-muted-foreground self-center">#</span>
                    <Input
                      ref={numberInputRef}
                      type="text"
                      inputMode="numeric"
                      value={editableNumber}
                      onChange={(e) => {
                        if (/^\d*$/.test(e.target.value)) {
                          setEditableNumber(e.target.value)
                        }
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } if (e.key === 'Escape') handleCancel(); }}
                      className={`h-7 px-1 py-0 w-16 text-sm ${hasDuplicateNumber && player.number ? 'border-red-500 border-2' : ''}`}
                      placeholder="S/N"
                    />
                  </div>
                  <Input
                    type="text"
                    value={editableName}
                    onChange={(e) => setEditableName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } if (e.key === 'Escape') handleCancel(); }}
                    className="h-7 px-1 py-0 flex-1 text-sm min-w-[100px]"
                    placeholder="Nombre/Apodo"
                  />
                </div>

                {/* Photo upload section */}
                <div className="mt-2 flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />

                  {(photoPreview || currentPhotoUrl) && (
                    <div
                      className="relative w-12 h-12 rounded overflow-hidden border-2 border-primary group"
                      onClick={(e) => e.stopPropagation()}
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const preview = e.currentTarget.querySelector('.preview-popup') as HTMLElement;
                        if (preview) {
                          preview.style.left = `${rect.right + 8}px`;
                          preview.style.top = `${rect.top + rect.height / 2}px`;
                          preview.style.transform = 'translateY(-50%)';
                          preview.style.opacity = '1';
                        }
                      }}
                      onMouseLeave={(e) => {
                        const preview = e.currentTarget.querySelector('.preview-popup') as HTMLElement;
                        if (preview) {
                          preview.style.opacity = '0';
                        }
                      }}
                    >
                      <Image
                        src={photoPreview || currentPhotoUrl || ''}
                        alt="Player photo"
                        fill
                        className="object-cover cursor-pointer"
                      />

                      {/* Hover preview - using fixed positioning - 3x larger (576px) */}
                      <div className="preview-popup fixed z-[9999] pointer-events-none opacity-0 transition-opacity duration-200">
                        <div className="relative w-[36rem] h-[36rem] rounded-lg overflow-hidden border-4 border-primary shadow-2xl bg-background">
                          <Image
                            src={photoPreview || currentPhotoUrl || ''}
                            alt="Player photo preview"
                            fill
                            className="object-cover"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    {photoFile || player.photoFileName ? 'Cambiar Foto' : 'Subir Foto'}
                  </Button>

                  {(photoFile || player.photoFileName) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => {
                        if (photoFile) {
                          setPhotoFile(null);
                          setPhotoPreview(null);
                        } else {
                          handleRemovePhoto();
                        }
                      }}
                      disabled={isUploadingPhoto}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Quitar
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  {currentPhotoUrl && (
                    <div
                      className="relative w-8 h-8 rounded overflow-hidden border border-primary/50 group"
                      onClick={(e) => e.stopPropagation()}
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const preview = e.currentTarget.querySelector('.preview-popup') as HTMLElement;
                        if (preview) {
                          preview.style.left = `${rect.right + 8}px`;
                          preview.style.top = `${rect.top + rect.height / 2}px`;
                          preview.style.transform = 'translateY(-50%)';
                          preview.style.opacity = '1';
                        }
                      }}
                      onMouseLeave={(e) => {
                        const preview = e.currentTarget.querySelector('.preview-popup') as HTMLElement;
                        if (preview) {
                          preview.style.opacity = '0';
                        }
                      }}
                    >
                      <Image
                        src={currentPhotoUrl}
                        alt="Player photo"
                        fill
                        className="object-cover cursor-pointer"
                      />

                      {/* Hover preview - using fixed positioning - 3x larger (576px) */}
                      <div className="preview-popup fixed z-[9999] pointer-events-none opacity-0 transition-opacity duration-200">
                        <div className="relative w-[36rem] h-[36rem] rounded-lg overflow-hidden border-4 border-primary shadow-2xl bg-background">
                          <Image
                            src={currentPhotoUrl}
                            alt="Player photo preview"
                            fill
                            className="object-cover"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <p className={`font-semibold truncate ${hasDuplicateNumber && player.number ? 'text-red-500' : 'text-card-foreground'}`}>
                    {displayPlayerNumber} - {player.name}
                  </p>
                </div>
              </>
            )}
            <p className="text-xs text-muted-foreground capitalize">
              {player.type === "goalkeeper" ? "Arquero" : "Jugador"}
            </p>
          </div>
        </div>

        <div className="flex gap-1 shrink-0">
          {!isReadOnly && (
            isEditing ? (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-600" onClick={handleSave} aria-label="Guardar cambios">
                  <CheckCircle className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={handleCancel} aria-label="Cancelar edición">
                  <XCircle className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="icon" className="text-primary hover:text-primary/80 h-8 w-8" onClick={handleEdit} aria-label={`Editar jugador ${player.name}`}>
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive h-8 w-8"
                  onClick={() => onRemovePlayer(player.id)}
                  aria-label={`Eliminar jugador ${player.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
