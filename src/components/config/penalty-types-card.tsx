
"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useGameState, type FormatAndTimingsProfileData, type PenaltyTypeDefinition, formatTime } from "@/contexts/game-state-context";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Edit3, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { safeUUID } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import { Checkbox } from "../ui/checkbox";

export interface PenaltyTypesCardRef {
  handleSave: () => boolean;
  handleDiscard: () => void;
  getIsDirty: () => boolean;
  setValues: (values: Partial<FormatAndTimingsProfileData>) => void;
}

interface PenaltyTypesCardProps {
  onDirtyChange: (isDirty: boolean) => void;
  initialValues: Partial<FormatAndTimingsProfileData>;
}

export const PenaltyTypesCard = forwardRef<PenaltyTypesCardRef, PenaltyTypesCardProps>((props, ref) => {
  const { state, dispatch } = useGameState();
  const { onDirtyChange, initialValues } = props;
  const { toast } = useToast();
  
  const [localPenaltyTypes, setLocalPenaltyTypes] = useState<PenaltyTypeDefinition[]>(initialValues.penaltyTypes || []);
  const [localDefaultPenaltyId, setLocalDefaultPenaltyId] = useState<string | null>(initialValues.defaultPenaltyTypeId || null);
  const [editingPenalty, setEditingPenalty] = useState<PenaltyTypeDefinition | null>(null);
  
  const [enableMaxPenalties, setEnableMaxPenalties] = useState(initialValues.enableMaxPenaltiesLimit || false);
  const [maxPenalties, setMaxPenalties] = useState(String(initialValues.maxPenaltiesPerPlayer || ''));
  
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);
  
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  const setValuesFromProfile = (values: Partial<FormatAndTimingsProfileData>) => {
    setLocalPenaltyTypes(values.penaltyTypes || []);
    setLocalDefaultPenaltyId(values.defaultPenaltyTypeId || null);
    setEnableMaxPenalties(values.enableMaxPenaltiesLimit || false);
    setMaxPenalties(String(values.maxPenaltiesPerPlayer || ''));
    setIsDirtyLocal(false);
  };

  useEffect(() => {
    setValuesFromProfile(initialValues);
  }, [initialValues]);

  // This is no longer truly necessary as we save automatically, but kept for parent component structure.
  useEffect(() => {
    onDirtyChange(isDirtyLocal);
  }, [isDirtyLocal, onDirtyChange]);


  const dispatchUpdate = (updates: Partial<FormatAndTimingsProfileData>) => {
    dispatch({
      type: "UPDATE_SELECTED_FT_PROFILE_DATA",
      payload: updates
    });
  };

  // Imperative handles are kept for API consistency, but their internal logic can be simplified
  // as they are no longer strictly needed for this component's auto-saving behavior.
  useImperativeHandle(ref, () => ({
    handleSave: () => true, // Always returns true as changes are saved instantly
    handleDiscard: () => {}, // Discard is a no-op as there are no 'dirty' states
    getIsDirty: () => false, // Always returns false
    setValues: setValuesFromProfile,
  }));
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    setDraggedItemId(id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); 
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!draggedItemId || draggedItemId === targetId) return;

    const currentPenalties = state.config.penaltyTypes || [];
    const draggedIndex = currentPenalties.findIndex(p => p.id === draggedItemId);
    const targetIndex = currentPenalties.findIndex(p => p.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const reorderedPenalties = [...currentPenalties];
    const [draggedItem] = reorderedPenalties.splice(draggedIndex, 1);
    reorderedPenalties.splice(targetIndex, 0, draggedItem);
    
    dispatchUpdate({ penaltyTypes: reorderedPenalties });
    toast({ title: "Orden de Penalidades Actualizado" });
    setDraggedItemId(null);
  };

  const handleAddNewPenalty = () => {
    setEditingPenalty({ id: safeUUID(), name: '', duration: 120, reducesPlayerCount: true, clearsOnGoal: true, isBenchPenalty: false });
  };
  
  const handleEditPenalty = (penalty: PenaltyTypeDefinition) => {
    setEditingPenalty(penalty);
  };

  const handleDeletePenalty = (id: string) => {
    const newPenalties = (state.config.penaltyTypes || []).filter(p => p.id !== id);
    let newDefaultId = state.config.defaultPenaltyTypeId;
    if (newDefaultId === id) {
        newDefaultId = newPenalties[0]?.id || null;
    }
    dispatchUpdate({ penaltyTypes: newPenalties, defaultPenaltyTypeId: newDefaultId });
    toast({ title: "Tipo de Penalidad Eliminado", variant: "destructive"});
  };

  const handleSavePenalty = (penaltyToSave: PenaltyTypeDefinition) => {
    const currentPenalties = state.config.penaltyTypes || [];
    const isNew = !currentPenalties.some(p => p.id === penaltyToSave.id);
    let newPenalties;
    if (isNew) {
      newPenalties = [...currentPenalties, penaltyToSave];
    } else {
      newPenalties = currentPenalties.map(p => p.id === penaltyToSave.id ? penaltyToSave : p);
    }
    dispatchUpdate({ penaltyTypes: newPenalties });
    toast({ title: "Lista de penalidades guardada" });
    setEditingPenalty(null);
  };

  return (
    <ControlCardWrapper title="Configuración Avanzada de Penalidades">
      <div className="space-y-4">
        <div>
          <Label htmlFor="defaultPenaltyType">Falta por Defecto</Label>
          <Select 
            value={state.config.defaultPenaltyTypeId || ""}
            onValueChange={val => { dispatchUpdate({ defaultPenaltyTypeId: val }); }}
            disabled={(state.config.penaltyTypes || []).length === 0}
          >
            <SelectTrigger id="defaultPenaltyType">
              <SelectValue placeholder="Seleccionar falta por defecto..." />
            </SelectTrigger>
            <SelectContent>
              {(state.config.penaltyTypes || []).length > 0 ? (
                (state.config.penaltyTypes || []).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({formatTime(p.duration * 100)})</SelectItem>
                ))
              ) : (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">No hay tipos definidos</div>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1.5">
            Esta será la penalidad preseleccionada en el tablero de controles.
          </p>
        </div>

        <div className="space-y-2">
            <Label>Lista de Tipos de Faltas (Arrastra para reordenar)</Label>
            <div className="border rounded-md p-2 space-y-2 max-h-60 overflow-y-auto">
              {(state.config.penaltyTypes || []).length > 0 ? (
                (state.config.penaltyTypes || []).map(p => (
                  <div 
                    key={p.id} 
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                    draggable
                    onDragStart={(e) => handleDragStart(e, p.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, p.id)}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{formatTime(p.duration * 100)}{p.isBenchPenalty ? ' (Banco)' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditPenalty(p)}>
                         <Edit3 className="h-4 w-4" />
                       </Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeletePenalty(p.id)}>
                         <Trash2 className="h-4 w-4" />
                       </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-center text-muted-foreground py-4">No hay tipos de penalidades definidos.</p>
              )}
            </div>
            <Button onClick={handleAddNewPenalty} variant="outline" className="mt-2 w-full">
                <Plus className="mr-2 h-4 w-4" /> Añadir Nuevo Tipo de Penalidad
            </Button>
        </div>

        <Separator />

        <div>
          <Label>Expulsión de Partido</Label>
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
              <div>
                <Label htmlFor="enableMatchExpulsion" className="font-normal">Habilitar expulsión de partido</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Aparece al final de la lista en el panel de control y muestra un cartel en el tablero.</p>
              </div>
              <Switch id="enableMatchExpulsion" checked={state.config.enableMatchExpulsion ?? true} onCheckedChange={(c) => dispatchUpdate({ enableMatchExpulsion: c })} />
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <Label>Límites de Penalidades por Jugador</Label>
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
              <Label htmlFor="enableMaxPenalties" className="font-normal">Habilitar límite de cantidad de penalidades</Label>
              <Switch id="enableMaxPenalties" checked={state.config.enableMaxPenaltiesLimit} onCheckedChange={(c) => { dispatchUpdate({ enableMaxPenaltiesLimit: c }); }} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
              <Label htmlFor="maxPenaltiesPerPlayer" className="font-normal">Cantidad máxima de penalidades</Label>
              <Input id="maxPenaltiesPerPlayer" type="number" value={state.config.maxPenaltiesPerPlayer} onBlur={(e) => { dispatchUpdate({ maxPenaltiesPerPlayer: parseInt(e.target.value, 10) || 3 }); }} onChange={e => {
                // This local state change is only for user input typing, the blur event saves it.
                // This is a common pattern for controlled inputs that save on blur.
              }} disabled={!state.config.enableMaxPenaltiesLimit} className="w-20 h-8" />
            </div>
          </div>
        </div>
      </div>
      
      {editingPenalty && (
        <EditPenaltyDialog
          penalty={editingPenalty}
          isOpen={!!editingPenalty}
          onOpenChange={(isOpen) => !isOpen && setEditingPenalty(null)}
          onSave={handleSavePenalty}
        />
      )}
    </ControlCardWrapper>
  );
});

