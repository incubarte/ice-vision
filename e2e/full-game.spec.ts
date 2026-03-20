import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const protoDataDir = path.join(process.cwd(), 'storageTest', 'protoData');

function readSeed(filename: string) {
  return JSON.parse(fs.readFileSync(path.join(protoDataDir, filename), 'utf-8'));
}

// Short-duration profile for fast e2e testing
const testProfile = {
  id: 'test-profile',
  name: 'E2E Test',
  defaultWarmUpDuration: 100,       // 1 second (centiseconds)
  defaultPeriodDuration: 150,       // 1.5 seconds
  defaultOTPeriodDuration: 100,     // 1 second
  defaultBreakDuration: 100,        // 1 second
  defaultPreOTBreakDuration: 100,   // 1 second
  defaultTimeoutDuration: 100,      // 1 second
  numberOfRegularPeriods: 2,
  numberOfOvertimePeriods: 0,
  playersPerTeamOnIce: 5,
  maxConcurrentPenalties: 2,
  autoStartWarmUp: true,
  autoStartBreaks: true,
  autoStartPreOTBreaks: true,
  autoStartTimeouts: true,
  gameTimeMode: 'stopped' as const,
  autoActivatePuckPenalties: false,
  enableMaxPenaltiesLimit: false,
  maxPenaltiesPerPlayer: 3,
  enableStoppedTimeAlert: false,
  stoppedTimeAlertGoalDiff: 1,
  stoppedTimeAlertTimeRemaining: 2,
  penaltyTypes: [
    { id: 'menor-2', name: 'Menor', duration: 3, reducesPlayerCount: true, clearsOnGoal: true, isBenchPenalty: false },
    { id: 'mayor-5', name: 'Mayor', duration: 5, reducesPlayerCount: true, clearsOnGoal: false, isBenchPenalty: false },
  ],
  defaultPenaltyTypeId: 'menor-2',
};

const testConfig = {
  selectedTournamentId: 'test-tournament-1',
  selectedMatchCategory: 'test-cat-1',
  enableTeamSelectionInMiniScoreboard: false,
  enablePlayerSelectionForPenalties: false,
  flashingZeroDurationMs: 200,
  formatAndTimingsProfiles: [testProfile],
  selectedFormatAndTimingsProfileId: 'test-profile',
  // Also set flat values so they're available before profile is applied
  ...testProfile,
};

// Helper: start the clock
async function startClock(page: Page) {
  const btn = page.getByRole('button', { name: 'Iniciar Reloj' });
  await expect(btn).toBeVisible({ timeout: 5000 });
  await btn.click();
}

// Helper: add a goal via the dialog (scorer + optional assists)
async function addGoal(
  page: Page,
  team: 'home' | 'away',
  scorer: string,
  opts?: { assist1?: string; assist2?: string }
) {
  const label = team === 'home' ? '(Local)' : '(Visitante)';

  // Click the score button
  const scoreButton = page
    .locator('p')
    .filter({ hasText: label })
    .locator('..')
    .locator('button')
    .first();
  await scoreButton.click();

  // Fill scorer
  const scorerInput = page.locator('#new-scorer-number');
  await expect(scorerInput).toBeVisible({ timeout: 3000 });
  await scorerInput.fill(scorer);

  // Fill assists if provided
  if (opts?.assist1) {
    await page.locator('#new-assist-number').fill(opts.assist1);
  }
  if (opts?.assist2) {
    await page.locator('#new-assist2-number').fill(opts.assist2);
  }

  // Submit
  const addBtn = page.locator('button[type="submit"]').filter({ hasText: /Añadir Gol/i });
  await addBtn.click();

  // Wait for dialog to close
  await expect(scorerInput).not.toBeVisible({ timeout: 3000 });
}

// Helper: add a penalty
async function addPenalty(page: Page, team: 'home' | 'away', playerNumber: string) {
  const input = page.locator(`#${team}-playerNumberForPenalty`);
  await expect(input).toBeVisible({ timeout: 3000 });
  await input.fill(playerNumber);

  // Click the "Agregar" button associated with the input's form — use aria-label
  const teamLabel = team === 'home' ? 'Test Home' : 'Test Away';
  const addBtn = page.getByRole('button', { name: new RegExp(`Agregar penalidad para ${teamLabel}`) });
  await addBtn.click();
}

