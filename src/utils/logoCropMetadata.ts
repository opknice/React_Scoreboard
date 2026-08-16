/**
 * Logo Crop Metadata Utilities
 * Handles saving and retrieving crop coordinates for logo images
 */

import type { Database } from 'firebase/database';
import { ref, set, get } from 'firebase/database';

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

/**
 * Save crop metadata to Firebase
 */
export async function saveCropMetadataToFirebase(
  db: Database,
  teamKey: string,
  originalUrl: string,
  crop: CropMetadata
): Promise<void> {
  const logoRef = ref(db, `teams/${teamKey}/logo`);
  await set(logoRef, {
    originalUrl,
    crop,
  });
}

/**
 * Get crop metadata from Firebase
 */
export async function getCropMetadataFromFirebase(
  db: Database,
  teamKey: string
): Promise<LogoWithCrop | null> {
  const logoRef = ref(db, `teams/${teamKey}/logo`);
  const snapshot = await get(logoRef);
  
  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.val() as LogoWithCrop;
}

/**
 * Save crop metadata to localStorage
 */
export function saveCropMetadataToLocalStorage(
  teamKey: string,
  originalUrl: string,
  crop: CropMetadata
): void {
  try {
    const crops = JSON.parse(localStorage.getItem(CROP_STORAGE_KEY) || '{}');
    crops[teamKey] = { originalUrl, crop };
    localStorage.setItem(CROP_STORAGE_KEY, JSON.stringify(crops));
  } catch (error) {
    console.error('[logoCropMetadata] Failed to save to localStorage:', error);
  }
}

/**
 * Get crop metadata from localStorage
 */
export function getCropMetadataFromLocalStorage(teamKey: string): LogoWithCrop | null {
  try {
    const crops = JSON.parse(localStorage.getItem(CROP_STORAGE_KEY) || '{}');
    return crops[teamKey] || null;
  } catch (error) {
    console.error('[logoCropMetadata] Failed to read from localStorage:', error);
    return null;
  }
}

/**
 * Remove crop metadata (both Firebase and localStorage)
 */
export async function removeCropMetadata(
  db: Database | null,
  teamKey: string
): Promise<void> {
  // Remove from Firebase
  if (db) {
    const cropRef = ref(db, `teams/${teamKey}/logo/crop`);
    await set(cropRef, null);
  }

  // Remove from localStorage
  try {
    const crops = JSON.parse(localStorage.getItem(CROP_STORAGE_KEY) || '{}');
    delete crops[teamKey];
    localStorage.setItem(CROP_STORAGE_KEY, JSON.stringify(crops));
  } catch (error) {
    console.error('[logoCropMetadata] Failed to remove from localStorage:', error);
  }
}

/**
 * Apply crop to image using CSS transform
 * Returns CSS object for image element
 */
export function getCropStyles(crop: CropMetadata | null): React.CSSProperties {
  if (!crop) {
    return {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
    };
  }

  // Calculate clip-path based on crop coordinates
  // Note: This is a simplified approach, Canvas rendering is more accurate
  return {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    transform: `scale(${crop.zoom}) rotate(${crop.rotation}deg)`,
    transformOrigin: 'center',
    clipPath: `inset(${crop.y}px ${crop.x + crop.width}px ${crop.y + crop.height}px ${crop.x}px)`,
  };
}

/**
 * Validate crop metadata
 */
export function isValidCropMetadata(crop: any): crop is CropMetadata {
  return (
    crop &&
    typeof crop.x === 'number' &&
    typeof crop.y === 'number' &&
    typeof crop.width === 'number' &&
    typeof crop.height === 'number' &&
    typeof crop.zoom === 'number' &&
    typeof crop.rotation === 'number' &&
    typeof crop.aspectRatio === 'number' &&
    typeof crop.createdAt === 'string'
  );
}
