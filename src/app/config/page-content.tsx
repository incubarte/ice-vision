

"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, Undo2, Upload, Download, RotateCcw, Plus, Edit3, Trash2, XCircle, ShieldAlert, LogIn } from 'lucide-react';
import { useGameState, type ConfigFields, type FormatAndTimingsProfile, type FormatAndTimingsProfileData, createDefaultFormatAndTimingsProfile, type CategoryData, type ScoreboardLayoutProfile, createDefaultScoreboardLayoutProfile } from '@/contexts/game-state-context';
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as FormDialogTitle,
  DialogDescription as FormDialogDescription,
  DialogFooter as FormDialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import isEqual from 'lodash.isequal';
import { HockeyPuckSpinner } from '@/components/ui/hockey-puck-spinner';
import type { DurationSettingsCardRef } from "@/components/config/duration-settings-card";
import type { PenaltySettingsCardRef } from "@/components/config/penalty-settings-card";
import type { StoppedTimeAlertCardRef } from "@/components/config/stopped-time-alert-card";
import type { PenaltyTypesCardRef } from "@/components/config/penalty-types-card";
import type { SoundSettingsCardRef } from "@/components/config/sound-settings-card";
import type { PenaltyCountdownSoundCardRef } from "@/components/config/penalty-countdown-sound-card";
import type { TeamSettingsCardRef } from "@/components/config/team-settings-card";
import type { LayoutSettingsCardRef } from "@/components/config/layout-settings-card";
import type { DebugSettingsCardRef } from "@/components/config/debug-settings-card";
import { RemoteControlsSettingsCard } from '@/components/config/remote-controls-settings-card';
import { ExternalWindowSettingsCard } from '@/components/config/external-window-settings-card';
import { useAuth } from '@/hooks/use-auth';
import type { ReplaySettingsCardRef } from '@/components/config/replay-settings-card';


// Lazy load heavy components
const loadingComponent = () => <div className="flex justify-center items-center p-8"><HockeyPuckSpinner className="h-36 w-36" /></div>;

const DurationSettingsCard = dynamic(() => import('@/components/config/duration-settings-card').then(mod => mod.DurationSettingsCard), { loading: loadingComponent });
const StoppedTimeAlertCard = dynamic(() => import('@/components/config/stopped-time-alert-card').then(mod => mod.StoppedTimeAlertCard), { loading: loadingComponent });
const PenaltySettingsCard = dynamic(() => import('@/components/config/penalty-settings-card').then(mod => mod.PenaltySettingsCard), { loading: loadingComponent });
const PenaltyTypesCard = dynamic(() => import('@/components/config/penalty-types-card').then(mod => mod.PenaltyTypesCard), { loading: loadingComponent });
const SoundSettingsCard = dynamic(() => import('@/components/config/sound-settings-card').then(mod => mod.SoundSettingsCard), { loading: loadingComponent });
const PenaltyCountdownSoundCard = dynamic(() => import('@/components/config/penalty-countdown-sound-card').then(mod => mod.PenaltyCountdownSoundCard), { loading: loadingComponent });
const TeamSettingsCard = dynamic(() => import('@/components/config/team-settings-card').then(mod => mod.TeamSettingsCard), { loading: loadingComponent });
const LayoutSettingsCard = dynamic(() => import('@/components/config/layout-settings-card').then(mod => mod.LayoutSettingsCard), { loading: loadingComponent });
const DebugSettingsCard = dynamic(() => import('@/components/config/debug-settings-card').then(mod => mod.DebugSettingsCard), { loading: loadingComponent });
const ReplaySettingsCard = dynamic(() => import('@/components/config/replay-settings-card').then(mod => mod.ReplaySettingsCard), { loading: loadingComponent });


const VALID_TAB_VALUES = ["formatAndTimings", "soundAndDisplay", "remoteControls", "replays"];

type ExportableSoundAndDisplayConfig = Pick<ConfigFields,
  | 'playSoundAtPeriodEnd' | 'customHornSoundDataUrl'
  | 'enablePenaltyCountdownSound' | 'penaltyCountdownStartTime' | 'customPenaltyBeepSoundDataUrl'
  | 'enableTeamSelectionInMiniScoreboard' | 'enablePlayerSelectionForPenalties'
  | 'showAliasInPenaltyPlayerSelector' | 'showAliasInControlsPenaltyList' | 'showAliasInScoreboardPenalties'
  | 'scoreboardLayoutProfiles' | 'enableDebugMode' | 'tunnel' | 'showStandingsInWarmup' | 'showShotsData' | 'enableOlympiaTransition'
>;


