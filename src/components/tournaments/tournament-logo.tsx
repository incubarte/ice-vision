"use client";

import { Trophy } from 'lucide-react';
import { useTournamentLogo } from '@/hooks/use-tournament-logo';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface TournamentLogoProps {
  tournamentId: string;
  size?: number;
  className?: string;
}

export function TournamentLogo({ tournamentId, size = 40, className }: TournamentLogoProps) {
  const { logo } = useTournamentLogo(tournamentId);

  if (logo) {
    return (
      <Image
        src={logo}
        alt="Tournament logo"
        width={size}
        height={size}
        className={cn("object-contain", className)}
      />
    );
  }

  return <Trophy className={cn("text-amber-400", className)} style={{ width: size, height: size }} />;
}
