/**
 * LogoWithCrop Component
 * Renders logo with crop metadata using Canvas API
 */

import { useEffect, useRef, useState } from 'react';
import type { CropMetadata } from '../types/teamLogo';
import { getFrameCanvasSize, getLogoCanvasBackingSize } from '../utils/logoFrame';

interface LogoWithCropProps {
  url: string;
  crop: CropMetadata | null;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Fill a fixed parent frame; disable when className defines the frame size. */
  fillFrame?: boolean;
  frameAspectRatio?: number;
  onError?: () => void;
  onImageLoad?: (dimensions: { naturalWidth: number; naturalHeight: number }) => void;
}

export default function LogoWithCrop({
  url,
  crop,
  alt = 'Logo',
  className,
  style,
  fillFrame = true,
  frameAspectRatio,
  onError,
  onImageLoad,
}: LogoWithCropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const onErrorRef = useRef(onError);
  const onImageLoadRef = useRef(onImageLoad);
  const [imageVersion, setImageVersion] = useState(0);
  const [renderedSize, setRenderedSize] = useState({ width: 0, height: 0, devicePixelRatio: 1 });
  onErrorRef.current = onError;
  onImageLoadRef.current = onImageLoad;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateRenderedSize = () => {
      const rect = canvas.getBoundingClientRect();
      const next = {
        width: Math.max(0, rect.width),
        height: Math.max(0, rect.height),
        devicePixelRatio: Math.max(1, window.devicePixelRatio || 1),
      };
      setRenderedSize((current) => (
        Math.abs(current.width - next.width) < 0.5
        && Math.abs(current.height - next.height) < 0.5
        && current.devicePixelRatio === next.devicePixelRatio
          ? current
          : next
      ));
    };

    updateRenderedSize();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(updateRenderedSize);
    observer.observe(canvas);
    window.addEventListener('resize', updateRenderedSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateRenderedSize);
    };
  }, []);

  useEffect(() => {
    if (!url) return;

    let disposed = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (disposed) return;
      imageRef.current = img;
      onImageLoadRef.current?.({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
      setImageVersion((version) => version + 1);
    };

    img.onerror = () => {
      if (disposed) return;
      imageRef.current = null;
      console.error('[LogoWithCrop] Failed to load image:', url);
      onErrorRef.current?.();
    };

    img.src = url;
    return () => {
      disposed = true;
      if (imageRef.current === img) imageRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    if (!url || !canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = imageRef.current;
    const frameId = window.requestAnimationFrame(() => {
      const { width: targetWidth, height: targetHeight } = getFrameCanvasSize(
        crop?.width || img.naturalWidth || 300,
        crop?.height || img.naturalHeight || 300,
        frameAspectRatio,
      );
      const backingSize = getLogoCanvasBackingSize({
        logicalWidth: targetWidth,
        logicalHeight: targetHeight,
        naturalWidth: img.naturalWidth || targetWidth,
        naturalHeight: img.naturalHeight || targetHeight,
        renderedWidth: renderedSize.width,
        renderedHeight: renderedSize.height,
        devicePixelRatio: renderedSize.devicePixelRatio,
      });

      if (canvas.width !== backingSize.width) canvas.width = backingSize.width;
      if (canvas.height !== backingSize.height) canvas.height = backingSize.height;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, backingSize.width, backingSize.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.setTransform(
        backingSize.width / targetWidth,
        0,
        0,
        backingSize.height / targetHeight,
        0,
        0,
      );

      if (!crop) {
        const naturalWidth = img.naturalWidth || targetWidth;
        const naturalHeight = img.naturalHeight || targetHeight;
        const containScale = Math.min(targetWidth / naturalWidth, targetHeight / naturalHeight);
        const drawWidth = naturalWidth * containScale;
        const drawHeight = naturalHeight * containScale;
        ctx.drawImage(
          img,
          (targetWidth - drawWidth) / 2,
          (targetHeight - drawHeight) / 2,
          drawWidth,
          drawHeight,
        );
        return;
      }

      ctx.save();
      // Translate to canvas center + pan offset X, Y
      ctx.translate(targetWidth / 2 + (crop.x || 0), targetHeight / 2 + (crop.y || 0));

      if (crop.rotation) {
        ctx.rotate((crop.rotation * Math.PI) / 180);
      }

      const zoomScale = crop.zoom !== undefined && crop.zoom !== 0 ? crop.zoom : 0.001;
      ctx.scale(zoomScale, zoomScale);

      // Draw image centered at origin
      const drawW = img.naturalWidth || targetWidth;
      const drawH = img.naturalHeight || targetHeight;
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

      ctx.restore();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [url, crop, imageVersion, frameAspectRatio, renderedSize]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        ...(fillFrame ? { width: '100%', height: '100%' } : {}),
        objectFit: 'contain',
        ...style,
      }}
      aria-label={alt}
    />
  );
}
