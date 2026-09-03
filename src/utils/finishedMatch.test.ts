import { describe, expect, it } from 'vitest';
import { filterFinishedMatches, isFinishedMatch } from './finishedMatch';
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
});
