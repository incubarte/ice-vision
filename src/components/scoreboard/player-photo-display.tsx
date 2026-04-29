"use client";

import React, { useState, useEffect, useRef } from 'react';
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
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { scoreboardLayout } = state.config;
  const photoSize = scoreboardLayout.goalCelebrationPhotoSize ?? 40;

  useEffect(() => {
    let currentUrl: string | null = null;

    const loadPlayerMedia = async () => {
      const mc = state.live.matchContext;

      if (!goal?.scorer?.playerNumber || !state.live.matchId) {
        setMediaUrl(null);
        setIsLoading(false);
        return;
      }

      if (!mc) {
        setMediaUrl(null);
        setIsLoading(false);
        return;
      }

      const roster = goal.team === 'home' ? mc.homeRoster : mc.awayRoster;
      const teamName = goal.team === 'home' ? state.live.homeTeamName : state.live.awayTeamName;

      if (!roster || roster.length === 0) {
        setMediaUrl(null);
        setIsLoading(false);
        return;
      }

      // matchContext is a snapshot — use it only to find player by number.
      // For media fields, read from activeTournament which is always up-to-date.
      const snapshotPlayer = roster.find(p => p.number === goal.scorer?.playerNumber);

      if (!snapshotPlayer) {
        setMediaUrl(null);
        setIsLoading(false);
        return;
      }

      const tournament = state.config.activeTournament;
      if (!tournament || !tournament.matches?.some(m => m.id === state.live.matchId)) {
        setMediaUrl(null);
        setIsLoading(false);
        return;
      }

      // Look up the live player data from the tournament (has the latest edits)
      const teamId = goal.team === 'home' ? mc.homeTeamId : mc.awayTeamId;
      const tournamentTeam = tournament.teams.find(t => t.id === teamId);
      const player = tournamentTeam?.players.find(p => p.id === snapshotPlayer.id) ?? snapshotPlayer;

      const sanitizedTeamName = teamName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

      // Decide which media to show — default is 'none' (nothing shown unless explicitly configured)
      const mediaConfig = player.celebrationMediaType ?? 'none';
      const useVideo = mediaConfig === 'video' && !!player.celebrationVideoFileName;
      const usePhoto = mediaConfig === 'photo' && !!player.photoFileName;

      if (!useVideo && !usePhoto) {
        setMediaUrl(null);
        setIsLoading(false);
        return;
      }

      const fileName = useVideo ? player.celebrationVideoFileName! : player.photoFileName!;
      const filePath = `tournaments/${tournament.id}/players/${sanitizedTeamName}/${fileName}`;

      try {
        const response = await fetch(`/api/storage/read?path=${encodeURIComponent(filePath)}`);

        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          currentUrl = url;
          setMediaUrl(url);
          setMediaType(useVideo ? 'video' : 'photo');
        } else {
          setMediaUrl(null);
        }
      } catch (error) {
        console.error('[PlayerPhotoDisplay] Error loading media:', error);
        setMediaUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    setIsLoading(true);
    loadPlayerMedia();

    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [goal?.scorer?.playerNumber, goal?.team, state.live.matchId, state.live.matchContext, state.config.activeTournament]);

  // Auto-play video when URL is set
  useEffect(() => {
    if (mediaType === 'video' && videoRef.current && mediaUrl) {
      videoRef.current.play().catch(() => {});
    }
  }, [mediaUrl, mediaType]);

  if (!goal || isLoading || !mediaUrl) return null;

  const roster = state.live.matchContext
    ? (goal.team === 'home' ? state.live.matchContext.homeRoster : state.live.matchContext.awayRoster)
    : [];
  const playerName = roster.find(p => p.number === goal.scorer?.playerNumber)?.name;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: -600, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -600, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className="fixed left-[5%] top-[40%] -translate-y-1/2 z-40"
      >
        {/* Ambient glow behind video */}
        {mediaType === 'video' && (
          <motion.div
            className="absolute inset-0 -z-10"
            style={{
              width: `${photoSize}rem`,
              height: `${photoSize * 1.25}rem`,
              filter: 'blur(40px)',
              background: 'radial-gradient(ellipse at center, rgba(251,146,60,0.6) 0%, rgba(251,191,36,0.3) 50%, transparent 80%)',
            }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        <motion.div
          className={mediaType === 'video'
            ? "relative overflow-hidden"
            : "relative rounded-2xl overflow-hidden shadow-2xl border-4 border-accent"
          }
          animate={mediaType === 'photo' ? {
            boxShadow: [
              '0 0 20px rgba(251, 146, 60, 0.5)',
              '0 0 40px rgba(251, 146, 60, 0.8)',
              '0 0 20px rgba(251, 146, 60, 0.5)',
            ],
          } : {}}
          transition={mediaType === 'photo' ? {
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          } : {}}
        >
          {mediaType === 'video' ? (
            <video
              ref={videoRef}
              src={mediaUrl}
              autoPlay
              muted
              playsInline
              style={{
                width: `${photoSize}rem`,
                height: `${photoSize * 1.25}rem`,
                objectFit: 'cover',
              }}
            />
          ) : (
            <Image
              src={mediaUrl}
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
          )}

          {/* Gradient overlay at bottom with player info */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-10">
            <p className="text-white font-bold text-6xl">
              #{goal.scorer?.playerNumber || 'S/N'}
            </p>
            <p className="text-white/90 text-4xl font-semibold">
              {playerName}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
