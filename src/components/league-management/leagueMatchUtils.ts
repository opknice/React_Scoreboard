import type { Match } from '../../config/supabaseClient';

/**
 * Determines whether a match is still waiting to be played.
 * A match with a recorded score or a finished status is excluded.
 */
export const isUnplayedMatch = (
  match: Pick<Match, 'score_a' | 'score_b' | 'status'>
): boolean => {
  return match.score_a === 0 && match.score_b === 0 && match.status !== 'finished';
};

/**
 * Returns the lowest-numbered match that has not been played yet.
 * A copy is sorted so the caller's array is never mutated.
 */
export const getFirstUnplayedMatch = <
  T extends Pick<Match, 'match_number' | 'score_a' | 'score_b' | 'status'>,
>(matches: T[]): T | null => {
  return [...matches]
    .filter(isUnplayedMatch)
    .sort((a, b) => a.match_number - b.match_number)[0] ?? null;
};

/**
 * Generates the next internal match number without exposing it in the UI.
 */
export const getNextMatchNumber = (
  matches: Pick<Match, 'match_number'>[]
): number => {
  if (matches.length === 0) return 1;
  return Math.max(...matches.map((match) => match.match_number)) + 1;
};
