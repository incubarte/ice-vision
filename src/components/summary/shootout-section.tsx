
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SummaryShootoutAttempt, PlayerData } from "@/types";
import { Check, X, Swords } from "lucide-react";

export const ShootoutSection = ({ teamName, attempts, players }: { teamName: string; attempts: SummaryShootoutAttempt[]; players?: PlayerData[] }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl"><Swords className="h-5 w-5" />Tiros de Penal (Shootout) - {teamName}</CardTitle>
            </CardHeader>
            <CardContent>
                {attempts.length > 0 ? (
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Ronda</TableHead>
                        <TableHead>Jugador</TableHead>
                        <TableHead>Resultado</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {attempts.map(attempt => (
                        <TableRow key={attempt.id}>
                            <TableCell className="font-mono">{attempt.round}</TableCell>
                            <TableCell>
                                {(() => { const player = (players ?? []).find(p => p.id === attempt.playerId); return (
                                <>
                                    <div className="font-semibold">#{player?.number || '?'}</div>
                                    <div className="text-xs text-muted-foreground">{player?.name || '---'}</div>
                                </>
                                ); })()}
                            </TableCell>
                            <TableCell>
                                {attempt.isGoal ? <span className="text-green-500 font-bold flex items-center gap-1"><Check className="h-4 w-4"/> Gol</span> : <span className="text-destructive flex items-center gap-1"><X className="h-4 w-4"/> Fallado</span>}
                            </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                ) : <p className="text-sm text-muted-foreground">Sin tiros de penal registrados para este equipo.</p>}
            </CardContent>
        </Card>
    );
};
