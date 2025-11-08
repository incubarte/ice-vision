
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useGameState } from '@/contexts/game-state-context';
import { Button } from '@/components/ui/button';
import { HockeyPuckSpinner } from '@/components/ui/hockey-puck-spinner';
import { ArrowLeft, Trophy, Info } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CategorySettingsCard } from '@/components/config/category-settings-card';
import { TeamsManagementTab } from '@/components/config/teams-management-tab';
import { FixtureCalendarView } from '@/components/fixture/fixture-calendar-view';
import { FixtureListView } from '@/components/fixture/fixture-list-view';
import { Separator } from '@/components/ui/separator';
import { StandingsTab } from '@/components/tournaments/standings-tab';
import { PlayerStatsTab } from '@/components/tournaments/player-stats-tab';

export default function TournamentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, isLoading: isGameStateLoading } = useGameState();

  const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY === 'true';

  const tournamentId = typeof params.tournamentId === 'string' ? params.tournamentId : undefined;
  const initialTab = searchParams.get('tab') || (isReadOnly ? 'fixture' : 'teamsAndCategories');
  const initialFixtureView = searchParams.get('view') === 'list' ? 'list' : 'calendar';
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isCategoryDirty, setIsCategoryDirty] = useState(false);
  
  const selectedTournament = useMemo(() => {
    if (!tournamentId) return null;
    return (state.config.tournaments || []).find(t => t.id === tournamentId);
  }, [state.config.tournaments, tournamentId]);
  
  useEffect(() => {
    const newTab = searchParams.get('tab');
    const validTabs = ['teamsAndCategories', 'fixture', 'standings', 'playerStats'];
    if (newTab && validTabs.includes(newTab)) {
      if (isReadOnly && newTab === 'teamsAndCategories') {
        setActiveTab('fixture');
      } else {
        setActiveTab(newTab);
      }
    }
  }, [searchParams, isReadOnly]);

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

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <Button variant="outline" onClick={() => router.push('/tournaments')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Torneos
      </Button>
      
      <div className="flex items-center gap-4">
        <Trophy className="h-10 w-10 text-amber-400" />
        <h1 className="text-4xl font-bold text-primary-foreground">{selectedTournament.name}</h1>
      </div>

      <Separator />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${isReadOnly ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'} gap-1`}>
          {!isReadOnly && <TabsTrigger value="teamsAndCategories" className="text-xs sm:text-sm">Equipos y Categorías</TabsTrigger>}
          <TabsTrigger value="fixture" className="text-xs sm:text-sm">Fixture</TabsTrigger>
          <TabsTrigger value="standings" className="text-xs sm:text-sm">Tabla de Posiciones</TabsTrigger>
          <TabsTrigger value="playerStats" className="text-xs sm:text-sm">Estadísticas</TabsTrigger>
        </TabsList>

        {!isReadOnly && (
          <TabsContent value="teamsAndCategories" className="mt-6">
            <div className="space-y-8">
              <CategorySettingsCard onDirtyChange={setIsCategoryDirty} />
              {isCategoryDirty && (
                <div className="flex justify-end gap-2">
                  <p className="text-sm text-muted-foreground self-center">Hay cambios sin guardar en las categorías.</p>
                </div>
              )}
              <Separator />
              <TeamsManagementTab />
            </div>
          </TabsContent>
        )}

        <TabsContent value="fixture" className="mt-6">
            <Tabs defaultValue={initialFixtureView} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="calendar">Vista Calendario</TabsTrigger>
                <TabsTrigger value="list">Vista Lista</TabsTrigger>
              </TabsList>
              <TabsContent value="calendar" className="mt-6">
                 <FixtureCalendarView />
              </TabsContent>
              <TabsContent value="list" className="mt-6">
                <FixtureListView />
              </TabsContent>
            </Tabs>
        </TabsContent>
        <TabsContent value="standings" className="mt-6">
            <StandingsTab />
        </TabsContent>
        <TabsContent value="playerStats" className="mt-6">
            <PlayerStatsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
