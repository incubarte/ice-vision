
"use client";

import { useMemo } from "react";
import { useGameState, formatTime, type Team, getEndReasonText } from "@/contexts/game-state-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PenaltyLogDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  team: Team;
  teamName: string;
}

const formatLogTimestamp = (timestamp?: number): string => {
    if (!timestamp) return '--';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '--';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const getEndReasonVariant = (reason?: 'completed' | 'deleted' | 'goal_on_pp'): "secondary" | "default" => {
    return reason ? 'secondary' : 'default';
};

export function PenaltyLogDialog({ isOpen, onOpenChange, team, teamName }: PenaltyLogDialogProps) {
  const { state } = useGameState();

  const attendance = state.live.attendance[team] || [];
  const roster = state.live.matchContext ? (team === 'home' ? state.live.matchContext.homeRoster : state.live.matchContext.awayRoster) : [];

  const lookupPlayerName = (playerNumber: string): string | undefined => {
    return attendance.find(p => p.number === playerNumber)?.name
      || roster.find(p => p.number === playerNumber)?.name;
  };

  const penaltyLogs = useMemo(() => {
    const logs = state.live.penaltiesLog[team];
    if (!logs) return [];
    // Sort by most recent first
    return [...logs].sort((a, b) => b.addTimestamp - a.addTimestamp);
  }, [state.live.penaltiesLog, team]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">Registro de Penalidades: {teamName}</DialogTitle>
          <DialogDescription>
            Un registro detallado de todas las penalidades sancionadas para este equipo durante el partido.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow my-4 border-t border-b overflow-hidden">
            <ScrollArea className="h-full">
                <Table>
                    <TableHeader className="sticky top-0 bg-muted/50 z-10 backdrop-blur-sm">
                        <TableRow>
                            <TableHead className="w-[100px]">Hora (Real)</TableHead>
                            <TableHead className="w-[120px]">Periodo/Tiempo</TableHead>
                            <TableHead>Jugador</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-center w-[100px]">Duración</TableHead>
                            <TableHead className="text-center w-[100px]">T. Cumplido</TableHead>
                            <TableHead className="text-right w-[120px]">Estado</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {penaltyLogs.length > 0 ? penaltyLogs.map(log => (
                            <TableRow key={log.id}>
                                <TableCell className="text-xs text-muted-foreground">{formatLogTimestamp(log.addTimestamp)}</TableCell>
                                <TableCell>
                                    <div className="font-mono">{formatTime(log.addGameTime, { showTenths: false })}</div>
                                    <div className="text-xs text-muted-foreground">{log.addPeriodText}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="font-semibold">{log.isBenchPenalty ? `Banco (#${log.playerNumber})` : `#${log.playerNumber}`}</div>
                                    <div className="text-xs text-muted-foreground">{log.isBenchPenalty ? '---' : lookupPlayerName(log.playerNumber) || 'Jugador no listado'}</div>
                                </TableCell>
                                <TableCell className="text-xs">{log.penaltyName || '---'}</TableCell>
                                <TableCell className="text-center font-mono">{formatTime(log.initialDuration * 100, { showTenths: false })}</TableCell>
                                <TableCell className="text-center font-mono">{log.timeServed !== undefined ? formatTime(log.timeServed * 100, { showTenths: false }) : '--'}</TableCell>
                                <TableCell className="text-right">
                                    <Badge variant={getEndReasonVariant(log.endReason)} className={cn(!log.endReason && "bg-green-600 hover:bg-green-700 text-white border-transparent")}>
                                        {getEndReasonText(log.endReason)}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    No hay penalidades registradas para este equipo.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
