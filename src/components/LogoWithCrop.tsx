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
      if (!crop) {
        // No crop metadata - render original image
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        return;
      }

      // Set canvas size to crop dimensions
      canvas.width = crop.width;
      canvas.height = crop.height;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Save context state
      ctx.save();

      // Apply transformations
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((crop.rotation * Math.PI) / 180);
      ctx.scale(crop.zoom, crop.zoom);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);

      // Draw cropped portion of image
      ctx.drawImage(
        img,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
      );

      // Restore context state
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
