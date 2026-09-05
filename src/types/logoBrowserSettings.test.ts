import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOGO_BROWSER_SETTINGS,
  normalizeLogoBrowserSettings,
} from './logoBrowserSettings';

describe('logoBrowserSettings', () => {
  it('ignores legacy sizes and normalizes the remaining presentation setting', () => {
    expect(normalizeLogoBrowserSettings({ sizeA: 420, sizeB: -5, backgroundMode: 'normal' })).toEqual({
      backgroundMode: 'normal',
    });
    expect(normalizeLogoBrowserSettings(null)).toEqual(DEFAULT_LOGO_BROWSER_SETTINGS);
  });
});
