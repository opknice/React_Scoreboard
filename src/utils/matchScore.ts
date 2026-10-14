/** PostgreSQL `integer` upper bound used by the matches.score_* columns. */
export const MAX_MATCH_SCORE = 2_147_483_647;

/**
 * Converts a persisted/display score into a safe database integer.
 *
 * Numeric strings are accepted because older overlay payloads may contain
 * them. Empty, signed, decimal, exponential, unsafe, and out-of-range values
 * are rejected instead of being silently coerced.
 */
export function parseMatchScore(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value <= MAX_MATCH_SCORE
      ? value
      : null;
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed <= MAX_MATCH_SCORE
    ? parsed
    : null;
}

export function isValidMatchScore(value: unknown): boolean {
  return parseMatchScore(value) !== null;
}
