

"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import {
  useGameState,
  centisecondsToDisplayMinutes,
  centisecondsToDisplaySeconds,
} from "@/contexts/game-state-context";
import type { FormatAndTimingsProfileData } from "@/types";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface DurationSettingsCardRef {
  handleSave: () => boolean; 
  handleDiscard: () => void;
  getIsDirty: () => boolean;
  setValues: (values: FormatAndTimingsProfileData) => void;
}

interface DurationSettingsCardProps {
  onDirtyChange?: (isDirty: boolean) => void;
  initialValues?: FormatAndTimingsProfileData;
  isDialogMode?: boolean;
  tempSettings?: Partial<FormatAndTimingsProfileData>;
  onSettingsChange?: (settings: Partial<FormatAndTimingsProfileData>) => void;
}

const narrowInputStyle = "w-24 text-sm";

export const DurationSettingsCard = forwardRef<DurationSettingsCardRef, DurationSettingsCardProps>((props, ref) => {
  const { state, dispatch } = useGameState();
  const { onDirtyChange, initialValues: propInitialValues, isDialogMode = false, tempSettings, onSettingsChange } = props;

  const initialValues = propInitialValues || state.config;

  const getInitialState = (key: keyof FormatAndTimingsProfileData, converter?: (val: number) => string) => {
    const value = tempSettings?.[key] ?? initialValues[key as keyof typeof initialValues];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
        return converter ? converter(value) : String(value);
    }
    return '';
  };
  
  const [localWarmUpDurationInput, setLocalWarmUpDurationInput] = useState(getInitialState('defaultWarmUpDuration', centisecondsToDisplayMinutes));
  const [localPeriodDurationInput, setLocalPeriodDurationInput] = useState(getInitialState('defaultPeriodDuration', centisecondsToDisplayMinutes));
  const [localOTPeriodDurationInput, setLocalOTPeriodDurationInput] = useState(getInitialState('defaultOTPeriodDuration', centisecondsToDisplayMinutes));
  const [localBreakDurationInput, setLocalBreakDurationInput] = useState(getInitialState('defaultBreakDuration', centisecondsToDisplaySeconds));
  const [localPreOTBreakDurationInput, setLocalPreOTBreakDurationInput] = useState(getInitialState('defaultPreOTBreakDuration', centisecondsToDisplaySeconds));
  const [localTimeoutDurationInput, setLocalTimeoutDurationInput] = useState(getInitialState('defaultTimeoutDuration', centisecondsToDisplaySeconds));
  
  const [localAutoStartWarmUp, setLocalAutoStartWarmUp] = useState(getInitialState('autoStartWarmUp') as boolean);
  const [localAutoStartBreaks, setLocalAutoStartBreaks] = useState(getInitialState('autoStartBreaks') as boolean);
  const [localAutoStartPreOTBreaks, setLocalAutoStartPreOTBreaks] = useState(getInitialState('autoStartPreOTBreaks') as boolean);
  const [localAutoStartTimeouts, setLocalAutoStartTimeouts] = useState(getInitialState('autoStartTimeouts') as boolean);

  const [localNumRegularPeriodsInput, setLocalNumRegularPeriodsInput] = useState(getInitialState('numberOfRegularPeriods'));
  const [localNumOTPeriodsInput, setLocalNumOTPeriodsInput] = useState(getInitialState('numberOfOvertimePeriods'));
  
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);

  const setValuesFromProfile = (values: Partial<FormatAndTimingsProfileData>) => {
    setLocalWarmUpDurationInput(centisecondsToDisplayMinutes(values.defaultWarmUpDuration!));
    setLocalPeriodDurationInput(centisecondsToDisplayMinutes(values.defaultPeriodDuration!));
    setLocalOTPeriodDurationInput(centisecondsToDisplayMinutes(values.defaultOTPeriodDuration!));
    setLocalBreakDurationInput(centisecondsToDisplaySeconds(values.defaultBreakDuration!));
    setLocalPreOTBreakDurationInput(centisecondsToDisplaySeconds(values.defaultPreOTBreakDuration!));
    setLocalTimeoutDurationInput(centisecondsToDisplaySeconds(values.defaultTimeoutDuration!));
    setLocalAutoStartWarmUp(values.autoStartWarmUp!);
    setLocalAutoStartBreaks(values.autoStartBreaks!);
    setLocalAutoStartPreOTBreaks(values.autoStartPreOTBreaks!);
    setLocalAutoStartTimeouts(values.autoStartTimeouts!);
    setLocalNumRegularPeriodsInput(String(values.numberOfRegularPeriods!));
    setLocalNumOTPeriodsInput(String(values.numberOfOvertimePeriods!));
    setIsDirtyLocal(false);
  };
  
  useEffect(() => {
    if (!isDialogMode) {
      setValuesFromProfile(initialValues);
    }
  }, [initialValues, isDialogMode]);
  
  const markDirty = () => {
    if (!isDialogMode) setIsDirtyLocal(true);
  };

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string, key: keyof FormatAndTimingsProfileData, unit: 'min' | 'sec' | 'count' = 'min') => {
    setter(value);
    if(onSettingsChange) {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        let finalValue = numValue;
        if (unit === 'min') finalValue = numValue * 60 * 100;
        else if (unit === 'sec') finalValue = numValue * 100;
        onSettingsChange({ ...tempSettings, [key]: finalValue });
      }
    }
    markDirty();
  }

  const handleSwitchChange = (setter: React.Dispatch<React.SetStateAction<boolean>>, value: boolean, key: keyof FormatAndTimingsProfileData) => {
    setter(value);
    if(onSettingsChange) {
      onSettingsChange({ ...tempSettings, [key]: value });
    }
    markDirty();
  }

  useEffect(() => {
    if (!isDialogMode) onDirtyChange?.(isDirtyLocal);
  }, [isDirtyLocal, onDirtyChange, isDialogMode]);

  useImperativeHandle(ref, () => ({
    handleSave: () => {
      if (!isDirtyLocal || isDialogMode) return true;
      // ... save logic ...
      setIsDirtyLocal(false);
      return true;
    },
    handleDiscard: () => {
      if(!isDialogMode) setValuesFromProfile(initialValues);
    },
    getIsDirty: () => isDirtyLocal,
    setValues: setValuesFromProfile,
  }));

  const inputGrid = (
    <div className="grid grid-cols-[auto_theme(spacing.24)_auto_auto] items-center gap-x-3 sm:gap-x-4 gap-y-6">
      <Label htmlFor="numRegularPeriods" className="text-sm whitespace-nowrap">Períodos Regulares (Cant)</Label>
      <Input id="numRegularPeriods" type="number" value={localNumRegularPeriodsInput} onChange={(e) => handleInputChange(setLocalNumRegularPeriodsInput, e.target.value, 'numberOfRegularPeriods', 'count')} className={cn(narrowInputStyle)} placeholder="ej. 3" min="1"/>
      <Label htmlFor="periodDuration" className="text-sm whitespace-nowrap justify-self-end">Duración (Min)</Label>
      <Input id="periodDuration" type="number" value={localPeriodDurationInput} onChange={(e) => handleInputChange(setLocalPeriodDurationInput, e.target.value, 'defaultPeriodDuration', 'min')} className={cn(narrowInputStyle)} placeholder="ej. 20" min="1"/>

      <Label htmlFor="numOTPeriods" className="text-sm whitespace-nowrap">Períodos Overtime (Cant)</Label>
      <Input id="numOTPeriods" type="number" value={localNumOTPeriodsInput} onChange={(e) => handleInputChange(setLocalNumOTPeriodsInput, e.target.value, 'numberOfOvertimePeriods', 'count')} className={cn(narrowInputStyle)} placeholder="ej. 1" min="0"/>
      <Label htmlFor="otPeriodDuration" className="text-sm whitespace-nowrap justify-self-end">Duración (Min)</Label>
      <Input id="otPeriodDuration" type="number" value={localOTPeriodDurationInput} onChange={(e) => handleInputChange(setLocalOTPeriodDurationInput, e.target.value, 'defaultOTPeriodDuration', 'min')} className={cn(narrowInputStyle)} placeholder="ej. 5" min="1"/>
      
      <Label htmlFor="timeoutDurationConfig" className="text-sm whitespace-nowrap">Timeout (seg)</Label>
      <Input id="timeoutDurationConfig" type="number" value={localTimeoutDurationInput} onChange={(e) => handleInputChange(setLocalTimeoutDurationInput, e.target.value, 'defaultTimeoutDuration', 'sec')} className={cn(narrowInputStyle)} placeholder="ej. 30" min="1"/>
      <Label htmlFor="autoStartTimeoutsConfig" className="font-normal text-sm whitespace-nowrap justify-self-end">Iniciar Autom.</Label>
      <Switch id="autoStartTimeoutsConfig" checked={localAutoStartTimeouts} onCheckedChange={(c) => handleSwitchChange(setLocalAutoStartTimeouts, c, 'autoStartTimeouts')}/>

      <Label htmlFor="breakDurationConfig" className="text-sm whitespace-nowrap">Descanso Reg. (seg)</Label>
      <Input id="breakDurationConfig" type="number" value={localBreakDurationInput} onChange={(e) => handleInputChange(setLocalBreakDurationInput, e.target.value, 'defaultBreakDuration', 'sec')} className={cn(narrowInputStyle)} placeholder="ej. 120" min="1"/>
      <Label htmlFor="autoStartBreaksConfig" className="font-normal text-sm whitespace-nowrap justify-self-end">Iniciar Autom.</Label>
      <Switch id="autoStartBreaksConfig" checked={localAutoStartBreaks} onCheckedChange={(c) => handleSwitchChange(setLocalAutoStartBreaks, c, 'autoStartBreaks')}/>

      <Label htmlFor="preOTBreakDurationConfig" className="text-sm whitespace-nowrap">Descanso Pre-OT (seg)</Label>
      <Input id="preOTBreakDurationConfig" type="number" value={localPreOTBreakDurationInput} onChange={(e) => handleInputChange(setLocalPreOTBreakDurationInput, e.target.value, 'defaultPreOTBreakDuration', 'sec')} className={cn(narrowInputStyle)} placeholder="ej. 60" min="1"/>
      <Label htmlFor="autoStartPreOTBreaksConfig" className="font-normal text-sm whitespace-nowrap justify-self-end">Iniciar Autom.</Label>
      <Switch id="autoStartPreOTBreaksConfig" checked={localAutoStartPreOTBreaks} onCheckedChange={(c) => handleSwitchChange(setLocalAutoStartPreOTBreaks, c, 'autoStartPreOTBreaks')}/>

      <Label htmlFor="warmUpDurationConfig" className="text-sm whitespace-nowrap">Calentamiento (min)</Label>
      <Input id="warmUpDurationConfig" type="number" value={localWarmUpDurationInput} onChange={(e) => handleInputChange(setLocalWarmUpDurationInput, e.target.value, 'defaultWarmUpDuration', 'min')} className={cn(narrowInputStyle)} placeholder="ej. 5" min="1"/>
      <Label htmlFor="autoStartWarmUpConfig" className="font-normal text-sm whitespace-nowrap justify-self-end">Iniciar Autom.</Label>
      <Switch id="autoStartWarmUpConfig" checked={localAutoStartWarmUp} onCheckedChange={(c) => handleSwitchChange(setLocalAutoStartWarmUp, c, 'autoStartWarmUp')}/>
    </div>
  );

  if (isDialogMode) {
    return inputGrid;
  }
  
  return (
    <ControlCardWrapper title="Configuración de Tiempos, Períodos y Arranque Automático">
      {inputGrid}
    </ControlCardWrapper>
  );
});

DurationSettingsCard.displayName = "DurationSettingsCard";
