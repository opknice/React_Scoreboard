/**
 * LogoWithCrop Component
 * Renders logo with crop metadata using Canvas API
 */

import { useEffect, useRef } from 'react';
import type { CropMetadata } from '../utils/logoCropMetadata';

interface LogoWithCropProps {
  url: string;
  crop: CropMetadata | null;
  alt?: string;
  style?: React.CSSProperties;
  onError?: () => void;
}

export default function LogoWithCrop({
  url,
  crop,
  alt = 'Logo',
  style,
  onError,
}: LogoWithCropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!url || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const targetWidth = crop?.width && crop.width > 0 ? crop.width : img.naturalWidth || 300;
      const targetHeight = crop?.height && crop.height > 0 ? crop.height : img.naturalHeight || 300;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx.clearRect(0, 0, targetWidth, targetHeight);

      if (!crop) {
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
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
    };

    img.onerror = () => {
      console.error('[LogoWithCrop] Failed to load image:', url);
      onError?.();
    };

    img.src = url;
  }, [url, crop, onError]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        ...style,
      }}
      aria-label={alt}
    />
  );
}

