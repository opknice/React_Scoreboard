import type { Json } from './supabase';
import type { CropMetadata } from './teamLogo';

export const MIN_LOGO_SCALE_PERCENT = 25;
export const MAX_LOGO_SCALE_PERCENT = 300;
export const DEFAULT_LOGO_SCALE_PERCENT = 100;

export type LogoSizingContext = 'overlay' | 'logo-browser';

export interface LeagueLogoSizingSettings {
  overlayScalePercent: number;
  logoBrowserScalePercent: number;
}

export const DEFAULT_LEAGUE_LOGO_SIZING: LeagueLogoSizingSettings = {
  overlayScalePercent: DEFAULT_LOGO_SCALE_PERCENT,
  logoBrowserScalePercent: DEFAULT_LOGO_SCALE_PERCENT,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isLeagueLogoSizingSettings(value: unknown): value is LeagueLogoSizingSettings {
  if (!isRecord(value)) return false;
  return typeof value.overlayScalePercent === 'number'
    && Number.isFinite(value.overlayScalePercent)
    && value.overlayScalePercent >= MIN_LOGO_SCALE_PERCENT
    && value.overlayScalePercent <= MAX_LOGO_SCALE_PERCENT
    && typeof value.logoBrowserScalePercent === 'number'
    && Number.isFinite(value.logoBrowserScalePercent)
    && value.logoBrowserScalePercent >= MIN_LOGO_SCALE_PERCENT
    && value.logoBrowserScalePercent <= MAX_LOGO_SCALE_PERCENT;
}

export function normalizeLogoScalePercent(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_LOGO_SCALE_PERCENT;
  return Math.min(MAX_LOGO_SCALE_PERCENT, Math.max(MIN_LOGO_SCALE_PERCENT, Math.round(value)));
}

export function parseLeagueLogoSizing(settings: unknown): LeagueLogoSizingSettings {
  if (!isRecord(settings) || !isRecord(settings.logoSizing)) return { ...DEFAULT_LEAGUE_LOGO_SIZING };
  return {
    overlayScalePercent: normalizeLogoScalePercent(settings.logoSizing.overlayScalePercent),
    logoBrowserScalePercent: normalizeLogoScalePercent(settings.logoSizing.logoBrowserScalePercent),
  };
}

/** Preserves unrelated league settings while replacing only the logoSizing namespace. */
export function mergeLeagueLogoSizing(
  settings: Json | null | undefined,
  logoSizing: LeagueLogoSizingSettings,
): Json {
  const root = isRecord(settings) ? settings : {};
  return {
    ...root,
    logoSizing: {
      overlayScalePercent: normalizeLogoScalePercent(logoSizing.overlayScalePercent),
      logoBrowserScalePercent: normalizeLogoScalePercent(logoSizing.logoBrowserScalePercent),
    },
  } as Json;
}

export function getLeagueScaleForContext(
  sizing: LeagueLogoSizingSettings,
  context: LogoSizingContext,
): number {
  return context === 'overlay' ? sizing.overlayScalePercent : sizing.logoBrowserScalePercent;
}

export function getEffectiveLogoScalePercent(
  crop: CropMetadata | null | undefined,
  leagueScalePercent: number,
): number {
  return crop
    ? normalizeLogoScalePercent(crop.frameScalePercent)
    : normalizeLogoScalePercent(leagueScalePercent);
}

export function scaleLogoPixels(basePixels: number, scalePercent: number): number {
  return Math.round((basePixels * normalizeLogoScalePercent(scalePercent)) / 100);
}
