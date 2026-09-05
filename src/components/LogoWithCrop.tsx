/**
 * LogoWithCrop Component
 * Renders logo with crop metadata using Canvas API
 */

import { useEffect, useRef, useState } from 'react';
import type { CropMetadata } from '../types/teamLogo';

interface LogoWithCropProps {
  url: string;
  crop: CropMetadata | null;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Fill a fixed parent frame; disable when className defines the frame size. */
  fillFrame?: boolean;
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
  onError,
  onImageLoad,
}: LogoWithCropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const onErrorRef = useRef(onError);
  const onImageLoadRef = useRef(onImageLoad);
  const [imageVersion, setImageVersion] = useState(0);
  onErrorRef.current = onError;
  onImageLoadRef.current = onImageLoad;

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
      const targetWidth = crop?.width && crop.width > 0 ? crop.width : img.naturalWidth || 300;
      const targetHeight = crop?.height && crop.height > 0 ? crop.height : img.naturalHeight || 300;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx.clearRect(0, 0, targetWidth, targetHeight);

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
  }, [url, crop, imageVersion]);

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
