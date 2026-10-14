import type { CropMetadata } from '../types/teamLogo';

export type BrowserFrame = NonNullable<CropMetadata['browserFrame']>;

const MAX_LOGO_CANVAS_EDGE = 8192;
const MAX_LOGO_CANVAS_PIXELS = 16 * 1024 * 1024;

interface LogoCanvasBackingSizeOptions {
  logicalWidth: number;
  logicalHeight: number;
  naturalWidth: number;
  naturalHeight: number;
  renderedWidth?: number;
  renderedHeight?: number;
  devicePixelRatio?: number;
  /** Largest CSS transform scale that the rendered canvas must remain sharp at. */
  displayScale?: number;
}

export function resizeLogoFrame(frame: BrowserFrame, axis: 'width' | 'height', value: number): BrowserFrame {
  if (!Number.isFinite(value)) return frame;
  const size = Math.min(570, Math.max(48, value));
  if (!frame.lockAspectRatio) return { ...frame, [axis]: Math.round(size) };
  // Clamp both dimensions together so reaching a limit does not distort the ratio.
  const factor = Math.min(570 / frame.width, 570 / frame.height,
    Math.max(48 / frame.width, 48 / frame.height, size / frame[axis]));
  return { ...frame, width: Math.round(frame.width * factor), height: Math.round(frame.height * factor) };
}

export function getFrameCanvasSize(width: number, height: number, ratio?: number) {
  return ratio && ratio > 0
    ? { width: Math.round(Math.max(width, height * ratio)), height: Math.round(Math.max(height, width / ratio)) }
    : { width, height };
}

/**
 * Keeps crop coordinates in their stable logical space while allocating enough
 * backing pixels to avoid downsampling the source before the browser displays it.
 */
export function getLogoCanvasBackingSize({
  logicalWidth,
  logicalHeight,
  naturalWidth,
  naturalHeight,
  renderedWidth = 0,
  renderedHeight = 0,
  devicePixelRatio = 1,
  displayScale = 1,
}: LogoCanvasBackingSizeOptions) {
  const safeLogicalWidth = Math.max(1, logicalWidth);
  const safeLogicalHeight = Math.max(1, logicalHeight);
  const safeDpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const safeDisplayScale = Number.isFinite(displayScale)
    ? Math.min(8, Math.max(1, displayScale))
    : 1;
  const requestedScale = Math.max(
    1,
    naturalWidth / safeLogicalWidth,
    naturalHeight / safeLogicalHeight,
    (renderedWidth * safeDpr * safeDisplayScale) / safeLogicalWidth,
    (renderedHeight * safeDpr * safeDisplayScale) / safeLogicalHeight,
  );
  const requestedWidth = safeLogicalWidth * requestedScale;
  const requestedHeight = safeLogicalHeight * requestedScale;
  const limitScale = Math.min(
    1,
    MAX_LOGO_CANVAS_EDGE / requestedWidth,
    MAX_LOGO_CANVAS_EDGE / requestedHeight,
    Math.sqrt(MAX_LOGO_CANVAS_PIXELS / (requestedWidth * requestedHeight)),
  );

  return {
    width: Math.max(1, Math.round(requestedWidth * limitScale)),
    height: Math.max(1, Math.round(requestedHeight * limitScale)),
  };
}
