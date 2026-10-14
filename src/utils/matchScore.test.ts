import { describe, expect, it } from 'vitest';
import { MAX_MATCH_SCORE, isValidMatchScore, parseMatchScore } from './matchScore';

describe('match score validation', () => {
  it.each([
    [0, 0],
    [12, 12],
    [' 42 ', 42],
    [String(MAX_MATCH_SCORE), MAX_MATCH_SCORE],
  ])('accepts a valid persisted score %p', (input, expected) => {
    expect(parseMatchScore(input)).toBe(expected);
    expect(isValidMatchScore(input)).toBe(true);
  });

  it.each([
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    MAX_MATCH_SCORE + 1,
    '',
    ' ',
    '-1',
    '+1',
    '1.5',
    '1e2',
    '12goals',
    null,
    undefined,
  ])('rejects an invalid persisted score %p', (input) => {
    expect(parseMatchScore(input)).toBeNull();
    expect(isValidMatchScore(input)).toBe(false);
  });
});
