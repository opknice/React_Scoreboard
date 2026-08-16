export type LogoBackgroundMode = 'transparent' | 'normal';

export interface LogoBrowserSettings {
  sizeA: number;
  sizeB: number;
  backgroundMode: LogoBackgroundMode;
}

export const LOGO_SETTINGS_STORAGE_KEY = 'logoBrowserSettings';
export const LOGO_MIN_SIZE = 32;
export const LOGO_MAX_SIZE = 800;
export const LOGO_DEFAULT_SIZE = 190;

export const DEFAULT_LOGO_BROWSER_SETTINGS: LogoBrowserSettings = {
  sizeA: LOGO_DEFAULT_SIZE,
  sizeB: LOGO_DEFAULT_SIZE,
  backgroundMode: 'transparent',
};

export function normalizeLogoSize(value: unknown, fallback = LOGO_DEFAULT_SIZE): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(LOGO_MAX_SIZE, Math.max(LOGO_MIN_SIZE, Math.round(parsed)));
}

export function normalizeLogoBackgroundMode(value: unknown): LogoBackgroundMode {
  return value === 'normal' ? 'normal' : 'transparent';
}

export function normalizeLogoBrowserSettings(value: unknown): LogoBrowserSettings {
  const candidate = value && typeof value === 'object' ? value as Partial<LogoBrowserSettings> : {};
  return {
    sizeA: normalizeLogoSize(candidate.sizeA),
    sizeB: normalizeLogoSize(candidate.sizeB),
    backgroundMode: normalizeLogoBackgroundMode(candidate.backgroundMode),
  };
}
