import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOGO_BROWSER_SETTINGS,
  normalizeLogoBrowserSettings,
  normalizeLogoSize,
} from './logoBrowserSettings';

describe('logoBrowserSettings', () => {
  it('clamps logo size to the safe range', () => {
    expect(normalizeLogoSize(1)).toBe(32);
    expect(normalizeLogoSize(9999)).toBe(800);
    expect(normalizeLogoSize('invalid')).toBe(190);
  });

  it('normalizes malformed settings to safe defaults', () => {
    expect(normalizeLogoBrowserSettings({ sizeA: 420, sizeB: -5, backgroundMode: 'normal' })).toEqual({
      sizeA: 420,
      sizeB: 32,
      backgroundMode: 'normal',
    });
    expect(normalizeLogoBrowserSettings(null)).toEqual(DEFAULT_LOGO_BROWSER_SETTINGS);
  });
});
