/** Utilities for storing and validating team logo crop metadata. */

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

export interface LogoWithCrop {
  originalUrl: string;
  crop: CropMetadata | null;
}

const CROP_STORAGE_KEY = 'teamLogoCrops';

export function saveCropMetadataToLocalStorage(
  teamKey: string,
  originalUrl: string,
  crop: CropMetadata,
): void {
  try {
    const crops = JSON.parse(localStorage.getItem(CROP_STORAGE_KEY) || '{}') as Record<string, LogoWithCrop>;
    crops[teamKey] = { originalUrl, crop };
    localStorage.setItem(CROP_STORAGE_KEY, JSON.stringify(crops));
  } catch (error) {
    console.error('[logoCropMetadata] Failed to save to localStorage:', error);
  }
}

export function getCropMetadataFromLocalStorage(teamKey: string): LogoWithCrop | null {
  try {
    const crops = JSON.parse(localStorage.getItem(CROP_STORAGE_KEY) || '{}') as Record<string, LogoWithCrop>;
    return crops[teamKey] || null;
  } catch (error) {
    console.error('[logoCropMetadata] Failed to read from localStorage:', error);
    return null;
  }
}

export function removeCropMetadataFromLocalStorage(teamKey: string): void {
  try {
    const crops = JSON.parse(localStorage.getItem(CROP_STORAGE_KEY) || '{}') as Record<string, LogoWithCrop>;
    delete crops[teamKey];
    localStorage.setItem(CROP_STORAGE_KEY, JSON.stringify(crops));
  } catch (error) {
    console.error('[logoCropMetadata] Failed to remove from localStorage:', error);
  }
}

export function getCropStyles(crop: CropMetadata | null): React.CSSProperties {
  if (!crop) {
    return {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
    };
  }

  return {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    transform: `scale(${crop.zoom}) rotate(${crop.rotation}deg)`,
    transformOrigin: 'center',
    clipPath: `inset(${crop.y}px ${crop.x + crop.width}px ${crop.y + crop.height}px ${crop.x}px)`,
  };
}

export function isValidCropMetadata(crop: unknown): crop is CropMetadata {
  if (!crop || typeof crop !== 'object') return false;
  const candidate = crop as Record<string, unknown>;
  return (
    typeof candidate.x === 'number' &&
    typeof candidate.y === 'number' &&
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number' &&
    typeof candidate.zoom === 'number' &&
    typeof candidate.rotation === 'number' &&
    typeof candidate.aspectRatio === 'number' &&
    typeof candidate.createdAt === 'string'
  );
}
