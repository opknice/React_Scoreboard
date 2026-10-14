import { describe, expect, it } from 'vitest';
import {
  filterDisplayableFinishedMatches,
  filterFinishedMatches,
  isFinishedMatch,
} from './finishedMatch';
import { calculateFinishedStandings } from './standingsCalculator';

describe('finished match filtering', () => {
  it('accepts only the exact finished status', () => {
    expect(isFinishedMatch({ status: 'finished' })).toBe(true);
    expect(isFinishedMatch({ status: 'Finished' })).toBe(false);
    expect(isFinishedMatch({ status: 'in_progress' })).toBe(false);
    expect(isFinishedMatch({ status: undefined })).toBe(false);
  });

  it('filters non-finished matches without mutating the source array', () => {
    const matches = [{ status: 'scheduled' }, { status: 'finished' }, { status: 'postponed' }];
    expect(filterFinishedMatches(matches)).toEqual([{ status: 'finished' }]);
    expect(matches).toHaveLength(3);
  });

  it('keeps public results only when both scores are valid integers', () => {
    const valid = { status: 'finished', scoreA: 2, scoreB: '1' };
    const matches = [
      valid,
      { status: 'finished', scoreA: -1, scoreB: 0 },
      { status: 'finished', scoreA: 1.5, scoreB: 0 },
      { status: 'scheduled', scoreA: 2, scoreB: 1 },
    ];

    expect(filterDisplayableFinishedMatches(matches)).toEqual([valid]);
  });
});

describe('calculateFinishedStandings', () => {
  it('keeps registered teams with zero statistics', () => {
    const rows = calculateFinishedStandings(
      [{ id: '1', teamA: 'A', teamB: 'B', scoreA: 2, scoreB: 0, status: 'scheduled' }],
      [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    );

    expect(rows).toHaveLength(3);
    expect(rows.find((row) => row.team === 'C')).toMatchObject({ P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 });
  });

  it('calculates only finished matches', () => {
    const rows = calculateFinishedStandings([
      { id: '1', teamA: 'A', teamB: 'B', scoreA: 2, scoreB: 0, status: 'finished' },
      { id: '2', teamA: 'A', teamB: 'C', scoreA: 9, scoreB: 0, status: 'in_progress' },
    ]);

    expect(rows.find((row) => row.team === 'A')).toMatchObject({ P: 1, W: 1, GF: 2, GA: 0, Pts: 3 });
    expect(rows.find((row) => row.team === 'C')).toBeUndefined();
  });

  it('keeps duplicate team names separate by team ID', () => {
    const rows = calculateFinishedStandings(
      [
        { id: '1', teamIdA: 'city-1', teamIdB: 'rivals', teamA: 'City', teamB: 'Rivals', scoreA: 1, scoreB: 0, status: 'finished' },
        { id: '2', teamIdA: 'city-2', teamIdB: 'rivals', teamA: 'City', teamB: 'Rivals', scoreA: 0, scoreB: 2, status: 'finished' },
      ],
      [
        { id: 'city-1', name: 'City' },
        { id: 'city-2', name: 'City' },
        { id: 'rivals', name: 'Rivals' },
      ],
    );

    expect(rows).toHaveLength(3);
    expect(rows.find((row) => row.teamId === 'city-1')).toMatchObject({ P: 1, W: 1, Pts: 3 });
    expect(rows.find((row) => row.teamId === 'city-2')).toMatchObject({ P: 1, L: 1, Pts: 0 });
    expect(rows.find((row) => row.teamId === 'rivals')).toMatchObject({ P: 2, W: 1, L: 1, Pts: 3 });
  });

  it('attributes a historic team name to the current registered row by ID', () => {
    const rows = calculateFinishedStandings(
      [{ id: '1', teamIdA: 'a', teamIdB: 'b', teamA: 'Old Alpha', teamB: 'Beta', scoreA: 3, scoreB: 2, status: 'finished' }],
      [{ id: 'a', name: 'New Alpha' }, { id: 'b', name: 'Beta' }],
    );

    expect(rows.find((row) => row.teamId === 'a')).toMatchObject({ team: 'New Alpha', P: 1, W: 1, Pts: 3 });
    expect(rows.some((row) => row.team === 'Old Alpha')).toBe(false);
  });

  it('ignores an identity-ambiguous legacy match instead of corrupting duplicate-name rows', () => {
    const rows = calculateFinishedStandings(
      [{ id: '1', teamA: 'City', teamB: 'Rivals', scoreA: 4, scoreB: 0, status: 'finished' }],
      [{ id: 'city-1', name: 'City' }, { id: 'city-2', name: 'City' }, { id: 'rivals', name: 'Rivals' }],
    );

    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.P === 0 && row.Pts === 0)).toBe(true);
  });

  it('ignores malformed finished scores rather than changing the table', () => {
    const rows = calculateFinishedStandings(
      [
        { id: '1', teamIdA: 'a', teamIdB: 'b', teamA: 'A', teamB: 'B', scoreA: -1, scoreB: 0, status: 'finished' },
        { id: '2', teamIdA: 'a', teamIdB: 'b', teamA: 'A', teamB: 'B', scoreA: 1.5, scoreB: 0, status: 'finished' },
      ],
      [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    );

    expect(rows.every((row) => row.P === 0 && row.GF === 0 && row.Pts === 0)).toBe(true);
  });
});
