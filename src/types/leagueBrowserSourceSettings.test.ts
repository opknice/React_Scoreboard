import { describe, expect, it } from 'vitest';
import { DEFAULT_SCORE_BROWSER_SETTINGS } from './scoreBrowserSettings';
import { DEFAULT_TEAM_NAME_BROWSER_SETTINGS } from './teamNameBrowserSettings';
import { DEFAULT_TEAM_COLOR_BROWSER_SETTINGS } from './teamColorBrowserSettings';
import { DEFAULT_LOGO_BROWSER_SETTINGS } from './logoBrowserSettings';
import { DEFAULT_PLAYER_BROWSER_SETTINGS } from './playerBrowserSettings';
import {
  mergeLeagueBrowserSourceSettings,
  resolveLeagueBrowserSourceSettings,
  type LeagueBrowserSourceSettings,
} from './leagueBrowserSourceSettings';

const globalSettings: LeagueBrowserSourceSettings = {
  teamName: { ...DEFAULT_TEAM_NAME_BROWSER_SETTINGS, fontFamily: 'Kanit', fontSizeA: 54 },
  score: { ...DEFAULT_SCORE_BROWSER_SETTINGS, fontFamily: 'Kanit', fontSizeA: 80 },
  teamColor: DEFAULT_TEAM_COLOR_BROWSER_SETTINGS,
  logo: DEFAULT_LOGO_BROWSER_SETTINGS,
  player: DEFAULT_PLAYER_BROWSER_SETTINGS,
};

describe('leagueBrowserSourceSettings', () => {
  it('uses global settings when the league has no browser source override', () => {
    expect(resolveLeagueBrowserSourceSettings({ logoSizing: {} }, globalSettings)).toEqual({
      settings: globalSettings,
      scope: 'global',
    });
  });

  it('supports a partial league override and falls back per field and group', () => {
    const resolved = resolveLeagueBrowserSourceSettings({
      browserSources: { teamName: { textColorA: '#ff0000' } },
    }, globalSettings);

    expect(resolved.scope).toBe('mixed');
    expect(resolved.settings.teamName.textColorA).toBe('#ff0000');
    expect(resolved.settings.teamName.fontFamily).toBe('Kanit');
    expect(resolved.settings.score).toEqual(globalSettings.score);
  });

  it('deep-merges nested team-color overrides with global values', () => {
    const resolved = resolveLeagueBrowserSourceSettings({
      browserSources: {
        teamColor: {
          appearance: { width: 420 },
          positions: { A1: { x: 64 } },
        },
      },
    }, globalSettings);

    expect(resolved.scope).toBe('mixed');
    expect(resolved.settings.teamColor.appearance.width).toBe(420);
    expect(resolved.settings.teamColor.appearance.height)
      .toBe(globalSettings.teamColor.appearance.height);
    expect(resolved.settings.teamColor.positions.A1.x).toBe(64);
    expect(resolved.settings.teamColor.positions.A1.y)
      .toBe(globalSettings.teamColor.positions.A1.y);
  });

  it('preserves unrelated settings and browser source namespaces when saving', () => {
    const merged = mergeLeagueBrowserSourceSettings({
      logoSizing: { overlayScalePercent: 120 },
      browserSources: { futureSetting: { enabled: true } },
    }, globalSettings);

    expect(merged).toEqual({
      logoSizing: { overlayScalePercent: 120 },
      browserSources: {
        futureSetting: { enabled: true },
        teamName: globalSettings.teamName,
        score: globalSettings.score,
        teamColor: globalSettings.teamColor,
        logo: globalSettings.logo,
        player: globalSettings.player,
      },
    });
  });
});
