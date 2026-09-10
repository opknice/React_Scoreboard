import { normalizeBrowserPositions, LOGO_POSITIONS, type BrowserPositions } from './browserPositions';
import { LOGO_FRAME_SIZE_PX } from './teamLogo';

export type LogoBackgroundMode = 'transparent' | 'normal';

export interface LogoBrowserSettings {
  positions: BrowserPositions;
  backgroundMode: LogoBackgroundMode;
}

export const LOGO_SETTINGS_STORAGE_KEY = 'logoBrowserSettings';
export const LOGO_DEFAULT_SIZE = LOGO_FRAME_SIZE_PX;

export const DEFAULT_LOGO_BROWSER_SETTINGS: LogoBrowserSettings = {
  positions: LOGO_POSITIONS,
  backgroundMode: 'transparent',
};

export function normalizeLogoBackgroundMode(value: unknown): LogoBackgroundMode {
  return value === 'normal' ? 'normal' : 'transparent';
}

export function normalizeLogoBrowserSettings(value: unknown): LogoBrowserSettings {
  const candidate = value && typeof value === 'object' ? value as Partial<LogoBrowserSettings> : {};
  return {
    positions: normalizeBrowserPositions(candidate.positions, LOGO_POSITIONS),
    backgroundMode: normalizeLogoBackgroundMode(candidate.backgroundMode),
  };
}

export function mergeLogoBrowserSettings(
  base: LogoBrowserSettings,
  override: unknown,
): LogoBrowserSettings {
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    return normalizeLogoBrowserSettings(base);
  }
  const source = override as Partial<LogoBrowserSettings>;
  return normalizeLogoBrowserSettings({
    ...base,
    ...source,
    positions: normalizeBrowserPositions(source.positions, base.positions),
  });
}
