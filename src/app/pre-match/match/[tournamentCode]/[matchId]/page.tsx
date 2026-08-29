"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PasswordGate } from '@/components/pre-match/password-gate';
import { PreMatchForm } from '@/components/pre-match/pre-match-form';
import type { MatchData, TeamData, PreMatchData } from '@/types';
import { Loader2, ArrowLeft, Users } from 'lucide-react';
import { getTeamDisplayName } from '@/lib/utils';

const SESSION_KEY_PREFIX = 'pre-match-auth';

interface MatchInfo {
  tournamentId: string;
  match: MatchData;
  homeTeam: TeamData | null;
  awayTeam: TeamData | null;
  homeInitialData: PreMatchData | null;
  awayInitialData: PreMatchData | null;
}

export default function PreMatchMatchPage() {
  const params = useParams();
  const tournamentCode = params.tournamentCode as string;
  const matchId = params.matchId as string;

  const sessionKey = `${SESSION_KEY_PREFIX}-${tournamentCode}-match`;

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'home' | 'away' | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (sessionStorage.getItem(sessionKey) === '1') setIsAuthenticated(true);
    }
  }, [sessionKey]);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pre-match/match/${tournamentCode}/${matchId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'Error al cargar el partido');
        return;
      }
      setMatchInfo(await res.json());
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated]);

  function handleAuthSuccess() {
    sessionStorage.setItem(sessionKey, '1');
    setIsAuthenticated(true);
  }

  function handleSaved() {
    loadData();
    setSelectedRole(null);
  }

  if (!isAuthenticated) return <PasswordGate onSuccess={handleAuthSuccess} />;

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-2">
        <p className="text-destructive font-medium">{error}</p>
        <button className="text-sm text-muted-foreground underline" onClick={loadData}>Reintentar</button>
      </div>
    </div>
  );

  if (!matchInfo) return null;

  const { match, homeTeam, awayTeam, homeInitialData, awayInitialData } = matchInfo;

  const selectedTeam = selectedRole === 'home' ? homeTeam : selectedRole === 'away' ? awayTeam : null;
  const opponentTeam = selectedRole === 'home' ? awayTeam : homeTeam;
  const initialData = selectedRole === 'home' ? homeInitialData : awayInitialData;

  const apiBase = `/api/pre-match/match/${tournamentCode}/${matchId}`;

  if (selectedRole && selectedTeam) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto p-4 space-y-4">
          <button
            onClick={() => setSelectedRole(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground pt-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Cambiar equipo
          </button>
          <PreMatchForm
            apiBase={apiBase}
            postUrl={`${apiBase}/${selectedTeam.id}`}
            match={match}
            team={selectedTeam}
            teamRole={selectedRole}
            opponentName={opponentTeam ? getTeamDisplayName(opponentTeam.name, opponentTeam.subName) : null}
            initialData={initialData ?? null}
            onSaved={handleSaved}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto p-4 space-y-6 pt-8">
        <div className="space-y-1">
          <h1 className="text-xl font-bold">Completar Pre-partido</h1>
          <p className="text-sm text-muted-foreground">Selecciona tu equipo</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {homeTeam && (
            <button
              onClick={() => setSelectedRole('home')}
              className="flex flex-col items-center gap-3 p-6 border rounded-xl bg-card hover:bg-muted/50 transition-colors text-center"
            >
              <Users className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Local</p>
                <p className="font-semibold">{getTeamDisplayName(homeTeam.name, homeTeam.subName)}</p>
              </div>
              {homeInitialData && (
                <p className="text-xs text-green-600">Ya completado</p>
              )}
            </button>
          )}
          {awayTeam && (
            <button
              onClick={() => setSelectedRole('away')}
              className="flex flex-col items-center gap-3 p-6 border rounded-xl bg-card hover:bg-muted/50 transition-colors text-center"
            >
              <Users className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Visitante</p>
                <p className="font-semibold">{getTeamDisplayName(awayTeam.name, awayTeam.subName)}</p>
              </div>
              {awayInitialData && (
                <p className="text-xs text-green-600">Ya completado</p>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
