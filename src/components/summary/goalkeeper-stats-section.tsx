"use client";

import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GoalkeeperStats, GoalkeeperPeriodStats } from '@/hooks/use-goalkeeper-stats';
import type { AttendedPlayerInfo } from '@/types';

interface GoalkeeperStatsSectionProps {
  teamName?: string;
  goalkeeperStats: GoalkeeperStats[];
  attendance?: AttendedPlayerInfo[];
  showOnlyPresent?: boolean;
}

export function GoalkeeperStatsSection({ teamName, goalkeeperStats, attendance, showOnlyPresent = false }: GoalkeeperStatsSectionProps) {
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
      const attendanceInfo = (attendance || []).find(p => (p.id || p.number) === gkStat.playerId || p.number === gkStat.playerNumber);
      // isPresent is true if: attendance is null, player not in attendance list (backwards compat), or isPresent !== false
      const isPresent = !attendance || !attendanceInfo || attendanceInfo.isPresent !== false;

      return {
        ...gkStat,
        isPresent
      };
    }).filter(gk => showOnlyPresent ? gk.isPresent : true);
  }, [goalkeeperStats, attendance, showOnlyPresent]);

  if (goalkeeperStatsWithAttendance.length === 0) {
    return (
      <Card>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-400" />
          {teamName ? `Arqueros - ${teamName}` : 'Arqueros'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {goalkeeperStatsWithAttendance.map(gkStat => (
          <div key={gkStat.playerId} className={cn("border rounded-lg p-3 space-y-3", !gkStat.isPresent && "opacity-50 text-muted-foreground")}>
            {/* Goalkeeper Header */}
            <div className="flex items-start justify-between border-b pb-2">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-400" />
                  <h3 className="font-bold">{gkStat.playerName}</h3>
                  <span className="text-xs text-muted-foreground">#{gkStat.playerNumber}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{formatTime(gkStat.totalTimeOnIce)}</div>
                <div className="text-xs text-muted-foreground">Tiempo Total</div>
              </div>
            </div>

            {/* Totals Summary */}
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center p-2 bg-muted/30 rounded">
                <div className="text-lg font-bold">{gkStat.totalShotsAgainst}</div>
                <div className="text-xs text-muted-foreground">Tiros</div>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded">
                <div className="text-lg font-bold text-green-600">
                  {gkStat.totalShotsAgainst === 0 ? '-' : gkStat.totalSaves}
                </div>
                <div className="text-xs text-muted-foreground">Atajados</div>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded">
                <div className="text-lg font-bold text-destructive">{gkStat.totalGoalsAgainst}</div>
                <div className="text-xs text-muted-foreground">Goles</div>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded">
                <div className="text-lg font-bold text-blue-600">
                  {gkStat.totalShotsAgainst === 0 ? '-' : `${gkStat.savePercentage}%`}
                </div>
                <div className="text-xs text-muted-foreground">% Efect.</div>
              </div>
            </div>

            {/* Period Breakdown */}
            {gkStat.periodStats.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold mb-1 text-muted-foreground">Por Período</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs py-2">Período</TableHead>
                      <TableHead className="text-center text-xs py-2">Tiempo</TableHead>
                      <TableHead className="text-center text-xs py-2">Tiros</TableHead>
                      <TableHead className="text-center text-xs py-2">Ataj.</TableHead>
                      <TableHead className="text-center text-xs py-2">Goles</TableHead>
                      <TableHead className="text-center text-xs py-2">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gkStat.periodStats.map(periodStat => (
                      <TableRow key={periodStat.period}>
                        <TableCell className="font-medium text-xs py-2">{periodStat.period}</TableCell>
                        <TableCell className="text-center font-mono text-xs py-2">{formatTime(periodStat.timeOnIce)}</TableCell>
                        <TableCell className="text-center font-mono text-xs py-2">{periodStat.shotsAgainst}</TableCell>
                        <TableCell className="text-center font-mono text-xs py-2 text-green-600">
                          {periodStat.shotsAgainst === 0 ? '-' : periodStat.saves}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs py-2 text-destructive">{periodStat.goalsAgainst}</TableCell>
                        <TableCell className="text-center font-mono text-xs py-2 text-blue-600">
                          {periodStat.shotsAgainst === 0 ? '-' : `${periodStat.savePercentage}%`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
