import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LeagueService } from '../services/leagueService';
import { isScoreboardStateEvent, isTeamColorSettingsUpdatedEvent, SCOREBOARD_EVENT_CHANNEL, SCOREBOARD_STATE_STORAGE_KEY, type ScoreboardStateEvent } from '../types/scoreboardEvent';
import {
  DEFAULT_TEAM_COLOR_BROWSER_SETTINGS,
  TEAM_COLOR_SETTINGS_STORAGE_KEY,
  mergeTeamColorBrowserSettings,
  normalizeTeamColorBrowserSettings,
} from '../types/teamColorBrowserSettings';
import { requestScoreboardState } from '../hooks/useScoreboardChannels';
import { useDisableZoom } from '../hooks/useDisableZoom';
import TeamColorPreview, { type TeamColorValues } from './TeamColorPreview';
import './TeamColorBrowserSource.css';

type DisplaySide = 'A' | 'B' | 'both';

const DEFAULT_COLORS: { A: TeamColorValues; B: TeamColorValues } = {
  A: { primary: '#ffffff', secondary: '#000000' },
  B: { primary: '#ffffff', secondary: '#000000' },
};

function readGlobalSettings() {
  try {
    const saved = localStorage.getItem(TEAM_COLOR_SETTINGS_STORAGE_KEY);
    return saved
      ? normalizeTeamColorBrowserSettings(JSON.parse(saved))
      : normalizeTeamColorBrowserSettings(DEFAULT_TEAM_COLOR_BROWSER_SETTINGS);
  } catch {
    return normalizeTeamColorBrowserSettings(DEFAULT_TEAM_COLOR_BROWSER_SETTINGS);
  }
}

function readInitialColors(): { A: TeamColorValues; B: TeamColorValues } {
  try {
    const saved = localStorage.getItem(SCOREBOARD_STATE_STORAGE_KEY);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (isScoreboardStateEvent(parsed)) return colorsFromState(parsed);
    }
  } catch {
    // Fall back to neutral colors when localStorage is unavailable.
  }
  return DEFAULT_COLORS;
}

function colorsFromState(event: ScoreboardStateEvent) {
  return {
    A: { primary: event.colorA1, secondary: event.colorA2 },
    B: { primary: event.colorB1, secondary: event.colorB2 },
  };
}

function readSide(value: string | null): DisplaySide {
  return value === 'A' || value === 'B' || value === 'both' ? value : 'both';
}

export default function TeamColorBrowserSource() {
  useDisableZoom();
  const [searchParams] = useSearchParams();
  const leagueId = searchParams.get('league')?.trim() || '';
  const side = readSide(searchParams.get('side'));
  const [settings, setSettings] = useState(readGlobalSettings);
  const [colors, setColors] = useState(readInitialColors);

  useEffect(() => {
    let cancelled = false;
    const loadLeagueSettings = async () => {
      if (!leagueId) {
        setSettings(readGlobalSettings());
        return;
      }

      try {
        const league = await LeagueService.getLeagueById(leagueId);
        if (cancelled) return;
        const globalSettings = readGlobalSettings();
        const rawSettings = league?.settings;
        const rawBrowserSources = rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)
          ? (rawSettings as Record<string, unknown>).browserSources
          : null;
        const rawTeamColor = rawBrowserSources && typeof rawBrowserSources === 'object' && !Array.isArray(rawBrowserSources)
          ? (rawBrowserSources as Record<string, unknown>).teamColor
          : null;
        setSettings(mergeTeamColorBrowserSettings(globalSettings, rawTeamColor));
      } catch {
        if (!cancelled) setSettings(readGlobalSettings());
      }
    };

    void loadLeagueSettings();
    return () => { cancelled = true; };
  }, [leagueId]);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (isScoreboardStateEvent(event.data)) {
        setColors(colorsFromState(event.data));
        return;
      }
      if (isTeamColorSettingsUpdatedEvent(event.data)) {
        const eventLeagueId = event.data.leagueId || '';
        if (eventLeagueId === leagueId) setSettings(normalizeTeamColorBrowserSettings(event.data.settings));
      }
    };

    try {
      channel = new BroadcastChannel(SCOREBOARD_EVENT_CHANNEL);
      channel.addEventListener('message', handleMessage);
      requestScoreboardState();
    } catch {
      // localStorage state remains available when BroadcastChannel is blocked.
    }

    return () => {
      channel?.removeEventListener('message', handleMessage);
      channel?.close();
    };
  }, [leagueId]);

  return (
    <main className="team-color-source-root" aria-label="Team color browser source">
      <TeamColorPreview settings={settings} colors={colors} side={side} className="team-color-source-canvas" />
    </main>
  );
}
