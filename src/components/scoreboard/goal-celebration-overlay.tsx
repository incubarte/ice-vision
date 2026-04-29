
"use client";

import React, { useMemo } from 'react';
import Image from "next/image";
import { motion } from 'framer-motion';
import type { LiveState } from '@/types';
import { DefaultTeamLogo } from '../teams/default-team-logo';
import { useGameState } from '@/contexts/game-state-context';

import { PlayerPhotoDisplay } from './player-photo-display';

interface GoalCelebrationOverlayProps {
    celebration: NonNullable<LiveState['goalCelebration']>;
}

export function GoalCelebrationOverlay({ celebration }: GoalCelebrationOverlayProps) {
    const { goal } = celebration;
    const { state } = useGameState();
    const { scoreboardLayout } = state.config;

    // Get logo and player name from matchContext
    const mc = state.live.matchContext;
    const logoDataUrl = mc ? (goal.team === 'home' ? mc.homeTeamLogoDataUrl : mc.awayTeamLogoDataUrl) : null;
    const roster = mc ? (goal.team === 'home' ? mc.homeRoster : mc.awayRoster) : [];
    const scorerName = roster.find(p => p.number === goal.scorer?.playerNumber)?.name;
    const assistName = goal.assist?.playerNumber ? roster.find(p => p.number === goal.assist?.playerNumber)?.name : undefined;
    const assist2Name = goal.assist2?.playerNumber ? roster.find(p => p.number === goal.assist2?.playerNumber)?.name : undefined;

    if (!goal) return null;

    const scoringTeamName = goal.team === 'home' ? state.live.homeTeamName : state.live.awayTeamName;

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-black/50 backdrop-blur-sm overflow-hidden">



            <motion.div
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 100, damping: 15, delay: 0.2 }}
                className="flex items-center gap-6"
            >
                {logoDataUrl ? (
                    <Image
                        src={logoDataUrl}
                        alt={`${scoringTeamName} logo`}
                        width={128}
                        height={128}
                        className="w-24 h-24 md:w-32 md:h-32 object-contain"
                        data-ai-hint="team logo"
                        priority
                    />
                ) : (
                    <DefaultTeamLogo teamName={scoringTeamName} size="lg" className="w-24 h-24 md:w-32 md:h-32 text-5xl" />
                )}

                <motion.h1
                    className="font-headline font-bold text-accent uppercase"
                    style={{ fontSize: `${scoreboardLayout.clockSize * 0.8}rem` }}
                    animate={{
                        scale: [1, 1.1, 1, 1.1, 1],
                    }}
                    transition={{
                        duration: 2,
                        ease: "easeInOut",
                        repeat: Infinity,
                        repeatType: "loop",
                    }}
                >
                    GOL!
                </motion.h1>

                {logoDataUrl ? (
                    <Image
                        src={logoDataUrl}
                        alt={`${scoringTeamName} logo`}
                        width={128}
                        height={128}
                        className="w-24 h-24 md:w-32 md:h-32 object-contain"
                        data-ai-hint="team logo"
                        priority
                    />
                ) : (
                    <DefaultTeamLogo teamName={scoringTeamName} size="lg" className="w-24 h-24 md:w-32 md:h-32 text-5xl" />
                )}
            </motion.div>

            <motion.div
                className="text-center mt-4"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 100, damping: 15, delay: 0.4 }}
            >
                <h2 className="text-foreground font-semibold uppercase tracking-wider" style={{ fontSize: `${scoreboardLayout.teamNameSize * 1.2}rem` }}>
                    {scoringTeamName}
                </h2>
                <div className="text-primary-foreground mt-2" style={{ fontSize: `${scoreboardLayout.periodSize * 1.1}rem` }}>
                    <p className="font-bold">
                        <span className="font-bold">#{goal.scorer?.playerNumber || 'S/N'}</span>
                        <span className="ml-2 font-normal">{scorerName}</span>
                    </p>
                    {goal.assist?.playerNumber && (
                        <p
                            className="text-foreground/80 block font-bold"
                            style={{ fontSize: '0.8em' }}
                        >
                            <span className="font-bold">#{goal.assist.playerNumber}</span>
                            <span className="ml-2 font-normal">{assistName}</span>
                        </p>
                    )}
                    {goal.assist2?.playerNumber && (
                        <p
                            className="text-foreground/80 block font-bold"
                            style={{ fontSize: '0.8em' }}
                        >
                            <span className="font-bold">#{goal.assist2.playerNumber}</span>
                            <span className="ml-2 font-normal">{assist2Name}</span>
                        </p>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