test.describe('Full Game Lifecycle', () => {

  test.beforeEach(async ({ request }) => {
    // Reset server state with seed data + short-duration config
    const seedLive = readSeed('live.json');
    // Override live state to start at warm-up (period 0) with short clock
    const liveForTest = {
      ...seedLive,
      clock: {
        ...seedLive.clock,
        currentTime: testConfig.defaultWarmUpDuration,
        currentPeriod: 0,
        isClockRunning: false,
        periodDisplayOverride: 'Pre Warm-up',
      },
    };
    await request.post('/api/db', { data: { live: liveForTest, config: testConfig } });
  });

  test('complete game with goals, penalties, player number swap, and summary', async ({ context, request }) => {
    test.setTimeout(60000);

    // Create both pages and start navigation in parallel
    const [controlsPage, scoreboardPage] = await Promise.all([
      context.newPage(),
      context.newPage(),
    ]);
    const controlsReady = controlsPage.goto('/controls');
    const scoreboardReady = scoreboardPage.goto('/scoreboard');

    // ─── PHASE 1: GAME PREPARATION ───

    // Wait for controls page to load
    await controlsReady;

    // Switch to Jugadores tab
    await controlsPage.getByRole('tab', { name: 'Jugadores' }).click();

    // Wait for player cards to load
    await expect(controlsPage.getByText('0/3 presentes').first()).toBeVisible({ timeout: 5000 });

    // Mark all home players as attended
    await controlsPage.getByText('HOME GOALKEEPER').click();
    await controlsPage.getByText('HOME PLAYER ONE').click();
    await controlsPage.getByText('HOME PLAYER TWO').click();

    // Mark home goalkeeper as active
    await controlsPage.getByRole('button', { name: 'Activar' }).first().click();

    // Verify home attendance
    await expect(controlsPage.getByText('3/3 presentes').first()).toBeVisible({ timeout: 3000 });

    // Mark all away players as attended
    await controlsPage.getByText('AWAY GOALKEEPER').click();
    await controlsPage.getByText('AWAY PLAYER ONE').click();
    await controlsPage.getByText('AWAY PLAYER TWO').click();

    // Mark away goalkeeper as active
    await controlsPage.getByRole('button', { name: 'Activar' }).first().click();

    // Verify all away attended
    await expect(controlsPage.getByText('3/3 presentes').nth(1)).toBeVisible({ timeout: 3000 });

    // Switch back to Penalidades tab
    await controlsPage.getByRole('tab', { name: 'Penalidades' }).click();

    // ─── PHASE 2: ADVANCE TO PERIOD 1 ───

    // Click "COMENZAR PARTIDO" to transition to warm-up (autoStartWarmUp=true, clock starts automatically)
    const comenzarBtn = controlsPage.getByRole('button', { name: /COMENZAR PARTIDO/i });
    await expect(comenzarBtn).toBeVisible({ timeout: 5000 });
    await comenzarBtn.click();

    // Wait for warm-up to finish and auto-transition to period 1
    // autoStartWarmUp=true means clock starts automatically, then flashing zero → period 1
    await expect(controlsPage.getByRole('button', { name: 'Iniciar Reloj' })).toBeVisible({ timeout: 10000 });

    // ─── PHASE 3: PERIOD 1 — GOALS AND PENALTIES ───

    // Score a home goal: scorer #10 with assist from #20
    await addGoal(controlsPage, 'home', '10', { assist1: '20' });

    // Verify score is 1-0
    await expect(
      controlsPage.locator('p').filter({ hasText: '(Local)' }).locator('..').locator('button').filter({ hasText: /^1$/ }).first()
    ).toBeVisible({ timeout: 5000 });

    // Score another home goal: scorer #20, assist #10
    await addGoal(controlsPage, 'home', '20', { assist1: '10' });

    // Verify score is 2-0
    await expect(
      controlsPage.locator('p').filter({ hasText: '(Local)' }).locator('..').locator('button').filter({ hasText: /^2$/ }).first()
    ).toBeVisible({ timeout: 5000 });

    // Scoreboard was loading in parallel — wait for it now
    await scoreboardReady;

    // Verify scoreboard shows the teams
    await expect(scoreboardPage.getByText('Test Home').first()).toBeVisible({ timeout: 5000 });

    // Add a penalty for away player #21 (Menor - 3 seconds)
    await addPenalty(controlsPage, 'away', '21');

    // Verify penalty shows on scoreboard
    await expect(scoreboardPage.getByText('#21').first()).toBeVisible({ timeout: 5000 });

    // Start the clock for period 1
    await startClock(controlsPage);

    // Wait for period 1 to end and auto-transition to Break (autoStartBreaks=true → break clock starts auto)
    await expect(controlsPage.getByText(/BREAK|Descanso/i).first()).toBeVisible({ timeout: 10000 });

    // ─── PHASE 4: BREAK — SWAP PLAYER NUMBERS ───

    // Switch to Jugadores tab for number swap
    await controlsPage.getByRole('tab', { name: 'Jugadores' }).click();

    // Wait for the player inputs to be visible
    const inputPlayerOne = controlsPage.locator('span').filter({ hasText: 'HOME PLAYER ONE' }).locator('..').locator('input[placeholder="#"]');
    await expect(inputPlayerOne).toBeVisible({ timeout: 3000 });

    // Step 1: Change HOME PLAYER ONE's number (#10) to #20
    await inputPlayerOne.click({ force: true });
    await inputPlayerOne.fill('20');
    await inputPlayerOne.press('Enter');

    // Step 2: Change HOME PLAYER TWO's number (#20) to #10
    const inputPlayerTwo = controlsPage.locator('span').filter({ hasText: 'HOME PLAYER TWO' }).locator('..').locator('input[placeholder="#"]');
    await inputPlayerTwo.click({ force: true });
    await inputPlayerTwo.fill('10');
    await inputPlayerTwo.press('Enter');

    // Verify: Switch to Goles tab and check the goal display uses updated names
    await controlsPage.getByRole('tab', { name: 'Goles' }).click();

    // Scorer #10 now maps to HOME PLAYER TWO (after swap)
    await expect(controlsPage.getByText('HOME PLAYER TWO').first()).toBeVisible({ timeout: 3000 });

    // Assist #20 now maps to HOME PLAYER ONE (after swap)
    await expect(controlsPage.getByText('HOME PLAYER ONE').first()).toBeVisible({ timeout: 3000 });

    // ─── PHASE 5: ADVANCE TO PERIOD 2 ───

    // Switch back to Penalidades tab
    await controlsPage.getByRole('tab', { name: 'Penalidades' }).click();

    // Wait for break to end and auto-transition to period 2
    // Break auto-started (autoStartBreaks=true), so just wait for "Iniciar Reloj" for period 2
    await expect(controlsPage.getByRole('button', { name: 'Iniciar Reloj' })).toBeVisible({ timeout: 10000 });

    // ─── PHASE 6: PERIOD 2 — SCORE AWAY GOAL ───

    // Score an away goal: scorer #11, assist #21
    await addGoal(controlsPage, 'away', '11', { assist1: '21' });

    // Verify score is 2-1
    await expect(
      controlsPage.locator('p').filter({ hasText: '(Visitante)' }).locator('..').locator('button').filter({ hasText: /^1$/ }).first()
    ).toBeVisible({ timeout: 5000 });

    // Start clock for period 2
    await startClock(controlsPage);

    // Wait for period 2 to end — game auto-finalizes (2-1, not a tie)
    await expect(controlsPage.getByText(/FINALIZADO/i)).toBeVisible({ timeout: 10000 });

    // ─── PHASE 7: VERIFY SUMMARY GENERATION ───

    // Call the summary generation API directly and validate the response
    const summaryResponse = await request.post('/api/generate-summary', {
      data: { matchId: 'test-match-1' }
    });

    expect(summaryResponse.ok()).toBeTruthy();
    const summaryData = await summaryResponse.json();
    expect(summaryData.success).toBe(true);

    const summary = summaryData.summary;

    // Verify attendance in summary
    expect(summary.attendance.home).toHaveLength(3);
    expect(summary.attendance.away).toHaveLength(3);

    // All players should be present
    summary.attendance.home.forEach((p: any) => expect(p.isPresent).toBe(true));
    summary.attendance.away.forEach((p: any) => expect(p.isPresent).toBe(true));

    // Verify goals in summary — should reference playerId, not playerNumber
    expect(summary.statsByPeriod).toBeDefined();
    expect(summary.statsByPeriod.length).toBeGreaterThanOrEqual(2);

    // Period 1 should have 2 home goals
    const period1 = summary.statsByPeriod.find((p: any) => p.period === '1ST');
    expect(period1).toBeDefined();
    expect(period1.stats.goals.home).toHaveLength(2);
    expect(period1.stats.goals.away).toHaveLength(0);

    // First home goal: scorer #10, assist #20
    // After number swap (#10↔#20): #10 → player-h2, #20 → player-h1
    // Summary uses final roster mapping (operator verified)
    const homeGoal1 = period1.stats.goals.home[0];
    expect(homeGoal1.scorer?.playerId).toBe('player-h2');
    expect(homeGoal1.assist?.playerId).toBe('player-h1');

    // Second home goal: scorer #20, assist #10
    const homeGoal2 = period1.stats.goals.home[1];
    expect(homeGoal2.scorer?.playerId).toBe('player-h1');
    expect(homeGoal2.assist?.playerId).toBe('player-h2');

    // Period 1 should have 1 away penalty for #21 (player-a2)
    expect(period1.stats.penalties.away).toHaveLength(1);
    expect(period1.stats.penalties.away[0].playerId).toBe('player-a2');

    // Period 2 should have 1 away goal
    const period2 = summary.statsByPeriod.find((p: any) => p.period === '2ND');
    expect(period2).toBeDefined();
    expect(period2.stats.goals.away).toHaveLength(1);
    expect(period2.stats.goals.home).toHaveLength(0);

    // Away goal: scorer #11 (player-a1), assist #21 (player-a2)
    const awayGoal = period2.stats.goals.away[0];
    expect(awayGoal.scorer?.playerId).toBe('player-a1');
    expect(awayGoal.assist?.playerId).toBe('player-a2');

    // Verify played periods
    expect(summary.playedPeriods).toContain('1ST');
    expect(summary.playedPeriods).toContain('2ND');
  });
});

// Player Number Changes tests moved to component tests:
// src/components/controls/__tests__/players-control-card.test.tsx
