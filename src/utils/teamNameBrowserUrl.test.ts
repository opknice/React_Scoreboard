import { describe, expect, it } from 'vitest';
import { DEFAULT_TEAM_NAME_BROWSER_SETTINGS } from '../types/teamNameBrowserSettings';
import { buildTeamNameBrowserUrl, getTeamNamePresentation } from './teamNameBrowserUrl';

describe('teamNameBrowserUrl', () => {
  it('keeps legacy URLs in auto mode with safe defaults', () => {
    expect(getTeamNamePresentation('', 'A')).toEqual({
      fontFamily: 'Inter',
      fontWeight: 700,
      fontMode: 'auto',
      fontSize: 48,
    });
  });

  it('reads manual font settings from the URL', () => {
    const presentation = getTeamNamePresentation('?font=Kanit&fontMode=manual&fontSize=72', 'B');
    expect(presentation).toEqual({ fontFamily: 'Kanit', fontWeight: 700, fontMode: 'manual', fontSize: 72 });
  });

  it('clamps unsafe manual sizes and accepts a local font family', () => {
    expect(getTeamNamePresentation('?font=My%20Local%20Font&fontMode=manual&fontSize=999', 'A')).toEqual({
      fontFamily: 'My Local Font',
      fontWeight: 700,
      fontMode: 'manual',
      fontSize: 120,
    });
  });

  it('falls back when a font family contains unsafe CSS characters', () => {
    expect(getTeamNamePresentation('?font=Bad%3Bfont&fontMode=manual&fontSize=48', 'A')).toEqual({
      fontFamily: 'Inter',
      fontWeight: 700,
      fontMode: 'manual',
      fontSize: 48,
    });
  });

  it('builds a separate URL for each team while preserving the old route', () => {
    const url = buildTeamNameBrowserUrl('http://localhost:5173/React_Scoreboard', 'B', {
      ...DEFAULT_TEAM_NAME_BROWSER_SETTINGS,
      fontFamily: 'Montserrat',
      fontModeB: 'manual',
      fontSizeB: 64,
    });
    expect(url).toContain('/goal-animation?');
    expect(url).toContain('template=team-names');
    expect(url).toContain('side=B');
    expect(url).toContain('font=Montserrat');
    expect(url).toContain('fontMode=manual');
    expect(url).toContain('fontSize=64');
    expect(url).toContain('fontWeight=700');
  });
});
