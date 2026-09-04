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
