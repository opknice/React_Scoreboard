import { describe, expect, it } from 'vitest';
import { getFrameCanvasSize, resizeLogoFrame } from './logoFrame';

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
});
