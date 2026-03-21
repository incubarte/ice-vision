"use client";

import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GoalkeeperStats, GoalkeeperPeriodStats } from '@/hooks/use-goalkeeper-stats';
import type { SummaryRosterEntry } from '@/types';

interface GoalkeeperStatsSectionProps {
  teamName?: string;
  goalkeeperStats: GoalkeeperStats[];
  attendance?: SummaryRosterEntry[];
  showOnlyPresent?: boolean;
  className?: string;
}

export function GoalkeeperStatsSection({ teamName, goalkeeperStats, attendance, showOnlyPresent = false, className }: GoalkeeperStatsSectionProps) {
  // Helper to format centiseconds to MM:SS
  const formatTime = (centiseconds: number) => {
    const totalSeconds = Math.floor(centiseconds / 100);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  // Add attendance info to goalkeeper stats
  const goalkeeperStatsWithAttendance = useMemo(() => {
    return goalkeeperStats.map(gkStat => {
      // Find the goalkeeper in the attendance list
      const attendanceInfo = (attendance || []).find(p => p.id === gkStat.playerId);
      const isPresent = !attendance || !attendanceInfo || attendanceInfo.isPresent;

      return {
        ...gkStat,
        isPresent
      };
    }).filter(gk => showOnlyPresent ? gk.isPresent : true);
  }, [goalkeeperStats, attendance, showOnlyPresent]);

  if (goalkeeperStatsWithAttendance.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-400" />
            {teamName ? `Arqueros - ${teamName}` : 'Arqueros'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No hay datos de arqueros para este equipo.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="py-2 px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-400" />
          {teamName ? `Arqueros - ${teamName}` : 'Arqueros'}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <Table>
          <TableHeader>
            <TableRow className="h-4">
              <TableHead className="h-8 px-2 py-2 text-xs">#</TableHead>
              <TableHead className="h-8 px-2 py-2 text-xs">Nombre</TableHead>
              <TableHead className="h-8 px-2 py-2 text-xs text-center">Tiros</TableHead>
              <TableHead className="h-8 px-2 py-2 text-xs text-center">Ataj.</TableHead>
              <TableHead className="h-8 px-2 py-2 text-xs text-center">Goles</TableHead>
              <TableHead className="h-8 px-2 py-2 text-xs text-center">%</TableHead>
              <TableHead className="h-8 px-2 py-2 text-xs text-center">Tiempo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {goalkeeperStatsWithAttendance.map(gkStat => (
              <TableRow key={gkStat.playerId} className={cn("h-7", !gkStat.isPresent && "opacity-50 text-muted-foreground")}>
                <TableCell className="py-1 font-semibold">{gkStat.playerNumber}</TableCell>
                <TableCell className="py-1 text-xs">{gkStat.playerName}</TableCell>
                <TableCell className="py-1 text-center font-mono">{gkStat.totalShotsAgainst}</TableCell>
                <TableCell className="py-1 text-center font-mono text-green-600">{gkStat.totalShotsAgainst === 0 ? '-' : gkStat.totalSaves}</TableCell>
                <TableCell className="py-1 text-center font-mono text-destructive">{gkStat.totalGoalsAgainst}</TableCell>
                <TableCell className="py-1 text-center font-mono text-blue-600">{gkStat.totalShotsAgainst === 0 ? '-' : `${gkStat.savePercentage}%`}</TableCell>
                <TableCell className="py-1 text-center font-mono text-xs">{formatTime(gkStat.totalTimeOnIce)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
