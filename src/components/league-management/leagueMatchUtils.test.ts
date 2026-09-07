import { describe, expect, it } from 'vitest';
import {
  getFirstUnplayedMatch,
  getNextMatchNumber,
  getScheduledTeamIdsForDate,
  isUnplayedMatch,
} from './leagueMatchUtils';

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

describe('getFirstUnplayedMatch', () => {
  it('returns the lowest-numbered unplayed match even when input is unordered', () => {
    const matches = [
      { match_number: 45, score_a: 0, score_b: 0, status: 'scheduled' },
      { match_number: 38, score_a: 0, score_b: 0, status: 'scheduled' },
      { match_number: 37, score_a: 0, score_b: 0, status: 'scheduled' },
      { match_number: 39, score_a: 1, score_b: 0, status: 'finished' },
    ];

    expect(getFirstUnplayedMatch(matches)?.match_number).toBe(37);
    expect(matches.map((match) => match.match_number)).toEqual([45, 38, 37, 39]);
  });

  it('returns null when every match has been played', () => {
    expect(getFirstUnplayedMatch([
      { match_number: 1, score_a: 1, score_b: 0, status: 'finished' },
      { match_number: 2, score_a: 0, score_b: 2, status: 'scheduled' },
    ])).toBeNull();
  });
});

describe('getScheduledTeamIdsForDate', () => {
  const matches = [
    {
      id: 'match-1',
      team_a_id: 'team-a',
      team_b_id: 'team-b',
      match_date: '2026-09-07T00:00:00.000Z',
      status: 'scheduled',
    },
    {
      id: 'match-2',
      team_a_id: 'team-c',
      team_b_id: 'team-d',
      match_date: '2026-09-07',
      status: 'finished',
    },
    {
      id: 'match-3',
      team_a_id: 'team-e',
      team_b_id: 'team-f',
      match_date: '2026-09-08',
      status: 'scheduled',
    },
    {
      id: 'match-4',
      team_a_id: 'team-g',
      team_b_id: 'team-h',
      match_date: '2026-09-07',
      status: 'postponed',
    },
  ] as const;

  it('returns both teams from scheduled matches on the selected date', () => {
    expect(getScheduledTeamIdsForDate(matches, '2026-09-07')).toEqual(new Set(['team-a', 'team-b']));
  });

  it('ignores non-scheduled matches and matches on other dates', () => {
    expect(getScheduledTeamIdsForDate(matches, '2026-09-08')).toEqual(new Set(['team-e', 'team-f']));
  });

  it('excludes the match currently being edited', () => {
    expect(getScheduledTeamIdsForDate(matches, '2026-09-07', 'match-1')).toEqual(new Set());
  });
});
