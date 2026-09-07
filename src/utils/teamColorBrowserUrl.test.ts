import { describe, expect, it } from 'vitest';
import { buildTeamColorBrowserUrl } from './teamColorBrowserUrl';

describe('buildTeamColorBrowserUrl', () => {
  it('builds a side-specific URL with the league scope', () => {
    expect(buildTeamColorBrowserUrl('https://example.test/', 'A', 'league-1'))
      .toBe('https://example.test/team-color?side=A&league=league-1');
  });

  it('omits an empty league id for global fallback sources', () => {
    expect(buildTeamColorBrowserUrl('http://localhost:5173', 'B', ' '))
      .toBe('http://localhost:5173/team-color?side=B');
  });
});
