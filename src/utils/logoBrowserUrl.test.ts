import { describe, expect, it } from 'vitest';
import { buildLogoBrowserUrl, getLogoPresentation } from './logoBrowserUrl';
import { DEFAULT_LOGO_BROWSER_SETTINGS } from '../types/logoBrowserSettings';

describe('logoBrowserUrl', () => {
  it('builds separate persistent Logo Browser Source URLs', () => {
    const url = buildLogoBrowserUrl('http://localhost:5173/React_Scoreboard/', 'B');

    expect(url).toContain('template=team-logos');
    expect(url).toContain('side=B');
    expect(url).toContain('size=190');
    expect(url).toContain('background=transparent');
  });

  it('builds independent size and background parameters', () => {
    const url = buildLogoBrowserUrl('http://localhost:5173/React_Scoreboard', 'A', {
      ...DEFAULT_LOGO_BROWSER_SETTINGS,
      sizeA: 360,
      backgroundMode: 'normal',
    });

    expect(url).toContain('size=360');
    expect(url).toContain('background=normal');
    expect(getLogoPresentation(url, 'A')).toEqual({ size: 360, backgroundMode: 'normal' });
  });
});
