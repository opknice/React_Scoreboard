import { describe, expect, it } from 'vitest';
import { normalizeBrowserPositions, TEAM_NAME_POSITIONS } from './browserPositions';
import { DEFAULT_TEAM_NAME_BROWSER_SETTINGS } from './teamNameBrowserSettings';
import { DEFAULT_LOGO_BROWSER_SETTINGS } from './logoBrowserSettings';
import { DEFAULT_SCORE_BROWSER_SETTINGS } from './scoreBrowserSettings';
import { buildTeamNameBrowserUrl, getTeamNamePresentation } from '../utils/teamNameBrowserUrl';
import { buildLogoBrowserUrl, getLogoPresentation } from '../utils/logoBrowserUrl';
import { buildScoreBrowserUrl, getScorePresentation } from '../utils/scoreBrowserUrl';

describe('Canvas positions', () => {
  it('preserves missing coordinates and rejects invalid values while clamping bounds', () => {
    expect(normalizeBrowserPositions({ A: { x: -10, y: 2000 }, B: { x: '', y: Infinity } }, TEAM_NAME_POSITIONS))
      .toEqual({ A: { x: 0, y: 1080 }, B: TEAM_NAME_POSITIONS.B });
    expect(normalizeBrowserPositions({ A: { x: 100 } }, TEAM_NAME_POSITIONS).A).toEqual({ x: 100, y: TEAM_NAME_POSITIONS.A.y });
  });
  it('round-trips independent team positions through separate and combined OBS URLs', () => {
    const positions = { A: { x: 0, y: 210.5 }, B: { x: 1920, y: 1080 } };
    for (const side of ['A', 'B'] as const) {
      const name = new URL(buildTeamNameBrowserUrl('https://example.test', side, { ...DEFAULT_TEAM_NAME_BROWSER_SETTINGS, positions }));
      expect(getTeamNamePresentation(name.search, side).position).toEqual(positions[side]);
    }
    for (const side of ['A', 'B', 'both'] as const) {
      const logo = new URL(buildLogoBrowserUrl('https://example.test', side, { ...DEFAULT_LOGO_BROWSER_SETTINGS, positions }));
      const score = new URL(buildScoreBrowserUrl('https://example.test', side, { ...DEFAULT_SCORE_BROWSER_SETTINGS, positions }));
      for (const team of ['A', 'B'] as const) {
        expect(getLogoPresentation(logo.search, team).position).toEqual(positions[team]);
        expect(getScorePresentation(score.search, team).position).toEqual(positions[team]);
      }
    }
  });
});
