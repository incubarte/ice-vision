
"use client";

import React, { useEffect, useRef } from 'react';
import { useGameState, DEFAULT_HORN_SOUND_PATH, DEFAULT_PENALTY_BEEP_PATH } from '@/contexts/game-state-context';
import { useToast } from '@/hooks/use-toast';
import { usePathname } from 'next/navigation';

export function SoundPlayer() {
  const { state, isLoading } = useGameState();
  const { toast } = useToast();
  const pathname = usePathname();
  const isScoreboardPage = pathname === '/' || pathname === '/scoreboard';

  const hornAudioRef = useRef<HTMLAudioElement | null>(null);
  const penaltyAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Use a ref to track the previous value of the triggers
  const prevHornTriggerRef = useRef<number>();
  const prevBeepTriggerRef = useRef<number>();

  useEffect(() => {
    if (isLoading || !state.config || !state.live) {
      return;
    }

    const { playSoundAtPeriodEnd, enablePenaltyCountdownSound } = state.config;
    const { playHornTrigger, playPenaltyBeepTrigger } = state.live;
    
    // --- Horn Sound Logic ---
    if (prevHornTriggerRef.current !== undefined && playHornTrigger > prevHornTriggerRef.current) {
      if (playSoundAtPeriodEnd && hornAudioRef.current && typeof document !== 'undefined' && !document.hidden) {
        hornAudioRef.current.currentTime = 0;
        hornAudioRef.current.play().catch(error => {
          console.warn("Playback prevented for horn sound:", error);
          if (!isScoreboardPage) {
            toast({
              title: "Error de Sonido de Bocina",
              description: "El navegador impidió la reproducción automática del sonido.",
              variant: "destructive"
            });
          }
        });
      }
    }
    
    // --- Penalty Beep Logic ---
    if (prevBeepTriggerRef.current !== undefined && playPenaltyBeepTrigger > prevBeepTriggerRef.current) {
        if (enablePenaltyCountdownSound && penaltyAudioRef.current && typeof document !== 'undefined' && !document.hidden) {
            penaltyAudioRef.current.currentTime = 0;
            penaltyAudioRef.current.play().catch(error => {
                console.warn("Playback prevented for penalty beep:", error);
                if (!isScoreboardPage) {
                  toast({
                    title: "Error de Sonido de Beep",
                    description: "El navegador impidió la reproducción automática del sonido.",
                    variant: "destructive"
                  });
                }
            });
        }
    }

    // Update the refs with the current values for the next render
    prevHornTriggerRef.current = playHornTrigger;
    prevBeepTriggerRef.current = playPenaltyBeepTrigger;
    
  }, [
    state.live?.playHornTrigger, 
    state.live?.playPenaltyBeepTrigger,
    state.config, 
    isLoading,
    toast
  ]);


  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>, soundName: string) => {
    const error = e.currentTarget.error;
    if (!error) return;

    let errorMessage = `Código de error: ${error.code}.`;
    switch (error.code) {
      case error.MEDIA_ERR_ABORTED:
        errorMessage = 'La carga de audio fue abortada.';
        break;
      case error.MEDIA_ERR_NETWORK:
        errorMessage = 'Ocurrió un error de red al cargar el audio.';
        break;
      case error.MEDIA_ERR_DECODE:
        errorMessage = 'El archivo de audio está corrupto o no es soportado.';
        break;
      case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
        errorMessage = 'No se encontró o no se soporta el archivo de audio. Verifica que exista en la carpeta /public.';
        break;
      default:
        errorMessage = 'Ocurrió un error desconocido al cargar el audio.';
        break;
    }

    // Usar console.warn en lugar de console.error en la página del scoreboard
    // para evitar que Next.js muestre el overlay de error
    if (isScoreboardPage) {
      console.warn(`Error de Audio (${soundName}):`, error.message, e.currentTarget.src);
    } else {
      console.error(`Error de Audio (${soundName}):`, error.message, e.currentTarget.src);
      toast({
          title: `Error de Sonido (${soundName})`,
          description: errorMessage,
          variant: "destructive"
      });
    }
  };

  if (isLoading || !state.config) {
    return null;
  }

  const hornSoundSrc = state.config.customHornSoundDataUrl || DEFAULT_HORN_SOUND_PATH;
  const penaltyBeepSoundSrc = state.config.customPenaltyBeepSoundDataUrl || DEFAULT_PENALTY_BEEP_PATH;

  return (
    <>
      <audio 
        ref={hornAudioRef} 
        src={hornSoundSrc} 
        preload="auto"
        onError={(e) => handleAudioError(e, 'Bocina')} 
      />
      <audio 
        ref={penaltyAudioRef} 
        src={penaltyBeepSoundSrc} 
        preload="auto" 
        onError={(e) => handleAudioError(e, 'Beep Penalidad')}
      />
    </>
  );
}
