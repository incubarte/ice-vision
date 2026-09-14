"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useGameState } from "@/contexts/game-state-context";
import { useAdminMode } from "@/hooks/use-admin-mode";
import type { PlayerType, PlayerProfile, DocType } from "@/types";
import { UserPlus, Search, Link, Unlink, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AddPlayerFormProps {
  teamId: string;
}

type Mode = "search" | "new" | "linked" | "unlinked";

export function AddPlayerForm({ teamId }: AddPlayerFormProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const { adminSecret } = useAdminMode();

  // Search phase
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mode
  const [mode, setMode] = useState<Mode>("search");
  const [linkedPlayer, setLinkedPlayer] = useState<PlayerProfile | null>(null);

  // Form fields
  const [playerNumber, setPlayerNumber] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerType, setPlayerType] = useState<PlayerType>("player");
  const [docType, setDocType] = useState<DocType>("DNI");
  const [docTypeLabel, setDocTypeLabel] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const showForm = mode !== "search";

  const doSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    fetch(`/api/players?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => setResults(data.players ?? []))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const resetAll = () => {
    setMode("search");
    setQuery("");
    setResults([]);
    setLinkedPlayer(null);
    setPlayerNumber("");
    setPlayerName("");
    setPlayerType("player");
    setDocType("DNI");
    setDocTypeLabel("");
    setDocNumber("");
    setEmail("");
    setPhone("");
  };

  const selectLinked = (p: PlayerProfile) => {
    setLinkedPlayer(p);
    setPlayerName(p.name);
    setMode("linked");
    setResults([]);
    setQuery("");
  };

  const handleNewMode = () => {
    setLinkedPlayer(null);
    setPlayerName(query);
    setMode("new");
  };

  const handleUnlinked = () => {
    setLinkedPlayer(null);
    setPlayerName(query);
    setMode("unlinked");
  };

  const handlePlayerNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (/^\d*$/.test(v)) setPlayerNumber(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNumber = playerNumber.trim();
    const trimmedName = playerName.trim();

    if (!trimmedName) {
      toast({ title: "Nombre Requerido", description: "El nombre del jugador es obligatorio.", variant: "destructive" });
      return;
    }

    if (!trimmedNumber) {
      toast({ title: "Número Requerido", description: "El número de camiseta es obligatorio.", variant: "destructive" });
      return;
    }

    if (!/^\d+$/.test(trimmedNumber)) {
      toast({ title: "Número Inválido", description: "El número solo debe contener dígitos.", variant: "destructive" });
      return;
    }

    const currentTeam = state.config.activeTournament?.teams.find((t) => t.id === teamId);
    if (currentTeam?.players.some((p) => p.number === trimmedNumber)) {
      toast({
        title: "Número Duplicado",
        description: `El número #${trimmedNumber} ya existe en este equipo.`,
        variant: "destructive",
      });
      return;
    }

    if (mode === "new") {
      const trimmedDocNumber = docNumber.trim();
      if (!trimmedDocNumber) {
        toast({ title: "Documento Requerido", description: "El número de documento es obligatorio.", variant: "destructive" });
        return;
      }
    }

    let globalPlayerId: string | undefined;

    if (mode === "new") {
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
                ...(docType === "other" && docTypeLabel.trim() ? { docTypeLabel: docTypeLabel.trim() } : {}),
                docNumber: docNumber.trim(),
              },
              ...(email.trim() ? { email: email.trim() } : {}),
              ...(phone.trim() ? { phone: phone.trim() } : {}),
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Error");
        globalPlayerId = data.player?.id;
      } catch {
        toast({ title: "Error al crear perfil global", variant: "destructive" });
        return;
      }
    } else if (mode === "linked" && linkedPlayer) {
      globalPlayerId = linkedPlayer.id;
    }

    dispatch({
      type: "ADD_PLAYER_TO_TEAM",
      payload: {
        teamId,
        player: {
          number: trimmedNumber,
          name: trimmedName,
          type: playerType,
          ...(globalPlayerId ? { globalPlayerId } : {}),
          ...(mode === "linked" && linkedPlayer?.document ? { document: linkedPlayer.document } : {}),
          ...(mode === "new" && docNumber.trim()
            ? {
                document: {
                  docType,
                  ...(docType === "other" && docTypeLabel.trim() ? { docTypeLabel: docTypeLabel.trim() } : {}),
                  docNumber: docNumber.trim(),
                },
              }
            : {}),
        },
      },
    });

    toast({
      title: "Jugador Añadido",
      description: `#${trimmedNumber} ${trimmedName} añadido al equipo.`,
    });

    resetAll();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Añadir Jugador
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search phase */}
        {!showForm && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="player-search">Buscar por documento o nombre</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="player-search"
                  className="pl-8"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Número de documento o nombre..."
                />
              </div>
            </div>

            {searching && <p className="text-sm text-muted-foreground">Buscando...</p>}

            {results.length > 0 && (
              <div className="border rounded-md divide-y">
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 text-sm"
                    onClick={() => selectLinked(p)}
                  >
                    <Link className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium">{p.name}</span>
                    {p.document && (
                      <span className="text-muted-foreground">
                        — {p.document.docTypeLabel ?? p.document.docType} {p.document.docNumber}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleNewMode}>
                <UserPlus className="mr-1.5 h-4 w-4" />
                Crear nuevo jugador
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleUnlinked}>
                <Unlink className="mr-1.5 h-4 w-4" />
                Completar sin vincular
              </Button>
            </div>
          </div>
        )}

        {/* Completion form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-muted-foreground">
                {mode === "linked" ? "Vinculado al registro" : mode === "new" ? "Nuevo jugador" : "Sin vincular"}
              </span>
              <button type="button" onClick={resetAll} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Name */}
            <div>
              <Label htmlFor="form-name">Apellido, Nombre o Apodo</Label>
              {mode === "linked" ? (
                <p className="mt-1 text-sm font-medium px-3 py-2 bg-muted rounded-md">{playerName}</p>
              ) : (
                <Input
                  id="form-name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Oyarzún / Carlos Oyarzún"
                  required
                />
              )}
            </div>

            {/* Document — only for new mode */}
            {mode === "new" && (
              <>
                <div>
                  <Label>Tipo de documento</Label>
                  <RadioGroup
                    value={docType}
                    onValueChange={(v) => setDocType(v as DocType)}
                    className="flex gap-4 mt-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="DNI" id="doc-dni" />
                      <Label htmlFor="doc-dni" className="font-normal">DNI</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="other" id="doc-other" />
                      <Label htmlFor="doc-other" className="font-normal">Otro</Label>
                    </div>
                  </RadioGroup>
                </div>
                {docType === "other" && (
                  <div>
                    <Label htmlFor="doc-label">Tipo (ej: Pasaporte)</Label>
                    <Input
                      id="doc-label"
                      value={docTypeLabel}
                      onChange={(e) => setDocTypeLabel(e.target.value)}
                      placeholder="Pasaporte, CI, etc."
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="doc-number">Número de documento</Label>
                  <Input
                    id="doc-number"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    placeholder="12345678"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="new-email">Email (opcional)</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jugador@ejemplo.com"
                  />
                </div>
                <div>
                  <Label htmlFor="new-phone">Teléfono (opcional)</Label>
                  <Input
                    id="new-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+54 11 1234-5678"
                  />
                </div>
              </>
            )}

            {/* Linked: show doc read-only */}
            {mode === "linked" && linkedPlayer?.document && (
              <div>
                <Label>Documento</Label>
                <p className="mt-1 text-sm px-3 py-2 bg-muted rounded-md">
                  {linkedPlayer.document.docTypeLabel ?? linkedPlayer.document.docType}: {linkedPlayer.document.docNumber}
                </p>
              </div>
            )}

            {/* Number — always required */}
            <div>
              <Label htmlFor="form-number">Número de camiseta</Label>
              <Input
                id="form-number"
                type="text"
                inputMode="numeric"
                value={playerNumber}
                onChange={handlePlayerNumberChange}
                placeholder="Ej: 10"
                required
              />
            </div>

            {/* Player type */}
            <div>
              <Label>Tipo de Jugador</Label>
              <RadioGroup
                value={playerType}
                onValueChange={(v) => setPlayerType(v as PlayerType)}
                className="flex gap-4 mt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="player" id="type-player" />
                  <Label htmlFor="type-player" className="font-normal">Jugador</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="goalkeeper" id="type-goalkeeper" />
                  <Label htmlFor="type-goalkeeper" className="font-normal">Arquero</Label>
                </div>
              </RadioGroup>
            </div>

            <Button type="submit" className="w-full sm:w-auto">
              <UserPlus className="mr-2 h-4 w-4" />
              Añadir Jugador
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