export default function ConfigPage() {
  const { state, dispatch, isLoading: isGameStateLoading } = useGameState();
  const { authStatus } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  const durationSettingsRef = useRef<DurationSettingsCardRef>(null);
  const penaltySettingsRef = useRef<PenaltySettingsCardRef>(null);
  const stoppedTimeAlertRef = useRef<StoppedTimeAlertCardRef>(null);
  const penaltyTypesRef = useRef<PenaltyTypesCardRef>(null);
  const soundSettingsRef = useRef<SoundSettingsCardRef>(null);
  const penaltyCountdownSoundRef = useRef<PenaltyCountdownSoundCardRef>(null);
  const teamSettingsRef = useRef<TeamSettingsCardRef>(null);
  const layoutSettingsRef = useRef<LayoutSettingsCardRef>(null);
  const debugSettingsRef = useRef<DebugSettingsCardRef>(null);
  const replaySettingsRef = useRef<ReplaySettingsCardRef>(null);
  
  const fileInputFormatAndTimingsRef = useRef<HTMLInputElement>(null);
  const fileInputSoundAndDisplayRef = useRef<HTMLInputElement>(null);
  
  const [isDurationDirty, setIsDurationDirty] = useState(false);
  const [isPenaltyDirty, setIsPenaltyDirty] = useState(false);
  const [isStoppedTimeAlertDirty, setIsStoppedTimeAlertDirty] = useState(false);
  const [isPenaltyTypesDirty, setIsPenaltyTypesDirty] = useState(false);
  const [isSoundDirty, setIsSoundDirty] = useState(false);
  const [isPenaltyCountdownSoundDirty, setIsPenaltyCountdownSoundDirty] = useState(false);
  const [isTeamSettingsDirty, setIsTeamSettingsDirty] = useState(false);
  const [isDebugDirty, setIsDebugDirty] = useState(false);
  const [isReplayDirty, setIsReplayDirty] = useState(false);
  
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [currentExportFilename, setCurrentExportFilename] = useState('');
  const [currentExportAction, setCurrentExportAction] = useState<(() => void) | null>(null);

  const [isResetConfigDialogOpen, setIsResetConfigDialogOpen] = useState(false);

  const urlTab = searchParams.get('tab');
  const initialTab = urlTab && VALID_TAB_VALUES.includes(urlTab) ? urlTab : "formatAndTimings";
  const [activeTab, setActiveTab] = useState(initialTab);

  // States for Format & Timings Profiles
  const [isNewFTProfileDialogOpen, setIsNewFTProfileDialogOpen] = useState(false);
  const [newFTProfileName, setNewFTProfileName] = useState("");
  const [isEditFTProfileNameDialogOpen, setIsEditFTProfileNameDialogOpen] = useState(false);
  const [editingFTProfileName, setEditingFTProfileName] = useState("");
  const [ftProfileToDelete, setFtProfileToDelete] = useState<FormatAndTimingsProfile | null>(null);
  const [isConfirmSwitchFTProfileDialogOpen, setIsConfirmSwitchFTProfileDialogOpen] = useState(false);
  const [pendingFTProfileIdToSelect, setPendingFTProfileIdToSelect] = useState<string | null>(null);

  // States for Layout Profiles
  const [isNewLayoutProfileDialogOpen, setIsNewLayoutProfileDialogOpen] = useState(false);
  const [newLayoutProfileName, setNewLayoutProfileName] = useState("");
  const [isEditLayoutProfileNameDialogOpen, setIsEditLayoutProfileNameDialogOpen] = useState(false);
  const [editingLayoutProfileName, setEditingLayoutProfileName] = useState("");
  const [layoutProfileToDelete, setLayoutProfileToDelete] = useState<ScoreboardLayoutProfile | null>(null);
  const [isConfirmSwitchLayoutProfileDialogOpen, setIsConfirmSwitchLayoutProfileDialogOpen] = useState(false);
  const [pendingLayoutProfileIdToSelect, setPendingLayoutProfileIdToSelect] = useState<string | null>(null);

  const [isConfirmSwitchTabDialogOpen, setIsConfirmSwitchTabDialogOpen] = useState(false);
  const [pendingTabSwitchData, setPendingTabSwitchData] = useState<{ newTabValue: string; discardAction: (() => void) | null; sectionName: string } | null>(null);


  useEffect(() => {
    const currentUrlTab = searchParams.get('tab');
    if (activeTab !== currentUrlTab && VALID_TAB_VALUES.includes(activeTab)) {
      router.push(`/config?tab=${activeTab}`, { scroll: false });
    }
  }, [activeTab, router, searchParams]);

  const selectedFTProfile = useMemo(() => {
    const profiles = state.config.formatAndTimingsProfiles || [];
    return profiles.find(p => p.id === state.config.selectedFormatAndTimingsProfileId) || profiles[0] || createDefaultFormatAndTimingsProfile();
  }, [state.config.formatAndTimingsProfiles, state.config.selectedFormatAndTimingsProfileId]);

  const selectedLayoutProfile = useMemo(() => {
    const profiles = state.config.scoreboardLayoutProfiles || [];
    return profiles.find(p => p.id === state.config.selectedScoreboardLayoutProfileId) || profiles[0] || createDefaultScoreboardLayoutProfile();
  }, [state.config.scoreboardLayoutProfiles, state.config.selectedScoreboardLayoutProfileId]);

  const isLayoutDirty = useMemo(() => {
    if (!selectedLayoutProfile) return false;
    const { id, name, ...savedSettings } = selectedLayoutProfile;
    return !isEqual(savedSettings, state.config.scoreboardLayout);
  }, [state.config.scoreboardLayout, selectedLayoutProfile]);

  useEffect(() => {
    if (durationSettingsRef.current) durationSettingsRef.current.setValues(selectedFTProfile);
    if (penaltySettingsRef.current) penaltySettingsRef.current.setValues(selectedFTProfile);
    if (stoppedTimeAlertRef.current) stoppedTimeAlertRef.current.setValues(selectedFTProfile);
    if (penaltyTypesRef.current) penaltyTypesRef.current.setValues(selectedFTProfile);
    setIsDurationDirty(false);
    setIsPenaltyDirty(false);
    setIsStoppedTimeAlertDirty(false);
    setIsPenaltyTypesDirty(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFTProfile.id]); 

  const isFormatAndTimingsSectionDirty = isDurationDirty || isPenaltyDirty || isStoppedTimeAlertDirty || isPenaltyTypesDirty;
  const isSoundAndDisplaySectionDirty = isSoundDirty || isPenaltyCountdownSoundDirty || isTeamSettingsDirty || isLayoutDirty || isDebugDirty;
  const isReplaysSectionDirty = isReplayDirty;

  const handleSaveChanges_FormatAndTimings = () => {
    let allSavesSuccessful = true;

    if (isDurationDirty && durationSettingsRef.current) {
      if (durationSettingsRef.current.handleSave()) {
        setIsDurationDirty(false);
      } else { allSavesSuccessful = false; }
    }
    if (isPenaltyDirty && penaltySettingsRef.current) {
      if (penaltySettingsRef.current.handleSave()) {
        setIsPenaltyDirty(false);
      } else { allSavesSuccessful = false; }
    }
    if (isStoppedTimeAlertDirty && stoppedTimeAlertRef.current) {
      if (stoppedTimeAlertRef.current.handleSave()) {
        setIsStoppedTimeAlertDirty(false);
      } else { allSavesSuccessful = false; }
    }
    if (isPenaltyTypesDirty && penaltyTypesRef.current) {
      if (penaltyTypesRef.current.handleSave()) {
        setIsPenaltyTypesDirty(false);
      } else { allSavesSuccessful = false; }
    }

    if (allSavesSuccessful) {
      toast({ title: "Formato y Tiempos Guardados", description: "Los cambios en Formato y Tiempos han sido guardados en la configuración activa." });
    } else {
      toast({ title: "Error al Guardar", description: "No se pudieron guardar todos los cambios en Formato y Tiempos.", variant: "destructive" });
    }
  };


  const handleDiscardChanges_FormatAndTimings = () => {
    if (durationSettingsRef.current && isDurationDirty) { durationSettingsRef.current.handleDiscard(); setIsDurationDirty(false); }
    if (penaltySettingsRef.current && isPenaltyDirty) { penaltySettingsRef.current.handleDiscard(); setIsPenaltyDirty(false); }
    if (stoppedTimeAlertRef.current && isStoppedTimeAlertDirty) { stoppedTimeAlertRef.current.handleDiscard(); setIsStoppedTimeAlertDirty(false); }
    if (penaltyTypesRef.current && isPenaltyTypesDirty) { penaltyTypesRef.current.handleDiscard(); setIsPenaltyTypesDirty(false); }
    toast({ title: "Cambios Descartados", description: "Los cambios no guardados en Formato y Tiempos han sido revertidos." });
  };


  const handleSaveChanges_SoundAndDisplay = () => {
    if (soundSettingsRef.current && isSoundDirty) soundSettingsRef.current.handleSave();
    if (penaltyCountdownSoundRef.current && isPenaltyCountdownSoundDirty) penaltyCountdownSoundRef.current.handleSave();
    if (teamSettingsRef.current && isTeamSettingsDirty) teamSettingsRef.current.handleSave();
    if (layoutSettingsRef.current && isLayoutDirty) layoutSettingsRef.current.handleSave();
    if (debugSettingsRef.current && isDebugDirty) debugSettingsRef.current.handleSave();
    
    setIsSoundDirty(false);
    setIsPenaltyCountdownSoundDirty(false);
    setIsTeamSettingsDirty(false);
    setIsDebugDirty(false);
    // isLayoutDirty will update via memoization, becoming false after save
    
    toast({ title: "Sonido y Display Guardados", description: "Los cambios en Sonido y Display han sido guardados en la configuración activa." });
  };

  const handleDiscardChanges_SoundAndDisplay = () => {
    if (soundSettingsRef.current && isSoundDirty) { soundSettingsRef.current.handleDiscard(); setIsSoundDirty(false); }
    if (penaltyCountdownSoundRef.current && isPenaltyCountdownSoundDirty) { penaltyCountdownSoundRef.current.handleDiscard(); setIsPenaltyCountdownSoundDirty(false); }
    if (teamSettingsRef.current && isTeamSettingsDirty) { teamSettingsRef.current.handleDiscard(); setIsTeamSettingsDirty(false); }
    if (layoutSettingsRef.current && isLayoutDirty) { layoutSettingsRef.current.handleDiscard(); }
    if (debugSettingsRef.current && isDebugDirty) { debugSettingsRef.current.handleDiscard(); setIsDebugDirty(false); }
    
    toast({ title: "Cambios Descartados", description: "Los cambios no guardados en Sonido y Display han sido revertidos." });
  };
  
  const handleSaveChanges_Replays = () => {
    if (replaySettingsRef.current && isReplayDirty) {
      replaySettingsRef.current.handleSave();
      setIsReplayDirty(false);
    }
  };

  const handleDiscardChanges_Replays = () => {
    if (replaySettingsRef.current && isReplayDirty) {
      replaySettingsRef.current.handleDiscard();
      setIsReplayDirty(false);
    }
  };

  const performExportActionWithDialog = (filename: string) => {
    if (!currentExportAction) return;

    if (!filename.trim().endsWith('.json')) {
        filename = filename.trim() + '.json';
    }
    if (filename.trim() === '.json'){
        toast({
            title: "Nombre de Archivo Inválido",
            description: "El nombre del archivo no puede estar vacío.",
            variant: "destructive",
        });
        return;
    }
    localStorage.setItem('lastExportFilename', filename.trim()); 
    currentExportAction(); 
    setIsExportDialogOpen(false);
    setCurrentExportAction(null);
  };

  const exportSection = (sectionName: string, configData: object, suggestedBaseName: string) => {
    let lastFilename: string | null = null;
    if (typeof window !== 'undefined') {
      lastFilename = localStorage.getItem('lastExportFilename');
    }
    const suggestedFilename = lastFilename || `${suggestedBaseName}_config.json`;
    setCurrentExportFilename(suggestedFilename);

    setCurrentExportAction(() => () => { 
        const jsonString = JSON.stringify(configData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = currentExportFilename.trim(); 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
        toast({
            title: `${sectionName} Exportado`,
            description: `Archivo ${currentExportFilename.trim()} descargado.`,
        });
    });
    setIsExportDialogOpen(true);
  };

  const handleExportFormatAndTimings = () => {
    exportSection("Perfiles de Formato y Tiempos", state.config.formatAndTimingsProfiles, "icevision_formatos_tiempos_perfiles");
  };

  const handleExportSoundAndDisplay = () => {
    const configToExport: ExportableSoundAndDisplayConfig = {
      playSoundAtPeriodEnd: state.config.playSoundAtPeriodEnd,
      customHornSoundDataUrl: state.config.customHornSoundDataUrl,
      enablePenaltyCountdownSound: state.config.enablePenaltyCountdownSound,
      penaltyCountdownStartTime: state.config.penaltyCountdownStartTime,
      customPenaltyBeepSoundDataUrl: state.config.customPenaltyBeepSoundDataUrl,
      enableTeamSelectionInMiniScoreboard: state.config.enableTeamSelectionInMiniScoreboard,
      enablePlayerSelectionForPenalties: state.config.enablePlayerSelectionForPenalties,
      showAliasInPenaltyPlayerSelector: state.config.showAliasInPenaltyPlayerSelector,
      showAliasInControlsPenaltyList: state.config.showAliasInControlsPenaltyList,
      showAliasInScoreboardPenalties: state.config.showAliasInScoreboardPenalties,
      scoreboardLayoutProfiles: state.config.scoreboardLayoutProfiles,
      enableDebugMode: state.config.enableDebugMode,
      tunnel: state.config.tunnel,
      showStandingsInWarmup: state.config.showStandingsInWarmup,
      showShotsData: state.config.showShotsData,
      enableOlympiaTransition: state.config.enableOlympiaTransition,
    };
    exportSection("Configuración de Sonido y Display", configToExport, "icevision_sonido_display");
  };
  
  const genericImportHandler = (
    event: React.ChangeEvent<HTMLInputElement>,
    sectionName: string,
    requiredFields: string[],
    dispatchActionType: 
        | 'LOAD_FORMAT_AND_TIMINGS_PROFILES' 
        | 'LOAD_SOUND_AND_DISPLAY_CONFIG',
    fileInputRef: React.RefObject<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error("Error al leer el archivo.");
        const importedConfig = JSON.parse(text);

        if (dispatchActionType === 'LOAD_FORMAT_AND_TIMINGS_PROFILES' && !Array.isArray(importedConfig)) {
            throw new Error(`Archivo de perfiles de ${sectionName} no válido. Se esperaba un array de perfiles.`);
        }
        if (dispatchActionType !== 'LOAD_FORMAT_AND_TIMINGS_PROFILES' && (typeof importedConfig !== 'object' || Array.isArray(importedConfig))) {
            throw new Error(`Archivo de configuración para ${sectionName} no válido. Se esperaba un objeto.`);
        }

        if (requiredFields.length > 0) {
            const dataToCheck = dispatchActionType === 'LOAD_FORMAT_AND_TIMINGS_PROFILES' ? importedConfig[0] : importedConfig;
            if (dataToCheck) { 
                const missingFields = requiredFields.filter(field => !(field in dataToCheck));
                if (missingFields.length > 0) { 
                    throw new Error(`Archivo de configuración para ${sectionName} no válido. Faltan campos: ${missingFields.join(', ')}`);
                }
            } else if (dispatchActionType === 'LOAD_FORMAT_AND_TIMINGS_PROFILES' && importedConfig.length === 0) {
                // Allow empty array for profiles, but it won't have fields to check
            } else {
                 throw new Error(`Archivo de configuración para ${sectionName} no válido o vacío.`);
            }
        }
        
        let payload: any;
        payload = importedConfig;

        dispatch({ type: dispatchActionType, payload });
        
        if (dispatchActionType === 'LOAD_FORMAT_AND_TIMINGS_PROFILES') {
            setIsDurationDirty(false);
            setIsPenaltyDirty(false);
            setIsStoppedTimeAlertDirty(false);
            setIsPenaltyTypesDirty(false);
        } else if (dispatchActionType === 'LOAD_SOUND_AND_DISPLAY_CONFIG') {
            setIsSoundDirty(false);
            setIsTeamSettingsDirty(false);
            setIsPenaltyCountdownSoundDirty(false);
            setIsDebugDirty(false);
        }

        toast({
          title: `${sectionName} Importado`,
          description: `Configuración de ${sectionName.toLowerCase()} cargada exitosamente.`,
        });
      } catch (error) {
        console.error(`Error importing ${sectionName}:`, error);
        toast({
          title: `Error al Importar ${sectionName}`,
          description: (error as Error).message || `No se pudo procesar el archivo de ${sectionName.toLowerCase()}.`,
          variant: "destructive",
        });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };
    reader.readAsText(file);
  };

  const handleImportFormatAndTimings = (event: React.ChangeEvent<HTMLInputElement>) => {
    genericImportHandler(event, "Perfiles de Formato y Tiempos", 
      ['name', 'defaultPeriodDuration', 'penaltyTypes'], 
      'LOAD_FORMAT_AND_TIMINGS_PROFILES',
      fileInputFormatAndTimingsRef
    );
  };

  const handleImportSoundAndDisplay = (event: React.ChangeEvent<HTMLInputElement>) => {
    genericImportHandler(event, "Sonido y Display",
      ['playSoundAtPeriodEnd', 'scoreboardLayoutProfiles', 'enablePenaltyCountdownSound', 'penaltyCountdownStartTime', 'enableDebugMode'], 
      'LOAD_SOUND_AND_DISPLAY_CONFIG',
      fileInputSoundAndDisplayRef
    );
  };
  
  const handlePrepareResetConfig = () => {
    setIsResetConfigDialogOpen(true);
  };

  const performConfigReset = () => {
    dispatch({ type: 'RESET_CONFIG_TO_DEFAULTS' });
    setIsDurationDirty(false);
    setIsPenaltyDirty(false);
    setIsStoppedTimeAlertDirty(false);
    setIsPenaltyTypesDirty(false);
    setIsSoundDirty(false);
    setIsPenaltyCountdownSoundDirty(false);
    setIsTeamSettingsDirty(false);
    setIsDebugDirty(false);

    toast({
      title: "Configuración Restablecida",
      description: "Todas las configuraciones han vuelto a sus valores predeterminados de fábrica.",
    });
    setIsResetConfigDialogOpen(false);
  };

  const handleCreateNewFTProfile = () => {
    if (!newFTProfileName.trim()) {
      toast({ title: "Nombre Requerido", description: "El nombre del perfil no puede estar vacío.", variant: "destructive" });
      return;
    }
    dispatch({ type: 'ADD_FORMAT_AND_TIMINGS_PROFILE', payload: { name: newFTProfileName.trim() } });
    setNewFTProfileName("");
    setIsNewFTProfileDialogOpen(false);
  };

  const handleSelectFTProfile = (profileId: string) => {
    if (isFormatAndTimingsSectionDirty) {
        setPendingFTProfileIdToSelect(profileId);
        setIsConfirmSwitchFTProfileDialogOpen(true);
    } else {
        dispatch({ type: 'SELECT_FORMAT_AND_TIMINGS_PROFILE', payload: { profileId } });
    }
  };

  const confirmSwitchFTProfile = () => {
    if (pendingFTProfileIdToSelect) {
        handleDiscardChanges_FormatAndTimings();
        dispatch({ type: 'SELECT_FORMAT_AND_TIMINGS_PROFILE', payload: { profileId: pendingFTProfileIdToSelect } });
    }
    setIsConfirmSwitchFTProfileDialogOpen(false);
    setPendingFTProfileIdToSelect(null);
  };
  
  const handlePrepareEditFTProfileName = () => {
    if (selectedFTProfile) {
      setEditingFTProfileName(selectedFTProfile.name);
      setIsEditFTProfileNameDialogOpen(true);
    }
  };

  const handleUpdateFTProfileName = () => {
    if (!editingFTProfileName.trim()) {
      toast({ title: "Nombre Requerido", description: "El nombre del perfil no puede estar vacío.", variant: "destructive" });
      return;
    }
    if (selectedFTProfile) {
      dispatch({ type: 'UPDATE_FORMAT_AND_TIMINGS_PROFILE_NAME', payload: { profileId: selectedFTProfile.id, newName: editingFTProfileName.trim() } });
      toast({ title: "Nombre de Perfil Actualizado" });
    }
    setIsEditFTProfileNameDialogOpen(false);
  };

  const handlePrepareDeleteFTProfile = () => {
    const profiles = state.config.formatAndTimingsProfiles || [];
    if (selectedFTProfile && profiles.length > 1) {
      setFtProfileToDelete(selectedFTProfile);
    } else if (profiles.length <= 1) {
        toast({ title: "Acción no permitida", description: "Debe existir al menos un perfil de formato y tiempos.", variant: "destructive" });
    }
  };

  const confirmDeleteFTProfile = () => {
    if (ftProfileToDelete) {
      dispatch({ type: 'DELETE_FORMAT_AND_TIMINGS_PROFILE', payload: { profileId: ftProfileToDelete.id } });
      toast({ title: "Perfil Eliminado", description: `Perfil "${ftProfileToDelete.name}" eliminado.` });
      setFtProfileToDelete(null);
    }
  };

  // --- Layout Profile Handlers ---

  const handleCreateNewLayoutProfile = () => {
    if (!newLayoutProfileName.trim()) {
        toast({ title: "Nombre Requerido", description: "El nombre del perfil no puede estar vacío.", variant: "destructive" });
        return;
    }
    dispatch({ type: 'ADD_SCOREBOARD_LAYOUT_PROFILE', payload: { name: newLayoutProfileName.trim() } });
    setNewLayoutProfileName("");
    setIsNewLayoutProfileDialogOpen(false);
  };

  const handleSelectLayoutProfile = (profileId: string) => {
    if (isLayoutDirty) {
      setPendingLayoutProfileIdToSelect(profileId);
      setIsConfirmSwitchLayoutProfileDialogOpen(true);
    } else {
      dispatch({ type: 'SELECT_SCOREBOARD_LAYOUT_PROFILE', payload: { profileId } });
    }
  };
  
  const confirmSwitchLayoutProfile = () => {
    if (pendingLayoutProfileIdToSelect) {
      if (layoutSettingsRef.current) layoutSettingsRef.current.handleDiscard();
      dispatch({ type: 'SELECT_SCOREBOARD_LAYOUT_PROFILE', payload: { profileId: pendingLayoutProfileIdToSelect } });
    }
    setIsConfirmSwitchLayoutProfileDialogOpen(false);
    setPendingLayoutProfileIdToSelect(null);
  };

  const handlePrepareEditLayoutProfileName = () => {
    if (selectedLayoutProfile) {
      setEditingLayoutProfileName(selectedLayoutProfile.name);
      setIsEditLayoutProfileNameDialogOpen(true);
    }
  };

  const handleUpdateLayoutProfileName = () => {
    if (!editingLayoutProfileName.trim()) {
      toast({ title: "Nombre Requerido", description: "El nombre del perfil no puede estar vacío.", variant: "destructive" });
      return;
    }
    if (selectedLayoutProfile) {
      dispatch({ type: 'UPDATE_SCOREBOARD_LAYOUT_PROFILE_NAME', payload: { profileId: selectedLayoutProfile.id, newName: editingLayoutProfileName.trim() } });
      toast({ title: "Nombre de Perfil de Diseño Actualizado" });
    }
    setIsEditLayoutProfileNameDialogOpen(false);
  };

  const handlePrepareDeleteLayoutProfile = () => {
    const profiles = state.config.scoreboardLayoutProfiles || [];
    if (selectedLayoutProfile && profiles.length > 1) {
      setLayoutProfileToDelete(selectedLayoutProfile);
    } else if (profiles.length <= 1) {
      toast({ title: "Acción no permitida", description: "Debe existir al menos un perfil de diseño.", variant: "destructive" });
    }
  };

  const confirmDeleteLayoutProfile = () => {
    if (layoutProfileToDelete) {
      dispatch({ type: 'DELETE_SCOREBOARD_LAYOUT_PROFILE', payload: { profileId: layoutProfileToDelete.id } });
      toast({ title: "Perfil de Diseño Eliminado", description: `Perfil "${layoutProfileToDelete.name}" eliminado.` });
      setLayoutProfileToDelete(null);
    }
  };


  const handleTabChange = (newTabValue: string) => {
    let discardAction: (() => void) | null = null;
    let sectionName = "";
    let isDirty = false;

    if (activeTab === "formatAndTimings" && isFormatAndTimingsSectionDirty) {
      sectionName = "Formato y Tiempos";
      isDirty = true;
      discardAction = handleDiscardChanges_FormatAndTimings;
    } else if (activeTab === "soundAndDisplay" && isSoundAndDisplaySectionDirty) {
      sectionName = "Sonido y Display";
      isDirty = true;
      discardAction = handleDiscardChanges_SoundAndDisplay;
    } else if (activeTab === "replays" && isReplaysSectionDirty) {
      sectionName = "Replays/VAR";
      isDirty = true;
      discardAction = handleDiscardChanges_Replays;
    }

    if (isDirty) {
      setPendingTabSwitchData({ newTabValue, discardAction, sectionName });
      setIsConfirmSwitchTabDialogOpen(true);
    } else {
      setActiveTab(newTabValue);
    }
  };

  const confirmSwitchTab = () => {
    if (pendingTabSwitchData) {
      if (pendingTabSwitchData.discardAction) {
        pendingTabSwitchData.discardAction();
      }
      setActiveTab(pendingTabSwitchData.newTabValue);
    }
    setIsConfirmSwitchTabDialogOpen(false);
    setPendingTabSwitchData(null);
  };

  const tabContentClassName = "mt-6 p-0 sm:p-6 border-0 sm:border rounded-md sm:bg-card/30 sm:shadow-sm";
  const sectionCardClassName = "mb-8 p-6 border rounded-md bg-card shadow-sm";
  const sectionActionsContainerClass = "mt-6 mb-4 flex justify-end gap-2 border-t pt-6";

  if (authStatus === 'loading' || isGameStateLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
        <HockeyPuckSpinner className="h-24 w-24 text-primary mb-4" />
        <p className="text-xl text-foreground">Cargando configuración...</p>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    router.replace('/mobile-controls/login');
    return (
       <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive-foreground">Acceso Denegado</h1>
        <p className="text-muted-foreground mt-2">No tienes permisos para ver esta página. Redirigiendo al login...</p>
        <Button onClick={() => router.push('/mobile-controls/login')} className="mt-4">
            <LogIn className="mr-2 h-4 w-4" /> Ir a Login
        </Button>
      </div>
    );
  }


  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary-foreground">Configuración General</h1>
      </div>
      
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto sm:h-10">
          <TabsTrigger value="formatAndTimings" className="py-2 sm:py-1.5">Formato y Tiempos</TabsTrigger>
          <TabsTrigger value="soundAndDisplay" className="py-2 sm:py-1.5">Sonido y Display</TabsTrigger>
          <TabsTrigger value="remoteControls" className="py-2 sm:py-1.5">Controles Remotos</TabsTrigger>
          <TabsTrigger value="replays" className="py-2 sm:py-1.5">Replays/VAR</TabsTrigger>
        </TabsList>

        <TabsContent value="formatAndTimings" className={tabContentClassName}>
          <div className="space-y-6">
            <div className={cn(sectionCardClassName, "mb-6")}>
                <Label className="text-lg font-medium mb-2 block">Perfil de Formato y Tiempos</Label>
                <div className="flex items-center gap-2">
                    <Select value={selectedFTProfile.id || ""} onValueChange={handleSelectFTProfile}>
                        <SelectTrigger className="flex-grow text-base">
                            <SelectValue placeholder="Seleccionar perfil..." />
                        </SelectTrigger>
                        <SelectContent>
                            {(state.config.formatAndTimingsProfiles || []).map(profile => (
                                <SelectItem key={profile.id} value={profile.id} className="text-sm">{profile.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={() => setIsNewFTProfileDialogOpen(true)} aria-label="Crear nuevo perfil de formato y tiempos">
                        <Plus className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handlePrepareEditFTProfileName} disabled={!selectedFTProfile} aria-label="Editar nombre del perfil seleccionado">
                        <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={handlePrepareDeleteFTProfile} disabled={!selectedFTProfile || (state.config.formatAndTimingsProfiles || []).length <= 1} aria-label="Eliminar perfil seleccionado">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
                 <p className="text-xs text-muted-foreground mt-1.5">
                    Crea y selecciona diferentes perfiles para guardar conjuntos de configuraciones de formato y tiempos.
                </p>
            </div>
            <PenaltySettingsCard ref={penaltySettingsRef} onDirtyChange={setIsPenaltyDirty} initialValues={selectedFTProfile} />
            <Separator />
            <DurationSettingsCard ref={durationSettingsRef} onDirtyChange={setIsDurationDirty} initialValues={selectedFTProfile} />
            <Separator />
            <StoppedTimeAlertCard ref={stoppedTimeAlertRef} onDirtyChange={setIsStoppedTimeAlertDirty} initialValues={selectedFTProfile} />
            <Separator />
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-lg text-primary-foreground hover:no-underline">Configuración Avanzada de Penalidades</AccordionTrigger>
                <AccordionContent>
                  <PenaltyTypesCard ref={penaltyTypesRef} onDirtyChange={setIsPenaltyTypesDirty} initialValues={selectedFTProfile} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            
            {isFormatAndTimingsSectionDirty && (
              <div className={sectionActionsContainerClass}>
                <Button onClick={handleSaveChanges_FormatAndTimings} size="sm">
                  <Save className="mr-2 h-4 w-4" /> Guardar Cambios F&T
                </Button>
                <Button onClick={handleDiscardChanges_FormatAndTimings} variant="outline" size="sm">
                  <Undo2 className="mr-2 h-4 w-4" /> Descartar Cambios F&T
                </Button>
              </div>
            )}
            <Separator />
             <div className="space-y-3 pt-4">
                <h3 className="text-lg font-semibold text-primary-foreground">Exportar/Importar Perfiles de Formato y Tiempos</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                    <Button onClick={handleExportFormatAndTimings} variant="outline" className="flex-1">
                        <Download className="mr-2 h-4 w-4" /> Exportar Perfiles (JSON)
                    </Button>
                    <Button onClick={() => fileInputFormatAndTimingsRef.current?.click()} variant="outline" className="flex-1">
                        <Upload className="mr-2 h-4 w-4" /> Importar Perfiles (JSON)
                    </Button>
                    <input
                        type="file" ref={fileInputFormatAndTimingsRef} onChange={handleImportFormatAndTimings}
                        accept=".json" className="hidden"
                    />
                </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="soundAndDisplay" className={tabContentClassName}>
           <div className="space-y-6">
            <SoundSettingsCard ref={soundSettingsRef} onDirtyChange={setIsSoundDirty} />
            <Separator />
            <PenaltyCountdownSoundCard ref={penaltyCountdownSoundRef} onDirtyChange={setIsPenaltyCountdownSoundDirty} />
            <Separator />
            <TeamSettingsCard ref={teamSettingsRef} onDirtyChange={setIsTeamSettingsDirty}/>
            <Separator />
            <div className={cn(sectionCardClassName, "mb-6")}>
                <div className="flex justify-between items-center mb-2 flex-wrap gap-y-2">
                    <Label className="text-lg font-medium mb-0 block">Perfil de Diseño del Scoreboard</Label>
                    {isLayoutDirty && (
                        <div className="flex items-center gap-2">
                            <Badge variant="destructive">Con Cambios sin Guardar</Badge>
                            <Button size="sm" onClick={() => { if (layoutSettingsRef.current) layoutSettingsRef.current.handleSave(); }}>
                                <Save className="mr-2 h-4 w-4" /> Guardar en Perfil
                            </Button>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Select value={selectedLayoutProfile.id || ""} onValueChange={handleSelectLayoutProfile}>
                        <SelectTrigger className="flex-grow text-base">
                            <SelectValue placeholder="Seleccionar perfil de diseño..." />
                        </SelectTrigger>
                        <SelectContent>
                            {(state.config.scoreboardLayoutProfiles || []).map(profile => (
                                <SelectItem key={profile.id} value={profile.id} className="text-sm">{profile.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={() => setIsNewLayoutProfileDialogOpen(true)} aria-label="Crear nuevo perfil de diseño">
                        <Plus className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handlePrepareEditLayoutProfileName} disabled={!selectedLayoutProfile} aria-label="Editar nombre del perfil de diseño">
                        <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={handlePrepareDeleteLayoutProfile} disabled={!selectedLayoutProfile || (state.config.scoreboardLayoutProfiles || []).length <= 1} aria-label="Eliminar perfil de diseño">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                    Crea y selecciona diferentes perfiles para guardar conjuntos de configuraciones de diseño del scoreboard.
                </p>
            </div>
            <LayoutSettingsCard ref={layoutSettingsRef} initialValues={selectedLayoutProfile} />
            <Separator />
            <DebugSettingsCard ref={debugSettingsRef} onDirtyChange={setIsDebugDirty} />
            <Separator />
            <ExternalWindowSettingsCard />
            
            {isSoundAndDisplaySectionDirty && (
              <div className={sectionActionsContainerClass}>
                <Button onClick={handleSaveChanges_SoundAndDisplay} size="sm">
                  <Save className="mr-2 h-4 w-4" /> Guardar Cambios S&D
                </Button>
                <Button onClick={handleDiscardChanges_SoundAndDisplay} variant="outline" size="sm">
                  <Undo2 className="mr-2 h-4 w-4" /> Descartar Cambios S&D
                </Button>
              </div>
            )}
            <Separator />
            <div className="space-y-3 pt-4">
                <h3 className="text-lg font-semibold text-primary-foreground">Exportar/Importar Configuración de Sonido y Display</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                    <Button onClick={handleExportSoundAndDisplay} variant="outline" className="flex-1">
                        <Download className="mr-2 h-4 w-4" /> Exportar (JSON)
                    </Button>
                    <Button onClick={() => fileInputSoundAndDisplayRef.current?.click()} variant="outline" className="flex-1">
                        <Upload className="mr-2 h-4 w-4" /> Importar (JSON)
                    </Button>
                     <input
                        type="file" ref={fileInputSoundAndDisplayRef} onChange={handleImportSoundAndDisplay}
                        accept=".json" className="hidden"
                    />
                </div>
            </div>
           </div>
        </TabsContent>

        <TabsContent value="remoteControls" className={tabContentClassName}>
          <RemoteControlsSettingsCard />
        </TabsContent>

        <TabsContent value="replays" className={tabContentClassName}>
            <div className="space-y-6">
                <ReplaySettingsCard ref={replaySettingsRef} onDirtyChange={setIsReplayDirty} />
                {isReplaysSectionDirty && (
                <div className={sectionActionsContainerClass}>
                    <Button onClick={handleSaveChanges_Replays} size="sm">
                    <Save className="mr-2 h-4 w-4" /> Guardar Cambios Replays
                    </Button>
                    <Button onClick={handleDiscardChanges_Replays} variant="outline" size="sm">
                    <Undo2 className="mr-2 h-4 w-4" /> Descartar Cambios Replays
                    </Button>
                </div>
                )}
            </div>
        </TabsContent>
      </Tabs>

      <Separator className="my-10" />

      <div className="space-y-6 p-6 border rounded-md bg-card">
        <h2 className="text-xl font-semibold text-primary-foreground">Restablecer Todas las Configuraciones</h2>
        <p className="text-sm text-muted-foreground">
          Restablece todas las configuraciones de todas las secciones (el perfil de Formato y Tiempos actualmente seleccionado, Sonido y Display, y lista de Categorías) a sus valores predeterminados de fábrica. Esta acción no se puede deshacer.
          La lista de Equipos y Jugadores NO será afectada. Otros perfiles no seleccionados no se verán afectados.
        </p>
        <div className="flex justify-start">
          <Button onClick={handlePrepareResetConfig} variant="destructive" >
            <RotateCcw className="mr-2 h-4 w-4" /> Restablecer Configuraciones
          </Button>
        </div>
      </div>

      {isExportDialogOpen && (
        <AlertDialog open={isExportDialogOpen} onOpenChange={(open) => {
            if (!open) { setCurrentExportAction(null); }
            setIsExportDialogOpen(open);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Nombre del Archivo de Exportación</AlertDialogTitle>
              <AlertDialogDescription>
                Ingresa el nombre deseado para el archivo de configuración. Se añadirá la extensión ".json" automáticamente si no se incluye.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input value={currentExportFilename} onChange={(e) => setCurrentExportFilename(e.target.value)} placeholder="nombre_de_configuracion.json" className="my-4" />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setIsExportDialogOpen(false); setCurrentExportAction(null); }}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => performExportActionWithDialog(currentExportFilename)}>Exportar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {isResetConfigDialogOpen && (
        <AlertDialog open={isResetConfigDialogOpen} onOpenChange={setIsResetConfigDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Restablecimiento</AlertDialogTitle>
              <AlertDialogDescription>
                Esto restablecerá el perfil actualmente seleccionado para cada sección (Formato y Tiempos, Diseño) y los ajustes de Sonido, Display y Categorías a sus valores predeterminados. La lista de Equipos y sus jugadores NO se verá afectada. Otros perfiles no seleccionados tampoco. ¿Estás seguro?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={performConfigReset} className="bg-destructive hover:bg-destructive/90">Confirmar Restablecimiento</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* --- Format & Timings Dialogs --- */}
      <Dialog open={isNewFTProfileDialogOpen} onOpenChange={setIsNewFTProfileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <FormDialogTitle>Nuevo Perfil de Formato y Tiempos</FormDialogTitle>
            <FormDialogDescription>Ingresa un nombre para el nuevo perfil.</FormDialogDescription>
          </DialogHeader>
          <Input value={newFTProfileName} onChange={(e) => setNewFTProfileName(e.target.value)} placeholder="Nombre del perfil" className="my-4" onKeyDown={(e) => {if (e.key === 'Enter') handleCreateNewFTProfile();}} />
          <FormDialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleCreateNewFTProfile}>Crear Perfil</Button>
          </FormDialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isEditFTProfileNameDialogOpen} onOpenChange={setIsEditFTProfileNameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <FormDialogTitle>Editar Nombre de Perfil F&T</FormDialogTitle>
            <FormDialogDescription>Actualiza el nombre del perfil seleccionado.</FormDialogDescription>
          </DialogHeader>
          <Input value={editingFTProfileName} onChange={(e) => setEditingFTProfileName(e.target.value)} placeholder="Nombre del perfil" className="my-4" onKeyDown={(e) => {if (e.key === 'Enter') handleUpdateFTProfileName();}} />
          <FormDialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleUpdateFTProfileName}>Guardar Nombre</Button>
          </FormDialogFooter>
        </DialogContent>
      </Dialog>
       {ftProfileToDelete && (
        <AlertDialog open={!!ftProfileToDelete} onOpenChange={() => setFtProfileToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Eliminación de Perfil F&T</AlertDialogTitle>
                <AlertDialogDescription>¿Estás seguro de que quieres eliminar el perfil "{ftProfileToDelete.name}"? Esta acción no se puede deshacer.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteFTProfile} className="bg-destructive hover:bg-destructive/90">Eliminar Perfil</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
       )}
      {isConfirmSwitchFTProfileDialogOpen && (
        <AlertDialog open={isConfirmSwitchFTProfileDialogOpen} onOpenChange={setIsConfirmSwitchFTProfileDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Descartar Cambios</AlertDialogTitle>
              <AlertDialogDescription>Tienes cambios sin guardar en la sección de Formato y Tiempos. ¿Deseas descartarlos y cambiar de perfil?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setIsConfirmSwitchFTProfileDialogOpen(false); setPendingFTProfileIdToSelect(null); }}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmSwitchFTProfile}>Descartar y Cambiar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* --- Layout Dialogs --- */}
      <Dialog open={isNewLayoutProfileDialogOpen} onOpenChange={setIsNewLayoutProfileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <FormDialogTitle>Nuevo Perfil de Diseño</FormDialogTitle>
            <FormDialogDescription>Ingresa un nombre para el nuevo perfil de diseño.</FormDialogDescription>
          </DialogHeader>
          <Input value={newLayoutProfileName} onChange={(e) => setNewLayoutProfileName(e.target.value)} placeholder="Nombre del perfil" className="my-4" onKeyDown={(e) => { if (e.key === 'Enter') handleCreateNewLayoutProfile(); }} />
          <FormDialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleCreateNewLayoutProfile}>Crear Perfil</Button>
          </FormDialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isEditLayoutProfileNameDialogOpen} onOpenChange={setIsEditLayoutProfileNameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <FormDialogTitle>Editar Nombre de Perfil de Diseño</FormDialogTitle>
            <FormDialogDescription>Actualiza el nombre del perfil de diseño seleccionado.</FormDialogDescription>
          </DialogHeader>
          <Input value={editingLayoutProfileName} onChange={(e) => setEditingLayoutProfileName(e.target.value)} placeholder="Nombre del perfil" className="my-4" onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateLayoutProfileName(); }} />
          <FormDialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleUpdateLayoutProfileName}>Guardar Nombre</Button>
          </FormDialogFooter>
        </DialogContent>
      </Dialog>
      {layoutProfileToDelete && (
        <AlertDialog open={!!layoutProfileToDelete} onOpenChange={() => setLayoutProfileToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Eliminación de Perfil de Diseño</AlertDialogTitle>
              <AlertDialogDescription>¿Estás seguro de que quieres eliminar el perfil de diseño "{layoutProfileToDelete.name}"? Esta acción no se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteLayoutProfile} className="bg-destructive hover:bg-destructive/90">Eliminar Perfil</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {isConfirmSwitchLayoutProfileDialogOpen && (
        <AlertDialog open={isConfirmSwitchLayoutProfileDialogOpen} onOpenChange={setIsConfirmSwitchLayoutProfileDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Descartar Cambios</AlertDialogTitle>
              <AlertDialogDescription>Tienes cambios sin guardar en el diseño actual. ¿Deseas descartarlos y cambiar de perfil?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setIsConfirmSwitchLayoutProfileDialogOpen(false); setPendingLayoutProfileIdToSelect(null); }}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmSwitchLayoutProfile}>Descartar y Cambiar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* --- Generic Dialogs --- */}
      {isConfirmSwitchTabDialogOpen && pendingTabSwitchData && (
        <AlertDialog open={isConfirmSwitchTabDialogOpen} onOpenChange={setIsConfirmSwitchTabDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Descartar Cambios</AlertDialogTitle>
              <AlertDialogDescription>Tienes cambios sin guardar en la sección de {pendingTabSwitchData.sectionName}. ¿Deseas descartarlos y cambiar de pestaña?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setIsConfirmSwitchTabDialogOpen(false); setPendingTabSwitchData(null); }}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmSwitchTab}>Descartar y Cambiar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
