import { useCallback, useEffect, useRef, useState } from 'react';
import { broadcastTeamColorSettings } from './useScoreboardChannels';
import type { League } from '../config/supabaseClient';
import {
  DEFAULT_TEAM_NAME_BROWSER_SETTINGS,
  TEAM_NAME_SETTINGS_STORAGE_KEY,
  normalizeTeamNameBrowserSettings,
  type TeamNameBrowserSettings,
} from '../types/teamNameBrowserSettings';
import {
  DEFAULT_SCORE_BROWSER_SETTINGS,
  SCORE_SETTINGS_STORAGE_KEY,
  normalizeScoreBrowserSettings,
  type ScoreBrowserSettings,
} from '../types/scoreBrowserSettings';
import {
  DEFAULT_TEAM_COLOR_BROWSER_SETTINGS,
  TEAM_COLOR_SETTINGS_STORAGE_KEY,
  mergeTeamColorBrowserSettings,
  normalizeTeamColorBrowserSettings,
  type TeamColorBrowserSettings,
  type TeamColorBrowserSettingsPatch,
} from '../types/teamColorBrowserSettings';
import {
  mergeLeagueBrowserSourceSettings,
  resolveLeagueBrowserSourceSettings,
  type BrowserSourceSettingsScope,
  type LeagueBrowserSourceSettings,
} from '../types/leagueBrowserSourceSettings';
import type { UpdateLeagueOptions } from './useSupabaseLeague';

export type BrowserSourceSettingsSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseLeagueBrowserSourceSettingsOptions {
  activeLeague: League | null;
  updateLeague: (
    id: string,
    updates: Partial<League>,
    options?: UpdateLeagueOptions,
  ) => Promise<League>;
  onSaveError?: (message: string) => void;
  debounceMs?: number;
}

interface UseLeagueBrowserSourceSettingsResult {
  teamNameSettings: TeamNameBrowserSettings;
  scoreSettings: ScoreBrowserSettings;
  teamColorSettings: TeamColorBrowserSettings;
  scope: BrowserSourceSettingsScope;
  saveStatus: BrowserSourceSettingsSaveStatus;
  updateTeamNameSettings: (patch: Partial<TeamNameBrowserSettings>) => void;
  updateScoreSettings: (patch: Partial<ScoreBrowserSettings>) => void;
  updateTeamColorSettings: (patch: TeamColorBrowserSettingsPatch) => void;
}

interface PendingLeagueSave {
  leagueId: string;
  baseSettings: League['settings'];
  browserSources: LeagueBrowserSourceSettings;
}

function readGlobalTeamNameSettings(): TeamNameBrowserSettings {
  try {
    const saved = window.localStorage.getItem(TEAM_NAME_SETTINGS_STORAGE_KEY);
    return saved
      ? normalizeTeamNameBrowserSettings(JSON.parse(saved))
      : { ...DEFAULT_TEAM_NAME_BROWSER_SETTINGS };
  } catch {
    return { ...DEFAULT_TEAM_NAME_BROWSER_SETTINGS };
  }
}

function readGlobalScoreSettings(): ScoreBrowserSettings {
  try {
    const saved = window.localStorage.getItem(SCORE_SETTINGS_STORAGE_KEY);
    return saved
      ? normalizeScoreBrowserSettings(JSON.parse(saved))
      : { ...DEFAULT_SCORE_BROWSER_SETTINGS };
  } catch {
    return { ...DEFAULT_SCORE_BROWSER_SETTINGS };
  }
}

function readGlobalTeamColorSettings(): TeamColorBrowserSettings {
  try {
    const saved = window.localStorage.getItem(TEAM_COLOR_SETTINGS_STORAGE_KEY);
    return saved
      ? normalizeTeamColorBrowserSettings(JSON.parse(saved))
      : normalizeTeamColorBrowserSettings(DEFAULT_TEAM_COLOR_BROWSER_SETTINGS);
  } catch {
    return normalizeTeamColorBrowserSettings(DEFAULT_TEAM_COLOR_BROWSER_SETTINGS);
  }
}

