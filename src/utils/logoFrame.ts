import type { CropMetadata } from '../types/teamLogo';

export type BrowserFrame = NonNullable<CropMetadata['browserFrame']>;

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
