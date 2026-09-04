import { useCallback, useEffect, useState } from 'react';
import type { CropMetadata } from '../types/teamLogo';
import LogoWithCrop from './LogoWithCrop';

interface OverlayLogoProps {
  src: string;
  fallbackSrc: string;
  alt: string;
  className: string;
  crop?: CropMetadata | null;
}

/** Shared logo renderer for OBS pages, including Supabase crop metadata and fallback handling. */
export default function OverlayLogo({ src, fallbackSrc, alt, className, crop }: OverlayLogoProps) {
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

  if (crop && currentSrc === src) {
    return (
      <LogoWithCrop
        url={currentSrc}
        crop={crop}
        alt={alt}
        className={className}
        onError={handleError}
      />
    );
  }

  return (
    <img
      className={className}
      src={currentSrc}
      alt={alt}
      onError={handleError}
    />
  );
}
