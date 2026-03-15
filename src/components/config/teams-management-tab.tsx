

"use client";

import React, { useState, useMemo, useRef } from "react";
import { useGameState } from "@/contexts/game-state-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Search, Users, Info, Upload, Download, ListFilter, FileText, Trash2, X } from "lucide-react";
import { TeamListItem } from "@/components/teams/team-list-item";
import { CreateEditTeamDialog } from "@/components/teams/create-edit-team-dialog";
import { HockeyPuckSpinner } from "@/components/ui/hockey-puck-spinner";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import type { TeamData, Tournament } from "@/types";
import { getCategoryNameById } from "@/lib/game-helpers";
import { Separator } from "@/components/ui/separator";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImportTeamsDialog } from "@/components/teams/import-teams-dialog";

const ALL_CATEGORIES_FILTER_KEY = "__ALL_CATEGORIES_FILTER_KEY__";
const NO_CATEGORIES_PLACEHOLDER_VALUE_TAB = "__NO_CATEGORIES_DEFINED_TAB__";

interface TeamsManagementTabProps {
  tournamentId?: string;
}

export function TeamsManagementTab({ tournamentId }: TeamsManagementTabProps = {}) {
  const { state, dispatch, isLoading } = useGameState();
  const { tournaments, selectedTournamentId, activeTournament } = state.config;
  const router = useRouter();
  const { toast } = useToast();

  const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY === 'true';

  // Use tournamentId prop if provided, otherwise fall back to selectedTournamentId from state
  const activeTournamentId = tournamentId || selectedTournamentId;

  const selectedTournament = useMemo(() => {
    if (activeTournament?.id === activeTournamentId) {
      return activeTournament;
    }
    // Fallback to metadata for basic info, but we won't have teams/categories
    return (tournaments || []).find(t => t.id === activeTournamentId);
  }, [activeTournament, activeTournamentId, tournaments]);

  const isHydrated = !!(selectedTournament && 'teams' in selectedTournament);
  const teams = isHydrated ? (selectedTournament as Tournament).teams : [];
  const availableCategories = isHydrated ? (selectedTournament as Tournament).categories : [];

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES_FILTER_KEY);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [currentExportFilename, setCurrentExportFilename] = useState('');

  const [isDeleteSelectionMode, setIsDeleteSelectionMode] = useState(false);
  const [selectedTeamIdsForDeletion, setSelectedTeamIdsForDeletion] = useState<string[]>([]);
  const [isConfirmMassDeleteOpen, setIsConfirmMassDeleteOpen] = useState(false);

  const filteredTeams = useMemo(() => {
    let teamsToFilter = teams;

    if (categoryFilter && categoryFilter !== ALL_CATEGORIES_FILTER_KEY) {
      teamsToFilter = teamsToFilter.filter((team) => team.category === categoryFilter);
    }

    if (!searchTerm.trim()) {
      return teamsToFilter.sort((a, b) => a.name.localeCompare(b.name));
    }
    return teamsToFilter.filter((team) =>
      team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (team.subName && team.subName.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, searchTerm, categoryFilter]);


  const prepareExportTeams = () => {
    if (!selectedTournament) return;
    const date = new Date();
    const dateString = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    const suggestedFilename = `icevision_${selectedTournament.name.replace(/\s/g, '_')}_equipos_${dateString}.json`;
    setCurrentExportFilename(suggestedFilename);
    setIsExportDialogOpen(true);
  };

  const performExport = (filename: string) => {
    if (!filename.trim().endsWith('.json')) {
      filename = filename.trim() + '.json';
    }
    if (filename.trim() === '.json') {
      toast({
        title: "Nombre de Archivo Inválido",
        description: "El nombre del archivo no puede estar vacío.",
        variant: "destructive",
      });
      return;
    }

    const jsonString = JSON.stringify(teams, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename.trim();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Equipos Exportados",
      description: `Archivo ${filename.trim()} descargado con ${teams.length} equipo(s).`,
    });
    setIsExportDialogOpen(false);
  };


  const handleToggleTeamSelectionForDeletion = (teamId: string) => {
    setSelectedTeamIdsForDeletion(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  const handleConfirmMassDelete = () => {
    if (selectedTeamIdsForDeletion.length === 0 || !activeTournamentId) return;

    dispatch({ type: "DELETE_TEAMS_FROM_TOURNAMENT", payload: { tournamentId: activeTournamentId, teamIds: selectedTeamIdsForDeletion } });

    toast({
      title: "Equipos Eliminados",
      description: `${selectedTeamIdsForDeletion.length} equipo(s) han sido eliminados.`,
      variant: "destructive"
    });
    setSelectedTeamIdsForDeletion([]);
    setIsDeleteSelectionMode(false);
    setIsConfirmMassDeleteOpen(false);
  };


  if (!selectedTournament) {
    return (
      <div className="text-center py-12">
        <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold text-card-foreground mb-2">
          Ningún Torneo Seleccionado
        </h3>
        <p className="text-muted-foreground mb-4">
          Por favor, selecciona un torneo activo desde el menú principal para gestionar sus equipos y categorías.
        </p>
      </div>
    );
  }

  if (!isHydrated) {
    return (
      <div className="text-center py-12">
        <HockeyPuckSpinner className="h-12 w-12 text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Hydrating tournament data...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-primary-foreground">Gestión de Equipos</h1>
        </div>
        {!isDeleteSelectionMode && !isReadOnly && (
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-5 w-5" /> Crear Nuevo Equipo
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nombre o sub-nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 text-base"
            disabled={isDeleteSelectionMode}
          />
        </div>
        <div className="sm:w-auto min-w-[200px]">
          <Select value={categoryFilter} onValueChange={setCategoryFilter} disabled={isDeleteSelectionMode}>
            <SelectTrigger className="w-full text-base h-10">
              <ListFilter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Filtrar por categoría..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES_FILTER_KEY}>Todas las Categorías</SelectItem>
              {availableCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id} className="text-sm">
                  {cat.name}
                </SelectItem>
              ))}
              {availableCategories.length === 0 && (
                <SelectItem value={NO_CATEGORIES_PLACEHOLDER_VALUE_TAB} disabled>No hay categorías definidas</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>


      {isLoading ? (
        <p className="text-center text-muted-foreground">Cargando equipos...</p>
      ) : filteredTeams.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeams.map((team) => (
            <TeamListItem
              key={team.id}
              team={team}
              categoryName={getCategoryNameById(team.category, availableCategories) || "Sin Categoría"}
              isSelectionMode={isDeleteSelectionMode}
              isSelected={selectedTeamIdsForDeletion.includes(team.id)}
              onToggleSelection={handleToggleTeamSelectionForDeletion}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-card-foreground mb-2">
            {teams.length === 0
              ? "No hay equipos creados en este torneo"
              : (searchTerm || (categoryFilter && categoryFilter !== ALL_CATEGORIES_FILTER_KEY))
                ? "No se encontraron equipos con los filtros aplicados"
                : "No se encontraron equipos"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {teams.length === 0
              ? "Comienza creando tu primer equipo."
              : "Intenta con otros filtros o crea un nuevo equipo."}
          </p>
          {(searchTerm || (categoryFilter && categoryFilter !== ALL_CATEGORIES_FILTER_KEY)) && teams.length > 0 && !isDeleteSelectionMode && !isReadOnly && (
            <Button variant="outline" onClick={() => { setSearchTerm(""); setCategoryFilter(ALL_CATEGORIES_FILTER_KEY); }}>Limpiar filtros</Button>
          )}
        </div>
      )}

      {!isReadOnly && (
        <>
          <Separator className="my-10" />

          <div className="space-y-6 p-6 border rounded-md bg-card">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-primary-foreground">Acciones de Datos de Equipos</h2>
              {isDeleteSelectionMode ? (
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => setIsConfirmMassDeleteOpen(true)}
                    disabled={selectedTeamIdsForDeletion.length === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Confirmar Eliminación ({selectedTeamIdsForDeletion.length})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDeleteSelectionMode(false);
                      setSelectedTeamIdsForDeletion([]);
                    }}
                  >
                    <X className="mr-2 h-4 w-4" /> Cancelar Selección
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteSelectionMode(true)}
                  disabled={teams.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Seleccionar para Eliminar
                </Button>
              )}
            </div>
            {!isDeleteSelectionMode && (
              <>
                <p className="text-sm text-muted-foreground">
                  Importa o exporta los equipos del torneo actual.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Button onClick={prepareExportTeams} variant="outline" className="flex-1" disabled={teams.length === 0}>
                    <Download className="mr-2 h-4 w-4" /> Exportar Equipos (JSON)
                  </Button>
                  <Button onClick={() => setIsImportDialogOpen(true)} variant="outline" className="flex-1">
                    <Upload className="mr-2 h-4 w-4" /> Importar Equipos (CSV/JSON)
                  </Button>
                </div>
              </>
            )}
            {isDeleteSelectionMode && (
              <p className="text-sm text-muted-foreground">
                Selecciona los equipos que deseas eliminar de la lista de arriba. Luego confirma la eliminación o cancela.
              </p>
            )}
          </div>
        </>
      )}


      <CreateEditTeamDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onTeamSaved={() => { }}
        tournamentId={activeTournamentId}
      />

      {isExportDialogOpen && (
        <AlertDialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Nombre del Archivo de Exportación</AlertDialogTitle>
              <AlertDialogDescription>
                Ingresa el nombre deseado para el archivo de equipos. Se añadirá la extensión ".json" automáticamente si no se incluye.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={currentExportFilename}
              onChange={(e) => setCurrentExportFilename(e.target.value)}
              placeholder="nombre_de_archivo_equipos.json"
              className="my-4"
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsExportDialogOpen(false)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => performExport(currentExportFilename)}>
                Exportar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <ImportTeamsDialog
        isOpen={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        tournament={isHydrated ? (selectedTournament as Tournament) : null}
      />

      {isConfirmMassDeleteOpen && (
        <AlertDialog open={isConfirmMassDeleteOpen} onOpenChange={setIsConfirmMassDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Eliminación Múltiple</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que quieres eliminar los {selectedTeamIdsForDeletion.length} equipos seleccionados? Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsConfirmMassDeleteOpen(false)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmMassDelete} className="bg-destructive hover:bg-destructive/90">
                Eliminar Equipos
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
