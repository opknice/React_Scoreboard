import { describe, expect, it } from 'vitest';
import { findTeamLogoRecord, getLogoSrc, resolveTeamLogo } from './logoResolver';

const teams = [
  { id: 'team-1', name: 'ทีม เหย้า', logo_url: 'https://example.com/home.png' },
  { id: 'team-2', name: 'ทีม เยือน', logo_url: 'https://example.com/away.png' },
] as const;

describe('logoResolver', () => {
  it('prefers the stable team ID when resolving a logo', () => {
    expect(resolveTeamLogo(teams, 'team-2', 'ชื่อเก่า')).toBe('https://example.com/away.png');
  });

  it('falls back to a normalized team name for legacy matches', () => {
    expect(findTeamLogoRecord(teams, null, '  ทีม   เหย้า ')).toEqual(teams[0]);
    expect(resolveTeamLogo(teams, null, '  ทีม   เหย้า ')).toBe('https://example.com/home.png');
  });

  it('resolves a missing logo to the normal static fallback path', () => {
    expect(getLogoSrc('', 'Unknown Team')).toBe('/logos/Unknown%20Team.png');
  });
});
