import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CropMetadata } from '../types/teamLogo';
import CroppedLogoImage from './CroppedLogoImage';

const crop: CropMetadata = {
  x: 50,
  y: -25,
  width: 500,
  height: 500,
  zoom: 0.5,
  rotation: 15,
  aspectRatio: 1,
  createdAt: '2026-10-14T00:00:00.000Z',
};

describe('CroppedLogoImage', () => {
  afterEach(cleanup);

  it('keeps the original image element and applies crop metadata with CSS', () => {
    const onImageLoad = vi.fn();
    const { container } = render(
      <CroppedLogoImage
        url="https://example.com/original-logo.png"
        crop={crop}
        alt="Team logo"
        onImageLoad={onImageLoad}
      />,
    );
    const image = screen.getByAltText('Team logo') as HTMLImageElement;
    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 1000 });
    Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 800 });
    fireEvent.load(image);

    const positioner = image.parentElement as HTMLElement;
    expect(container.querySelector('canvas')).toBeNull();
    expect(image.src).toBe('https://example.com/original-logo.png');
    expect(positioner.style.left).toBe('60%');
    expect(positioner.style.top).toBe('45%');
    expect(positioner.style.width).toBe('100%');
    expect(positioner.style.height).toBe('80%');
    expect(image.style.transform).toBe('rotate(15deg)');
    expect(onImageLoad).toHaveBeenCalledWith({ naturalWidth: 1000, naturalHeight: 800 });
  });

  it('preserves image proportions inside a non-square browser frame', () => {
    render(
      <CroppedLogoImage
        url="https://example.com/square-logo.png"
        crop={{ ...crop, x: 0, y: 0, zoom: 0.5, rotation: 0 }}
        frameAspectRatio={2}
        alt="Wide frame logo"
      />,
    );
    const image = screen.getByAltText('Wide frame logo') as HTMLImageElement;
    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 1000 });
    Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 1000 });
    fireEvent.load(image);

    const positioner = image.parentElement as HTMLElement;
    expect(positioner.style.width).toBe('50%');
    expect(positioner.style.height).toBe('100%');
  });
});
