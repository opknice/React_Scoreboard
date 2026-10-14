import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { CropMetadata } from '../types/teamLogo';
import { normalizeLogoScalePercent, scaleLogoPixels } from '../types/leagueLogoSizing';
import CroppedLogoImage from './CroppedLogoImage';

interface OverlayLogoProps {
  src: string;
  fallbackSrc: string;
  alt: string;
  className: string;
  crop?: CropMetadata | null;
  scalePercent?: number;
}

/** Shared logo renderer for OBS pages, including Supabase crop metadata and fallback handling. */
export default function OverlayLogo({ src, fallbackSrc, alt, className, crop, scalePercent = 100 }: OverlayLogoProps) {
  const [currentSrc, setCurrentSrc] = useState<string>(src);
  const [hasFailed, setHasFailed] = useState<boolean>(false);

  useEffect(() => {
    setCurrentSrc(src);
    setHasFailed(false);
  }, [src]);

  const handleError = useCallback(() => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      return;
    }
    setHasFailed(true);
  }, [currentSrc, fallbackSrc]);

  if (!currentSrc || hasFailed) return null;
  const baseSizePx = className.includes('overlay-logo-small')
    ? 70
    : className.includes('combined-logo')
      ? 32
      : 64;
  const mobileBaseSizePx = className.includes('combined-logo') ? 20 : baseSizePx;
  const normalizedScale = normalizeLogoScalePercent(scalePercent);
  const scaleStyle = {
    '--logo-frame-size': `${scaleLogoPixels(baseSizePx, normalizedScale)}px`,
    '--logo-frame-mobile-size': `${scaleLogoPixels(mobileBaseSizePx, normalizedScale)}px`,
  } as CSSProperties;

  if (crop && currentSrc === src) {
    return (
      <CroppedLogoImage
        url={currentSrc}
        crop={crop}
        alt={alt}
        className={className}
        style={scaleStyle}
        fillFrame={false}
        onError={handleError}
      />
    );
  }

  return (
    <img
      className={className}
      style={scaleStyle}
      src={currentSrc}
      alt={alt}
      onError={handleError}
    />
  );
}
