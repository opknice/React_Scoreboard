import {
  DEFAULT_LOGO_BROWSER_SETTINGS,
  normalizeLogoBackgroundMode,
  normalizeLogoSize,
  type LogoBackgroundMode,
  type LogoBrowserSettings,
} from '../types/logoBrowserSettings';

export type LogoBrowserSide = 'A' | 'B' | 'both';

export interface LogoPresentation {
  size: number;
  backgroundMode: LogoBackgroundMode;
}

function getParamValue(search: string | URLSearchParams, key: string): string | null {
  return typeof search === 'string' ? new URLSearchParams(search).get(key) : search.get(key);
}

export function getLogoPresentation(
  search: string | URLSearchParams,
  _side: 'A' | 'B',
): LogoPresentation {
  return {
    size: normalizeLogoSize(getParamValue(search, 'size')),
    backgroundMode: normalizeLogoBackgroundMode(getParamValue(search, 'background')),
  };
}

/** Builds the persistent Logo Browser Source URL for OBS. */
export function buildLogoBrowserUrl(
  appBaseUrl: string,
  side: LogoBrowserSide,
  settings?: LogoBrowserSettings,
): string {
  const params: Record<string, string> = {
    template: 'team-logos',
    side,
  };

  if (settings) {
    const size = side === 'A'
      ? settings.sizeA
      : side === 'B'
        ? settings.sizeB
        : Math.max(settings.sizeA, settings.sizeB);
    params.size = String(normalizeLogoSize(size));
    params.background = normalizeLogoBackgroundMode(settings.backgroundMode);
  } else {
    // Keep manually-created legacy URLs compatible with the default presentation.
    params.size = String(DEFAULT_LOGO_BROWSER_SETTINGS.sizeA);
    params.background = DEFAULT_LOGO_BROWSER_SETTINGS.backgroundMode;
  }

  return `${appBaseUrl.replace(/\/$/, '')}/goal-animation?${new URLSearchParams(params).toString()}`;
}
