
"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from "react";
import { useGameState, DEFAULT_HORN_SOUND_PATH } from "@/contexts/game-state-context";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { UploadCloud, XCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface SoundSettingsCardRef {
  handleSave: () => boolean;
  handleDiscard: () => void;
  getIsDirty: () => boolean;
}

interface SoundSettingsCardProps {
  onDirtyChange: (isDirty: boolean) => void;
}

export const SoundSettingsCard = forwardRef<SoundSettingsCardRef, SoundSettingsCardProps>((props, ref) => {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const { onDirtyChange } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [localPlaySound, setLocalPlaySound] = useState(state.config.playSoundAtPeriodEnd);
  const [localCustomSoundDataUrl, setLocalCustomSoundDataUrl] = useState(state.config.customHornSoundDataUrl);
  const [customSoundFileName, setCustomSoundFileName] = useState<string | null>(null);
  const [localEnableOlympiaTransition, setLocalEnableOlympiaTransition] = useState(state.config.enableOlympiaTransition);
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);

  useEffect(() => {
    onDirtyChange(isDirtyLocal);
  }, [isDirtyLocal, onDirtyChange]);

  useEffect(() => {
     if (!isDirtyLocal) {
      setLocalPlaySound(state.config.playSoundAtPeriodEnd);
      setLocalCustomSoundDataUrl(state.config.customHornSoundDataUrl);
      setCustomSoundFileName(null);
      setLocalEnableOlympiaTransition(state.config.enableOlympiaTransition);
    }
  }, [state.config.playSoundAtPeriodEnd, state.config.customHornSoundDataUrl, state.config.enableOlympiaTransition, isDirtyLocal]);

  const markDirty = () => setIsDirtyLocal(true);

  useImperativeHandle(ref, () => ({
    handleSave: () => {
      if (!isDirtyLocal) return true;

      dispatch({
        type: "UPDATE_CONFIG_FIELDS",
        payload: {
          playSoundAtPeriodEnd: localPlaySound,
          customHornSoundDataUrl: localCustomSoundDataUrl,
          enableOlympiaTransition: localEnableOlympiaTransition,
        }
      });

      setIsDirtyLocal(false);
      return true;
    },
    handleDiscard: () => {
      setLocalPlaySound(state.config.playSoundAtPeriodEnd);
      setLocalCustomSoundDataUrl(state.config.customHornSoundDataUrl);
      setCustomSoundFileName(null);
      setLocalEnableOlympiaTransition(state.config.enableOlympiaTransition);
      setIsDirtyLocal(false);
    },
    getIsDirty: () => isDirtyLocal,
  }));

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      toast({
        title: "Archivo no Soportado",
        description: "Por favor, selecciona un archivo de audio (ej. MP3, WAV, OGG).",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
         toast({
            title: "Archivo Demasiado Grande",
            description: "El tamaño máximo del archivo de sonido es 2MB.",
            variant: "destructive",
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setLocalCustomSoundDataUrl(dataUrl);
      setCustomSoundFileName(file.name);
      markDirty();
      toast({
        title: "Sonido Personalizado Cargado",
        description: `"${file.name}" listo para usar. Guarda los cambios.`,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleClearCustomSound = () => {
    setLocalCustomSoundDataUrl(null);
    setCustomSoundFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    markDirty();
    toast({
      title: "Sonido Personalizado Eliminado",
      description: "Se usará el sonido predeterminado. Guarda los cambios.",
    });
  };

  const currentSoundDisplayName = 
    localCustomSoundDataUrl 
      ? (customSoundFileName || "Sonido Personalizado Cargado")
      : `Predeterminado (${DEFAULT_HORN_SOUND_PATH.split('/').pop() || 'default-horn.wav'})`;

  return (
    <ControlCardWrapper title="Configuración de Sonido y Display">
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-md bg-muted/20">
          <Label htmlFor="playSoundSwitch" className="flex flex-col space-y-1">
            <span>Reproducir Sonido al Final del Período</span>
            <span className="font-normal leading-snug text-muted-foreground text-xs">
              Activa para escuchar una bocina cuando el reloj de período, descanso o timeout llega a cero.
            </span>
          </Label>
          <Switch
            id="playSoundSwitch"
            checked={localPlaySound}
            onCheckedChange={(checked) => { setLocalPlaySound(checked); markDirty(); }}
          />
        </div>

        <div className="flex items-center justify-between p-4 border rounded-md bg-muted/20">
          <Label htmlFor="olympiaTransitionSwitch" className="flex flex-col space-y-1">
            <span>Transición del Olympia</span>
            <span className="font-normal leading-snug text-muted-foreground text-xs">
              Muestra la animación del Olympia al terminar el warmup. Desactiva si hay problemas de rendimiento.
            </span>
          </Label>
          <Switch
            id="olympiaTransitionSwitch"
            checked={localEnableOlympiaTransition}
            onCheckedChange={(checked) => { setLocalEnableOlympiaTransition(checked); markDirty(); }}
          />
        </div>

        <div className="space-y-3 p-4 border rounded-md bg-muted/20">
          <Label htmlFor="customSoundFile" className="text-base font-medium">Sonido de Bocina Personalizado</Label>
          
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-grow min-w-0">
              <span>Sonido actual:</span>
              <span className="font-semibold text-card-foreground truncate max-w-[160px] xs:max-w-[200px] sm:max-w-xs md:max-w-sm" title={currentSoundDisplayName}>
                {currentSoundDisplayName}
              </span>
              <TooltipProvider>
                  <Tooltip>
                      <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                          <p>
                           El sonido predeterminado requiere que el archivo <code>{DEFAULT_HORN_SOUND_PATH}</code> exista en la carpeta <code>public</code> de tu aplicación.
                           Si no está, o para usar tu propio sonido, cárgalo a continuación.
                          </p>
                      </TooltipContent>
                  </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className="flex gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="h-9">
                <UploadCloud className="mr-2 h-4 w-4" /> Cargar Sonido (max 2MB)
              </Button>
              {localCustomSoundDataUrl && (
                <Button type="button" variant="destructive" onClick={handleClearCustomSound} className="h-9">
                  <XCircle className="mr-2 h-4 w-4" /> Usar Predeterminado
                </Button>
              )}
            </div>
          </div>
          
          <Input
            id="customSoundFile"
            type="file"
            accept="audio/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <p className="text-xs text-muted-foreground pt-1">
            Formatos recomendados: MP3, WAV, OGG. Si no cargas uno, se intentará usar el predeterminado.
          </p>
        </div>
      </div>
    </ControlCardWrapper>
  );
});

SoundSettingsCard.displayName = "SoundSettingsCard";
