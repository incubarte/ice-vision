
"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from "@/components/ui/table";
import type { SummaryPlayerStats, PlayerData, AttendedPlayerInfo, Team } from "@/types";
import { BarChart3, Edit3, Check, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

export const PlayerStatsSection = ({ 
    team,
    teamName, 
    allPlayers,
    playerStats, 
    attendance,
    editingAttendanceSet,
    editable,
    editedStats,
    onStatChange,
    showAttendanceControls,
    isAttendanceEditing,
    onToggleAttendance,
    onEditToggle,
    onSave,
}: { 
    team: Team;
    teamName: string; 
    allPlayers?: PlayerData[];
    playerStats?: SummaryPlayerStats[]; 
    attendance?: AttendedPlayerInfo[];
    editingAttendanceSet?: Set<string>;
    editable?: boolean;
    editedStats?: Record<string, { shots: string }>;
    onStatChange?: (playerId: string, field: 'shots', value: string) => void;
    showAttendanceControls?: boolean;
    isAttendanceEditing?: boolean;
    onToggleAttendance?: (team: Team, playerId: string) => void;
    onEditToggle?: (isEditing: boolean) => void;
    onSave?: () => void;
}) => {
    
    const sortedPlayersWithStats = useMemo(() => {
        const fullRoster = allPlayers || [];
        // Filter attendance to only include players where isPresent is true (or undefined for backwards compatibility)
        const attendanceSet = isAttendanceEditing
            ? editingAttendanceSet
            : new Set((attendance || []).filter(p => p.isPresent !== false).map(p => p.id).filter((id): id is string => !!id));
        const statsMap = new Map<string, SummaryPlayerStats>();

        // Pre-populate map with stats from playerStats prop
        (playerStats || []).forEach(pStat => {
            statsMap.set(pStat.id, { ...pStat });
        });
        
        // Ensure every player from the roster is in the list
        fullRoster.forEach(player => {
            if (!statsMap.has(player.id)) {
                 statsMap.set(player.id, { id: player.id, name: player.name, number: player.number, shots: 0, goals: 0, assists: 0 });
            }
        });

        const combinedList = Array.from(statsMap.values()).map(stat => {
            const rosterPlayer = fullRoster.find(p => p.id === stat.id);
            return {
                ...stat,
                name: rosterPlayer?.name || stat.name, // Prefer roster name
                number: rosterPlayer?.number || stat.number, // Prefer roster number
                attended: attendanceSet ? attendanceSet.has(stat.id) : false,
            }
        });

        return combinedList.sort((a, b) => {
            // Sort attended players first
            if (isAttendanceEditing) {
                if (a.attended && !b.attended) return -1;
                if (!a.attended && b.attended) return 1;
            }

            // Then sort by number
            const numA = parseInt(a.number, 10);
            const numB = parseInt(b.number, 10);

            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            if (isNaN(numA) && !isNaN(numB)) return 1;
            if (!isNaN(numA) && isNaN(numB)) return -1;
            return a.name.localeCompare(b.name);
        });
    }, [allPlayers, playerStats, attendance, isAttendanceEditing, editingAttendanceSet]);

    const totals = useMemo(() => {
        return sortedPlayersWithStats.reduce((acc, player) => {
             if (player.attended) {
                if (editable && editedStats && editedStats[player.id]) {
                    acc.shots += parseInt(editedStats[player.id].shots, 10) || 0;
                } else {
                    acc.shots += player.shots || 0;
                }
                acc.goals += player.goals || 0;
                acc.assists += player.assists || 0;
             }
            return acc;
        }, { goals: 0, assists: 0, shots: 0 });
    }, [sortedPlayersWithStats, editable, editedStats]);
    
    const statInputClass = "h-7 w-12 text-center mx-auto text-sm";

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-xl"><BarChart3 className="h-5 w-5" />Tiros</CardTitle>
                {showAttendanceControls && (
                    isAttendanceEditing ? (
                        <div className="flex gap-2">
                            <Button variant="default" size="sm" onClick={onSave}><Check className="mr-2 h-4 w-4"/>Guardar</Button>
                            <Button variant="outline" size="sm" onClick={() => onEditToggle?.(false)}><XCircle className="mr-2 h-4 w-4"/>Cancelar</Button>
                        </div>
                    ) : (
                        <Button variant="outline" size="sm" onClick={() => onEditToggle?.(true)}>
                            <Edit3 className="mr-2 h-4 w-4"/>Editar Asistencia
                        </Button>
                    )
                )}
            </CardHeader>
            <CardContent>
                {sortedPlayersWithStats.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>#</TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead className="text-center">G</TableHead>
                                <TableHead className="text-center">A</TableHead>
                                <TableHead className="text-center">Tiros</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedPlayersWithStats.map(player => {
                                const playerEditedStats = editable && editedStats ? editedStats[player.id] : null;

                                return (
                                    <TableRow 
                                        key={player.id} 
                                        className={cn(
                                            (!player.attended && !isAttendanceEditing) && "hidden",
                                            isAttendanceEditing && !player.attended && "text-muted-foreground opacity-50",
                                            isAttendanceEditing && "cursor-pointer"
                                        )}
                                        onClick={isAttendanceEditing ? () => onToggleAttendance?.(team, player.id) : undefined}
                                    >
                                        <TableCell className="font-semibold">{player.number || 'S/N'}</TableCell>
                                        <TableCell className="text-xs">{player.name}</TableCell>
                                        <TableCell className="text-center font-mono">{player.goals || 0}</TableCell>
                                        <TableCell className="text-center font-mono">{player.assists || 0}</TableCell>
                                        <TableCell className="text-center">
                                            {editable ? (
                                                <Input type="number" value={playerEditedStats?.shots ?? String(player.shots || 0)} onChange={(e) => onStatChange?.(player.id, 'shots', e.target.value)} className={statInputClass} />
                                            ) : ( <span className="font-mono">{player.shots || 0}</span> )}
                                        </TableCell>
                                    </TableRow>
                                )}
                            )}
                        </TableBody>
                         <UiTableFooter>
                            <TableRow>
                                <TableCell colSpan={2} className="text-right font-bold">TOTAL (Asistentes)</TableCell>
                                <TableCell className="text-center font-bold font-mono">{totals.goals}</TableCell>
                                <TableCell className="text-center font-bold font-mono">{totals.assists}</TableCell>
                                <TableCell className="text-center font-bold font-mono">{totals.shots}</TableCell>
                            </TableRow>
                        </UiTableFooter>
                    </Table>
                ) : (
                    <p className="text-sm text-muted-foreground">Este equipo no tiene jugadores registrados.</p>
                )}
            </CardContent>
        </Card>
    );
};
