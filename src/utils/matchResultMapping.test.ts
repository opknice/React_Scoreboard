import { describe, expect, it } from 'vitest';
import { resolveCanonicalMatchResult, type ScoreboardMatchResult } from './matchResultMapping';

const match = {
  team_a_id: 'alpha-id',
  team_b_id: 'beta-id',
  team_a_name: 'Alpha',
  team_b_name: 'Beta',
};

function scoreboard(overrides: Partial<ScoreboardMatchResult> = {}): ScoreboardMatchResult {
  return {
    teamIdA: 'alpha-id',
    teamIdB: 'beta-id',
    teamNameA: 'Alpha',
    teamNameB: 'Beta',
    scoreA: 3,
    scoreB: 1,
    ...overrides,
  };
}

describe('resolveCanonicalMatchResult', () => {
  it('keeps scores in direct team order', () => {
    expect(resolveCanonicalMatchResult(match, scoreboard())).toEqual({
      ok: true,
      orientation: 'direct',
      score_a: 3,
      score_b: 1,
    });
  });

  it('maps scores back to canonical columns after teams are swapped on screen', () => {
    expect(resolveCanonicalMatchResult(match, scoreboard({
      teamIdA: 'beta-id',
      teamIdB: 'alpha-id',
      teamNameA: 'Beta',
      teamNameB: 'Alpha',
      scoreA: 3,
      scoreB: 1,
    }))).toEqual({
      ok: true,
      orientation: 'swapped',
      score_a: 1,
      score_b: 3,
    });
  });

  it('rejects a different team pair even when names resemble the scheduled teams', () => {
    expect(resolveCanonicalMatchResult(match, scoreboard({
      teamIdA: 'other-alpha-id',
      teamIdB: 'beta-id',
    }))).toEqual({ ok: false, reason: 'team-mismatch' });
  });

  it('does not fall back to names when a canonical match has team IDs', () => {
    expect(resolveCanonicalMatchResult(match, scoreboard({ teamIdA: null }))).toEqual({
      ok: false,
      reason: 'missing-team-identity',
    });
  });

  it('supports direct and swapped legacy matches through normalized names', () => {
    const legacyMatch = { ...match, team_a_id: null, team_b_id: null };

    expect(resolveCanonicalMatchResult(legacyMatch, scoreboard({
      teamIdA: null,
      teamIdB: null,
      teamNameA: ' alpha ',
      teamNameB: 'BETA',
    }))).toMatchObject({ ok: true, orientation: 'direct', score_a: 3, score_b: 1 });

    expect(resolveCanonicalMatchResult(legacyMatch, scoreboard({
      teamIdA: null,
      teamIdB: null,
      teamNameA: ' beta ',
      teamNameB: 'ALPHA',
    }))).toMatchObject({ ok: true, orientation: 'swapped', score_a: 1, score_b: 3 });
  });

  it('keeps an available canonical ID authoritative on a partially legacy match', () => {
    const partialLegacyMatch = { ...match, team_b_id: null };

    expect(resolveCanonicalMatchResult(partialLegacyMatch, scoreboard({
      teamIdA: 'other-alpha-id',
      teamIdB: null,
    }))).toEqual({ ok: false, reason: 'team-mismatch' });

    expect(resolveCanonicalMatchResult(partialLegacyMatch, scoreboard({
      teamIdB: null,
    }))).toMatchObject({ ok: true, orientation: 'direct', score_a: 3, score_b: 1 });
  });

  it('rejects unrelated names for legacy matches', () => {
    expect(resolveCanonicalMatchResult(
      { ...match, team_a_id: null, team_b_id: null },
      scoreboard({ teamIdA: null, teamIdB: null, teamNameA: 'Gamma' }),
    )).toEqual({ ok: false, reason: 'team-mismatch' });
  });

  it('rejects a legacy pair whose identical names make score orientation ambiguous', () => {
    expect(resolveCanonicalMatchResult(
      { team_a_id: null, team_b_id: null, team_a_name: 'City', team_b_name: 'City' },
      scoreboard({ teamIdA: null, teamIdB: null, teamNameA: 'City', teamNameB: 'City' }),
    )).toEqual({ ok: false, reason: 'team-mismatch' });
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])(
    'rejects invalid score %p before saving',
    (invalidScore) => {
      expect(resolveCanonicalMatchResult(match, scoreboard({ scoreA: invalidScore }))).toEqual({
        ok: false,
        reason: 'invalid-score',
      });
    },
  );
});
