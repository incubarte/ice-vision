"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Plus, Trash2, Edit3, CheckCircle, XCircle } from "lucide-react";
import { useGameState } from "@/contexts/game-state-context";
import { useToast } from "@/hooks/use-toast";
import type { StaffMember, StaffRole } from "@/types";

interface StaffManagementTabProps {
  tournamentId: string;
}

export function StaffManagementTab({ tournamentId }: StaffManagementTabProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY === 'true';

  const tournament = state.config.activeTournament;
  const staff = tournament?.staff || [];

  const [showAddForm, setShowAddForm] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newRoles, setNewRoles] = useState<StaffRole[]>([]);

  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editRoles, setEditRoles] = useState<StaffRole[]>([]);

  const handleAddStaff = () => {
    const trimmedFirstName = newFirstName.trim();
    const trimmedLastName = newLastName.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      toast({
        title: "Datos Incompletos",
        description: "Por favor ingresa nombre y apellido.",
        variant: "destructive"
      });
      return;
    }

    if (newRoles.length === 0) {
      toast({
        title: "Rol Requerido",
        description: "Por favor selecciona al menos un rol.",
        variant: "destructive"
      });
      return;
    }

    dispatch({
      type: 'ADD_STAFF_TO_TOURNAMENT',
      payload: {
        tournamentId,
        staff: {
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          roles: newRoles
        }
      }
    });

    // Reset form
    setNewFirstName("");
    setNewLastName("");
    setNewRoles([]);
    setShowAddForm(false);
  };

  const handleStartEdit = (staffMember: StaffMember) => {
    setEditingStaffId(staffMember.id);
    setEditFirstName(staffMember.firstName);
    setEditLastName(staffMember.lastName);
    setEditRoles([...staffMember.roles]);
  };

  const handleSaveEdit = () => {
    if (!editingStaffId) return;

    const trimmedFirstName = editFirstName.trim();
    const trimmedLastName = editLastName.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      toast({
        title: "Datos Incompletos",
        description: "Por favor ingresa nombre y apellido.",
        variant: "destructive"
      });
      return;
    }

    if (editRoles.length === 0) {
      toast({
        title: "Rol Requerido",
        description: "Por favor selecciona al menos un rol.",
        variant: "destructive"
      });
      return;
    }

    dispatch({
      type: 'UPDATE_STAFF_IN_TOURNAMENT',
      payload: {
        tournamentId,
        staffId: editingStaffId,
        updates: {
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          roles: editRoles
        }
      }
    });

    setEditingStaffId(null);
  };

  const handleCancelEdit = () => {
    setEditingStaffId(null);
  };

  const handleRemoveStaff = (staffId: string) => {
    if (!confirm("¿Estás seguro de eliminar este miembro del staff?")) return;

    dispatch({
      type: 'REMOVE_STAFF_FROM_TOURNAMENT',
      payload: { tournamentId, staffId }
    });
  };

  const toggleRole = (role: StaffRole, isNew: boolean) => {
    if (isNew) {
      setNewRoles(prev =>
        prev.includes(role)
          ? prev.filter(r => r !== role)
          : [...prev, role]
      );
    } else {
      setEditRoles(prev =>
        prev.includes(role)
          ? prev.filter(r => r !== role)
          : [...prev, role]
      );
    }
  };

  const getRoleLabel = (role: StaffRole) => {
    return role === 'mesa' ? 'Mesa' : 'Árbitro';
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staff del Torneo
            </CardTitle>
            {!isReadOnly && !showAddForm && (
              <Button onClick={() => setShowAddForm(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Staff
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <Card className="mb-4 bg-muted/30">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nombre</Label>
                    <Input
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      placeholder="Nombre"
                    />
                  </div>
                  <div>
                    <Label>Apellido</Label>
                    <Input
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                      placeholder="Apellido"
                    />
                  </div>
                </div>

                <div>
                  <Label>Roles</Label>
                  <div className="flex gap-4 mt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="new-role-mesa"
                        checked={newRoles.includes('mesa')}
                        onCheckedChange={() => toggleRole('mesa', true)}
                      />
                      <label
                        htmlFor="new-role-mesa"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Mesa
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="new-role-referee"
                        checked={newRoles.includes('referee')}
                        onCheckedChange={() => toggleRole('referee', true)}
                      />
                      <label
                        htmlFor="new-role-referee"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Árbitro
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAddStaff} size="sm">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Guardar
                  </Button>
                  <Button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewFirstName("");
                      setNewLastName("");
                      setNewRoles([]);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {staff.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay staff registrado. Agrega miembros del staff para poder asignarlos a partidos.
            </p>
          ) : (
            <div className="space-y-2">
              {staff.map((staffMember) => {
                const isEditing = editingStaffId === staffMember.id;

                return (
                  <Card key={staffMember.id} className="bg-muted/30">
                    <CardContent className="p-3">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Nombre</Label>
                              <Input
                                value={editFirstName}
                                onChange={(e) => setEditFirstName(e.target.value)}
                                placeholder="Nombre"
                              />
                            </div>
                            <div>
                              <Label>Apellido</Label>
                              <Input
                                value={editLastName}
                                onChange={(e) => setEditLastName(e.target.value)}
                                placeholder="Apellido"
                              />
                            </div>
                          </div>

                          <div>
                            <Label>Roles</Label>
                            <div className="flex gap-4 mt-2">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`edit-role-mesa-${staffMember.id}`}
                                  checked={editRoles.includes('mesa')}
                                  onCheckedChange={() => toggleRole('mesa', false)}
                                />
                                <label
                                  htmlFor={`edit-role-mesa-${staffMember.id}`}
                                  className="text-sm font-medium"
                                >
                                  Mesa
                                </label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`edit-role-referee-${staffMember.id}`}
                                  checked={editRoles.includes('referee')}
                                  onCheckedChange={() => toggleRole('referee', false)}
                                />
                                <label
                                  htmlFor={`edit-role-referee-${staffMember.id}`}
                                  className="text-sm font-medium"
                                >
                                  Árbitro
                                </label>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button onClick={handleSaveEdit} size="sm">
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Guardar
                            </Button>
                            <Button onClick={handleCancelEdit} variant="outline" size="sm">
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">
                              {staffMember.firstName} {staffMember.lastName}
                            </p>
                            <div className="flex gap-2 mt-1">
                              {staffMember.roles.map((role) => (
                                <span
                                  key={role}
                                  className={`text-xs px-2 py-1 rounded font-medium ${
                                    role === 'mesa'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                      : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                                  }`}
                                >
                                  {getRoleLabel(role)}
                                </span>
                              ))}
                            </div>
                          </div>
                          {!isReadOnly && (
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleStartEdit(staffMember)}
                                variant="ghost"
                                size="sm"
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                onClick={() => handleRemoveStaff(staffMember.id)}
                                variant="ghost"
                                size="sm"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
