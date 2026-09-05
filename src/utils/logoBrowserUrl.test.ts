import { describe, expect, it } from 'vitest';
import { buildLogoBrowserUrl, getLogoPresentation } from './logoBrowserUrl';
import { DEFAULT_LOGO_BROWSER_SETTINGS } from '../types/logoBrowserSettings';

describe('logoBrowserUrl', () => {
  it('builds separate persistent Logo Browser Source URLs', () => {
    const url = buildLogoBrowserUrl('http://localhost:5173/React_Scoreboard/', 'B', undefined, 'sync-1', 'league-1');

    expect(url).toContain('template=team-logos');
    expect(url).toContain('side=B');
    expect(url).toContain('size=190');
    expect(url).toContain('background=transparent');
    expect(url).toContain('sync=sync-1');
    expect(url).toContain('league=league-1');
  });

  it('keeps the frame fixed while preserving the selected background', () => {
    const url = buildLogoBrowserUrl('http://localhost:5173/React_Scoreboard', 'A', {
      ...DEFAULT_LOGO_BROWSER_SETTINGS,
      backgroundMode: 'normal',
    });

    expect(url).toContain('size=190');
    expect(url).toContain('background=normal');
    expect(getLogoPresentation(`${url}&size=360&sizeA=420`, 'A')).toEqual({ size: 190, backgroundMode: 'normal' });
  });
});
