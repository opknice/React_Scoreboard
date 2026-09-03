import { describe, expect, it } from 'vitest';
import { getNextMatchNumber, isUnplayedMatch } from './leagueMatchUtils';

describe('isUnplayedMatch', () => {
  it('returns true for a scheduled 0-0 match', () => {
    expect(isUnplayedMatch({ score_a: 0, score_b: 0, status: 'scheduled' })).toBe(true);
  });

  it('returns true for a non-finished 0-0 match', () => {
    expect(isUnplayedMatch({ score_a: 0, score_b: 0, status: 'in_progress' })).toBe(true);
  });

  it('returns false when the match has a recorded score', () => {
    expect(isUnplayedMatch({ score_a: 1, score_b: 0, status: 'scheduled' })).toBe(false);
    expect(isUnplayedMatch({ score_a: 0, score_b: 2, status: 'in_progress' })).toBe(false);
  });

  it('returns false for a finished 0-0 match', () => {
    expect(isUnplayedMatch({ score_a: 0, score_b: 0, status: 'finished' })).toBe(false);
  });
});

describe('getNextMatchNumber', () => {
  it('returns 1 when there are no existing matches', () => {
    expect(getNextMatchNumber([])).toBe(1);
  });

  it('returns the next number after the highest existing match number', () => {
    expect(getNextMatchNumber([{ match_number: 1 }, { match_number: 7 }, { match_number: 3 }])).toBe(8);
  });
});
