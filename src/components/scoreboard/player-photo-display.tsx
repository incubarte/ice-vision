"use client";

import React, { useState, useEffect } from 'react';
import Image from "next/image";
import { motion, AnimatePresence } from 'framer-motion';
import type { LiveState } from '@/types';
import { useGameState } from '@/contexts/game-state-context';

interface PlayerPhotoDisplayProps {
  celebration: NonNullable<LiveState['goalCelebration']>;
}

export function PlayerPhotoDisplay({ celebration }: PlayerPhotoDisplayProps) {
  const { goal } = celebration;
  const { state } = useGameState();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { scoreboardLayout } = state.config;
  const photoSize = scoreboardLayout.goalCelebrationPhotoSize ?? 40;

  console.log('[PlayerPhoto] Component rendered!', { celebration, goal, photoSize });

  useEffect(() => {
    let currentUrl: string | null = null;

    const loadPlayerPhoto = async () => {
      const mc = state.live.matchContext;
      console.log('[PlayerPhoto] Starting load...', {
        scorerNumber: goal?.scorer?.playerNumber,
        matchId: state.live.matchId,
        team: goal?.team,
        hasMatchContext: !!mc
      });

      if (!goal?.scorer?.playerNumber || !state.live.matchId) {
        console.log('[PlayerPhoto] Missing scorer or matchId');
        setPhotoUrl(null);
        setIsLoading(false);
        return;
      }

      // Use matchContext roster for player data
      if (!mc) {
        console.log('[PlayerPhoto] No matchContext');
        setPhotoUrl(null);
        setIsLoading(false);
        return;
      }

      const roster = goal.team === 'home' ? mc.homeRoster : mc.awayRoster;
      const teamName = goal.team === 'home' ? state.live.homeTeamName : state.live.awayTeamName;
      console.log('[PlayerPhoto] Team found:', teamName, 'Players:', roster?.length || 0);

      if (!roster || roster.length === 0) {
        console.log('[PlayerPhoto] Team has no players');
        setPhotoUrl(null);
        setIsLoading(false);
        return;
      }

      // Find player by playerNumber
      const player = roster.find(p => p.number === goal.scorer?.playerNumber);

      if (!player) {
        console.log('[PlayerPhoto] Player not found for number:', goal.scorer?.playerNumber);
        console.log('[PlayerPhoto] Available players:', roster.map(p => ({ num: p.number, id: p.id })));
        setPhotoUrl(null);
        setIsLoading(false);
        return;
      }

      console.log('[PlayerPhoto] Player found:', { id: player.id, number: player.number, name: player.name, photoFileName: player.photoFileName });

      // Check if player has a photo
      if (!player.photoFileName) {
        console.log('[PlayerPhoto] Player has no photo');
        setPhotoUrl(null);
        setIsLoading(false);
        return;
      }

      // Find tournament from activeTournament
      const tournament = state.config.activeTournament;

      if (!tournament || !tournament.matches?.some(m => m.id === state.live.matchId)) {
        console.log('[PlayerPhoto] Tournament not found');
        setPhotoUrl(null);
        setIsLoading(false);
        return;
      }

      // Sanitize team name for path
      const sanitizedTeamName = teamName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

      // Try to load player photo using photoFileName
      const photoPath = `tournaments/${tournament.id}/players/${sanitizedTeamName}/${player.photoFileName}`;
      console.log('[PlayerPhoto] Trying to load:', photoPath);

      try {
        const response = await fetch(`/api/storage/read?path=${encodeURIComponent(photoPath)}`);
        console.log('[PlayerPhoto] Response status:', response.status);

        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          currentUrl = url;
          setPhotoUrl(url);
          console.log('[PlayerPhoto] ✅ Photo loaded successfully!');
        } else {
          console.log('[PlayerPhoto] ❌ Photo not found (status:', response.status, ')');
          setPhotoUrl(null);
        }
      } catch (error) {
        console.log('[PlayerPhoto] ❌ Error loading photo:', error);
        setPhotoUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    setIsLoading(true);
    loadPlayerPhoto();

    // Cleanup URL on unmount
    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [goal?.scorer?.playerNumber, goal?.team, state.live.matchId, state.live.matchContext]);

  if (!goal || isLoading || !photoUrl) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: -600, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -600, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className="fixed left-[5%] top-[40%] -translate-y-1/2 z-40"
      >
        <motion.div
          className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-accent"
          animate={{
            boxShadow: [
              '0 0 20px rgba(251, 146, 60, 0.5)',
              '0 0 40px rgba(251, 146, 60, 0.8)',
              '0 0 20px rgba(251, 146, 60, 0.5)',
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Image
            src={photoUrl}
            alt={'Jugador'}
            width={780}
            height={1040}
            className="object-cover"
            style={{
              width: `${photoSize}rem`,
              height: `${photoSize * 1.25}rem`
            }}
            priority
          />

          {/* Gradient overlay at bottom with player info */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-10">
            <p className="text-white font-bold text-6xl">
              #{goal.scorer?.playerNumber || 'S/N'}
            </p>
            <p className="text-white/90 text-4xl font-semibold">
              {state.live.attendance[goal.team]?.find(p => p.number === goal.scorer?.playerNumber)?.name}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
