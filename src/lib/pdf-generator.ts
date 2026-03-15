

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatTime, getCategoryNameById, getEndReasonText, type GameState, getPeriodText } from '@/contexts/game-state-context';
import type { GoalLog, PenaltyLog, PlayerData, SummaryPlayerStats, PeriodSummary } from '@/types';

// Helper to add a section with a title
const addSectionTitle = (doc: jsPDF, title: string, y: number): number => {
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text(title, 14, y);
    return y + 8;
};

// Helper to add a table with a title
const addTable = (doc: jsPDF, title: string, y: number, head: any[], body: any[][], options: { headFillColor?: [number, number, number], showTotal?: boolean } = {}): number => {
    let currentY = y;
    if (title) {
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(title, 14, currentY);
        currentY += 6;
    }

    if (body.length > 0) {
        const foot = options.showTotal ? [[{ content: `Total: ${body.length}`, colSpan: head.length, styles: { halign: 'right', fontStyle: 'bold' } }]] : [];
        
        autoTable(doc, {
            startY: currentY,
            head: [head],
            body: body,
            foot: foot,
            theme: 'striped',
            headStyles: { fillColor: options.headFillColor || [41, 128, 185] },
            footStyles: { fillColor: [230, 230, 230], textColor: 0 },
        });
        return (doc as any).lastAutoTable.finalY + 4;
    } else {
        doc.setFontSize(10);
        doc.text("Sin eventos registrados.", 14, currentY);
        return currentY + 8;
    }
};

