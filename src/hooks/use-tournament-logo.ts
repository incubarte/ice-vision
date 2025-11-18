"use client";

import { useState, useEffect } from 'react';

export function useTournamentLogo(tournamentId: string | undefined | null) {
  const [logo, setLogo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tournamentId) {
      setLogo(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchLogo() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/tournaments/${tournamentId}/logo`);
        const data = await response.json();

        if (!cancelled) {
          setLogo(data.logo || null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching tournament logo:', error);
        if (!cancelled) {
          setLogo(null);
          setIsLoading(false);
        }
      }
    }

    fetchLogo();

    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  return { logo, isLoading };
}