PenaltyTypesCard.displayName = "PenaltyTypesCard";


function EditPenaltyDialog({ penalty, isOpen, onOpenChange, onSave }: { penalty: PenaltyTypeDefinition, isOpen: boolean, onOpenChange: (open: boolean) => void, onSave: (penalty: PenaltyTypeDefinition) => void }) {
  const [name, setName] = useState(penalty.name);
  const [duration, setDuration] = useState(String(penalty.duration));
  const [reducesPlayerCount, setReducesPlayerCount] = useState(penalty.reducesPlayerCount);
  const [clearsOnGoal, setClearsOnGoal] = useState(penalty.clearsOnGoal);
  const [isBenchPenalty, setIsBenchPenalty] = useState(penalty.isBenchPenalty || false);

  const handleSubmit = () => {
    const durationNum = parseInt(duration, 10);
    if (!name.trim() || isNaN(durationNum) || durationNum <= 0) {
      // Basic validation
      return;
    }
    onSave({ ...penalty, name: name.trim(), duration: durationNum, reducesPlayerCount, clearsOnGoal, isBenchPenalty });
  };
  
  return (
     <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{penalty.name ? "Editar" : "Añadir"} Tipo de Penalidad</DialogTitle>
            <DialogDescription>Define los detalles de este tipo de falta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
              <div>
                  <Label htmlFor="penaltyName">Nombre</Label>
                  <Input id="penaltyName" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Menor, Mayor"/>
              </div>
              <div>
                  <Label htmlFor="penaltyDuration">Duración (en segundos)</Label>
                  <Input id="penaltyDuration" type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="Ej: 120"/>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="reducesPlayerCount" checked={reducesPlayerCount} onCheckedChange={c => setReducesPlayerCount(!!c)} />
                <Label htmlFor="reducesPlayerCount" className="font-normal">Reduce jugadores en juego</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="clearsOnGoal" checked={clearsOnGoal} onCheckedChange={c => setClearsOnGoal(!!c)} />
                <Label htmlFor="clearsOnGoal" className="font-normal">Se elimina por gol en contra</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="isBenchPenalty" checked={isBenchPenalty} onCheckedChange={c => setIsBenchPenalty(!!c)} />
                <Label htmlFor="isBenchPenalty" className="font-normal">Es una Penalidad de Banco</Label>
              </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSubmit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
