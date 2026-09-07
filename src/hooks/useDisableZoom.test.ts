import { describe, expect, it } from 'vitest';
import { calculateZoomLockCompensation } from './useDisableZoom';

describe('calculateZoomLockCompensation', () => {
  it('keeps the viewport unchanged at 100% zoom', () => {
    expect(calculateZoomLockCompensation({
      innerWidth: 1920,
      innerHeight: 1080,
      initialDpr: 1,
      currentDpr: 1,
    })).toEqual({
      cssZoom: 1,
      viewportWidth: 1920,
      viewportHeight: 1080,
    });
  });

  it('restores the logical viewport when the browser applies 125% page zoom', () => {
    expect(calculateZoomLockCompensation({
      innerWidth: 1536,
      innerHeight: 864,
      initialDpr: 1,
      currentDpr: 1.25,
    })).toEqual({
      cssZoom: 0.8,
      viewportWidth: 1920,
      viewportHeight: 1080,
    });
  });

  it('restores the logical viewport when the browser applies 80% page zoom', () => {
    expect(calculateZoomLockCompensation({
      innerWidth: 2400,
      innerHeight: 1350,
      initialDpr: 1,
      currentDpr: 0.8,
    })).toEqual({
      cssZoom: 1.25,
      viewportWidth: 1920,
      viewportHeight: 1080,
    });
  });
});
