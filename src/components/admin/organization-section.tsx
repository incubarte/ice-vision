"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Building2 } from "lucide-react";
import { useAdminMode } from "@/hooks/use-admin-mode";
import { useToast } from "@/hooks/use-toast";
import type { Organization } from "@/types";

export function OrganizationSection() {
  const { isReadOnly, adminSecret } = useAdminMode();
  const { toast } = useToast();
  const [org, setOrg] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/organization")
      .then((r) => r.json())
      .then((data) => {
        if (data.organization) {
          setOrg(data.organization);
          setName(data.organization.name);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ title: "Nombre requerido", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: Organization = {
      id: org?.id ?? crypto.randomUUID(),
      name: trimmed,
      createdAt: org?.createdAt ?? new Date().toISOString(),
    };
    try {
      const res = await fetch("/api/organization", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminSecret ? { "x-admin-secret": adminSecret } : {}),
        },
        body: JSON.stringify({ organization: payload }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setOrg(payload);
      setEditing(false);
      toast({ title: "Organización guardada" });
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Organización
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-muted-foreground text-sm">Cargando...</p>
        ) : org && !editing ? (
          <div className="flex items-center justify-between">
            <span className="font-medium">{org.name}</span>
            {!isReadOnly && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Editar
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="org-name">Nombre de la organización</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Liga de Hockey Metropolitana"
                disabled={isReadOnly}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isReadOnly || saving}>
                {org ? "Guardar cambios" : "Crear organización"}
              </Button>
              {org && (
                <Button variant="ghost" onClick={() => { setEditing(false); setName(org.name); }}>
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
