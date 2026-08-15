export const SCOREBOARD_EVENT_CHANNEL = 'scoreboard-events';

export type GoalScoredSource = 'manual' | 'hotkey' | 'macro';

export interface GoalScoredEvent {
  type: 'GoalScored';
  eventId: string;
  team: 'A' | 'B';
  teamName: string;
  scoreA: number;
  scoreB: number;
  logo?: string;
  color1?: string;
  color2?: string;
  matchId?: number;
  source: GoalScoredSource;
  timestamp: number;
}

export type GoalScoredPayload = Omit<GoalScoredEvent, 'type' | 'eventId' | 'timestamp'>;

export function isGoalScoredEvent(value: unknown): value is GoalScoredEvent {
  if (!value || typeof value !== 'object') return false;

  const event = value as Partial<GoalScoredEvent>;
  return event.type === 'GoalScored'
    && typeof event.eventId === 'string'
    && (event.team === 'A' || event.team === 'B')
    && typeof event.teamName === 'string'
    && Number.isFinite(event.scoreA)
    && Number.isFinite(event.scoreB)
    && (event.source === 'manual' || event.source === 'hotkey' || event.source === 'macro')
    && typeof event.timestamp === 'number';
}
