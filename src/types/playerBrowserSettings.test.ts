import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAYER_BROWSER_SETTINGS,
  normalizePlayerBrowserSettings,
  PLAYER_BROWSER_CANVAS_HEIGHT,
  PLAYER_BROWSER_CANVAS_WIDTH,
} from './playerBrowserSettings';

describe('playerBrowserSettings', () => {
  it('clamps canvas positions and element sizes', () => {
    const settings = normalizePlayerBrowserSettings({
      image: { x: -20, y: 9999, size: 9999 },
      jersey: { x: 2000, y: -2, size: 1 },
    });

    expect(settings.image).toEqual({ x: 0, y: PLAYER_BROWSER_CANVAS_HEIGHT, size: 720 });
    expect(settings.jersey).toEqual({ x: PLAYER_BROWSER_CANVAS_WIDTH, y: 0, size: 8 });
    expect(settings.name).toEqual(DEFAULT_PLAYER_BROWSER_SETTINGS.name);
  });

  it('falls back safely for malformed settings', () => {
    expect(normalizePlayerBrowserSettings(null)).toEqual(DEFAULT_PLAYER_BROWSER_SETTINGS);
    expect(normalizePlayerBrowserSettings({ image: 'invalid' }).image)
      .toEqual(DEFAULT_PLAYER_BROWSER_SETTINGS.image);
  });
});
