import type { Json } from './supabase';

/** The persisted presentation settings for a team's logo. */
export interface CropMetadata {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  rotation: number;
  aspectRatio: number;
  createdAt: string;
  customSize?: number;
}

export interface LegacyLogoCropRecord {
  originalUrl: string;
  crop: CropMetadata | null;
}

const LEGACY_CROP_STORAGE_KEY = 'teamLogoCrops';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Converts untrusted JSON from Supabase or localStorage into safe crop data. */
export function isCropMetadata(value: unknown): value is CropMetadata {
  if (!isRecord(value)) return false;

  return isFiniteNumber(value.x)
    && isFiniteNumber(value.y)
    && isFiniteNumber(value.width)
    && isFiniteNumber(value.height)
    && isFiniteNumber(value.zoom)
    && isFiniteNumber(value.rotation)
    && isFiniteNumber(value.aspectRatio)
    && typeof value.createdAt === 'string'
    && (value.customSize === undefined || isFiniteNumber(value.customSize));
}

export function parseCropMetadata(value: Json | null | undefined): CropMetadata | null {
  return isCropMetadata(value) ? value : null;
}

export function cropMetadataToJson(crop: CropMetadata): Json {
  return {
    x: crop.x,
    y: crop.y,
    width: crop.width,
    height: crop.height,
    zoom: crop.zoom,
    rotation: crop.rotation,
    aspectRatio: crop.aspectRatio,
    createdAt: crop.createdAt,
    ...(crop.customSize === undefined ? {} : { customSize: crop.customSize }),
  };
}

/** Matches the legacy Firebase/localStorage team-key format without importing Firebase code. */
export function normalizeLegacyTeamKey(teamName: string): string {
  return String(teamName || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-.()[\]/\\]+/g, '');
}

function readLegacyCropRecords(): Record<string, LegacyLogoCropRecord> {
  try {
    const raw = localStorage.getItem(LEGACY_CROP_STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};

    return Object.entries(parsed).reduce<Record<string, LegacyLogoCropRecord>>((records, [key, value]) => {
      if (!isRecord(value) || typeof value.originalUrl !== 'string') return records;

      records[key] = {
        originalUrl: value.originalUrl,
        crop: isCropMetadata(value.crop) ? value.crop : null,
      };
      return records;
    }, {});
  } catch {
    return {};
  }
}

/** Reads one legacy record only. Migration is deliberately initiated by the user per team. */
export function getLegacyCropRecord(teamName: string): LegacyLogoCropRecord | null {
  const record = readLegacyCropRecords()[normalizeLegacyTeamKey(teamName)];
  return record ?? null;
}

/** Removes a migrated record only after Supabase confirms the team update. */
export function removeLegacyCropRecord(teamName: string): void {
  try {
    const records = readLegacyCropRecords();
    delete records[normalizeLegacyTeamKey(teamName)];
    localStorage.setItem(LEGACY_CROP_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Storage may be unavailable in a restricted embedded browser. The Supabase save remains valid.
  }
}
