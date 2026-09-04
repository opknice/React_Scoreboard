import { describe, expect, it } from 'vitest';
import {
  getLegacyCropRecord,
  isCropMetadata,
  parseCropMetadata,
  removeLegacyCropRecord,
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

  it('reads and removes only the legacy record selected for migration', () => {
    localStorage.setItem('teamLogoCrops', JSON.stringify({
      teamalpha: { originalUrl: 'https://example.com/alpha.png', crop: validCrop },
      teambeta: { originalUrl: 'https://example.com/beta.png', crop: validCrop },
    }));

    expect(getLegacyCropRecord('Team Alpha')).toEqual({
      originalUrl: 'https://example.com/alpha.png',
      crop: validCrop,
    });

    removeLegacyCropRecord('Team Alpha');

    expect(getLegacyCropRecord('Team Alpha')).toBeNull();
    expect(getLegacyCropRecord('Team Beta')?.originalUrl).toBe('https://example.com/beta.png');
  });
});
