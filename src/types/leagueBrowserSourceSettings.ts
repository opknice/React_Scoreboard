import type { Json } from './supabase';
import {
  normalizeTeamNameBrowserSettings,
  type TeamNameBrowserSettings,
} from './teamNameBrowserSettings';
import {
  normalizeScoreBrowserSettings,
  type ScoreBrowserSettings,
} from './scoreBrowserSettings';

export interface LeagueBrowserSourceSettings {
  teamName: TeamNameBrowserSettings;
  score: ScoreBrowserSettings;
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

  const hasTeamName = teamNameCandidate !== null;
  const hasScore = scoreCandidate !== null;

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
    },
    scope: hasTeamName && hasScore
      ? 'league'
      : hasTeamName || hasScore
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
    },
  } as unknown as Json;
}
