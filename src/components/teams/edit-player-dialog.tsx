"use client";

import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Video, Lock, Unlock } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);
    const [celebrationMediaType, setCelebrationMediaType] = useState<'photo' | 'video' | 'none'>(player.celebrationMediaType ?? 'none');
    const [celebrationUnlocked, setCelebrationUnlocked] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordError, setPasswordError] = useState(false);
    const [showPasswordInput, setShowPasswordInput] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

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
            setVideoFile(null);
            setCelebrationMediaType(player.celebrationMediaType ?? 'none');
            setCelebrationUnlocked(false);
            setPasswordInput('');
            setPasswordError(false);
            setShowPasswordInput(false);
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

    const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'video/webm') {
            toast({ title: "Archivo Inválido", description: "Por favor selecciona un archivo .webm.", variant: "destructive" });
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            toast({ title: "Archivo Muy Grande", description: "El video no debe superar los 50MB.", variant: "destructive" });
            return;
        }

        setVideoFile(file);
    };

    const handleRemoveVideo = async () => {
        if (!player.celebrationVideoFileName) return;

        const sanitizedTeamName = teamName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        const filePath = `tournaments/${tournamentId}/players/${sanitizedTeamName}/${player.celebrationVideoFileName}`;

        try {
            const response = await fetch(`/api/storage/player-video?path=${encodeURIComponent(filePath)}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete video');

            dispatch({
                type: "UPDATE_PLAYER_IN_TEAM",
                payload: { teamId, playerId: player.id, updates: { celebrationVideoFileName: undefined } }
            });

            toast({ title: "Video Eliminado", description: "El video de celebración ha sido eliminado." });
        } catch (error) {
            console.error('Error deleting video:', error);
            toast({ title: "Error", description: "No se pudo eliminar el video.", variant: "destructive" });
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

        const updates: Partial<Pick<PlayerData, 'name' | 'number' | 'photoFileName' | 'celebrationVideoFileName' | 'celebrationMediaType'>> = {};
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

        // Handle video upload
        if (videoFile) {
            setIsUploadingVideo(true);
            try {
                const formData = new FormData();
                formData.append('file', videoFile);
                formData.append('tournamentId', tournamentId);
                formData.append('teamName', teamName);
                formData.append('playerName', trimmedName);

                const response = await fetch('/api/storage/player-video', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) throw new Error('Failed to upload video');

                const data = await response.json();
                updates.celebrationVideoFileName = data.fileName;
                changesMade = true;

                // Delete old video if exists
                if (player.celebrationVideoFileName) {
                    const sanitizedTeamName = teamName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                    const oldFilePath = `tournaments/${tournamentId}/players/${sanitizedTeamName}/${player.celebrationVideoFileName}`;
                    await fetch(`/api/storage/player-video?path=${encodeURIComponent(oldFilePath)}`, {
                        method: 'DELETE',
                    }).catch(console.error);
                }
            } catch (error) {
                console.error('Error uploading video:', error);
                toast({ title: "Error", description: "No se pudo subir el video.", variant: "destructive" });
                setIsUploadingVideo(false);
                setIsSaving(false);
                return;
            } finally {
                setIsUploadingVideo(false);
            }
        }

        // Save celebrationMediaType only if the section was unlocked and value changed
        if (celebrationUnlocked && celebrationMediaType !== player.celebrationMediaType) {
            updates.celebrationMediaType = celebrationMediaType;
            changesMade = true;
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

                    {/* Video Section */}
                    <div className="space-y-2">
                        <Label>Video de Celebración (.webm)</Label>
                        <div className="flex items-center gap-4">
                            {videoFile && (
                                <div className="text-sm text-muted-foreground bg-muted rounded px-3 py-2">
                                    <Video className="h-4 w-4 inline mr-2" />
                                    {videoFile.name}
                                </div>
                            )}
                            {!videoFile && player.celebrationVideoFileName && (
                                <div className="text-sm text-muted-foreground bg-muted rounded px-3 py-2">
                                    <Video className="h-4 w-4 inline mr-2" />
                                    {player.celebrationVideoFileName}
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <input
                                    ref={videoInputRef}
                                    type="file"
                                    accept="video/webm"
                                    onChange={handleVideoSelect}
                                    className="hidden"
                                />

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => videoInputRef.current?.click()}
                                    disabled={isUploadingVideo || isSaving}
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    {videoFile || player.celebrationVideoFileName ? 'Cambiar Video' : 'Subir Video'}
                                </Button>

                                {(videoFile || player.celebrationVideoFileName) && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => {
                                            if (videoFile) {
                                                setVideoFile(null);
                                            } else {
                                                handleRemoveVideo();
                                            }
                                        }}
                                        disabled={isUploadingVideo || isSaving}
                                    >
                                        <X className="h-4 w-4 mr-2" />
                                        Quitar Video
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Celebration config — password protected */}
                    <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2">
                                {celebrationUnlocked
                                    ? <Unlock className="h-4 w-4 text-green-500" />
                                    : <Lock className="h-4 w-4 text-muted-foreground" />
                                }
                                Celebración de gol
                            </Label>
                            {!celebrationUnlocked && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowPasswordInput(v => !v)}
                                >
                                    {showPasswordInput ? 'Cancelar' : 'Desbloquear'}
                                </Button>
                            )}
                        </div>

                        {/* Current value (read-only when locked) */}
                        {!celebrationUnlocked && (
                            <p className="text-sm text-muted-foreground">
                                {{
                                    none: 'No mostrar nada',
                                    photo: 'Mostrar foto',
                                    video: 'Mostrar video',
                                }[celebrationMediaType]}
                            </p>
                        )}

                        {/* Password input */}
                        {!celebrationUnlocked && showPasswordInput && (
                            <div className="flex gap-2 mt-2">
                                <Input
                                    type="password"
                                    placeholder="Contraseña"
                                    value={passwordInput}
                                    onChange={(e) => {
                                        setPasswordInput(e.target.value);
                                        setPasswordError(false);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            if (btoa(passwordInput) === 'SUNFX1ZJU0lPTl8yNg==') {
                                                setCelebrationUnlocked(true);
                                                setShowPasswordInput(false);
                                                setPasswordInput('');
                                                setPasswordError(false);
                                            } else {
                                                setPasswordError(true);
                                            }
                                        }
                                    }}
                                    className={passwordError ? 'border-destructive' : ''}
                                    autoFocus
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                        if (btoa(passwordInput) === 'SUNFX1ZJU0lPTl8yNg==') {
                                            setCelebrationUnlocked(true);
                                            setShowPasswordInput(false);
                                            setPasswordInput('');
                                            setPasswordError(false);
                                        } else {
                                            setPasswordError(true);
                                        }
                                    }}
                                >
                                    OK
                                </Button>
                            </div>
                        )}
                        {passwordError && (
                            <p className="text-xs text-destructive">Contraseña incorrecta</p>
                        )}

                        {/* Options — only when unlocked */}
                        {celebrationUnlocked && (
                            <RadioGroup
                                value={celebrationMediaType}
                                onValueChange={(v) => setCelebrationMediaType(v as 'photo' | 'video' | 'none')}
                                className="flex gap-4 mt-2"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="none" id="media-none" />
                                    <Label htmlFor="media-none">Nada</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="photo" id="media-photo" />
                                    <Label htmlFor="media-photo">Foto</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="video" id="media-video" />
                                    <Label htmlFor="media-video">Video</Label>
                                </div>
                            </RadioGroup>
                        )}
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
                        disabled={isSaving || isUploadingPhoto || isUploadingVideo}
                    >
                        {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
