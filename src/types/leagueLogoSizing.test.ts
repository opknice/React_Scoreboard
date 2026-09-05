import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEAGUE_LOGO_SIZING,
  getEffectiveLogoScalePercent,
  mergeLeagueLogoSizing,
  normalizeLogoScalePercent,
  parseLeagueLogoSizing,
  scaleLogoPixels,
} from './leagueLogoSizing';

describe('leagueLogoSizing', () => {
  it('uses 100% when a league has no logo sizing settings', () => {
    expect(parseLeagueLogoSizing(null)).toEqual(DEFAULT_LEAGUE_LOGO_SIZING);
    expect(parseLeagueLogoSizing({ unrelated: true })).toEqual(DEFAULT_LEAGUE_LOGO_SIZING);
  });

  it('clamps slider values to 25-300 percent', () => {
    expect(normalizeLogoScalePercent(5)).toBe(25);
    expect(normalizeLogoScalePercent(125.6)).toBe(126);
    expect(normalizeLogoScalePercent(900)).toBe(300);
  });

  it('preserves unrelated settings when saving league sizing', () => {
    const merged = mergeLeagueLogoSizing(
      { theme: 'dark', nested: { enabled: true } },
      { overlayScalePercent: 120, logoBrowserScalePercent: 140 },
    );

    expect(merged).toEqual({
      theme: 'dark',
      nested: { enabled: true },
      logoSizing: { overlayScalePercent: 120, logoBrowserScalePercent: 140 },
    });
  });

  it('lets a cropped team keep its frame snapshot while an uncropped team inherits the league', () => {
    expect(getEffectiveLogoScalePercent(null, 150)).toBe(150);
    expect(getEffectiveLogoScalePercent({
      x: 0,
      y: 0,
      width: 500,
      height: 500,
      zoom: 1,
      rotation: 0,
      aspectRatio: 1,
      frameScalePercent: 120,
      createdAt: '2026-09-05T00:00:00.000Z',
    }, 150)).toBe(120);
  });

  it('scales each layout from its own base size', () => {
    expect(scaleLogoPixels(64, 120)).toBe(77);
    expect(scaleLogoPixels(70, 120)).toBe(84);
    expect(scaleLogoPixels(32, 120)).toBe(38);
    expect(scaleLogoPixels(190, 120)).toBe(228);
  });
});
