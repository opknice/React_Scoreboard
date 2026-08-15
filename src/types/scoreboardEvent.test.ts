import { describe, expect, it } from 'vitest';
import { isGoalScoredEvent } from './scoreboardEvent';

const validGoalEvent = {
  type: 'GoalScored',
  eventId: 'goal-1',
  team: 'A',
  teamName: 'Team A',
  scoreA: 1,
  scoreB: 0,
  source: 'manual',
  timestamp: Date.now(),
};

describe('scoreboardEvent', () => {
  it('accepts a valid GoalScored event', () => {
    expect(isGoalScoredEvent(validGoalEvent)).toBe(true);
  });

  it('rejects malformed or unrelated messages', () => {
    expect(isGoalScoredEvent(null)).toBe(false);
    expect(isGoalScoredEvent({ type: 'ButtonClicked' })).toBe(false);
    expect(isGoalScoredEvent({ ...validGoalEvent, team: 'C' })).toBe(false);
    expect(isGoalScoredEvent({ ...validGoalEvent, scoreA: '1' })).toBe(false);
    expect(isGoalScoredEvent({ ...validGoalEvent, source: 'firebase' })).toBe(false);
  });
});