function writeGlobalSettings<T>(storageKey: string, settings: T): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(settings));
  } catch {
    console.warn(`[Scoreboard] Unable to persist global settings: ${storageKey}`);
  }
}

/**
 * Keeps device-wide Browser Source settings separate from per-league Supabase
 * overrides. UI/OBS update immediately; league writes are debounced and queued.
 */
export function useLeagueBrowserSourceSettings({
  activeLeague,
  updateLeague,
  onSaveError,
  debounceMs = 500,
}: UseLeagueBrowserSourceSettingsOptions): UseLeagueBrowserSourceSettingsResult {
  const [globalTeamNameSettings, setGlobalTeamNameSettings] = useState(readGlobalTeamNameSettings);
  const [globalScoreSettings, setGlobalScoreSettings] = useState(readGlobalScoreSettings);
  const [globalTeamColorSettings, setGlobalTeamColorSettings] = useState(readGlobalTeamColorSettings);
  const globalSettingsRef = useRef<LeagueBrowserSourceSettings>({
    teamName: globalTeamNameSettings,
    score: globalScoreSettings,
    teamColor: globalTeamColorSettings,
  });
  globalSettingsRef.current = {
    teamName: globalTeamNameSettings,
    score: globalScoreSettings,
    teamColor: globalTeamColorSettings,
  };

  const [teamNameSettings, setTeamNameSettings] = useState(globalTeamNameSettings);
  const [scoreSettings, setScoreSettings] = useState(globalScoreSettings);
  const [teamColorSettings, setTeamColorSettings] = useState(globalTeamColorSettings);
  const [scope, setScope] = useState<BrowserSourceSettingsScope>('global');
  const [saveStatus, setSaveStatus] = useState<BrowserSourceSettingsSaveStatus>('idle');

  const currentSettingsRef = useRef<LeagueBrowserSourceSettings>({
    teamName: globalTeamNameSettings,
    score: globalScoreSettings,
    teamColor: globalTeamColorSettings,
  });
  const activeLeagueRef = useRef<League | null>(activeLeague);
  activeLeagueRef.current = activeLeague;
  const hydratedLeagueIdRef = useRef<string | null>(null);
  const pendingSaveRef = useRef<PendingLeagueSave | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const isMountedRef = useRef(true);
  const updateLeagueRef = useRef(updateLeague);
  const onSaveErrorRef = useRef(onSaveError);
  updateLeagueRef.current = updateLeague;
  onSaveErrorRef.current = onSaveError;

  const persistPendingSave = useCallback(async (): Promise<void> => {
    if (saveInFlightRef.current || !pendingSaveRef.current) return;

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    saveInFlightRef.current = true;

    if (isMountedRef.current && activeLeagueRef.current?.id === pending.leagueId) {
      setSaveStatus('saving');
    }

    const latestSettings = activeLeagueRef.current?.id === pending.leagueId
      ? activeLeagueRef.current.settings
      : pending.baseSettings;

    try {
      await updateLeagueRef.current(
        pending.leagueId,
        { settings: mergeLeagueBrowserSourceSettings(latestSettings, pending.browserSources) },
        { silent: true },
      );

      if (isMountedRef.current && activeLeagueRef.current?.id === pending.leagueId) {
        setScope('league');
        setSaveStatus('saved');
      }
    } catch (error: unknown) {
      if (isMountedRef.current && activeLeagueRef.current?.id === pending.leagueId) {
        setSaveStatus('error');
      }
      const message = error instanceof Error ? error.message : 'ไม่สามารถบันทึก Browser Source settings ได้';
      onSaveErrorRef.current?.(message);
    } finally {
      saveInFlightRef.current = false;
      // Serialize writes so an older response can never overwrite a newer edit.
      if (pendingSaveRef.current) void persistPendingSave();
    }
  }, []);

  const scheduleLeagueSave = useCallback((browserSources: LeagueBrowserSourceSettings) => {
    const league = activeLeagueRef.current;
    if (!league) return;

    pendingSaveRef.current = {
      leagueId: league.id,
      baseSettings: league.settings,
      browserSources,
    };
    setScope('league');
    setSaveStatus('saving');

    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void persistPendingSave();
    }, debounceMs);
  }, [debounceMs, persistPendingSave]);

  useEffect(() => {
    const nextLeagueId = activeLeague?.id ?? null;
    const leagueChanged = hydratedLeagueIdRef.current !== nextLeagueId;

    if (leagueChanged && pendingSaveRef.current) void persistPendingSave();
    hydratedLeagueIdRef.current = nextLeagueId;

    // Do not replace an optimistic edit with a stale league object while saving.
    const hasCurrentLeagueSave = pendingSaveRef.current?.leagueId === nextLeagueId
      || (saveInFlightRef.current && !leagueChanged);
    if (hasCurrentLeagueSave) return;

    const resolved = resolveLeagueBrowserSourceSettings(
      activeLeague?.settings,
      globalSettingsRef.current,
    );
    currentSettingsRef.current = resolved.settings;
    setTeamNameSettings(resolved.settings.teamName);
    setScoreSettings(resolved.settings.score);
    setTeamColorSettings(resolved.settings.teamColor);
    setScope(activeLeague ? resolved.scope : 'global');
    setSaveStatus('idle');
  }, [activeLeague, persistPendingSave]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (pendingSaveRef.current) void persistPendingSave();
    };
  }, [persistPendingSave]);

  const updateTeamNameSettings = useCallback((patch: Partial<TeamNameBrowserSettings>) => {
    const next = normalizeTeamNameBrowserSettings({
      ...currentSettingsRef.current.teamName,
      ...patch,
    });
    const nextBrowserSources = { ...currentSettingsRef.current, teamName: next };
    currentSettingsRef.current = nextBrowserSources;
    setTeamNameSettings(next);

    if (activeLeagueRef.current) {
      scheduleLeagueSave(nextBrowserSources);
      return;
    }

    setGlobalTeamNameSettings(next);
    setScope('global');
    setSaveStatus('saved');
    writeGlobalSettings(TEAM_NAME_SETTINGS_STORAGE_KEY, next);
  }, [scheduleLeagueSave]);

  const updateScoreSettings = useCallback((patch: Partial<ScoreBrowserSettings>) => {
    const next = normalizeScoreBrowserSettings({
      ...currentSettingsRef.current.score,
      ...patch,
    });
    const nextBrowserSources = { ...currentSettingsRef.current, score: next };
    currentSettingsRef.current = nextBrowserSources;
    setScoreSettings(next);

    if (activeLeagueRef.current) {
      scheduleLeagueSave(nextBrowserSources);
      return;
    }

    setGlobalScoreSettings(next);
    setScope('global');
    setSaveStatus('saved');
    writeGlobalSettings(SCORE_SETTINGS_STORAGE_KEY, next);
  }, [scheduleLeagueSave]);

  const updateTeamColorSettings = useCallback((patch: TeamColorBrowserSettingsPatch) => {
    const next = mergeTeamColorBrowserSettings(currentSettingsRef.current.teamColor, patch);
    const nextBrowserSources = { ...currentSettingsRef.current, teamColor: next };
    currentSettingsRef.current = nextBrowserSources;
    setTeamColorSettings(next);
    broadcastTeamColorSettings(activeLeagueRef.current?.id ?? null, next);

    if (activeLeagueRef.current) {
      scheduleLeagueSave(nextBrowserSources);
      return;
    }

    setGlobalTeamColorSettings(next);
    setScope('global');
    setSaveStatus('saved');
    writeGlobalSettings(TEAM_COLOR_SETTINGS_STORAGE_KEY, next);
  }, [scheduleLeagueSave]);

  return {
    teamNameSettings,
    scoreSettings,
    teamColorSettings,
    scope,
    saveStatus,
    updateTeamNameSettings,
    updateScoreSettings,
    updateTeamColorSettings,
  };
}
