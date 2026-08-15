import { describe, expect, it } from 'vitest';
import {
  resolveGoalAnimationSide,
  resolveGoalAnimationTemplate,
  resolveScoreAnimationMode,
} from './goalAnimationTemplates';

describe('goal animation template parameters', () => {
  it('keeps the old URL on Classic', () => {
    expect(resolveGoalAnimationTemplate(null)).toBe('classic');
    expect(resolveGoalAnimationTemplate('')).toBe('classic');
    expect(resolveGoalAnimationTemplate('unknown')).toBe('classic');
  });

  it('resolves the score-only template', () => {
    expect(resolveGoalAnimationTemplate('score-only')).toBe('score-only');
    expect(resolveGoalAnimationTemplate('score')).toBe('score-only');
    expect(resolveGoalAnimationTemplate('SCORE_ONLY')).toBe('score-only');
  });

  it('resolves the persistent team names template', () => {
    expect(resolveGoalAnimationTemplate('team-names')).toBe('team-names');
    expect(resolveGoalAnimationTemplate('team-name')).toBe('team-names');
    expect(resolveGoalAnimationTemplate('names')).toBe('team-names');
  });

  it('resolves the requested score side', () => {
    expect(resolveGoalAnimationSide('A')).toBe('A');
    expect(resolveGoalAnimationSide('b')).toBe('B');
    expect(resolveGoalAnimationSide('both')).toBe('both');
    expect(resolveGoalAnimationSide(null)).toBe('both');
    expect(resolveGoalAnimationSide('invalid')).toBe('both');
  });

  it('uses real score number mode by default and supports the effect fallback', () => {
    expect(resolveScoreAnimationMode(null)).toBe('number');
    expect(resolveScoreAnimationMode('number')).toBe('number');
    expect(resolveScoreAnimationMode('effect')).toBe('effect');
  });
});
