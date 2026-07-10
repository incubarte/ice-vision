import type { DisciplinarySanction, MatchData } from '@/types';

function getTeamMatchesAfterStart(
  teamId: string,
  allMatches: MatchData[],
  startDate: string
): MatchData[] {
  return allMatches
    .filter(m =>
      (m.homeTeamId === teamId || m.awayTeamId === teamId) &&
      m.date.split('T')[0] >= startDate
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Returns the reinstatement date (YYYY-MM-DD) or null if it can't be determined yet. */
export function calculateReinstatementDate(
  sanction: DisciplinarySanction,
  allMatches: MatchData[]
): string | null {
  if (sanction.sanctionType === 'pending_review' || !sanction.sanctionValue) return null;

  if (sanction.sanctionType === 'calendar_days') {
    const start = new Date(sanction.startDate + 'T12:00:00');
    start.setDate(start.getDate() + sanction.sanctionValue);
    return start.toISOString().split('T')[0];
  }

  if (sanction.sanctionType === 'matches') {
    const teamMatches = getTeamMatchesAfterStart(sanction.teamId, allMatches, sanction.startDate);
    if (teamMatches.length < sanction.sanctionValue) return null;
    const lastMissedMatch = teamMatches[sanction.sanctionValue - 1];
    const lastDate = new Date(lastMissedMatch.date.split('T')[0] + 'T12:00:00');
    lastDate.setDate(lastDate.getDate() + 1);
    return lastDate.toISOString().split('T')[0];
  }

  return null;
}

/** Returns true if the sanction is still active on the given reference date (YYYY-MM-DD). */
export function isSanctionActive(
  sanction: DisciplinarySanction,
  allMatches: MatchData[],
  referenceDate: string
): boolean {
  if (sanction.sanctionType === 'pending_review') return true;
  if (!sanction.sanctionValue) return true;

  const reinstatement = calculateReinstatementDate(sanction, allMatches);
  if (!reinstatement) return true; // can't calculate → assume still active

  return referenceDate < reinstatement;
}

/**
 * Returns the 1-based position of the current match within the sanction sequence.
 * e.g. if the player is serving a 3-match suspension and this is their 2nd missed game, returns 2.
 */
export function getSanctionMatchNumber(
  sanction: DisciplinarySanction,
  allMatches: MatchData[],
  currentMatchDate: string
): number {
  const teamMatches = getTeamMatchesAfterStart(sanction.teamId, allMatches, sanction.startDate);
  const normalizedDate = currentMatchDate.split('T')[0];
  const count = teamMatches.filter(m => m.date.split('T')[0] <= normalizedDate).length;
  return Math.max(1, count);
}

/** Formats a YYYY-MM-DD date for display as DD/MM/YYYY. */
export function formatSanctionDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}
