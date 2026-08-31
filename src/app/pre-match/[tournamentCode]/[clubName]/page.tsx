"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { PasswordGate } from '@/components/pre-match/password-gate';
import { PreMatchForm } from '@/components/pre-match/pre-match-form';
import type { MatchData, TeamData, PreMatchData } from '@/types';
import { Loader2, CalendarX, ChevronRight, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const SESSION_KEY_PREFIX = 'pre-match-auth';

interface MatchEntry {
  match: MatchData;
  team: TeamData;
  role: 'home' | 'away';
  opponentName: string | null;
}

interface InitialDataMap {
  [matchId: string]: PreMatchData | null;
}

function formatTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return '';
  }
}

export default function PreMatchPage() {
  const params = useParams();
  const tournamentCode = params.tournamentCode as string;
  const clubName = params.clubName as string;
  const decodedClubName = decodeURIComponent(clubName);

  const sessionKey = `${SESSION_KEY_PREFIX}-${tournamentCode}-${clubName}`;

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [matchEntries, setMatchEntries] = useState<MatchEntry[]>([]);
  const [initialDataMap, setInitialDataMap] = useState<InitialDataMap>({});
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clubPassword, setClubPassword] = useState('IceVision');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (sessionStorage.getItem(sessionKey) === '1') setIsAuthenticated(true);
    }
  }, [sessionKey]);

  // Fetch club password on mount so PasswordGate can validate correctly before auth
  useEffect(() => {
    fetch(`/api/pre-match/club/${tournamentCode}/${clubName}/matches`)
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (json?.password) setClubPassword(json.password); })
      .catch(() => {});
  }, [tournamentCode, clubName]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pre-match/club/${tournamentCode}/${clubName}/matches`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'Error al cargar los partidos');
        return;
      }
      const json = await res.json() as { tournamentId: string; matches: MatchEntry[]; password?: string };
      setMatchEntries(json.matches);
      setClubPassword(json.password || 'IceVision');

      const dataMap: InitialDataMap = {};
      await Promise.all(
        json.matches.map(async ({ match }: MatchEntry) => {
          try {
            const r = await fetch(`/api/pre-match/club/${tournamentCode}/${clubName}/${match.id}`);
            if (r.ok) {
              const d = await r.json();
              dataMap[match.id] = d.exists ? d.data : null;
            } else {
              dataMap[match.id] = null;
            }
          } catch {
            dataMap[match.id] = null;
          }
        })
      );
      setInitialDataMap(dataMap);
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setIsLoading(false);
    }
  }, [tournamentCode, clubName]);

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated, loadData]);

  function handleAuthSuccess() {
    sessionStorage.setItem(sessionKey, '1');
    setIsAuthenticated(true);
  }

  function handleSaved() {
    loadData();
    setSelectedMatchId(null);
  }

  if (!isAuthenticated) {
    return <PasswordGate onSuccess={handleAuthSuccess} password={clubPassword} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">{error}</p>
          <button className="text-sm text-muted-foreground underline" onClick={loadData}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Match detail view
  const selectedEntry = matchEntries.find(e => e.match.id === selectedMatchId);
  if (selectedMatchId && selectedEntry) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto p-4 space-y-4">
          <button
            onClick={() => setSelectedMatchId(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground pt-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a los partidos
          </button>

          <PreMatchForm
            apiBase={`/api/pre-match/club/${tournamentCode}/${clubName}`}
            match={selectedEntry.match}
            team={selectedEntry.team}
            teamRole={selectedEntry.role}
            opponentName={selectedEntry.opponentName}
            initialData={initialDataMap[selectedMatchId] ?? null}
            onSaved={handleSaved}
            password={clubPassword}
          />
        </div>
      </div>
    );
  }

  // Match list view
  const firstMatchDate = matchEntries[0]?.match.date;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="pt-4 space-y-1">
          <h1 className="text-xl font-bold">{decodedClubName}</h1>
          {firstMatchDate && (
            <p className="text-sm text-muted-foreground capitalize">{formatDate(firstMatchDate)}</p>
          )}
        </div>

        {matchEntries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <CalendarX className="h-10 w-10" />
            <p className="font-medium">No hay partidos hoy</p>
            <p className="text-sm">El formulario estará disponible el día del partido.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {matchEntries.map(({ match, team, role, opponentName }) => {
              const isSaved = !!initialDataMap[match.id];
              const savedCount = initialDataMap[match.id]?.players.filter(p => p.isPresent).length ?? 0;

              return (
                <button
                  key={match.id}
                  onClick={() => setSelectedMatchId(match.id)}
                  className={cn(
                    'w-full text-left border rounded-lg p-4 flex items-center gap-4 transition-colors hover:bg-muted/50',
                    isSaved ? 'border-green-500/40 bg-green-500/5' : 'border-border bg-card'
                  )}
                >
                  {/* Time */}
                  <div className="flex flex-col items-center w-14 shrink-0">
                    <Clock className="h-4 w-4 text-muted-foreground mb-0.5" />
                    <span className="font-mono font-semibold text-sm">{formatTime(match.date)}</span>
                  </div>

                  {/* Match info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {role === 'home' ? 'vs' : 'vs'} {opponentName ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {role === 'home' ? 'Local' : 'Visitante'} · {team.category}
                    </p>
                    {isSaved && (
                      <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {savedCount} jugadores confirmados
                      </p>
                    )}
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
