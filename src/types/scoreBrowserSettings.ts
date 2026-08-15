import {
  DEFAULT_FONT_WEIGHT,
  normalizeFontWeight,
  TEAM_NAME_FONT_OPTIONS,
  type FontWeight,
  type TeamNameFontFamily,
} from './teamNameBrowserSettings';

export type ScoreFontMode = 'auto' | 'manual';
export type ScoreFontFamily = TeamNameFontFamily;
export type ScoreFontWeight = FontWeight;

export interface ScoreBrowserSettings {
  fontFamily: ScoreFontFamily;
  fontWeightA: ScoreFontWeight;
  fontWeightB: ScoreFontWeight;
  fontModeA: ScoreFontMode;
  fontModeB: ScoreFontMode;
  fontSizeA: number;
  fontSizeB: number;
}

export const SCORE_SETTINGS_STORAGE_KEY = 'scoreBrowserSettings';
export const SCORE_MIN_FONT_SIZE = 24;
export const SCORE_MAX_FONT_SIZE = 140;
export const SCORE_DEFAULT_FONT_SIZE = 72;
export const SCORE_FONT_OPTIONS = TEAM_NAME_FONT_OPTIONS;

export const DEFAULT_SCORE_BROWSER_SETTINGS: ScoreBrowserSettings = {
  fontFamily: 'Inter',
  fontWeightA: DEFAULT_FONT_WEIGHT,
  fontWeightB: DEFAULT_FONT_WEIGHT,
  fontModeA: 'auto',
  fontModeB: 'auto',
  fontSizeA: SCORE_DEFAULT_FONT_SIZE,
  fontSizeB: SCORE_DEFAULT_FONT_SIZE,
};

export function normalizeScoreFontSize(value: unknown, fallback = SCORE_DEFAULT_FONT_SIZE): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(SCORE_MAX_FONT_SIZE, Math.max(SCORE_MIN_FONT_SIZE, Math.round(parsed)));
}

export function normalizeScoreFontMode(value: unknown): ScoreFontMode {
  return value === 'manual' ? 'manual' : 'auto';
}

export function normalizeScoreFontFamily(value: unknown): ScoreFontFamily {
  return SCORE_FONT_OPTIONS.some((option) => option.value === value)
    ? value as ScoreFontFamily
    : DEFAULT_SCORE_BROWSER_SETTINGS.fontFamily;
}

export function normalizeScoreBrowserSettings(value: unknown): ScoreBrowserSettings {
  const candidate = value && typeof value === 'object' ? value as Partial<ScoreBrowserSettings> : {};
  return {
    fontFamily: normalizeScoreFontFamily(candidate.fontFamily),
    fontWeightA: normalizeFontWeight(candidate.fontWeightA),
    fontWeightB: normalizeFontWeight(candidate.fontWeightB),
    fontModeA: normalizeScoreFontMode(candidate.fontModeA),
    fontModeB: normalizeScoreFontMode(candidate.fontModeB),
    fontSizeA: normalizeScoreFontSize(candidate.fontSizeA),
    fontSizeB: normalizeScoreFontSize(candidate.fontSizeB),
  };
}
