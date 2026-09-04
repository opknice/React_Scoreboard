import { describe, expect, it } from 'vitest';
import {
  isGoalScoredEvent,
  isScoreboardStateEvent,
  isTeamNameAnimationCompletedEvent,
} from './scoreboardEvent';

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

const validScoreboardState = {
  type: 'ScoreboardState',
  eventId: 'state-1',
  scoreA: 1,
  scoreB: 0,
  nameA: 'Team A',
  nameB: 'Team B',
  logoA: '/logos/team-a.png',
  logoB: '/logos/team-b.png',
  colorA1: '#ff0000',
  colorA2: '#ffffff',
  colorB1: '#0000ff',
  colorB2: '#ffffff',
  timestamp: Date.now(),
};

const validTeamNameAnimationCompletedEvent = {
  type: 'TeamNameAnimationCompleted',
  eventId: 'goal-1',
  team: 'A',
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
    expect(isGoalScoredEvent({ ...validGoalEvent, source: 'unknown' })).toBe(false);
  });

  it('accepts a valid persistent scoreboard state', () => {
    expect(isScoreboardStateEvent(validScoreboardState)).toBe(true);
    expect(isScoreboardStateEvent({
      ...validScoreboardState,
      logoBrowserCropA: {
        x: 0, y: 0, width: 500, height: 500, zoom: 1, rotation: 0, aspectRatio: 1, createdAt: '2026-09-04T00:00:00.000Z',
      },
    })).toBe(true);
  });

  it('rejects malformed persistent scoreboard state', () => {
    expect(isScoreboardStateEvent({ ...validScoreboardState, scoreB: '0' })).toBe(false);
    expect(isScoreboardStateEvent({ ...validScoreboardState, colorA1: null })).toBe(false);
    expect(isScoreboardStateEvent({ type: 'GoalScored' })).toBe(false);
  });

  it('accepts and rejects team name animation completion events', () => {
    expect(isTeamNameAnimationCompletedEvent(validTeamNameAnimationCompletedEvent)).toBe(true);
    expect(isTeamNameAnimationCompletedEvent({
      ...validTeamNameAnimationCompletedEvent,
      team: 'C',
    })).toBe(false);
  });
});
