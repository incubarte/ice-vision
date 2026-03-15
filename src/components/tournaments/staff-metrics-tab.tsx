"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Flag, Users } from "lucide-react";
import { useGameState } from "@/contexts/game-state-context";
import { useRefereeStats, useMesaStats } from "@/hooks/use-staff-stats";
import type { StaffMatchStats } from "@/hooks/use-staff-stats";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface StaffMetricsTabProps {
  tournamentId: string;
}

export function StaffMetricsTab({ tournamentId }: StaffMetricsTabProps) {
  const { state } = useGameState();
  const tournament = state.config.activeTournament;

  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const refereeStats = useRefereeStats(tournament, categoryFilter === "all" ? undefined : categoryFilter);
  const mesaStats = useMesaStats(tournament, categoryFilter === "all" ? undefined : categoryFilter);

  const categories = tournament?.categories || [];

  if (!tournament) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        Torneo no encontrado
      </div>
    );
  }

  if (!tournament.staff || tournament.staff.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        No hay staff registrado en este torneo. Agrega staff desde la pestaña "Staff".
      </div>
    );
  }

  const RefereeStatsTable = ({ stats, title, icon }: { stats: StaffMatchStats[]; title: string; icon: React.ReactNode }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No hay datos disponibles{categoryFilter !== "all" ? " para la categoría seleccionada" : ""}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-center">Partidos</TableHead>
                  <TableHead className="text-center">Principal</TableHead>
                  <TableHead className="text-center">2º</TableHead>
                  <TableHead className="text-center">3º</TableHead>
                  <TableHead className="text-center">Goles</TableHead>
                  <TableHead className="text-center">Faltas</TableHead>
                  <TableHead className="text-center">Goles/Partido</TableHead>
                  <TableHead className="text-center">Faltas/Partido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((stat) => (
                  <TableRow key={stat.staffId}>
                    <TableCell className="font-medium">{stat.staffName}</TableCell>
                    <TableCell className="text-center">{stat.totalMatches}</TableCell>
                    <TableCell className="text-center">{stat.asPrincipal}</TableCell>
                    <TableCell className="text-center">{stat.asSecond}</TableCell>
                    <TableCell className="text-center">{stat.asThird}</TableCell>
                    <TableCell className="text-center">{stat.totalGoals}</TableCell>
                    <TableCell className="text-center">{stat.totalPenalties}</TableCell>
                    <TableCell className="text-center">{stat.avgGoalsPerMatch.toFixed(1)}</TableCell>
                    <TableCell className="text-center">{stat.avgPenaltiesPerMatch.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const MesaStatsTable = ({ stats, title, icon }: { stats: StaffMatchStats[]; title: string; icon: React.ReactNode }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No hay datos disponibles{categoryFilter !== "all" ? " para la categoría seleccionada" : ""}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-center">Partidos</TableHead>
                  <TableHead className="text-center">Principal</TableHead>
                  <TableHead className="text-center">2º</TableHead>
                  <TableHead className="text-center">3º</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((stat) => (
                  <TableRow key={stat.staffId}>
                    <TableCell className="font-medium">{stat.staffName}</TableCell>
                    <TableCell className="text-center">{stat.totalMatches}</TableCell>
                    <TableCell className="text-center">{stat.asPrincipal}</TableCell>
                    <TableCell className="text-center">{stat.asSecond}</TableCell>
                    <TableCell className="text-center">{stat.asThird}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Category Filter */}
      {categories.length > 0 && (
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="max-w-xs">
              <Label htmlFor="category-filter">Filtrar por Categoría</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger id="category-filter">
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Referee Stats Table */}
      <RefereeStatsTable
        stats={refereeStats}
        title="Estadísticas de Árbitros"
        icon={<Flag className="h-5 w-5" />}
      />

      {/* Mesa Stats Table */}
      <MesaStatsTable
        stats={mesaStats}
        title="Estadísticas de Mesa"
        icon={<Users className="h-5 w-5" />}
      />
    </div>
  );
}