const addPlayerStatsTable = (doc: jsPDF, title: string, y: number, summaryPlayerStats: SummaryPlayerStats[]): number => {
    let currentY = y;
     if (title) {
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(title, 14, currentY);
        currentY += 6;
    }

    const attendedPlayers = [...summaryPlayerStats].sort((a,b) => (parseInt(a.number) || 999) - (parseInt(b.number) || 999));

    if (attendedPlayers.length > 0) {
        const totalGoals = attendedPlayers.reduce((sum, p) => sum + (p.goals || 0), 0);
        const totalAssists = attendedPlayers.reduce((sum, p) => sum + (p.assists || 0), 0);
        const totalShots = attendedPlayers.reduce((sum, p) => sum + (p.shots || 0), 0);

        autoTable(doc, {
            startY: currentY,
            head: [['#', 'Nombre', 'G', 'A', 'Tiros']],
            body: attendedPlayers.map(p => [p.number, p.name, p.goals || 0, p.assists || 0, p.shots || 0]),
            foot: [[{ content: 'TOTAL', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, totalGoals, totalAssists, totalShots]],
            theme: 'striped',
            headStyles: { fillColor: [22, 163, 74] },
            footStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold' },
        });
        return (doc as any).lastAutoTable.finalY + 4;
    } else {
        doc.setFontSize(10);
        doc.text("Sin estadísticas registradas.", 14, currentY);
        return currentY + 8;
    }
};

const checkPageBreak = (doc: jsPDF, currentY: number): number => {
    if (currentY > 260) {
        doc.addPage();
        return 20;
    }
    return currentY;
};

export const exportGameSummaryPDF = (state: GameState) => {
    if (!state.config || !state.live) {
        console.error("Cannot generate PDF: game state is not fully loaded.");
        return "error_no_state.pdf";
    }

    const { config, live } = state;
    const doc = new jsPDF();
    const teamTitle = `${live.homeTeamName} vs ${live.awayTeamName}`;
    const tournament = config.activeTournament;
    const categoryName = getCategoryNameById(config.selectedMatchCategory, tournament?.categories) || 'N/A';
    
    const date = new Date();
    const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const filename = `${dateString} - Cat ${categoryName} - ${live.homeTeamName} vs ${live.awayTeamName}.pdf`;

    const finalScore = `${live.score.home} - ${live.score.away}`;

    // --- Resumen General ---
    doc.setFontSize(16);
    doc.text(`Resumen del Partido: ${teamTitle}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Categoría: ${categoryName}  |  Fecha: ${date.toLocaleDateString()}`, 14, 22);
    doc.setFontSize(12);
    doc.text(`Resultado Final: ${finalScore}`, 14, 29);

    let currentY = 40;

    const allHomeGoals = [...(live.goals?.home || [])].sort((a, b) => a.timestamp - b.timestamp);
    const allAwayGoals = [...(live.goals?.away || [])].sort((a, b) => a.timestamp - b.timestamp);
    const allHomePenalties = [...(live.penaltiesLog?.home || [])].sort((a,b) => a.addTimestamp - b.addTimestamp);
    const allAwayPenalties = [...(live.penaltiesLog?.away || [])].sort((a,b) => a.addTimestamp - b.addTimestamp);

    // --- Tablas Generales ---
    currentY = addTable(doc, `${live.homeTeamName} - Goles`, currentY,
        ['Tiempo', 'Gol', 'Asistencia'],
        allHomeGoals.map(g => [`${formatTime(g.gameTime)} - ${g.periodText}`,`#${g.scorer?.playerNumber || 'S/N'} ${g.scorer?.playerName || ''}`.trim(), g.assist ? `#${g.assist.playerNumber} ${g.assist.playerName || ''}`.trim() : '---']),
        { headFillColor: [41, 128, 185], showTotal: true }
    );
    currentY = checkPageBreak(doc, currentY);

    currentY = addTable(doc, `${live.awayTeamName} - Goles`, currentY,
        ['Tiempo', 'Gol', 'Asistencia'],
        allAwayGoals.map(g => [`${formatTime(g.gameTime)} - ${g.periodText}`,`#${g.scorer?.playerNumber || 'S/N'} ${g.scorer?.playerName || ''}`.trim(), g.assist ? `#${g.assist.playerNumber} ${g.assist.playerName || ''}`.trim() : '---']),
        { headFillColor: [41, 128, 185], showTotal: true }
    );
    currentY = checkPageBreak(doc, currentY);

    currentY = addTable(doc, `${live.homeTeamName} - Penalidades`, currentY,
        ['Tiempo', 'Jugador', 'Tipo', 'Duración', 'Estado'],
        allHomePenalties.map(p => [`${p.addPeriodText} ${formatTime(p.addGameTime)}`, p.isBenchPenalty ? `Banco (#${p.playerNumber})` : `#${p.playerNumber} ${p.playerName || ''}`.trim(), p.penaltyName || '---', formatTime(p.initialDuration * 100), getEndReasonText(p.endReason)]),
        { headFillColor: [231, 76, 60], showTotal: true }
    );
    currentY = checkPageBreak(doc, currentY);

    currentY = addTable(doc, `${live.awayTeamName} - Penalidades`, currentY,
        ['Tiempo', 'Jugador', 'Tipo', 'Duración', 'Estado'],
        allAwayPenalties.map(p => [`${p.addPeriodText} ${formatTime(p.addGameTime)}`, p.isBenchPenalty ? `Banco (#${p.playerNumber})` : `#${p.playerNumber} ${p.playerName || ''}`.trim(), p.penaltyName || '---', formatTime(p.initialDuration * 100), getEndReasonText(p.endReason)]),
        { headFillColor: [231, 76, 60], showTotal: true }
    );

    // --- Estadísticas Generales por Jugador ---
    doc.addPage();
    currentY = 20;

    const homeAggregatedStats = live.attendance.home.map(p => {
        return {
            id: p.id,
            name: p.name,
            number: p.number,
            goals: allHomeGoals.filter(g => g.scorer?.playerNumber === p.number).length,
            assists: allHomeGoals.filter(g => g.assist?.playerNumber === p.number).length,
            shots: (live.shotsLog?.home || []).filter(s => s.playerNumber === p.number).length
        }
    });
     const awayAggregatedStats = live.attendance.away.map(p => {
        return {
            id: p.id,
            name: p.name,
            number: p.number,
            goals: allAwayGoals.filter(g => g.scorer?.playerNumber === p.number).length,
            assists: allAwayGoals.filter(g => g.assist?.playerNumber === p.number).length,
            shots: (live.shotsLog?.away || []).filter(s => s.playerNumber === p.number).length
        }
    });

    currentY = addPlayerStatsTable(doc, `${live.homeTeamName} - Estadísticas de Jugador`, currentY, homeAggregatedStats);
    currentY = checkPageBreak(doc, currentY);
    currentY = addPlayerStatsTable(doc, `${live.awayTeamName} - Estadísticas de Jugador`, currentY, awayAggregatedStats);


    // --- Desglose por Período ---
    const allPeriodTexts = Array.from(new Set([...allHomeGoals, ...allAwayGoals].map(e => e.periodText))).sort((a, b) => {
        const getPeriodNumber = (text: string) => {
            if (text.startsWith('OT')) return config.numberOfRegularPeriods + parseInt(text.replace('OT', '') || '1', 10);
            if (text.toLowerCase().includes('warm-up')) return -1;
            return parseInt(text.replace(/\D/g, ''), 10);
        }
        return getPeriodNumber(a) - getPeriodNumber(b);
    });

    if (allPeriodTexts.some(p => !p.toLowerCase().includes('warm-up'))) {
        doc.addPage();
        currentY = addSectionTitle(doc, 'Detalle de Goles por Periodo', 20);

        for (const periodText of allPeriodTexts) {
            if (!periodText || periodText.toLowerCase().includes('warm-up')) continue;
            
            currentY = checkPageBreak(doc, currentY);
            doc.setFontSize(14);
            doc.text(`Estadísticas para: ${periodText}`, 14, currentY);
            currentY += 8;

            const homeGoalsInPeriod = allHomeGoals.filter(g => g.periodText === periodText);
            const awayGoalsInPeriod = allAwayGoals.filter(g => g.periodText === periodText);
            
            currentY = addTable(doc, `${live.homeTeamName} - Goles`, currentY, ['Tiempo', 'Gol', 'Asistencia'], homeGoalsInPeriod.map(g => [formatTime(g.gameTime), `#${g.scorer?.playerNumber || 'S/N'} ${g.scorer?.playerName || ''}`.trim(), g.assist ? `#${g.assist.playerNumber} ${g.assist.playerName || ''}`.trim() : '---']), { showTotal: true });
            currentY = checkPageBreak(doc, currentY);
            
            currentY = addTable(doc, `${live.awayTeamName} - Goles`, currentY, ['Tiempo', 'Gol', 'Asistencia'], awayGoalsInPeriod.map(g => [formatTime(g.gameTime), `#${g.scorer?.playerNumber || 'S/N'} ${g.scorer?.playerName || ''}`.trim(), g.assist ? `#${g.assist.playerNumber} ${g.assist.playerName || ''}`.trim() : '---']), { showTotal: true });
            currentY = checkPageBreak(doc, currentY);
        }
    }


    doc.save(filename);
    
    return filename;
};
