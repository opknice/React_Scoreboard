import type { Json } from './supabase';
import { normalizeBrowserPositions } from './browserPositions';
import {
  mergeLogoBrowserSettings,
  normalizeLogoBrowserSettings,
  type LogoBrowserSettings,
} from './logoBrowserSettings';
import {
  mergePlayerBrowserSettings,
  normalizePlayerBrowserSettings,
  type PlayerBrowserSettings,
} from './playerBrowserSettings';
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
  logo: LogoBrowserSettings;
  player: PlayerBrowserSettings;
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
  const logoCandidate = browserSources && isRecord(browserSources.logo)
    ? browserSources.logo
    : null;
  const playerCandidate = browserSources && isRecord(browserSources.player)
    ? browserSources.player
    : null;

  const hasTeamName = teamNameCandidate !== null;
  const hasScore = scoreCandidate !== null;
  const hasTeamColor = teamColorCandidate !== null;
  const hasLogo = logoCandidate !== null;
  const hasPlayer = playerCandidate !== null;

  return {
    settings: {
      teamName: normalizeTeamNameBrowserSettings({
        ...globalSettings.teamName,
        ...(teamNameCandidate ?? {}),
        positions: normalizeBrowserPositions(teamNameCandidate?.positions, globalSettings.teamName.positions),
      }),
      score: normalizeScoreBrowserSettings({
        ...globalSettings.score,
        ...(scoreCandidate ?? {}),
        positions: normalizeBrowserPositions(scoreCandidate?.positions, globalSettings.score.positions),
      }),
      // Team-color settings contain nested appearance/position objects, so
      // merge them deeply before normalizing to preserve partial overrides.
      teamColor: mergeTeamColorBrowserSettings(globalSettings.teamColor, teamColorCandidate),
      logo: mergeLogoBrowserSettings(globalSettings.logo, logoCandidate),
      player: mergePlayerBrowserSettings(globalSettings.player, playerCandidate),
    },
    scope: hasTeamName && hasScore && hasTeamColor && hasLogo && hasPlayer
      ? 'league'
      : hasTeamName || hasScore || hasTeamColor || hasLogo || hasPlayer
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
      logo: normalizeLogoBrowserSettings(browserSourceSettings.logo),
      player: normalizePlayerBrowserSettings(browserSourceSettings.player),
    },
  } as unknown as Json;
}
