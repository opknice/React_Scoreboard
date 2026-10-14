import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CropMetadata } from '../types/teamLogo';
import LogoWithCrop from './LogoWithCrop';

class TestImage {
  crossOrigin = '';
  naturalWidth = 960;
  naturalHeight = 960;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private source = '';

  set src(value: string) {
    this.source = value;
    queueMicrotask(() => this.onload?.());
  }

  get src() {
    return this.source;
  }
}

const crop: CropMetadata = {
  x: 0,
  y: 0,
  width: 500,
  height: 500,
  zoom: 0.5208,
  rotation: 0,
  aspectRatio: 1,
  createdAt: '2026-10-14T00:00:00.000Z',
};

describe('LogoWithCrop high-resolution rendering', () => {
  const context = {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    restore: vi.fn(),
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low' as ImageSmoothingQuality,
  };

  beforeEach(() => {
    vi.stubGlobal('Image', TestImage);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 190,
      height: 190,
      top: 0,
      right: 190,
      bottom: 190,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    context.imageSmoothingEnabled = false;
    context.imageSmoothingQuality = 'low';
  });

  it('retains the natural bitmap resolution when crop coordinates use a smaller logical canvas', async () => {
    render(<LogoWithCrop url="https://example.com/logo.png" crop={crop} alt="Team logo" />);
    const canvas = screen.getByLabelText('Team logo') as HTMLCanvasElement;

    await waitFor(() => expect(canvas.width).toBe(960));
    expect(canvas.height).toBe(960);
    expect(context.imageSmoothingEnabled).toBe(true);
    expect(context.imageSmoothingQuality).toBe('high');
    expect(context.setTransform).toHaveBeenLastCalledWith(1.92, 0, 0, 1.92, 0, 0);
  });

});
