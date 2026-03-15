
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

  useEffect(() => {
    if (tournamentId && state.config.selectedTournamentId !== tournamentId) {
      dispatch({ type: 'UPDATE_CONFIG_FIELDS', payload: { selectedTournamentId: tournamentId } });
    }
  }, [tournamentId, state.config.selectedTournamentId, dispatch]);
  const initialTab = searchParams.get('tab') || (shouldShowTeams ? 'teamsAndCategories' : 'fixture');
  const initialFixtureView = searchParams.get('view') === 'list' ? 'list' : 'calendar';

  const [activeTab, setActiveTab] = useState(initialTab);

  const { logo } = useTournamentLogo(tournamentId);

  const selectedTournament = useMemo(() => {
    if (!tournamentId) return null;
    return (state.config.tournaments || []).find(t => t.id === tournamentId);
  }, [state.config.tournaments, tournamentId]);

  useEffect(() => {
    const newTab = searchParams.get('tab');
    const validTabs = ['teamsAndCategories', 'staff', 'fixture', 'standings', 'playerStats'];
    if (newTab && validTabs.includes(newTab)) {
      if (!shouldShowTeams && (newTab === 'teamsAndCategories' || newTab === 'staff')) {
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

  // Calculate grid columns based on enabled tabs
  const getGridColsClass = () => {
    let cols = 2; // Fixture + Standings always present
    if (shouldShowTeams) cols += 2; // Teams + Staff (Staff Metrics integrated into Estadísticas)
    if (state.config.showShotsData) cols++;

    // Responsive classes
    if (cols === 2) return "grid-cols-2";
    if (cols === 3) return "grid-cols-2 sm:grid-cols-3";
    if (cols === 4) return "grid-cols-2 sm:grid-cols-4";
    if (cols === 5) return "grid-cols-2 sm:grid-cols-3 md:grid-cols-5";
    return "grid-cols-2 sm:grid-cols-3 md:grid-cols-5"; // fallback
  };

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
        <TabsList className={`grid w-full ${getGridColsClass()} gap-1`}>
          {shouldShowTeams && <TabsTrigger value="teamsAndCategories" className="text-xs sm:text-sm">Equipos</TabsTrigger>}
          {shouldShowTeams && <TabsTrigger value="staff" className="text-xs sm:text-sm">Staff</TabsTrigger>}
          <TabsTrigger value="fixture" className="text-xs sm:text-sm">Fixture</TabsTrigger>
          <TabsTrigger value="standings" className="text-xs sm:text-sm">Tabla de Posiciones</TabsTrigger>
          {state.config.showShotsData && <TabsTrigger value="playerStats" className="text-xs sm:text-sm">Estadísticas</TabsTrigger>}
        </TabsList>

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
      </Tabs>
    </div>
  );
}
