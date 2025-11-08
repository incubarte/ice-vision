/**
 * Pure helper functions for game state calculations
 * Extracted from game-state-context.tsx for better organization
 */

import type { PenaltyLog, GameState, ShootoutState, PeriodDisplayOverrideType, CategoryData } from '@/types';
import { CENTISECONDS_PER_SECOND } from './game-constants';

/**
 * Formats time in centiseconds to MM:SS format with optional tenths display
 */
export const formatTime = (
  totalCentiseconds: number,
  options: {
    showTenths?: boolean;
    includeMinutesForTenths?: boolean;
    rounding?: 'up' | 'down';
  } = {}
): string => {
  if (isNaN(totalCentiseconds) || totalCentiseconds < 0) totalCentiseconds = 0;

  const isUnderMinute = totalCentiseconds < 6000;

  if (isUnderMinute && options.showTenths) {
    const totalSeconds = Math.floor(totalCentiseconds / 100);
    const tenths = Math.floor((totalCentiseconds % 100) / 10);
    if (options.includeMinutesForTenths) {
      return `00:${totalSeconds.toString().padStart(2, '0')}.${tenths.toString()}`;
    }
    return `${totalSeconds.toString().padStart(2, '0')}.${tenths.toString()}`;
  }

  let totalSecondsOnly;
  if (options.rounding === 'down') {
     totalSecondsOnly = Math.floor(totalCentiseconds / 100);
  } else {
    totalSecondsOnly = Math.ceil(totalCentiseconds / 100);
  }

  const minutes = Math.floor(totalSecondsOnly / 60);
  const seconds = totalSecondsOnly % 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Gets the display text for a period (1ST, 2ND, 3RD, OT, etc.)
 */
export const getPeriodText = (period: number, numRegPeriods: number): string => {
  if (period === 0) return "Warm-up";
  if (period < 0) return "---";
  if (period <= numRegPeriods) {
    if (period === 1) return "1ST";
    if (period === 2) return "2ND";
    if (period === 3) return "3RD";
    return `${period}TH`;
  }
  const overtimeNumber = period - numRegPeriods;
  return `OT${overtimeNumber > 1 ? overtimeNumber : ''}`.trim();
};

/**
 * Gets the actual period text considering overrides and shootout state
 */
export const getActualPeriodText = (
  period: number,
  override: PeriodDisplayOverrideType,
  numberOfRegularPeriods: number,
  shootoutState?: ShootoutState
): string => {
  if (override === "Time Out") return "TIME OUT";
  if (override === "End of Game") return "FINALIZADO";
  if (override === "AwaitingDecision") return "PRE-FINAL";
  if (override === "Shootout" || (shootoutState && shootoutState.isActive)) {
    return "SHOOTOUT"
  }
  if (override) return override;
  return getPeriodText(period, numberOfRegularPeriods);
};

/**
 * Gets period context from absolute time
 */
export const getPeriodContextFromAbsoluteTime = (
  absoluteTimeCs: number,
  state: GameState
): { periodText: string; timeInPeriodCs: number; periodNumber: number } => {
  if (absoluteTimeCs < 0) absoluteTimeCs = 0;
  const { numberOfRegularPeriods, defaultPeriodDuration, defaultOTPeriodDuration, numberOfOvertimePeriods } = state.config;
  let timeTracker = 0;

  for (let i = 1; i <= numberOfRegularPeriods; i++) {
    if (absoluteTimeCs <= timeTracker + defaultPeriodDuration) {
      return {
        periodText: getPeriodText(i, numberOfRegularPeriods),
        timeInPeriodCs: Math.max(0, defaultPeriodDuration - (absoluteTimeCs - timeTracker)),
        periodNumber: i
      };
    }
    timeTracker += defaultPeriodDuration;
  }

  for (let i = 1; i <= numberOfOvertimePeriods; i++) {
    const periodNumber = numberOfRegularPeriods + i;
    if (absoluteTimeCs <= timeTracker + defaultOTPeriodDuration) {
      return {
        periodText: getPeriodText(periodNumber, numberOfRegularPeriods),
        timeInPeriodCs: Math.max(0, defaultOTPeriodDuration - (absoluteTimeCs - timeTracker)),
        periodNumber: periodNumber
      };
    }
    timeTracker += defaultOTPeriodDuration;
  }

  const lastPeriodNumber = numberOfRegularPeriods + numberOfOvertimePeriods;
  return {
    periodText: getPeriodText(lastPeriodNumber, numberOfRegularPeriods),
    timeInPeriodCs: 0,
    periodNumber: lastPeriodNumber
  };
};

/**
 * Converts centiseconds to display seconds
 */
export const centisecondsToDisplaySeconds = (centiseconds: number): string => {
  if (isNaN(centiseconds) || centiseconds < 0) return "0";
  return Math.floor(centiseconds / CENTISECONDS_PER_SECOND).toString();
};

/**
 * Converts centiseconds to display minutes
 */
export const centisecondsToDisplayMinutes = (centiseconds: number): string => {
  if (isNaN(centiseconds) || centiseconds < 0) return "0";
  return Math.floor(centiseconds / (60 * CENTISECONDS_PER_SECOND)).toString();
};

/**
 * Gets the text description for a penalty end reason
 */
export const getEndReasonText = (reason?: PenaltyLog['endReason']): string => {
  switch (reason) {
    case 'completed': return 'Cumplida';
    case 'deleted': return 'Eliminada';
    case 'goal_on_pp': return 'Gol en Contra';
    default: return 'Activa';
  }
};

/**
 * Gets category name by ID
 */
export const getCategoryNameById = (
  categoryId: string,
  availableCategories: CategoryData[] | undefined
): string | undefined => {
  if (!Array.isArray(availableCategories)) return undefined;
  const category = availableCategories.find(cat => cat && typeof cat === 'object' && cat.id === categoryId);
  return category ? category.name : undefined;
};
