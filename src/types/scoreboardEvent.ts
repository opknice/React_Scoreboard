import { isCropMetadata, type CropMetadata } from './teamLogo';
import { isLeagueLogoSizingSettings, type LeagueLogoSizingSettings } from './leagueLogoSizing';
import { normalizeTeamColorBrowserSettings, type TeamColorBrowserSettings } from './teamColorBrowserSettings';
import type { LogoBrowserSettings } from './logoBrowserSettings';

export const SCOREBOARD_EVENT_CHANNEL = 'scoreboard-events';
export const SCOREBOARD_STATE_STORAGE_KEY = 'scoreboard_live_state_v1';

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

export interface ScoreboardStateEvent {
  type: 'ScoreboardState';
  eventId: string;
  scoreA: number;
  scoreB: number;
  nameA: string;
  nameB: string;
  leagueId?: string | null;
  leagueLogoSizing?: LeagueLogoSizingSettings;
  teamIdA?: string | null;
  teamIdB?: string | null;
  logoA: string;
  logoB: string;
  colorA1: string;
  colorA2: string;
  colorB1: string;
  colorB2: string;
  /** Crop settings used by Logo Browser Source and goal animations. */
  logoBrowserCropA?: CropMetadata | null;
  logoBrowserCropB?: CropMetadata | null;
  timestamp: number;
}

export interface TeamNameAnimationCompletedEvent {
  type: 'TeamNameAnimationCompleted';
  eventId: string;
  team: 'A' | 'B';
  timestamp: number;
}

export interface LogoSettingsUpdatedEvent {
  type: 'LogoSettingsUpdated';
  leagueId?: string | null;
  settings?: LogoBrowserSettings;
  backgroundMode?: 'transparent' | 'normal';
  timestamp: number;
}

export interface LogoCropUpdatedEvent {
  type: 'LogoCropUpdated';
  teamKey?: string;
  timestamp: number;
}

export interface TeamColorSettingsUpdatedEvent {
  type: 'TeamColorSettingsUpdated';
  leagueId?: string | null;
  settings: TeamColorBrowserSettings;
  timestamp: number;
}

export type ScoreboardStatePayload = Omit<ScoreboardStateEvent, 'type' | 'eventId' | 'timestamp'>;

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

export function isScoreboardStateEvent(value: unknown): value is ScoreboardStateEvent {
  if (!value || typeof value !== 'object') return false;

  const event = value as Partial<ScoreboardStateEvent>;
  return event.type === 'ScoreboardState'
    && typeof event.eventId === 'string'
    && Number.isFinite(event.scoreA)
    && Number.isFinite(event.scoreB)
    && typeof event.nameA === 'string'
    && typeof event.nameB === 'string'
    && (event.leagueId === undefined || event.leagueId === null || typeof event.leagueId === 'string')
    && (event.leagueLogoSizing === undefined || isLeagueLogoSizingSettings(event.leagueLogoSizing))
    && (event.teamIdA === undefined || event.teamIdA === null || typeof event.teamIdA === 'string')
    && (event.teamIdB === undefined || event.teamIdB === null || typeof event.teamIdB === 'string')
    && typeof event.logoA === 'string'
    && typeof event.logoB === 'string'
    && typeof event.colorA1 === 'string'
    && typeof event.colorA2 === 'string'
    && typeof event.colorB1 === 'string'
    && typeof event.colorB2 === 'string'
    && (event.logoBrowserCropA === undefined || event.logoBrowserCropA === null || isCropMetadata(event.logoBrowserCropA))
    && (event.logoBrowserCropB === undefined || event.logoBrowserCropB === null || isCropMetadata(event.logoBrowserCropB))
    && typeof event.timestamp === 'number';
}

export function isTeamNameAnimationCompletedEvent(
  value: unknown,
): value is TeamNameAnimationCompletedEvent {
  if (!value || typeof value !== 'object') return false;

  const event = value as Partial<TeamNameAnimationCompletedEvent>;
  return event.type === 'TeamNameAnimationCompleted'
    && typeof event.eventId === 'string'
    && (event.team === 'A' || event.team === 'B')
    && typeof event.timestamp === 'number';
}

export function isLogoSettingsUpdatedEvent(value: unknown): value is LogoSettingsUpdatedEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<LogoSettingsUpdatedEvent>;
  return event.type === 'LogoSettingsUpdated' && typeof event.timestamp === 'number';
}

export function isLogoCropUpdatedEvent(value: unknown): value is LogoCropUpdatedEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<LogoCropUpdatedEvent>;
  return event.type === 'LogoCropUpdated' && typeof event.timestamp === 'number';
}

export function isTeamColorSettingsUpdatedEvent(value: unknown): value is TeamColorSettingsUpdatedEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<TeamColorSettingsUpdatedEvent>;
  return event.type === 'TeamColorSettingsUpdated'
    && (event.leagueId === undefined || event.leagueId === null || typeof event.leagueId === 'string')
    && typeof event.timestamp === 'number'
    && Boolean(event.settings)
    && JSON.stringify(normalizeTeamColorBrowserSettings(event.settings)) === JSON.stringify(event.settings);
}
