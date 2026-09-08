import { describe, expect, it } from 'vitest';
import { buildInstantReplayBrowserUrl, buildVarReplayBrowserUrl } from './replayBrowserUrl';

describe('replay browser URLs', () => {
  it.each([
    ['http://localhost:5173/React_Scoreboard/', 'http://localhost:5173/React_Scoreboard'],
    ['https://example.github.io/React_Scoreboard/', 'https://example.github.io/React_Scoreboard'],
    ['https://scoreboard.example.com/', 'https://scoreboard.example.com'],
  ])('uses the current application base URL: %s', (baseUrl, expectedBase) => {
    expect(buildVarReplayBrowserUrl(baseUrl)).toBe(`${expectedBase}/var-replay-v2/screen`);
    expect(buildInstantReplayBrowserUrl(baseUrl)).toBe(`${expectedBase}/replay/screen`);
  });
});
