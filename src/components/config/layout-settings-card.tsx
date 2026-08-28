
"use client";

import React, { useMemo, forwardRef, useImperativeHandle, useState, useEffect } from "react";
import { useGameState, type ScoreboardLayoutSettings } from "@/contexts/game-state-context";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { INITIAL_LAYOUT_SETTINGS } from "@/contexts/game-state-context";

// --- Color Conversion Helpers ---
function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0 0% 0%";

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return `${h} ${s}% ${l}%`;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  let c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs((h / 60) % 2 - 1)),
    m = l - c / 2,
    r = 0,
    g = 0,
    b = 0;

  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  const toHex = (c: number) => c.toString(16).padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
// --- End Color Conversion Helpers ---


const SliderControl = ({ label, value, onValueChange, min, max, step, unit = "rem" }: { label: string, value: number, onValueChange: (value: number) => void, min: number, max: number, step: number, unit?: string }) => (
  <div className="grid grid-cols-3 items-center gap-x-4">
    <Label className="text-sm whitespace-nowrap">{label}</Label>
    <Slider
      value={[value]}
      onValueChange={(v) => onValueChange(v[0])}
      min={min}
      max={max}
      step={step}
    />
    <span className="text-sm text-muted-foreground tabular-nums">{value.toFixed(unit === '%' ? 0 : 2)} {unit}</span>
  </div>
);

const ColorControl = ({ label, value, onValueChange, defaultValue }: { label: string, value: string, onValueChange: (value: string) => void, defaultValue: string }) => {
  const hexValue = useMemo(() => {
    try {
      const [h, s, l] = value.split(" ").map(v => parseFloat(v.replace('%', '')));
      return hslToHex(h, s, l);
    } catch (e) {
      return '#000000';
    }
  }, [value]);

  const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHex = e.target.value;
    onValueChange(hexToHsl(newHex));
  };

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 sm:gap-x-4">
      <Label className="text-sm whitespace-nowrap">{label}</Label>
      <input
        type="color"
        value={hexValue}
        onChange={handleColorInputChange}
        className="w-10 h-10 p-0 border-none rounded-md cursor-pointer bg-transparent"
        title="Hacer clic para cambiar color"
      />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onValueChange(defaultValue)}
            >
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Restablecer color por defecto</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export interface LayoutSettingsCardRef {
  handleSave: () => boolean;
  handleDiscard: () => void;
}

interface LayoutSettingsCardProps {
  initialValues: ScoreboardLayoutSettings;
}

