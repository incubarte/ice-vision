
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useGameState } from '@/contexts/game-state-context';
import { Button } from '@/components/ui/button';
import { HockeyPuckSpinner } from '@/components/ui/hockey-puck-spinner';
import { ArrowLeft, Trophy, Info } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamsManagementTab } from '@/components/config/teams-management-tab';
import { FixtureCalendarView } from '@/components/fixture/fixture-calendar-view';
import { FixtureListView } from '@/components/fixture/fixture-list-view';
import { StandingsTab } from '@/components/tournaments/standings-tab';
import { PlayerStatsTab } from '@/components/tournaments/player-stats-tab';
import { TodayMatchesSection } from '@/components/tournaments/today-matches-section';
import { StaffManagementTab } from '@/components/tournaments/staff-management-tab';
import { DisciplineTab } from '@/components/tournaments/discipline-tab';
import { ClubsManagementTab } from '@/components/clubs/clubs-management-tab';
import { useTournamentLogo } from '@/hooks/use-tournament-logo';
import Image from 'next/image';

export default function TournamentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, dispatch, isLoading: isGameStateLoading } = useGameState();

  const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY === 'true';
  const showTeamsInReadOnly = process.env.NEXT_PUBLIC_SHOW_TEAMS_IN_READONLY === 'true';
  const shouldShowTeams = !isReadOnly || showTeamsInReadOnly;

  const tournamentId = typeof params.tournamentId === 'string' ? params.tournamentId : undefined;

  // Fetch full tournament data directly (teams, matches, summaries) without touching selectedTournamentId.
  // This keeps "browsing a tournament" decoupled from "setting the active scoreboard tournament".
  useEffect(() => {
    if (!tournamentId) return;
    if (state.config.activeTournament?.id === tournamentId) return; // Already loaded
    fetch(`/api/tournaments/${tournamentId}`)
      .then(res => { if (!res.ok) throw new Error(`${res.status}`); return res.json(); })
      .then(data => {
        if (data.tournament) {
          dispatch({ type: 'LOAD_TOURNAMENT_CONTEXT', payload: { tournamentData: data.tournament } });
        }
      })
      .catch(err => console.error('[TournamentPage] Failed to load tournament data:', err));
  // Re-run only when the URL param changes. activeTournament is checked at runtime to skip
  // unnecessary fetches but is not a trigger — adding it would cause re-fetch loops.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, dispatch]);

  const initialTab = searchParams.get('tab') || (shouldShowTeams ? 'clubs' : 'fixture');
  const initialFixtureView = searchParams.get('view') === 'list' ? 'list' : 'calendar';

  const [activeTab, setActiveTab] = useState(initialTab);

  const { logo } = useTournamentLogo(tournamentId);

  const selectedTournament = useMemo(() => {
    if (!tournamentId) return null;
    return (state.config.tournaments || []).find(t => t.id === tournamentId);
  }, [state.config.tournaments, tournamentId]);

  useEffect(() => {
    const newTab = searchParams.get('tab');
    const validTabs = ['clubs', 'teamsAndCategories', 'staff', 'fixture', 'standings', 'playerStats'];
    if (newTab && validTabs.includes(newTab)) {
      if (!shouldShowTeams && (newTab === 'clubs' || newTab === 'teamsAndCategories' || newTab === 'staff')) {
        setActiveTab('fixture');
      } else {
        setActiveTab(newTab);
      }
    }
  }, [searchParams, shouldShowTeams]);

  if (isGameStateLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
        <HockeyPuckSpinner className="h-24 w-24 text-primary mb-4" />
        <p className="text-xl text-foreground">Cargando datos del torneo...</p>
      </div>
    );
  }

  if (!selectedTournament) {
    return (
      <div className="text-center py-10">
        <Info className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive-foreground mb-2">Torneo no encontrado</h2>
        <p className="text-muted-foreground mb-6">
          El torneo que estás buscando no existe o ha sido eliminado.
        </p>
        <Button onClick={() => router.push('/tournaments')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a la lista de Torneos
        </Button>
      </div>
    );
  }

  // Wait for full tournament data (teams, matches, etc.) to finish loading.
  // After the initial load, the context fetches full data async — until it arrives,
  // activeTournament may be null or point to a different tournament.
  if (state.config.activeTournament?.id !== tournamentId) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
        <HockeyPuckSpinner className="h-24 w-24 text-primary mb-4" />
        <p className="text-xl text-foreground">Cargando datos del torneo...</p>
      </div>
    );
  }


  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <Button variant="outline" onClick={() => router.push('/tournaments')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Torneos
      </Button>

      <div className="flex items-center gap-4">
        {logo ? (
          <Image src={logo} alt="Tournament logo" width={120} height={120} className="object-contain" />
        ) : (
          <Trophy className="h-[120px] w-[120px] text-amber-400" />
        )}
        <h1 className="text-4xl font-bold text-primary-foreground">{selectedTournament.name}</h1>
      </div>

      <div className="border-b" />

      {tournamentId && <TodayMatchesSection tournamentId={tournamentId} />}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full overflow-x-auto justify-start h-auto p-1 gap-1">
          {shouldShowTeams && <TabsTrigger value="clubs" className="shrink-0 text-xs sm:text-sm">Clubes</TabsTrigger>}
          {shouldShowTeams && <TabsTrigger value="teamsAndCategories" className="shrink-0 text-xs sm:text-sm">Equipos</TabsTrigger>}
          {shouldShowTeams && <TabsTrigger value="staff" className="shrink-0 text-xs sm:text-sm">Staff</TabsTrigger>}
          <TabsTrigger value="fixture" className="shrink-0 text-xs sm:text-sm">Fixture</TabsTrigger>
          <TabsTrigger value="standings" className="shrink-0 text-xs sm:text-sm">
            <span className="sm:hidden">Posiciones</span>
            <span className="hidden sm:inline">Tabla de Posiciones</span>
          </TabsTrigger>
          {state.config.showShotsData && <TabsTrigger value="playerStats" className="shrink-0 text-xs sm:text-sm">Estadísticas</TabsTrigger>}
          <TabsTrigger value="discipline" className="shrink-0 text-xs sm:text-sm">Disciplina</TabsTrigger>
        </TabsList>

        {shouldShowTeams && tournamentId && (
          <TabsContent value="clubs" className="mt-6">
            <ClubsManagementTab tournamentId={tournamentId} />
          </TabsContent>
        )}

        {shouldShowTeams && (
          <TabsContent value="teamsAndCategories" className="mt-6">
            <TeamsManagementTab tournamentId={tournamentId} />
          </TabsContent>
        )}

        {shouldShowTeams && tournamentId && (
          <TabsContent value="staff" className="mt-6">
            <StaffManagementTab tournamentId={tournamentId} />
          </TabsContent>
        )}

        <TabsContent value="fixture" className="mt-6">
          <Tabs defaultValue={initialFixtureView} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="calendar">Vista Calendario</TabsTrigger>
              <TabsTrigger value="list">Vista Lista</TabsTrigger>
            </TabsList>
            <TabsContent value="calendar" className="mt-6">
              <FixtureCalendarView tournamentId={tournamentId} />
            </TabsContent>
            <TabsContent value="list" className="mt-6">
              <FixtureListView tournamentId={tournamentId} />
            </TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="standings" className="mt-6">
          <StandingsTab tournamentId={tournamentId} />
        </TabsContent>
        {state.config.showShotsData && (
          <TabsContent value="playerStats" className="mt-6">
            <PlayerStatsTab tournamentId={tournamentId} />
          </TabsContent>
        )}
        {tournamentId && (
          <TabsContent value="discipline" className="mt-6">
            <DisciplineTab tournamentId={tournamentId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
