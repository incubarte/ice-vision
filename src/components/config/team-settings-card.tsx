

"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useGameState } from "@/contexts/game-state-context";
import type { ConfigState } from "@/types";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface TeamSettingsCardRef {
  handleSave: () => boolean;
  handleDiscard: () => void;
  getIsDirty: () => boolean;
}

interface TeamSettingsCardProps {
  onDirtyChange: (isDirty: boolean) => void;
}

export const TeamSettingsCard = forwardRef<TeamSettingsCardRef, TeamSettingsCardProps>((props, ref) => {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const { onDirtyChange } = props;

  const [localEnableTeamUsage, setLocalEnableTeamUsage] = useState(state.config.enableTeamSelectionInMiniScoreboard);
  const [localEnablePlayerSelection, setLocalEnablePlayerSelection] = useState(state.config.enablePlayerSelectionForPenalties);
  const [localShowAliasInSelector, setLocalShowAliasInSelector] = useState(state.config.showAliasInPenaltyPlayerSelector);
  const [localShowAliasInControlsList, setLocalShowAliasInControlsList] = useState(state.config.showAliasInControlsPenaltyList);
  const [localShowAliasInScoreboard, setLocalShowAliasInScoreboard] = useState(state.config.showAliasInScoreboardPenalties);
  const [localShowStandingsInWarmup, setLocalShowStandingsInWarmup] = useState(state.config.showStandingsInWarmup);
  const [localShowShotsData, setLocalShowShotsData] = useState(state.config.showShotsData);
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);

  useEffect(() => {
    onDirtyChange(isDirtyLocal);
  }, [isDirtyLocal, onDirtyChange]);
  
  useEffect(() => {
    if (!isDirtyLocal) {
      setLocalEnableTeamUsage(state.config.enableTeamSelectionInMiniScoreboard);
      setLocalEnablePlayerSelection(state.config.enablePlayerSelectionForPenalties);
      setLocalShowAliasInSelector(state.config.showAliasInPenaltyPlayerSelector);
      setLocalShowAliasInControlsList(state.config.showAliasInControlsPenaltyList);
      setLocalShowAliasInScoreboard(state.config.showAliasInScoreboardPenalties);
      setLocalShowStandingsInWarmup(state.config.showStandingsInWarmup);
      setLocalShowShotsData(state.config.showShotsData);
    }
  }, [
    state.config.enableTeamSelectionInMiniScoreboard,
    state.config.enablePlayerSelectionForPenalties,
    state.config.showAliasInPenaltyPlayerSelector,
    state.config.showAliasInControlsPenaltyList,
    state.config.showAliasInScoreboardPenalties,
    state.config.showStandingsInWarmup,
    state.config.showShotsData,
    isDirtyLocal,
  ]);

  const markDirty = () => setIsDirtyLocal(true);

  useImperativeHandle(ref, () => ({
    handleSave: () => {
      if (!isDirtyLocal) return true;
      
      const updates: Partial<ConfigState> = {};
      updates.enableTeamSelectionInMiniScoreboard = localEnableTeamUsage;

      if (localEnableTeamUsage) {
        updates.enablePlayerSelectionForPenalties = localEnablePlayerSelection;
        if (localEnablePlayerSelection) {
            updates.showAliasInPenaltyPlayerSelector = localShowAliasInSelector;
            updates.showAliasInControlsPenaltyList = localShowAliasInControlsList;
            updates.showAliasInScoreboardPenalties = localShowAliasInScoreboard;
        } else {
            updates.showAliasInPenaltyPlayerSelector = false;
            updates.showAliasInControlsPenaltyList = false;
            updates.showAliasInScoreboardPenalties = false;
        }
      } else {
        updates.enablePlayerSelectionForPenalties = false;
        updates.showAliasInPenaltyPlayerSelector = false;
        updates.showAliasInControlsPenaltyList = false;
        updates.showAliasInScoreboardPenalties = false;
      }

      updates.showStandingsInWarmup = localShowStandingsInWarmup;
      updates.showShotsData = localShowShotsData;

      dispatch({ type: "UPDATE_CONFIG_FIELDS", payload: updates });
      setIsDirtyLocal(false);
      return true; 
    },
    handleDiscard: () => {
      setLocalEnableTeamUsage(state.config.enableTeamSelectionInMiniScoreboard);
      setLocalEnablePlayerSelection(state.config.enablePlayerSelectionForPenalties);
      setLocalShowAliasInSelector(state.config.showAliasInPenaltyPlayerSelector);
      setLocalShowAliasInControlsList(state.config.showAliasInControlsPenaltyList);
      setLocalShowAliasInScoreboard(state.config.showAliasInScoreboardPenalties);
      setLocalShowStandingsInWarmup(state.config.showStandingsInWarmup);
      setLocalShowShotsData(state.config.showShotsData);
      setIsDirtyLocal(false);
    },
    getIsDirty: () => {
      if (localEnableTeamUsage !== state.config.enableTeamSelectionInMiniScoreboard) return true;
      if (localEnablePlayerSelection !== state.config.enablePlayerSelectionForPenalties) return true;
      if (localShowAliasInSelector !== state.config.showAliasInPenaltyPlayerSelector) return true;
      if (localShowAliasInControlsList !== state.config.showAliasInControlsPenaltyList) return true;
      if (localShowAliasInScoreboard !== state.config.showAliasInScoreboardPenalties) return true;
      if (localShowStandingsInWarmup !== state.config.showStandingsInWarmup) return true;
      if (localShowShotsData !== state.config.showShotsData) return true;
      return false;
    },
  }));
  
  const handleMasterToggleChange = (checked: boolean) => {
    setLocalEnableTeamUsage(checked);
    markDirty();
    if (!checked) {
      setLocalEnablePlayerSelection(false);
      setLocalShowAliasInSelector(false);
      setLocalShowAliasInControlsList(false);
      setLocalShowAliasInScoreboard(false);
    }
  };
  
  const handlePlayerSelectionToggleChange = (checked: boolean) => {
    setLocalEnablePlayerSelection(checked);
    markDirty();
    if (!checked) {
        setLocalShowAliasInSelector(false);
        setLocalShowAliasInControlsList(false);
        setLocalShowAliasInScoreboard(false);
    }
  };

  return (
    <ControlCardWrapper title="Configuración de Display (Alias y Selección)">
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-md bg-card shadow-sm">
          <Label htmlFor="enableTeamUsageSwitch" className="flex flex-col space-y-1">
            <span className="font-semibold text-base">Habilitar el uso de Equipos</span>
            <span className="font-normal leading-snug text-muted-foreground text-xs">
              Activa todas las funcionalidades relacionadas con equipos (selección, jugadores, alias). Desactivarlo ocultará las opciones dependientes.
            </span>
          </Label>
          <Switch
            id="enableTeamUsageSwitch"
            checked={localEnableTeamUsage}
            onCheckedChange={handleMasterToggleChange}
          />
        </div>

        <div className={cn(
          "space-y-4 transition-opacity duration-300",
          !localEnableTeamUsage && "opacity-50 pointer-events-none"
        )}>
            <div className="flex items-center justify-between p-4 border rounded-md bg-muted/20">
              <Label htmlFor="enablePlayerSelectionSwitch" className="flex flex-col space-y-1">
                <span>Habilitar selector de jugador para penalidades</span>
                <span className="font-normal leading-snug text-muted-foreground text-xs">
                  Permite seleccionar jugadores de una lista al añadir penalidades si un equipo está cargado.
                </span>
              </Label>
              <Switch
                id="enablePlayerSelectionSwitch"
                checked={localEnablePlayerSelection}
                onCheckedChange={handlePlayerSelectionToggleChange}
                disabled={!localEnableTeamUsage}
              />
            </div>

            <div className={cn(
                "space-y-4 transition-opacity duration-300 ml-0 sm:ml-4",
                (!localEnableTeamUsage || !localEnablePlayerSelection) && "opacity-60 pointer-events-none"
            )}>
                <div className="flex items-center justify-between p-4 border rounded-md bg-muted/30">
                  <Label htmlFor="showAliasInSelectorSwitch" className="flex flex-col space-y-1">
                      <span>Mostrar alias en lista del selector de jugador</span>
                      <span className="font-normal leading-snug text-muted-foreground text-xs">
                      Muestra el nombre/alias junto al número en el desplegable.
                      </span>
                  </Label>
                  <Switch
                      id="showAliasInSelectorSwitch"
                      checked={localShowAliasInSelector}
                      onCheckedChange={(checked) => { setLocalShowAliasInSelector(checked); markDirty(); }}
                      disabled={!localEnableTeamUsage || !localEnablePlayerSelection}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-md bg-muted/30">
                  <Label htmlFor="showAliasInControlsListSwitch" className="flex flex-col space-y-1">
                      <span>Mostrar alias en lista de penalidades del tablero de Controles</span>
                      <span className="font-normal leading-snug text-muted-foreground text-xs">
                      Muestra el alias en la lista de penalidades activas en la página de Controles.
                      </span>
                  </Label>
                  <Switch
                      id="showAliasInControlsListSwitch"
                      checked={localShowAliasInControlsList}
                      onCheckedChange={(checked) => { setLocalShowAliasInControlsList(checked); markDirty(); }}
                      disabled={!localEnableTeamUsage || !localEnablePlayerSelection}
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-md bg-muted/30">
                  <Label htmlFor="showAliasInScoreboardSwitch" className="flex flex-col space-y-1">
                      <span>Mostrar alias en penalidades del Scoreboard</span>
                      <span className="font-normal leading-snug text-muted-foreground text-xs">
                      Muestra el alias del jugador en las tarjetas de penalidad del Scoreboard principal.
                      </span>
                  </Label>
                  <Switch
                      id="showAliasInScoreboardSwitch"
                      checked={localShowAliasInScoreboard}
                      onCheckedChange={(checked) => { setLocalShowAliasInScoreboard(checked); markDirty(); }}
                      disabled={!localEnableTeamUsage || !localEnablePlayerSelection}
                  />
                </div>
            </div>
        </div>

        {/* Configuraciones Generales de Visualización */}
        <div className="flex items-center justify-between p-4 border rounded-md bg-card shadow-sm">
          <Label htmlFor="showStandingsInWarmupSwitch" className="flex flex-col space-y-1">
            <span className="font-semibold text-base">Mostrar tabla de posiciones en Warm-up</span>
            <span className="font-normal leading-snug text-muted-foreground text-xs">
              Muestra la tabla de posiciones durante el período de calentamiento cuando hay un partido del fixture activo.
            </span>
          </Label>
          <Switch
            id="showStandingsInWarmupSwitch"
            checked={localShowStandingsInWarmup}
            onCheckedChange={(checked) => { setLocalShowStandingsInWarmup(checked); markDirty(); }}
          />
        </div>

        <div className="flex items-center justify-between p-4 border rounded-md bg-card shadow-sm">
          <Label htmlFor="showShotsDataSwitch" className="flex flex-col space-y-1">
            <span className="font-semibold text-base">Mostrar datos de tiros</span>
            <span className="font-normal leading-snug text-muted-foreground text-xs">
              Muestra información de tiros a gol en fixtures, tablas de posiciones y resúmenes de partidos.
            </span>
          </Label>
          <Switch
            id="showShotsDataSwitch"
            checked={localShowShotsData}
            onCheckedChange={(checked) => { setLocalShowShotsData(checked); markDirty(); }}
          />
        </div>
      </div>
    </ControlCardWrapper>
  );
});

TeamSettingsCard.displayName = "TeamSettingsCard";
