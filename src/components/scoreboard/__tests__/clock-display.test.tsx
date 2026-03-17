import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClockDisplay } from '../clock-display';
import { useGameState } from '@/contexts/game-state-context';

// Mock the useGameState hook
vi.mock('@/contexts/game-state-context', () => ({
  useGameState: vi.fn(),
  formatTime: vi.fn((time) => {
    // Simple mock of formatTime
    const mins = Math.floor(time / 6000);
    const secs = Math.floor((time % 6000) / 100);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }),
  getActualPeriodText: vi.fn(() => 'PERIOD 1'),
  getPeriodText: vi.fn(() => 'Period 1'),
}));

describe('ClockDisplay Component', () => {
  const mockState = {
    config: {
      scoreboardLayout: { clockSize: 10, periodSize: 4 },
      numberOfRegularPeriods: 3
    },
    live: {
      clock: {
        currentTime: 60000, // 10 mins
        currentPeriod: 1,
        isClockRunning: true,
        periodDisplayOverride: null,
        isFlashingZero: false
      },
      score: { home: 0, away: 0 },
      homeTeamName: 'Home Team',
      awayTeamName: 'Away Team',
      shootout: { isActive: false }
    }
  };

  it('should render the current time and period', () => {
    (useGameState as any).mockReturnValue({ state: mockState });
    
    render(<ClockDisplay />);
    
    expect(screen.getByText('10:00')).toBeInTheDocument();
    expect(screen.getByText('PERIOD 1')).toBeInTheDocument();
  });

  it('should show "Paused" when the clock is not running', () => {
    const pausedState = {
      ...mockState,
      live: {
        ...mockState.live,
        clock: { ...mockState.live.clock, isClockRunning: false }
      }
    };
    (useGameState as any).mockReturnValue({ state: pausedState });
    
    render(<ClockDisplay />);
    
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('should show the winner name when game is over', () => {
    const gameOverState = {
      ...mockState,
      live: {
        ...mockState.live,
        clock: { ...mockState.live.clock, periodDisplayOverride: 'End of Game' },
        score: { home: 2, away: 1 }
      }
    };
    (useGameState as any).mockReturnValue({ state: gameOverState });
    
    const { container } = render(<ClockDisplay />);
    
    // In winner state, it shows a Trophy icon and the team name
    expect(screen.getByText('Home Team')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument(); // Trophy icon
  });
});