export const LayoutSettingsCard = forwardRef<LayoutSettingsCardRef, LayoutSettingsCardProps>((props, ref) => {
  const { state, dispatch } = useGameState();
  const { scoreboardLayout, selectedScoreboardLayoutProfileId } = state.config;

  const handleValueChange = (key: keyof ScoreboardLayoutSettings, value: number | string | boolean) => {
    dispatch({ type: 'UPDATE_LAYOUT_SETTINGS', payload: { [key]: value } });
  };

  useImperativeHandle(ref, () => ({
    handleSave: () => {
      dispatch({ type: 'SAVE_CURRENT_LAYOUT_TO_PROFILE' });
      return true;
    },
    handleDiscard: () => {
      if (selectedScoreboardLayoutProfileId) {
        dispatch({ type: 'SELECT_SCOREBOARD_LAYOUT_PROFILE', payload: { profileId: selectedScoreboardLayoutProfileId } });
      }
    }
  }));

  const showShotsInHeader = scoreboardLayout.showShotsInHeader ?? INITIAL_LAYOUT_SETTINGS.showShotsInHeader;
  const shotsInHeaderSize = scoreboardLayout.shotsInHeaderSize ?? INITIAL_LAYOUT_SETTINGS.shotsInHeaderSize;
  const standingsFontSize = scoreboardLayout.standingsTableFontSize ?? INITIAL_LAYOUT_SETTINGS.standingsTableFontSize;
  const standingsRowHeight = scoreboardLayout.standingsTableRowHeight ?? INITIAL_LAYOUT_SETTINGS.standingsTableRowHeight;

  const penaltyTextColor = scoreboardLayout.penaltyTextColor ?? INITIAL_LAYOUT_SETTINGS.penaltyTextColor;
  const teamLogoSize = scoreboardLayout.teamLogoSize ?? INITIAL_LAYOUT_SETTINGS.teamLogoSize;
  const penaltyGap = scoreboardLayout.penaltyGap ?? INITIAL_LAYOUT_SETTINGS.penaltyGap;
  const penaltyBottomMargin = scoreboardLayout.penaltyBottomMargin ?? INITIAL_LAYOUT_SETTINGS.penaltyBottomMargin;
  const scoreNumberStrokeWidth = scoreboardLayout.scoreNumberStrokeWidth ?? INITIAL_LAYOUT_SETTINGS.scoreNumberStrokeWidth;

  return (
    <ControlCardWrapper title="Diseño del Scoreboard (Vista Previa en Vivo)">
      <div className="space-y-6">

        {/* Datos de equipo */}
        <div>
          <h4 className="text-base font-semibold mb-3">Datos de Equipo</h4>
          <div className="space-y-4">
            <SliderControl label="Posición vertical" value={scoreboardLayout.scoreboardVerticalPosition} onValueChange={(v) => handleValueChange('scoreboardVerticalPosition', v)} min={-4} max={20} step={0.5} />
            <SliderControl label="Logo (tamaño)" value={teamLogoSize} onValueChange={(v) => handleValueChange('teamLogoSize', v)} min={4} max={24} step={0.5} />
            <SliderControl label="Nombre (tamaño)" value={scoreboardLayout.teamNameSize} onValueChange={(v) => handleValueChange('teamNameSize', v)} min={1.5} max={10} step={0.1} />
            <SliderControl label="Nombre (ancho máx.)" value={scoreboardLayout.teamNameWidth} onValueChange={(v) => handleValueChange('teamNameWidth', v)} min={8} max={60} step={0.5} />
            <SliderControl label="Iconos Jugadores" value={scoreboardLayout.playersOnIceIconSize} onValueChange={(v) => handleValueChange('playersOnIceIconSize', v)} min={1} max={4} step={0.1} />
            <div className="grid grid-cols-3 items-center gap-x-4">
              <Label className="text-sm whitespace-nowrap">Mostrar tiros</Label>
              <div className="col-span-2">
                <button
                  onClick={() => handleValueChange('showShotsInHeader', !showShotsInHeader)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${showShotsInHeader ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  {showShotsInHeader ? 'Visible' : 'Oculto'}
                </button>
              </div>
            </div>
            {showShotsInHeader && (
              <SliderControl label="Tiros (tamaño)" value={shotsInHeaderSize!} onValueChange={(v) => handleValueChange('shotsInHeaderSize', v)} min={3} max={5} step={0.1} />
            )}
          </div>
        </div>

        {/* General */}
        <div className="border-t pt-6">
          <h4 className="text-base font-semibold mb-3">General</h4>
          <div className="space-y-4">
            <SliderControl label="Pantalla — Desplazar horizontal" value={scoreboardLayout.scoreboardHorizontalPosition} onValueChange={(v) => handleValueChange('scoreboardHorizontalPosition', v)} min={-20} max={20} step={0.5} />
            <SliderControl label="Categoría Partido" value={scoreboardLayout.categorySize} onValueChange={(v) => handleValueChange('categorySize', v)} min={0.75} max={3} step={0.05} />
            <SliderControl label="Reloj (tamaño)" value={scoreboardLayout.clockSize} onValueChange={(v) => handleValueChange('clockSize', v)} min={6} max={32} step={0.5} />
            <SliderControl label="Período" value={scoreboardLayout.periodSize} onValueChange={(v) => handleValueChange('periodSize', v)} min={2} max={8} step={0.1} />
            <SliderControl label="Logo del Torneo (tamaño)" value={scoreboardLayout.scoreSize} onValueChange={(v) => handleValueChange('scoreSize', v)} min={4} max={12} step={0.25} />
            <SliderControl label="Goles — Borde (grosor)" value={scoreNumberStrokeWidth} onValueChange={(v) => handleValueChange('scoreNumberStrokeWidth', v)} min={0} max={2} step={0.05} unit="u" />
          </div>
        </div>

        {/* Penalidades */}
        <div className="border-t pt-6">
          <h4 className="text-base font-semibold mb-3">Penalidades</h4>
          <div className="space-y-4">
            <SliderControl label="Nº Jugador (tamaño)" value={scoreboardLayout.penaltyPlayerNumberSize} onValueChange={(v) => handleValueChange('penaltyPlayerNumberSize', v)} min={1.5} max={14} step={0.1} />
            <SliderControl label="Tiempo (tamaño)" value={scoreboardLayout.penaltyTimeSize} onValueChange={(v) => handleValueChange('penaltyTimeSize', v)} min={1.5} max={14} step={0.1} />
            <SliderControl label="Espacio entre penalidades" value={penaltyGap} onValueChange={(v) => handleValueChange('penaltyGap', v)} min={0} max={6} step={0.25} />
            <SliderControl label="Margen inferior" value={penaltyBottomMargin} onValueChange={(v) => handleValueChange('penaltyBottomMargin', v)} min={0} max={12} step={0.25} />
            <SliderControl label="Icono Jugador" value={scoreboardLayout.penaltyPlayerIconSize} onValueChange={(v) => handleValueChange('penaltyPlayerIconSize', v)} min={1} max={5} step={0.1} />
            <ColorControl label="Color texto penalidades" value={penaltyTextColor} onValueChange={(v) => handleValueChange('penaltyTextColor', v)} defaultValue={INITIAL_LAYOUT_SETTINGS.penaltyTextColor} />
          </div>
        </div>

        {/* Tabla de posiciones */}
        <div className="border-t pt-6">
          <h4 className="text-base font-semibold mb-3">Tabla de Posiciones</h4>
          <div className="space-y-4">
            <SliderControl label="Fuente" value={standingsFontSize} onValueChange={(v) => handleValueChange('standingsTableFontSize', v)} min={0.5} max={3} step={0.05} />
            <SliderControl label="Alto Fila" value={standingsRowHeight} onValueChange={(v) => handleValueChange('standingsTableRowHeight', v)} min={2} max={6} step={0.25} />
          </div>
        </div>

        {/* Colores */}
        <div className="border-t pt-6">
          <h4 className="text-base font-semibold mb-3">Colores y Opacidad</h4>
          <div className="space-y-3">
            <ColorControl label="Color de Fondo" value={scoreboardLayout.backgroundColor} onValueChange={(v) => handleValueChange('backgroundColor', v)} defaultValue={INITIAL_LAYOUT_SETTINGS.backgroundColor} />
            <ColorControl label="Color Primario" value={scoreboardLayout.primaryColor} onValueChange={(v) => handleValueChange('primaryColor', v)} defaultValue={INITIAL_LAYOUT_SETTINGS.primaryColor} />
            <ColorControl label="Color de Acento" value={scoreboardLayout.accentColor} onValueChange={(v) => handleValueChange('accentColor', v)} defaultValue={INITIAL_LAYOUT_SETTINGS.accentColor} />
            <SliderControl label="Opacidad Logo de Fondo" value={scoreboardLayout.teamLogoOpacity} onValueChange={(v) => handleValueChange('teamLogoOpacity', v)} min={0} max={100} step={1} unit="%" />
            <SliderControl label="Foto Jugador (Gol)" value={scoreboardLayout.goalCelebrationPhotoSize ?? 40} onValueChange={(v) => handleValueChange('goalCelebrationPhotoSize', v)} min={20} max={80} step={2} />
          </div>
        </div>

      </div>
    </ControlCardWrapper>
  );
});
LayoutSettingsCard.displayName = "LayoutSettingsCard";
