import { LOGO_FRAME_SIZE_PX } from './teamLogo';

export type LogoBackgroundMode = 'transparent' | 'normal';

export interface LogoBrowserSettings {
  backgroundMode: LogoBackgroundMode;
}

export const LOGO_SETTINGS_STORAGE_KEY = 'logoBrowserSettings';
export const LOGO_DEFAULT_SIZE = LOGO_FRAME_SIZE_PX;

export const DEFAULT_LOGO_BROWSER_SETTINGS: LogoBrowserSettings = {
  backgroundMode: 'transparent',
};

export function normalizeLogoBackgroundMode(value: unknown): LogoBackgroundMode {
  return value === 'normal' ? 'normal' : 'transparent';
}

export function normalizeLogoBrowserSettings(value: unknown): LogoBrowserSettings {
  const candidate = value && typeof value === 'object' ? value as Partial<LogoBrowserSettings> : {};
  return {
    backgroundMode: normalizeLogoBackgroundMode(candidate.backgroundMode),
  };
}
