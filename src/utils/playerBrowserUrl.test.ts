import { describe, expect, it } from 'vitest';
import { buildPlayerBrowserUrl } from './playerBrowserUrl';

describe('buildPlayerBrowserUrl', () => {
  it('builds a league-scoped player source URL', () => {
    expect(buildPlayerBrowserUrl('https://example.test/', 'league-1'))
      .toBe('https://example.test/player?league=league-1');
  });

  it('omits an empty league scope', () => {
    expect(buildPlayerBrowserUrl('http://localhost:5173/React_Scoreboard', ' '))
      .toBe('http://localhost:5173/React_Scoreboard/player');
  });
});
