"use client";

import { Trophy } from 'lucide-react';
import { useTournamentLogo } from '@/hooks/use-tournament-logo';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface TournamentLogoProps {
  tournamentId: string;
  size?: number;
  className?: string;
  showFallback?: boolean; // Si mostrar el icono Trophy cuando no hay logo
}

export function TournamentLogo({ tournamentId, size = 40, className, showFallback = true }: TournamentLogoProps) {
  const { logo, isLoading } = useTournamentLogo(tournamentId);

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

  // Si está cargando o no hay logo y no queremos fallback, no mostrar nada
  if (isLoading || !showFallback) {
    return null;
  }

  // Mostrar Trophy como fallback solo si showFallback es true
  return <Trophy className={cn("text-amber-400", className)} style={{ width: size, height: size }} />;
}
