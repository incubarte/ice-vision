
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useGameState } from "@/contexts/game-state-context";
import type { PlayerType } from "@/types";
import { UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


interface AddPlayerFormProps {
  teamId: string;
}

export function AddPlayerForm({ teamId }: AddPlayerFormProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const [playerNumber, setPlayerNumber] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerType, setPlayerType] = useState<PlayerType>("player");

  const handlePlayerNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      setPlayerNumber(value);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPlayerNumber = playerNumber.trim();
    const trimmedPlayerName = playerName.trim();

    if (!trimmedPlayerName) {
      toast({
        title: "Nombre Requerido",
        description: "El nombre/apodo del jugador es obligatorio.",
        variant: "destructive",
      });
      return;
    }

    if (trimmedPlayerNumber) {
        if (!/^\d+$/.test(trimmedPlayerNumber)) {
            toast({
                title: "Número de Jugador Inválido",
                description: "El número del jugador solo debe contener dígitos si se proporciona.",
                variant: "destructive",
            });
            return;
        }

        const currentTournament = state.config.activeTournament;
        const currentTeam = currentTournament?.teams.find(t => t.id === teamId);

        if (currentTeam && currentTeam.players.some(p => p.number === trimmedPlayerNumber)) {
          toast({
            title: "Número de Jugador Duplicado",
            description: `El número #${trimmedPlayerNumber} ya existe en este equipo. Por favor, elige otro.`,
            variant: "destructive",
          });
          return;
        }
    }


    dispatch({
      type: "ADD_PLAYER_TO_TEAM",
      payload: {
        teamId,
        player: {
          number: trimmedPlayerNumber,
          name: trimmedPlayerName,
          type: playerType,
        },
      },
    });

    toast({
      title: "Jugador Añadido",
      description: `Jugador ${trimmedPlayerNumber ? `#${trimmedPlayerNumber} ` : ''}${trimmedPlayerName} añadido al equipo.`,
    });

    setPlayerNumber("");
    setPlayerName("");
    setPlayerType("player");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Añadir Nuevo Jugador</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="playerNumber">Número (Opcional)</Label>
              <Input
                id="playerNumber"
                type="text" 
                inputMode="numeric"
                value={playerNumber}
                onChange={handlePlayerNumberChange}
                placeholder="Ej: 10 (o dejar vacío)"
              />
            </div>
             <div>
              <Label htmlFor="playerName">Apellido, Nombre o Apodo</Label>
              <Input
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Oyarzún / Carlos Oyarzún / Tachuela"
                required
              />
            </div>
          </div>

          <div>
            <Label>Tipo de Jugador</Label>
            <RadioGroup
              value={playerType}
              onValueChange={(value) => setPlayerType(value as PlayerType)}
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
            <UserPlus className="mr-2 h-4 w-4" /> Añadir Jugador
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
