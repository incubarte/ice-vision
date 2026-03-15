"use client";

import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X } from "lucide-react";
import { useGameState } from "@/contexts/game-state-context";
import { useToast } from "@/hooks/use-toast";
import type { PlayerData } from "@/types";
import Image from "next/image";

interface EditPlayerDialogProps {
    player: PlayerData;
    teamId: string;
    tournamentId: string;
    teamName: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditPlayerDialog({
    player,
    teamId,
    tournamentId,
    teamName,
    isOpen,
    onOpenChange
}: EditPlayerDialogProps) {
    const { state, dispatch } = useGameState();
    const { toast } = useToast();

    const [editableName, setEditableName] = useState(player.name);
    const [editableNumber, setEditableNumber] = useState(player.number);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Get current photo URL
    const currentPhotoUrl = player.photoFileName
        ? `/api/storage/read?path=${encodeURIComponent(`tournaments/${tournamentId}/players/${teamName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}/${player.photoFileName}`)}`
        : null;

    // Reset form when dialog opens
    useEffect(() => {
        if (isOpen) {
            setEditableName(player.name);
            setEditableNumber(player.number);
            setPhotoFile(null);
            setPhotoPreview(null);
        }
    }, [isOpen, player]);

    const compressImage = (file: File): Promise<File> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

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

                    const isPNG = file.type === 'image/png';
                    if (!isPNG) {
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, width, height);
                    }

                    ctx.drawImage(img, 0, 0, width, height);

                    const outputType = isPNG ? 'image/png' : 'image/jpeg';
                    const quality = isPNG ? 0.9 : 0.8;

                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error('Could not compress image'));
                                return;
                            }

                            const extension = isPNG ? 'png' : 'jpg';
                            const fileName = file.name.replace(/\.[^/.]+$/, `.${extension}`);

                            const compressedFile = new File([blob], fileName, {
                                type: outputType,
                                lastModified: Date.now(),
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
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast({ title: "Archivo Inválido", description: "Por favor selecciona una imagen.", variant: "destructive" });
            return;
        }

        try {
            const compressedFile = await compressImage(file);

            if (compressedFile.size > 5 * 1024 * 1024) {
                toast({ title: "Archivo Muy Grande", description: "La imagen no debe superar los 5MB después de la compresión.", variant: "destructive" });
                return;
            }

            setPhotoFile(compressedFile);

            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoPreview(reader.result as string);
            };
            reader.readAsDataURL(compressedFile);
        } catch (error) {
            console.error('Error compressing image:', error);
            toast({ title: "Error", description: "No se pudo procesar la imagen.", variant: "destructive" });
        }
    };

    const handleRemovePhoto = async () => {
        if (!player.photoFileName) return;

        const sanitizedTeamName = teamName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        const filePath = `tournaments/${tournamentId}/players/${sanitizedTeamName}/${player.photoFileName}`;

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
        const trimmedName = editableName.trim();
        const trimmedNumber = editableNumber.trim();

        if (!trimmedName) {
            toast({ title: "Nombre Requerido", description: "El nombre no puede estar vacío.", variant: "destructive" });
            return;
        }

        if (trimmedNumber && !/^\d+$/.test(trimmedNumber)) {
            toast({ title: "Número Inválido", description: "El número solo debe contener dígitos.", variant: "destructive" });
            return;
        }

        // Check for duplicate number
        const tournament = state.config.activeTournament;
        const team = tournament?.teams.find(t => t.id === teamId);
        if (team && trimmedNumber && team.players.some(p => p.id !== player.id && p.number === trimmedNumber)) {
            toast({
                title: "Número Duplicado",
                description: `El número #${trimmedNumber} ya existe en este equipo.`,
                variant: "destructive",
            });
            return;
        }

        setIsSaving(true);

        const updates: Partial<Pick<PlayerData, 'name' | 'number' | 'photoFileName'>> = {};
        let changesMade = false;

        if (trimmedName !== player.name) {
            updates.name = trimmedName;
            changesMade = true;
        }

        if (trimmedNumber !== player.number) {
            updates.number = trimmedNumber;
            changesMade = true;
        }

        // Handle photo upload
        if (photoFile) {
            setIsUploadingPhoto(true);
            try {
                const formData = new FormData();
                formData.append('file', photoFile);
                formData.append('tournamentId', tournamentId);
                formData.append('teamName', teamName);
                formData.append('playerName', trimmedName);

                const response = await fetch('/api/storage/player-photo', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) throw new Error('Failed to upload photo');

                const data = await response.json();
                updates.photoFileName = data.fileName;
                changesMade = true;

                // Delete old photo if exists
                if (player.photoFileName) {
                    const sanitizedTeamName = teamName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                    const oldFilePath = `tournaments/${tournamentId}/players/${sanitizedTeamName}/${player.photoFileName}`;
                    await fetch(`/api/storage/player-photo?path=${encodeURIComponent(oldFilePath)}`, {
                        method: 'DELETE',
                    }).catch(console.error);
                }
            } catch (error) {
                console.error('Error uploading photo:', error);
                toast({ title: "Error", description: "No se pudo subir la foto.", variant: "destructive" });
                setIsUploadingPhoto(false);
                setIsSaving(false);
                return;
            } finally {
                setIsUploadingPhoto(false);
            }
        }

        if (changesMade) {
            dispatch({ type: "UPDATE_PLAYER_IN_TEAM", payload: { teamId, playerId: player.id, updates } });
            toast({ title: "Jugador Actualizado", description: `${trimmedName} ha sido actualizado.` });
        }

        setIsSaving(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Editar Jugador</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Photo Section */}
                    <div className="space-y-2">
                        <Label>Foto del Jugador</Label>
                        <div className="flex items-center gap-4">
                            {(photoPreview || currentPhotoUrl) && (
                                <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-primary">
                                    <Image
                                        src={photoPreview || currentPhotoUrl || ''}
                                        alt="Player photo"
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoSelect}
                                    className="hidden"
                                />

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploadingPhoto || isSaving}
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    {photoFile || player.photoFileName ? 'Cambiar Foto' : 'Subir Foto'}
                                </Button>

                                {(photoFile || player.photoFileName) && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => {
                                            if (photoFile) {
                                                setPhotoFile(null);
                                                setPhotoPreview(null);
                                            } else {
                                                handleRemovePhoto();
                                            }
                                        }}
                                        disabled={isUploadingPhoto || isSaving}
                                    >
                                        <X className="h-4 w-4 mr-2" />
                                        Quitar Foto
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Number */}
                    <div className="space-y-2">
                        <Label htmlFor="number">Número</Label>
                        <Input
                            id="number"
                            type="text"
                            inputMode="numeric"
                            value={editableNumber}
                            onChange={(e) => {
                                if (/^\d*$/.test(e.target.value)) {
                                    setEditableNumber(e.target.value);
                                }
                            }}
                            placeholder="S/N"
                            disabled={isSaving}
                        />
                    </div>

                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input
                            id="name"
                            type="text"
                            value={editableName}
                            onChange={(e) => setEditableName(e.target.value)}
                            placeholder="Nombre del jugador"
                            disabled={isSaving}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || isUploadingPhoto}
                    >
                        {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
