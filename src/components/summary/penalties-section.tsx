
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from "@/components/ui/table";
import { formatTime, getEndReasonText } from "@/contexts/game-state-context";
import type { SummaryPenaltyEntry, PlayerData, Team } from "@/types";
import { Button } from "@/components/ui/button";
import { PlusCircle, Trash2, Siren } from "lucide-react";

export const PenaltiesSection = ({ team, teamName, penalties, onAdd, onDelete, players }: { team: Team; teamName: string; penalties?: SummaryPenaltyEntry[]; onAdd?: () => void; onDelete?: (logId: string) => void; players?: PlayerData[] }) => {
    const safePenalties = penalties || [];
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-xl"><Siren className="h-5 w-5" />Penalidades</CardTitle>
                {onAdd && (
                    <Button variant="ghost" size="icon" onClick={onAdd} className="h-8 w-8 text-primary hover:text-primary/80">
                        <PlusCircle className="h-5 w-5" />
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {safePenalties.length > 0 ? (
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Tiempo</TableHead>
                        <TableHead>Jugador</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Duración</TableHead>
                        <TableHead>Estado</TableHead>
                         {onDelete && <TableHead className="text-right">Acción</TableHead>}
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {safePenalties.map(p => (
                        <TableRow key={p.id}>
                        <TableCell>
                            <div className="font-mono text-sm">{formatTime(p.addGameTime)}</div>
                            <div className="text-xs text-muted-foreground">{p.addPeriodText}</div>
                        </TableCell>
                        <TableCell>
                            {(() => { const player = (players ?? []).find(pl => pl.id === p.playerId); return (
                            <>
                                <div className="font-semibold">{p.isBenchPenalty ? `Banco (#${player?.number || '?'})` : `#${player?.number || '?'}`}</div>
                                <div className="text-xs text-muted-foreground">{p.isBenchPenalty ? '---' : player?.name || '---'}</div>
                            </>
                            ); })()}
                        </TableCell>
                        <TableCell className="text-xs">{p.penaltyName || '---'}</TableCell>
                        <TableCell className="font-mono text-sm">{formatTime(p.initialDuration * 100)}</TableCell>
                        <TableCell>
                            <div className="text-sm">{getEndReasonText(p.endReason)}</div>
                            {p.timeServed !== undefined && <div className="text-xs text-muted-foreground font-mono">({formatTime(p.timeServed * 100)})</div>}
                        </TableCell>
                         {onDelete && (
                            <TableCell className="text-right">
                               <Button variant="ghost" size="icon" onClick={() => onDelete(p.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                               </Button>
                            </TableCell>
                         )}
                        </TableRow>
                    ))}
                    </TableBody>
                     <UiTableFooter>
                        <TableRow>
                            <TableCell colSpan={onDelete ? 6 : 5} className="text-right font-bold">Total Penalidades: {safePenalties.length}</TableCell>
                        </TableRow>
                    </UiTableFooter>
                </Table>
                ) : <p className="text-sm text-muted-foreground">Sin penalidades registradas.</p>}
            </CardContent>
        </Card>
    );
};
