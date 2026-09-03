/**
 * The overlay views are result-only views. Keep this check deliberately
 * strict so scores from scheduled, in-progress, postponed, missing, or
 * differently-cased statuses can never leak into the public overlays.
 */
export interface MatchStatusRecord {
  status?: string | null;
}

export const isFinishedMatch = (match: MatchStatusRecord): boolean => {
  return match.status === 'finished';
};

export const filterFinishedMatches = <T extends MatchStatusRecord>(
  matches: readonly T[],
): T[] => matches.filter(isFinishedMatch);
