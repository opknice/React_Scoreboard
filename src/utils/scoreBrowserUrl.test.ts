import { describe, expect, it } from 'vitest';
import { DEFAULT_SCORE_BROWSER_SETTINGS } from '../types/scoreBrowserSettings';
import { buildScoreBrowserUrl, getScorePresentation } from './scoreBrowserUrl';

describe('scoreBrowserUrl', () => {
  it('keeps legacy score URLs in auto mode', () => {
    expect(getScorePresentation('?template=score-only&mode=number&side=A', 'A')).toEqual({
      fontFamily: 'Inter',
      fontWeight: 700,
      fontMode: 'auto',
      fontSize: 72,
    });
  });

  it('reads manual settings for a side URL', () => {
    expect(getScorePresentation('?font=Kanit&fontMode=manual&fontSize=84&fontWeight=300', 'B')).toEqual({
      fontFamily: 'Kanit',
      fontWeight: 300,
      fontMode: 'manual',
      fontSize: 84,
    });
  });

  it('reads separate settings from the Both URL', () => {
    const search = '?font=Roboto&fontModeA=manual&fontSizeA=60&fontModeB=auto&fontSizeB=100';
    expect(getScorePresentation(search, 'A').fontSize).toBe(60);
    expect(getScorePresentation(search, 'B').fontMode).toBe('auto');
  });

  it('builds A/B and Both URLs with score settings', () => {
    const settings = {
      ...DEFAULT_SCORE_BROWSER_SETTINGS,
      fontFamily: 'Montserrat' as const,
      fontModeA: 'manual' as const,
      fontSizeA: 64,
    };
    const aUrl = buildScoreBrowserUrl('http://localhost:5173/React_Scoreboard', 'A', settings);
    const bothUrl = buildScoreBrowserUrl('http://localhost:5173/React_Scoreboard', 'both', settings);
    expect(aUrl).toContain('template=score-only');
    expect(aUrl).toContain('side=A');
    expect(aUrl).toContain('fontSize=64');
    expect(bothUrl).toContain('side=both');
    expect(bothUrl).toContain('fontSizeA=64');
    expect(bothUrl).toContain('fontSizeB=72');
    expect(bothUrl).toContain('fontWeightA=700');
  });

});
