import { isValidMatchScore } from './matchScore';

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

export interface DisplayableFinishedMatch extends MatchStatusRecord {
  scoreA: unknown;
  scoreB: unknown;
}

/** Finished rows are public only when both persisted scores are valid. */
export const isDisplayableFinishedMatch = (
  match: DisplayableFinishedMatch,
): boolean => isFinishedMatch(match)
  && isValidMatchScore(match.scoreA)
  && isValidMatchScore(match.scoreB);

export const filterDisplayableFinishedMatches = <T extends DisplayableFinishedMatch>(
  matches: readonly T[],
): T[] => matches.filter(isDisplayableFinishedMatch);
