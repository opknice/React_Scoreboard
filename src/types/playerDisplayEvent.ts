import type { PlayerPosition } from '../config/supabaseClient';

export const PLAYER_DISPLAY_STORAGE_KEY = 'player_display_state_v1';

export interface PlayerDisplayState {
  type: 'PlayerDisplayState';
  eventId: string;
  visible: boolean;
  leagueId: string | null;
  team: 'A' | 'B' | null;
  teamId: string | null;
  teamName: string;
  playerId: string | null;
  jerseyNumber: number | null;
  name: string;
  position: PlayerPosition | null;
  imageUrl: string | null;
  hideAt: number | null;
  timestamp: number;
}

export type PlayerDisplayPayload = Omit<PlayerDisplayState, 'type' | 'eventId' | 'timestamp'>;

function isPlayerPosition(value: unknown): value is PlayerPosition {
  return value === 'GK' || value === 'DF' || value === 'MF' || value === 'FW';
}

export function isPlayerDisplayState(value: unknown): value is PlayerDisplayState {
  if (!value || typeof value !== 'object') return false;

  const state = value as Partial<PlayerDisplayState>;
  return state.type === 'PlayerDisplayState'
    && typeof state.eventId === 'string'
    && typeof state.visible === 'boolean'
    && (state.leagueId === null || typeof state.leagueId === 'string')
    && (state.team === null || state.team === 'A' || state.team === 'B')
    && (state.teamId === null || typeof state.teamId === 'string')
    && typeof state.teamName === 'string'
    && (state.playerId === null || typeof state.playerId === 'string')
    && (state.jerseyNumber === null || (typeof state.jerseyNumber === 'number' && Number.isInteger(state.jerseyNumber)))
    && typeof state.name === 'string'
    && (state.position === null || isPlayerPosition(state.position))
    && (state.imageUrl === null || typeof state.imageUrl === 'string')
    && (state.hideAt === null || (typeof state.hideAt === 'number' && Number.isFinite(state.hideAt)))
    && typeof state.timestamp === 'number';
}

export function createPlayerDisplayState(payload: PlayerDisplayPayload): PlayerDisplayState {
  const eventId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `player_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return {
    type: 'PlayerDisplayState',
    eventId,
    ...payload,
    timestamp: Date.now(),
  };
}
