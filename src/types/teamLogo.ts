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
  /** Snapshot of the league frame scale when this team became custom. */
  frameScalePercent?: number;
  browserFrame?: { width: number; height: number; lockAspectRatio: boolean };
  createdAt: string;
}

export const LOGO_FRAME_SIZE_PX = 190;

/** Calculates the inner-image zoom that fits an image inside the crop canvas. */
export function calculateContainZoom(
  naturalWidth: number,
  naturalHeight: number,
  frameWidth = 500,
  frameHeight = 500,
): number {
  if (![naturalWidth, naturalHeight, frameWidth, frameHeight].every((value) => Number.isFinite(value) && value > 0)) {
    return 1;
  }

  const fitZoom = Math.min(frameWidth / naturalWidth, frameHeight / naturalHeight);
  return Math.min(10, Math.max(0.05, Number(fitZoom.toFixed(4))));
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

  return isFiniteNumber(value.x) && Math.abs(value.x) <= 10000
    && isFiniteNumber(value.y) && Math.abs(value.y) <= 10000
    && isFiniteNumber(value.width) && value.width > 0 && value.width <= 4096
    && isFiniteNumber(value.height) && value.height > 0 && value.height <= 4096
    && isFiniteNumber(value.zoom) && value.zoom > 0 && value.zoom <= 20
    && isFiniteNumber(value.rotation) && Math.abs(value.rotation) <= 360
    && isFiniteNumber(value.aspectRatio) && value.aspectRatio > 0 && value.aspectRatio <= 10
    && (value.frameScalePercent === undefined
      || (isFiniteNumber(value.frameScalePercent) && value.frameScalePercent >= 25 && value.frameScalePercent <= 300))
    && typeof value.createdAt === 'string'
    && (value.browserFrame === undefined || (isRecord(value.browserFrame)
      && isFiniteNumber(value.browserFrame.width) && value.browserFrame.width >= 48 && value.browserFrame.width <= 570
      && isFiniteNumber(value.browserFrame.height) && value.browserFrame.height >= 48 && value.browserFrame.height <= 570
      && typeof value.browserFrame.lockAspectRatio === 'boolean'))
    // Accept the old field while reading so existing Supabase rows remain usable.
    && (value.customSize === undefined || (isFiniteNumber(value.customSize) && value.customSize >= 0 && value.customSize <= 2000));
}

export function parseCropMetadata(value: unknown): CropMetadata | null {
  if (!isCropMetadata(value)) return null;

  const legacyCustomSize = isRecord(value) && isFiniteNumber(value.customSize) && value.customSize > 0
    ? value.customSize
    : LOGO_FRAME_SIZE_PX;
  const legacyScale = legacyCustomSize / LOGO_FRAME_SIZE_PX;

  // Legacy customSize changed the outer box. Convert it to an equivalent inner
  // zoom against the 190px Logo Browser base while keeping the old 100% frame.
  return {
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
    zoom: Math.min(20, Math.max(0.05, value.zoom * legacyScale)),
    rotation: value.rotation,
    aspectRatio: value.aspectRatio,
    // Existing crop rows predate frame scaling and therefore preserve the old 100% frame.
    frameScalePercent: isRecord(value) && isFiniteNumber(value.frameScalePercent)
      ? Math.min(300, Math.max(25, Math.round(value.frameScalePercent)))
      : 100,
    createdAt: value.createdAt,
    ...(value.browserFrame ? { browserFrame: { ...value.browserFrame } } : {}),
  };
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
    frameScalePercent: typeof crop.frameScalePercent === 'number'
      ? Math.min(300, Math.max(25, Math.round(crop.frameScalePercent)))
      : 100,
    createdAt: crop.createdAt,
    ...(crop.browserFrame ? { browserFrame: { ...crop.browserFrame } } : {}),
  };
}
