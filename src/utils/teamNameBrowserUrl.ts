import {
  DEFAULT_TEAM_NAME_BROWSER_SETTINGS,
  normalizeFontWeight,
  normalizeTeamNameFontFamily,
  normalizeTeamNameFontMode,
  normalizeTeamNameFontSize,
  normalizeTeamNameTextColor,
  type FontWeight,
  type TeamNameBrowserSettings,
  type TeamNameFontFamily,
  type TeamNameFontMode,
} from '../types/teamNameBrowserSettings';

export interface TeamNamePresentation {
  fontFamily: TeamNameFontFamily;
  textColor: string;
  fontWeight: FontWeight;
  fontMode: TeamNameFontMode;
  fontSize: number;
}

function getParamValue(search: string | URLSearchParams, key: string): string | null {
  return typeof search === 'string' ? new URLSearchParams(search).get(key) : search.get(key);
}

export function getTeamNamePresentation(
  search: string | URLSearchParams,
  side: 'A' | 'B',
): TeamNamePresentation {
  return {
    fontFamily: normalizeTeamNameFontFamily(getParamValue(search, 'font')),
    textColor: normalizeTeamNameTextColor(getParamValue(search, 'color')),
    fontWeight: normalizeFontWeight(getParamValue(search, 'fontWeight')),
    fontMode: normalizeTeamNameFontMode(getParamValue(search, 'fontMode')),
    fontSize: normalizeTeamNameFontSize(
      getParamValue(search, 'fontSize'),
      side === 'A' ? DEFAULT_TEAM_NAME_BROWSER_SETTINGS.fontSizeA : DEFAULT_TEAM_NAME_BROWSER_SETTINGS.fontSizeB,
    ),
  };
}

export function buildTeamNameBrowserUrl(
  appBaseUrl: string,
  side: 'A' | 'B',
  settings: TeamNameBrowserSettings,
): string {
  const params = new URLSearchParams({
    template: 'team-names',
    side,
    font: settings.fontFamily,
    color: side === 'A' ? settings.textColorA : settings.textColorB,
    fontWeight: String(side === 'A' ? settings.fontWeightA : settings.fontWeightB),
    fontMode: side === 'A' ? settings.fontModeA : settings.fontModeB,
    fontSize: String(side === 'A' ? settings.fontSizeA : settings.fontSizeB),
  });
  return `${appBaseUrl.replace(/\/$/, '')}/goal-animation?${params.toString()}`;
}
