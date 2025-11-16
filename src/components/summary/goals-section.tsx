
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from "@/components/ui/table";
import { formatTime } from "@/contexts/game-state-context";
import type { GoalLog, PlayerData, Team } from "@/types";
import { Goal, PlusCircle, Trash2, Edit3, Check, XCircle } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { safeUUID } from '@/lib/utils';

interface EditableGoalRowProps {
    goal: GoalLog;
    players: PlayerData[];
    onSave: (updatedGoal: GoalLog) => void;
    onCancel: () => void;
    onDelete: (goalId: string) => void;
}

const EditableGoalRow = ({ goal, players, onSave, onCancel, onDelete }: EditableGoalRowProps) => {
    const [scorerNumber, setScorerNumber] = useState(goal.scorer?.playerNumber || '');
    const [assistNumber, setAssistNumber] = useState(goal.assist?.playerNumber || '');
    const [assist2Number, setAssist2Number] = useState(goal.assist2?.playerNumber || '');

    const posArray = goal.positives?.map(p => p?.playerNumber || '') || [];
    while (posArray.length < 5) posArray.push('');
    const [positives, setPositives] = useState<string[]>(posArray);

    const negArray = goal.negatives?.map(n => n?.playerNumber || '') || [];
    while (negArray.length < 5) negArray.push('');
    const [negatives, setNegatives] = useState<string[]>(negArray);

    const validPlayers = useMemo(() => players.filter(p => p.number && p.number.trim() !== ''), [players]);

    const handleSave = () => {
        const scorer = players.find(p => p.number === scorerNumber);
        const assist = players.find(p => p.number === assistNumber);
        const assist2 = players.find(p => p.number === assist2Number);

        const positivesData = positives
            .map((num, idx) => num.trim() ? { playerNumber: num.trim(), playerName: players.find(p => p.number === num.trim())?.name } : null)
            .filter(p => p !== null);

        const negativesData = negatives
            .map((num, idx) => num.trim() ? { playerNumber: num.trim(), playerName: players.find(p => p.number === num.trim())?.name } : null)
            .filter(p => p !== null);

        onSave({
            ...goal,
            scorer: scorer ? { playerNumber: scorer.number, playerName: scorer.name } : { playerNumber: scorerNumber },
            assist: assist ? { playerNumber: assist.number, playerName: assist.name } : (assistNumber ? { playerNumber: assistNumber } : undefined),
            assist2: assist2 ? { playerNumber: assist2.number, playerName: assist2.name } : (assist2Number ? { playerNumber: assist2Number } : undefined),
            positives: positivesData.length > 0 ? positivesData : undefined,
            negatives: negativesData.length > 0 ? negativesData : undefined
        });
    };

    return (
        <>
            <TableRow>
                <TableCell rowSpan={2}>{goal.periodText} {formatTime(goal.gameTime)}</TableCell>
                <TableCell>
                    <Select value={scorerNumber} onValueChange={setScorerNumber}>
                        <SelectTrigger><SelectValue placeholder="Goleador" /></SelectTrigger>
                        <SelectContent>
                            {validPlayers.map(p => <SelectItem key={p.id} value={p.number}>#{p.number} {p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </TableCell>
                <TableCell>
                    <Select value={assistNumber} onValueChange={(value) => setAssistNumber(value === "no-assist" ? "" : value)}>
                        <SelectTrigger><SelectValue placeholder="Asistente 1" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="no-assist">-- Sin Asistencia --</SelectItem>
                            {validPlayers.map(p => <SelectItem key={p.id} value={p.number} disabled={p.number === scorerNumber}>#{p.number} {p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </TableCell>
                <TableCell>
                    <Select value={assist2Number} onValueChange={(value) => setAssist2Number(value === "no-assist" ? "" : value)}>
                        <SelectTrigger><SelectValue placeholder="Asistente 2" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="no-assist">-- Sin Asistencia --</SelectItem>
                            {validPlayers.map(p => <SelectItem key={p.id} value={p.number} disabled={p.number === scorerNumber || p.number === assistNumber}>#{p.number} {p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </TableCell>
                <TableCell className="text-right" rowSpan={2}>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-green-500" onClick={handleSave}><Check className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onCancel}><XCircle className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(goal.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell colSpan={3}>
                    <div className="space-y-2">
                        <div>
                            <label className="text-xs font-semibold">Positivas:</label>
                            <div className="flex gap-1 mt-1">
                                {positives.map((pos, idx) => (
                                    <Input
                                        key={idx}
                                        value={pos}
                                        onChange={(e) => {
                                            if (/^\d*$/.test(e.target.value)) {
                                                const newPositives = [...positives];
                                                newPositives[idx] = e.target.value;
                                                setPositives(newPositives);
                                            }
                                        }}
                                        placeholder={`#${idx + 1}`}
                                        className="w-14 h-7 text-xs text-center"
                                    />
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold">Negativas:</label>
                            <div className="flex gap-1 mt-1">
                                {negatives.map((neg, idx) => (
                                    <Input
                                        key={idx}
                                        value={neg}
                                        onChange={(e) => {
                                            if (/^\d*$/.test(e.target.value)) {
                                                const newNegatives = [...negatives];
                                                newNegatives[idx] = e.target.value;
                                                setNegatives(newNegatives);
                                            }
                                        }}
                                        placeholder={`#${idx + 1}`}
                                        className="w-14 h-7 text-xs text-center"
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </TableCell>
            </TableRow>
        </>
    );
};

export const GoalsSection = ({ teamName, goals, onGoalChange, editable, players }: { teamName: string; goals?: GoalLog[]; onGoalChange?: (action: 'add' | 'update' | 'delete', goal: GoalLog, originalId?: string) => void; editable?: boolean; players?: PlayerData[] }) => {
    const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const safeGoals = goals || [];

    const handleSaveGoal = (updatedGoal: GoalLog) => {
        const isNew = !safeGoals.some(g => g.id === updatedGoal.id);
        if (onGoalChange) {
            if (isNew) {
                onGoalChange('add', updatedGoal);
            } else {
                onGoalChange('update', updatedGoal, updatedGoal.id);
            }
        }
        setIsAdding(false);
        setEditingGoalId(null);
    };

    const handleDeleteGoal = (goalId: string) => {
        const goalToDelete = safeGoals.find(g => g.id === goalId);
        if (goalToDelete && onGoalChange) {
            onGoalChange('delete', goalToDelete, goalId);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-xl"><Goal className="h-5 w-5" />Goles</CardTitle>
                {editable && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setIsAdding(true)}>
                        <PlusCircle className="h-5 w-5" />
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">Tiempo</TableHead>
                            <TableHead>Gol</TableHead>
                            <TableHead>Asist 1</TableHead>
                            <TableHead>Asist 2</TableHead>
                            {editable && <TableHead className="text-right">Acciones</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isAdding && players && (
                            <EditableGoalRow goal={{id: `new-${safeUUID()}`, team: 'home', timestamp:0, gameTime: 0, periodText: ''}} players={players} onSave={handleSaveGoal} onCancel={() => setIsAdding(false)} onDelete={() => {}} />
                        )}
                        {safeGoals.length > 0 ? safeGoals.map(goal => (
                            editingGoalId === goal.id && players ? (
                                <EditableGoalRow key={goal.id} goal={goal} players={players} onSave={handleSaveGoal} onCancel={() => setEditingGoalId(null)} onDelete={handleDeleteGoal}/>
                            ) : (
                                <TableRow key={goal.id}>
                                    <TableCell>
                                        <div className="font-mono text-sm">{formatTime(goal.gameTime)}</div>
                                        <div className="text-xs text-muted-foreground">{goal.periodText}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-semibold">#{goal.scorer?.playerNumber || 'S/N'}</div>
                                        <div className="text-xs text-muted-foreground">{goal.scorer?.playerName || '---'}</div>
                                        {goal.positives && goal.positives.length > 0 && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                                <span className="font-semibold">+:</span> {goal.positives.map(p => `#${p?.playerNumber}`).join(', ')}
                                            </div>
                                        )}
                                        {goal.negatives && goal.negatives.length > 0 && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                                <span className="font-semibold">-:</span> {goal.negatives.map(n => `#${n?.playerNumber}`).join(', ')}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {goal.assist?.playerNumber ? (
                                        <>
                                            <div className="font-semibold">#{goal.assist.playerNumber}</div>
                                            <div className="text-xs text-muted-foreground">{goal.assist.playerName || '---'}</div>
                                        </>
                                        ) : <span className="text-muted-foreground">---</span>}
                                    </TableCell>
                                    <TableCell>
                                        {goal.assist2?.playerNumber ? (
                                        <>
                                            <div className="font-semibold">#{goal.assist2.playerNumber}</div>
                                            <div className="text-xs text-muted-foreground">{goal.assist2.playerName || '---'}</div>
                                        </>
                                        ) : <span className="text-muted-foreground">---</span>}
                                    </TableCell>
                                    {editable && (
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingGoalId(goal.id)}><Edit3 className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteGoal(goal.id)}><Trash2 className="h-4 w-4" /></Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            )
                        )) : !isAdding && (
                            <TableRow>
                                <TableCell colSpan={editable ? 5 : 4} className="h-16 text-center text-sm text-muted-foreground">Sin goles registrados.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    {safeGoals.length > 0 && (
                        <UiTableFooter>
                            <TableRow>
                                <TableCell colSpan={editable ? 5 : 4} className="text-right font-bold">Total Goles: {safeGoals.length}</TableCell>
                            </TableRow>
                        </UiTableFooter>
                    )}
                </Table>
            </CardContent>
        </Card>
    );
};
