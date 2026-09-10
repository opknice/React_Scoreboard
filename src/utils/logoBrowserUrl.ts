import { browserPositionParams, normalizeBrowserPositions, readBrowserPosition, LOGO_POSITIONS, type BrowserPosition } from '../types/browserPositions';
import {
  DEFAULT_LOGO_BROWSER_SETTINGS,
  LOGO_DEFAULT_SIZE,
  normalizeLogoBackgroundMode,
  type LogoBackgroundMode,
  type LogoBrowserSettings,
} from '../types/logoBrowserSettings';

export type LogoBrowserSide = 'A' | 'B' | 'both';

export interface LogoPresentation {
  position: BrowserPosition;
  size: number;
  backgroundMode: LogoBackgroundMode;
}

function getParamValue(search: string | URLSearchParams, key: string): string | null {
  return typeof search === 'string' ? new URLSearchParams(search).get(key) : search.get(key);
}

export function getLogoPresentation(
  search: string | URLSearchParams,
  side: 'A' | 'B',
): LogoPresentation {
  void side;
  return {
    position: readBrowserPosition(search, side, LOGO_POSITIONS),
    // Ignore legacy size query parameters so every Browser Source keeps the
    // same predictable layout footprint.
    size: LOGO_DEFAULT_SIZE,
    backgroundMode: normalizeLogoBackgroundMode(getParamValue(search, 'background')),
  };
}

/** Builds the persistent Logo Browser Source URL for OBS. */
export function buildLogoBrowserUrl(
  appBaseUrl: string,
  side: LogoBrowserSide,
  settings?: LogoBrowserSettings,
  syncSessionId?: string,
  leagueId?: string,
): string {
  const params: Record<string, string> = {
    template: 'team-logos',
    ...browserPositionParams(normalizeBrowserPositions(settings?.positions, LOGO_POSITIONS)),
    side,
  };

  if (settings) {
    params.sizeA = String(LOGO_DEFAULT_SIZE);
    params.sizeB = String(LOGO_DEFAULT_SIZE);
    params.size = String(LOGO_DEFAULT_SIZE);
    params.background = normalizeLogoBackgroundMode(settings.backgroundMode);
  } else {
    // Keep manually-created legacy URLs compatible with the default presentation.
    params.sizeA = String(LOGO_DEFAULT_SIZE);
    params.sizeB = String(LOGO_DEFAULT_SIZE);
    params.size = String(LOGO_DEFAULT_SIZE);
    params.background = DEFAULT_LOGO_BROWSER_SETTINGS.backgroundMode;
  }

  if (syncSessionId) params.sync = syncSessionId;
  if (leagueId) params.league = leagueId;

  return `${appBaseUrl.replace(/\/$/, '')}/goal-animation?${new URLSearchParams(params).toString()}`;
}
