import { describe, expect, it } from 'vitest';
import {
  PLAYER_IMAGE_MAX_FILE_SIZE_BYTES,
  validatePlayerImageFile,
} from './playerImageStorageService';

describe('player image upload validation', () => {
  it('accepts a file exactly at the 500KB limit', () => {
    const file = new File([new Uint8Array(PLAYER_IMAGE_MAX_FILE_SIZE_BYTES)], 'player.png', { type: 'image/png' });
    expect(() => validatePlayerImageFile(file)).not.toThrow();
  });

  it('rejects a file larger than 500KB or an unsupported type', () => {
    const oversized = new File([new Uint8Array(PLAYER_IMAGE_MAX_FILE_SIZE_BYTES + 1)], 'player.png', { type: 'image/png' });
    const svg = new File(['<svg></svg>'], 'player.svg', { type: 'image/svg+xml' });
    expect(() => validatePlayerImageFile(oversized)).toThrow(/500KB/);
    expect(() => validatePlayerImageFile(svg)).toThrow(/PNG, JPG, WebP และ GIF/);
  });
});
