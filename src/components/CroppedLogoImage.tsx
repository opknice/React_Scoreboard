import { useMemo, useState, type CSSProperties, type SyntheticEvent } from 'react';
import type { CropMetadata } from '../types/teamLogo';
import { getFrameCanvasSize } from '../utils/logoFrame';

interface CroppedLogoImageProps {
  url: string;
  crop: CropMetadata;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  /** Fill a fixed parent frame; disable when className defines the frame size. */
  fillFrame?: boolean;
  frameAspectRatio?: number;
  onError?: () => void;
  onImageLoad?: (dimensions: { naturalWidth: number; naturalHeight: number }) => void;
}

/**
 * Crops a logo with native DOM layout instead of rasterizing it into a canvas.
 * OBS/Chromium therefore keeps the original decoded image available when a CSS
 * animation scales the logo, rather than enlarging an already flattened bitmap.
 */
export default function CroppedLogoImage({
  url,
  crop,
  alt = 'Logo',
  className,
  style,
  fillFrame = true,
  frameAspectRatio,
  onError,
  onImageLoad,
}: CroppedLogoImageProps) {
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const frameSize = useMemo(() => getFrameCanvasSize(
    crop.width,
    crop.height,
    frameAspectRatio,
  ), [crop.height, crop.width, frameAspectRatio]);

  const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    setNaturalSize((current) => (
      current.width === naturalWidth && current.height === naturalHeight
        ? current
        : { width: naturalWidth, height: naturalHeight }
    ));
    onImageLoad?.({ naturalWidth, naturalHeight });
  };

  const hasNaturalSize = naturalSize.width > 0 && naturalSize.height > 0;
  const imageWidthPercent = hasNaturalSize
    ? (naturalSize.width * crop.zoom / frameSize.width) * 100
    : 100;
  const imageHeightPercent = hasNaturalSize
    ? (naturalSize.height * crop.zoom / frameSize.height) * 100
    : 100;
  const leftPercent = 50 + (crop.x / frameSize.width) * 100;
  const topPercent = 50 + (crop.y / frameSize.height) * 100;

  return (
    <span
      className={className}
      style={{
        ...(fillFrame ? { width: '100%', height: '100%' } : {}),
        ...style,
        position: 'relative',
        display: 'block',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: `${leftPercent}%`,
          top: `${topPercent}%`,
          width: `${imageWidthPercent}%`,
          height: `${imageHeightPercent}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <img
          src={url}
          alt={alt}
          draggable={false}
          decoding="async"
          onLoad={handleLoad}
          onError={onError}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            maxWidth: 'none',
            maxHeight: 'none',
            objectFit: hasNaturalSize ? 'fill' : 'contain',
            transform: `rotate(${crop.rotation || 0}deg)`,
            transformOrigin: 'center center',
            imageRendering: 'auto',
            userSelect: 'none',
          }}
        />
      </span>
    </span>
  );
}
