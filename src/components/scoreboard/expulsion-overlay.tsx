
"use client";

import React from 'react';
import Image from "next/image";
import { motion } from 'framer-motion';
import type { LiveState } from '@/types';
import { DefaultTeamLogo } from '../teams/default-team-logo';
import { useGameState } from '@/contexts/game-state-context';
import { ShieldAlert } from 'lucide-react';

interface ExpulsionOverlayProps {
  expulsionDisplay: NonNullable<LiveState['expulsionDisplay']>;
}

export function ExpulsionOverlay({ expulsionDisplay }: ExpulsionOverlayProps) {
  const { expulsion } = expulsionDisplay;
  const { state } = useGameState();
  const { scoreboardLayout } = state.config;

  const mc = state.live.matchContext;
  const logoDataUrl = mc
    ? (expulsion.team === 'home' ? mc.homeTeamLogoDataUrl : mc.awayTeamLogoDataUrl)
    : null;
  const teamName = expulsion.team === 'home' ? state.live.homeTeamName : state.live.awayTeamName;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-black/60 backdrop-blur-sm overflow-hidden">
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 100, damping: 15, delay: 0.2 }}
        className="flex items-center gap-6"
      >
        {logoDataUrl ? (
          <Image
            src={logoDataUrl}
            alt={`${teamName} logo`}
            width={128}
            height={128}
            className="w-24 h-24 md:w-32 md:h-32 object-contain opacity-80"
            data-ai-hint="team logo"
            priority
          />
        ) : (
          <DefaultTeamLogo teamName={teamName} size="lg" className="w-24 h-24 md:w-32 md:h-32 text-5xl opacity-80" />
        )}

        <motion.div
          className="flex items-center gap-3"
          animate={{ scale: [1, 1.05, 1, 1.05, 1] }}
          transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
        >
          <ShieldAlert
            className="text-destructive"
            style={{ width: `${scoreboardLayout.clockSize * 0.6}rem`, height: `${scoreboardLayout.clockSize * 0.6}rem` }}
          />
          <h1
            className="font-headline font-bold text-destructive uppercase"
            style={{ fontSize: `${scoreboardLayout.clockSize * 0.7}rem` }}
          >
            EXPULSADO
          </h1>
        </motion.div>
      </motion.div>

      <motion.div
        className="text-center mt-6"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 100, damping: 15, delay: 0.4 }}
      >
        <h2
          className="text-foreground font-semibold uppercase tracking-wider"
          style={{ fontSize: `${scoreboardLayout.teamNameSize * 1.2}rem` }}
        >
          {teamName}
        </h2>
        <p
          className="text-primary-foreground font-bold mt-2"
          style={{ fontSize: `${scoreboardLayout.periodSize * 1.1}rem` }}
        >
          <span className="font-bold">#{expulsion.playerNumber}</span>
          {expulsion.playerName && (
            <span className="ml-2 font-normal">{expulsion.playerName}</span>
          )}
        </p>
        <p
          className="text-destructive/80 mt-1 uppercase tracking-widest font-semibold"
          style={{ fontSize: `${scoreboardLayout.periodSize * 0.8}rem` }}
        >
          Expulsado del partido
        </p>
      </motion.div>
    </div>
  );
}
