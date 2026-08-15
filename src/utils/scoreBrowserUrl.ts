import {
  DEFAULT_SCORE_BROWSER_SETTINGS,
  normalizeScoreFontFamily,
  normalizeScoreFontMode,
  normalizeScoreFontSize,
  type ScoreBrowserSettings,
  type ScoreFontFamily,
  type ScoreFontMode,
} from '../types/scoreBrowserSettings';
import { normalizeFontWeight, type FontWeight } from '../types/teamNameBrowserSettings';

export interface ScorePresentation {
  fontFamily: ScoreFontFamily;
  fontWeight: FontWeight;
  fontMode: ScoreFontMode;
  fontSize: number;
}

function getParam(search: string | URLSearchParams, key: string): string | null {
  return typeof search === 'string' ? new URLSearchParams(search).get(key) : search.get(key);
}

export function getScorePresentation(
  search: string | URLSearchParams,
  side: 'A' | 'B',
): ScorePresentation {
  const sideKey = side === 'A' ? 'A' : 'B';
  return {
    fontFamily: normalizeScoreFontFamily(getParam(search, 'font')),
    fontWeight: normalizeFontWeight(
      getParam(search, 'fontWeight') ?? getParam(search, `fontWeight${sideKey}`),
    ),
    fontMode: normalizeScoreFontMode(
      getParam(search, 'fontMode') ?? getParam(search, `fontMode${sideKey}`),
    ),
    fontSize: normalizeScoreFontSize(
      getParam(search, 'fontSize') ?? getParam(search, `fontSize${sideKey}`),
      side === 'A' ? DEFAULT_SCORE_BROWSER_SETTINGS.fontSizeA : DEFAULT_SCORE_BROWSER_SETTINGS.fontSizeB,
    ),
  };
}

export function buildScoreBrowserUrl(
  appBaseUrl: string,
  side: 'A' | 'B' | 'both',
  settings: ScoreBrowserSettings,
): string {
  const params: Record<string, string> = {
    template: 'score-only',
    mode: 'number',
    side,
    font: settings.fontFamily,
  };

  if (side === 'both') {
    params.fontModeA = settings.fontModeA;
    params.fontModeB = settings.fontModeB;
    params.fontWeightA = String(settings.fontWeightA);
    params.fontWeightB = String(settings.fontWeightB);
    params.fontSizeA = String(settings.fontSizeA);
    params.fontSizeB = String(settings.fontSizeB);
  } else {
    params.fontMode = side === 'A' ? settings.fontModeA : settings.fontModeB;
    params.fontWeight = String(side === 'A' ? settings.fontWeightA : settings.fontWeightB);
    params.fontSize = String(side === 'A' ? settings.fontSizeA : settings.fontSizeB);
  }

  const searchParams = new URLSearchParams(params);
  return `${appBaseUrl.replace(/\/$/, '')}/goal-animation?${searchParams.toString()}`;
}
