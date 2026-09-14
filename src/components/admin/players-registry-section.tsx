"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Users, Plus, FileText } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAdminMode } from "@/hooks/use-admin-mode";
import { useToast } from "@/hooks/use-toast";
import type { PlayerProfile, DocType } from "@/types";

export function PlayersRegistrySection() {
  const { isReadOnly, adminSecret } = useAdminMode();
  const { toast } = useToast();
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [docType, setDocType] = useState<DocType>("DNI");
  const [docTypeLabel, setDocTypeLabel] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const loadPlayers = () => {
    setLoading(true);
    fetch("/api/players")
      .then((r) => r.json())
      .then((data) => setPlayers(data.players ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPlayers(); }, []);

  const resetForm = () => {
    setName("");
    setDocType("DNI");
    setDocTypeLabel("");
    setDocNumber("");
    setEmail("");
    setPhone("");
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedDocNumber = docNumber.trim();
    if (!trimmedName || !trimmedDocNumber) {
      toast({ title: "Nombre y número de documento son requeridos", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminSecret ? { "x-admin-secret": adminSecret } : {}),
        },
        body: JSON.stringify({
          player: {
            name: trimmedName,
            document: {
              docType,
              ...(docType === "other" ? { docTypeLabel: docTypeLabel.trim() } : {}),
              docNumber: trimmedDocNumber,
            },
            ...(email.trim() ? { email: email.trim() } : {}),
            ...(phone.trim() ? { phone: phone.trim() } : {}),
          },
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      toast({ title: "Jugador creado" });
      resetForm();
      loadPlayers();
    } catch {
      toast({ title: "Error al crear jugador", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Registro de Jugadores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-muted-foreground text-sm">Cargando...</p>
        ) : players.length === 0 && !showForm ? (
          <p className="text-muted-foreground text-sm">No hay jugadores registrados.</p>
        ) : (
          <div className="space-y-2">
            {players.map((p) => (
              <div key={p.id} className="py-1 border-b last:border-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-sm">{p.name}</span>
                  {p.document && (
                    <span className="text-xs text-muted-foreground">
                      {p.document.docTypeLabel ?? p.document.docType} {p.document.docNumber}
                    </span>
                  )}
                </div>
                {(p.email || p.phone) && (
                  <div className="ml-6 flex gap-3 mt-0.5">
                    {p.email && <span className="text-xs text-muted-foreground">{p.email}</span>}
                    {p.phone && <span className="text-xs text-muted-foreground">{p.phone}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
            <div>
              <Label htmlFor="reg-name">Nombre</Label>
              <Input
                id="reg-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Apellido, Nombre"
                required
              />
            </div>
            <div>
              <Label>Tipo de documento</Label>
              <RadioGroup
                value={docType}
                onValueChange={(v) => setDocType(v as DocType)}
                className="flex gap-4 mt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="DNI" id="reg-dni" />
                  <Label htmlFor="reg-dni" className="font-normal">DNI</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id="reg-other" />
                  <Label htmlFor="reg-other" className="font-normal">Otro</Label>
                </div>
              </RadioGroup>
            </div>
            {docType === "other" && (
              <div>
                <Label htmlFor="reg-doc-label">Tipo (ej: Pasaporte)</Label>
                <Input
                  id="reg-doc-label"
                  value={docTypeLabel}
                  onChange={(e) => setDocTypeLabel(e.target.value)}
                  placeholder="Pasaporte, CI, etc."
                />
              </div>
            )}
            <div>
              <Label htmlFor="reg-doc-number">Número de documento</Label>
              <Input
                id="reg-doc-number"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="12345678"
                required
              />
            </div>
            <div>
              <Label htmlFor="reg-email">Email (opcional)</Label>
              <Input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@ejemplo.com"
              />
            </div>
            <div>
              <Label htmlFor="reg-phone">Teléfono (opcional)</Label>
              <Input
                id="reg-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+54 11 1234-5678"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isReadOnly || saving}>
                Guardar jugador
              </Button>
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {!showForm && !isReadOnly && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Jugador
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
