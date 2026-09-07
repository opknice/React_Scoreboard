import type { Json } from './supabase';
import {
  normalizeTeamNameBrowserSettings,
  type TeamNameBrowserSettings,
} from './teamNameBrowserSettings';
import {
  normalizeScoreBrowserSettings,
  type ScoreBrowserSettings,
} from './scoreBrowserSettings';
import {
  mergeTeamColorBrowserSettings,
  normalizeTeamColorBrowserSettings,
  type TeamColorBrowserSettings,
} from './teamColorBrowserSettings';

export interface LeagueBrowserSourceSettings {
  teamName: TeamNameBrowserSettings;
  score: ScoreBrowserSettings;
  teamColor: TeamColorBrowserSettings;
}

export type BrowserSourceSettingsScope = 'global' | 'league' | 'mixed';

export interface ResolvedLeagueBrowserSourceSettings {
  settings: LeagueBrowserSourceSettings;
  scope: BrowserSourceSettingsScope;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getBrowserSourcesRecord(settings: unknown): Record<string, unknown> | null {
  if (!isRecord(settings) || !isRecord(settings.browserSources)) return null;
  return settings.browserSources;
}

/** Resolve missing league groups and fields from the device-wide global settings. */
export function resolveLeagueBrowserSourceSettings(
  settings: unknown,
  globalSettings: LeagueBrowserSourceSettings,
): ResolvedLeagueBrowserSourceSettings {
  const browserSources = getBrowserSourcesRecord(settings);
  const teamNameCandidate = browserSources && isRecord(browserSources.teamName)
    ? browserSources.teamName
    : null;
  const scoreCandidate = browserSources && isRecord(browserSources.score)
    ? browserSources.score
    : null;
  const teamColorCandidate = browserSources && isRecord(browserSources.teamColor)
    ? browserSources.teamColor
    : null;

  const hasTeamName = teamNameCandidate !== null;
  const hasScore = scoreCandidate !== null;
  const hasTeamColor = teamColorCandidate !== null;

  return {
    settings: {
      teamName: normalizeTeamNameBrowserSettings({
        ...globalSettings.teamName,
        ...(teamNameCandidate ?? {}),
      }),
      score: normalizeScoreBrowserSettings({
        ...globalSettings.score,
        ...(scoreCandidate ?? {}),
      }),
      // Team-color settings contain nested appearance/position objects, so
      // merge them deeply before normalizing to preserve partial overrides.
      teamColor: mergeTeamColorBrowserSettings(globalSettings.teamColor, teamColorCandidate),
    },
    scope: hasTeamName && hasScore && hasTeamColor
      ? 'league'
      : hasTeamName || hasScore || hasTeamColor
        ? 'mixed'
        : 'global',
  };
}

/** Replace only browserSources while preserving every unrelated league setting. */
export function mergeLeagueBrowserSourceSettings(
  settings: Json | null | undefined,
  browserSourceSettings: LeagueBrowserSourceSettings,
): Json {
  const root = isRecord(settings) ? settings : {};
  const currentBrowserSources = isRecord(root.browserSources) ? root.browserSources : {};

  return {
    ...root,
    browserSources: {
      ...currentBrowserSources,
      teamName: normalizeTeamNameBrowserSettings(browserSourceSettings.teamName),
      score: normalizeScoreBrowserSettings(browserSourceSettings.score),
      teamColor: normalizeTeamColorBrowserSettings(browserSourceSettings.teamColor),
    },
  } as unknown as Json;
}
