import { describe, expect, it } from 'vitest';
import {
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
  it('accepts complete finite crop metadata', () => {
    expect(isCropMetadata(validCrop)).toBe(true);
    expect(parseCropMetadata(validCrop)).toEqual(validCrop);
  });

  it('rejects malformed values before they reach canvas rendering', () => {
    expect(isCropMetadata({ ...validCrop, zoom: Number.NaN })).toBe(false);
    expect(isCropMetadata({ ...validCrop, createdAt: 123 })).toBe(false);
    expect(parseCropMetadata({ invalid: true })).toBeNull();
  });
});
