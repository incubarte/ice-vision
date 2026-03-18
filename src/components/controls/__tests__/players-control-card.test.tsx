import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { gameReducer, getInitialState } from '@/lib/game-state-reducer';
import { PlayersControlCard } from '../players-control-card';
import type { GameState, GameAction } from '@/types';
import React from 'react';

// Track dispatched actions and apply them to state via the real reducer
let testState: GameState;
let mockDispatch: React.Dispatch<GameAction>;

vi.mock('@/contexts/game-state-context', () => ({
  useGameState: () => ({ state: testState, dispatch: mockDispatch, isLoading: false }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function setupState(): GameState {
  const state = getInitialState();
  state.live.homeTeamName = 'Test Home';
  state.live.awayTeamName = 'Test Away';
  state.live.matchContext = {
    tournamentId: 't1',
    homeTeamId: 'home-team',
    awayTeamId: 'away-team',
    categoryId: 'cat1',
    homeRoster: [
      { id: 'p1', number: '10', name: 'HOME PLAYER ONE', type: 'player' },
      { id: 'p2', number: '20', name: 'HOME PLAYER TWO', type: 'player' },
      { id: 'gk', number: '1', name: 'HOME GOALKEEPER', type: 'goalkeeper' },
    ],
    awayRoster: [
      { id: 'ap1', number: '11', name: 'AWAY PLAYER ONE', type: 'player' },
    ],
  } as any;
  state.live.attendance = { home: [], away: [] };
  return state;
}

function rerender() {
  cleanup();
  render(<PlayersControlCard team="home" teamName="Test Home" />);
}

function playerRow(name: string) {
  const nameEl = screen.getByText(name);
  return nameEl.closest('[class*="rounded-lg"]')! as HTMLElement;
}

function numberInput(name: string) {
  const row = playerRow(name);
  return within(row).getByPlaceholderText('#') as HTMLInputElement;
}

describe('PlayersControlCard — Player Number Changes', () => {
  beforeEach(() => {
    testState = setupState();
    mockDispatch = (action: GameAction) => {
      testState = gameReducer(testState, action);
    };
  });

  it('changing number to an unassigned number should not create a new player row', async () => {
    const user = userEvent.setup();

    // Activate HOME PLAYER ONE by clicking its row
    rerender();
    await user.click(playerRow('HOME PLAYER ONE'));
    rerender();

    expect(screen.getByText('1/3 presentes')).toBeInTheDocument();

    // Change HOME PLAYER ONE's number from 10 to 99
    const input = numberInput('HOME PLAYER ONE');
    await user.clear(input);
    await user.type(input, '99');
    await user.tab(); // trigger blur → save
    rerender();

    // Should still have 3 player rows, not 4
    const allInputs = screen.getAllByPlaceholderText('#');
    expect(allInputs).toHaveLength(3);

    // No input should show value "10" anymore
    expect(allInputs.every(i => (i as HTMLInputElement).value !== '10')).toBe(true);

    // HOME PLAYER ONE should be active with number 99
    expect(numberInput('HOME PLAYER ONE').value).toBe('99');
    expect(numberInput('HOME PLAYER ONE')).toBeEnabled();
  });

  it('changing number to a colliding number should not duplicate name nor deactivate player', async () => {
    const user = userEvent.setup();

    // Activate only HOME PLAYER ONE
    rerender();
    await user.click(playerRow('HOME PLAYER ONE'));
    rerender();

    expect(screen.getByText('1/3 presentes')).toBeInTheDocument();

    // Change HOME PLAYER ONE's number to 20 (HOME PLAYER TWO's number)
    const input = numberInput('HOME PLAYER ONE');
    await user.clear(input);
    await user.type(input, '20');
    await user.tab();
    rerender();

    // Should still have 3 rows
    expect(screen.getAllByPlaceholderText('#')).toHaveLength(3);

    // HOME PLAYER ONE should be active with number 20
    expect(numberInput('HOME PLAYER ONE')).toBeEnabled();
    expect(numberInput('HOME PLAYER ONE').value).toBe('20');

    // HOME PLAYER TWO should be inactive with number 20
    expect(numberInput('HOME PLAYER TWO')).toBeDisabled();
    expect(numberInput('HOME PLAYER TWO').value).toBe('20');

    // Now activate HOME PLAYER TWO
    await user.click(playerRow('HOME PLAYER TWO'));
    rerender();

    // Row count still 3
    expect(screen.getAllByPlaceholderText('#')).toHaveLength(3);
    expect(screen.getByText('2/3 presentes')).toBeInTheDocument();

    // Both active with number 20
    expect(numberInput('HOME PLAYER ONE')).toBeEnabled();
    expect(numberInput('HOME PLAYER ONE').value).toBe('20');
    expect(numberInput('HOME PLAYER TWO')).toBeEnabled();
    expect(numberInput('HOME PLAYER TWO').value).toBe('20');
  });
});
