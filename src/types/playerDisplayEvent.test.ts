import { describe, expect, it } from 'vitest';
import { createPlayerDisplayState, isPlayerDisplayState } from './playerDisplayEvent';

const validPayload = {
  visible: true,
  leagueId: 'league-1',
  team: 'A' as const,
  teamId: 'team-a',
  teamName: 'Team A',
  playerId: 'player-1',
  jerseyNumber: 10,
  name: 'Player One',
  position: 'FW' as const,
  imageUrl: 'https://cdn.example/player.png',
  hideAt: Date.now() + 5000,
};

describe('playerDisplayEvent', () => {
  it('creates a valid display state with an event id', () => {
    const state = createPlayerDisplayState(validPayload);
    expect(state.type).toBe('PlayerDisplayState');
    expect(state.eventId).toEqual(expect.any(String));
    expect(isPlayerDisplayState(state)).toBe(true);
  });

  it('rejects invalid player display messages', () => {
    const state = createPlayerDisplayState(validPayload);
    expect(isPlayerDisplayState({ ...state, position: 'ST' })).toBe(false);
    expect(isPlayerDisplayState({ ...state, jerseyNumber: '10' })).toBe(false);
    expect(isPlayerDisplayState({ type: 'ScoreboardState' })).toBe(false);
  });
});
