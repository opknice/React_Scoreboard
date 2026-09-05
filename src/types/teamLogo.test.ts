import { describe, expect, it } from 'vitest';
import {
  calculateContainZoom,
  cropMetadataToJson,
  isCropMetadata,
  parseCropMetadata,
} from './teamLogo';

const validCrop = {
  x: 10,
  y: -5,
  width: 500,
  height: 500,
  zoom: 1.2,
  rotation: 15,
  aspectRatio: 1,
  createdAt: '2026-09-04T00:00:00.000Z',
};

describe('teamLogo crop metadata', () => {
  it('calculates a contain zoom for different image aspect ratios', () => {
    expect(calculateContainZoom(1000, 500)).toBe(0.5);
    expect(calculateContainZoom(500, 1000)).toBe(0.5);
    expect(calculateContainZoom(500, 500)).toBe(1);
  });

  it('accepts complete finite crop metadata', () => {
    expect(isCropMetadata(validCrop)).toBe(true);
    expect(parseCropMetadata(validCrop)).toEqual({ ...validCrop, frameScalePercent: 100 });
  });

  it('rejects malformed values before they reach canvas rendering', () => {
    expect(isCropMetadata({ ...validCrop, zoom: Number.NaN })).toBe(false);
    expect(isCropMetadata({ ...validCrop, createdAt: 123 })).toBe(false);
    expect(parseCropMetadata({ invalid: true })).toBeNull();
  });

  it('converts legacy outer customSize to inner zoom and stops persisting it', () => {
    const migrated = parseCropMetadata({ ...validCrop, customSize: 380 });

    expect(migrated).toEqual({ ...validCrop, zoom: 2.4, frameScalePercent: 100 });
    expect(cropMetadataToJson(migrated!)).not.toHaveProperty('customSize');
  });

  it('preserves a valid custom frame scale', () => {
    const parsed = parseCropMetadata({ ...validCrop, frameScalePercent: 135 });

    expect(parsed?.frameScalePercent).toBe(135);
    expect(cropMetadataToJson(parsed!)).toHaveProperty('frameScalePercent', 135);
  });
});
