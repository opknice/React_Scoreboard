import { describe, expect, it } from 'vitest';
import { getFrameCanvasSize, getLogoCanvasBackingSize, resizeLogoFrame } from './logoFrame';

describe('browser logo frame', () => {
  it('resizes either axis while preserving the current ratio', () => {
    const frame = { width: 200, height: 100, lockAspectRatio: true };
    expect(resizeLogoFrame(frame, 'height', 150)).toEqual({ ...frame, width: 300, height: 150 });
    expect(resizeLogoFrame(frame, 'height', 570)).toEqual({ ...frame, width: 570, height: 285 });
    expect(resizeLogoFrame(frame, 'width', 48)).toEqual({ ...frame, width: 96, height: 48 });
  });
  it('allows independent dimensions and rejects nonfinite input', () => {
    const frame = { width: 200, height: 100, lockAspectRatio: false };
    expect(resizeLogoFrame(frame, 'height', 900)).toEqual({ ...frame, height: 570 });
    expect(resizeLogoFrame(frame, 'width', NaN)).toEqual(frame);
  });
  it('expands canvas space without stretching or changing legacy canvas dimensions', () => {
    expect(getFrameCanvasSize(500, 500, 2)).toEqual({ width: 1000, height: 500 });
    expect(getFrameCanvasSize(500, 500, 0.5)).toEqual({ width: 500, height: 1000 });
    expect(getFrameCanvasSize(600, 400)).toEqual({ width: 600, height: 400 });
  });

  it('keeps the source resolution after crop metadata activates the logical canvas', () => {
    expect(getLogoCanvasBackingSize({
      logicalWidth: 500,
      logicalHeight: 500,
      naturalWidth: 960,
      naturalHeight: 960,
    })).toEqual({ width: 960, height: 960 });
    expect(getLogoCanvasBackingSize({
      logicalWidth: 1000,
      logicalHeight: 500,
      naturalWidth: 960,
      naturalHeight: 960,
    })).toEqual({ width: 1920, height: 960 });
  });

  it('covers high-DPI display pixels without unbounded canvas allocation', () => {
    expect(getLogoCanvasBackingSize({
      logicalWidth: 500,
      logicalHeight: 500,
      naturalWidth: 300,
      naturalHeight: 300,
      renderedWidth: 570,
      renderedHeight: 570,
      devicePixelRatio: 2,
    })).toEqual({ width: 1140, height: 1140 });
    expect(getLogoCanvasBackingSize({
      logicalWidth: 500,
      logicalHeight: 500,
      naturalWidth: 12000,
      naturalHeight: 12000,
    })).toEqual({ width: 4096, height: 4096 });
  });

});
