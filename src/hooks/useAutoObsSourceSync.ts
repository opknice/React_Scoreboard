import { useEffect, useRef } from 'react';
import type OBSWebSocket from 'obs-websocket-js';
import { OBSSetupService } from '../services/obsSetupService';
import type { TeamNameBrowserSettings } from '../types/teamNameBrowserSettings';
import type { LogoBrowserSettings } from '../types/logoBrowserSettings';
import type { ScoreBrowserSettings } from '../types/scoreBrowserSettings';
import type { TeamColorBrowserSettings } from '../types/teamColorBrowserSettings';
import { getLogoSyncSessionId } from './useLogoCropPreviewSync';

interface UseAutoObsSourceSyncOptions {
  obs: {
    isConnected: boolean;
    getObsRef: () => OBSWebSocket | null;
  };
  teamNameSettings: TeamNameBrowserSettings;
  logoSettings: LogoBrowserSettings;
  scoreSettings: ScoreBrowserSettings;
  teamColorSettings?: TeamColorBrowserSettings;
  activeLeagueId?: string;
  debounceMs?: number;
}

/**
 * Automatically synchronizes Team Name, Logo, and Score Browser Sources with OBS Studio
 * whenever settings change while OBS WebSocket is connected, with debouncing to prevent flooding.
 */
export function useAutoObsSourceSync({
  obs,
  teamNameSettings,
  logoSettings,
  scoreSettings,
  teamColorSettings,
  activeLeagueId,
  debounceMs = 300,
}: UseAutoObsSourceSyncOptions) {
  const { getObsRef, isConnected } = obs;
  const isFirstRenderTeamName = useRef(true);
  const isFirstRenderLogo = useRef(true);
  const isFirstRenderScore = useRef(true);
  const isFirstRenderTeamColor = useRef(true);

  // Auto-sync Team Name Browser Sources on settings change
  useEffect(() => {
    if (isFirstRenderTeamName.current) {
      isFirstRenderTeamName.current = false;
      return;
    }

    if (!isConnected) return;
    const obsRef = getObsRef();
    if (!obsRef) return;

    const timer = setTimeout(() => {
      const service = new OBSSetupService(obsRef);
      service.updateTeamNameBrowserSources(teamNameSettings).catch((err) => {
        console.warn('[Auto OBS Sync] Failed to update Team Name Sources:', err);
      });
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [debounceMs, getObsRef, isConnected, teamNameSettings]);

  // Auto-sync Logo Browser Sources on settings change
  useEffect(() => {
    if (isFirstRenderLogo.current) {
      isFirstRenderLogo.current = false;
      return;
    }

    if (!isConnected) return;
    const obsRef = getObsRef();
    if (!obsRef) return;

    const timer = setTimeout(() => {
      const service = new OBSSetupService(obsRef);
      service.updateLogoBrowserSources(logoSettings, getLogoSyncSessionId(), activeLeagueId).catch((err) => {
        console.warn('[Auto OBS Sync] Failed to update Logo Sources:', err);
      });
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [activeLeagueId, debounceMs, getObsRef, isConnected, logoSettings]);

  // Auto-sync Score Browser Sources on settings change
  useEffect(() => {
    if (isFirstRenderScore.current) {
      isFirstRenderScore.current = false;
      return;
    }

    if (!isConnected) return;
    const obsRef = getObsRef();
    if (!obsRef) return;

    const timer = setTimeout(() => {
      const service = new OBSSetupService(obsRef);
      service.updateScoreBrowserSources(scoreSettings).catch((err) => {
        console.warn('[Auto OBS Sync] Failed to update Score Sources:', err);
      });
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [debounceMs, getObsRef, isConnected, scoreSettings]);

  // Auto-sync Team Color Browser Sources on appearance or league changes.
  useEffect(() => {
    if (!teamColorSettings) return;
    if (isFirstRenderTeamColor.current) {
      isFirstRenderTeamColor.current = false;
      return;
    }

    if (!isConnected) return;
    const obsRef = getObsRef();
    if (!obsRef) return;

    const timer = setTimeout(() => {
      const service = new OBSSetupService(obsRef);
      service.updateTeamColorBrowserSources(teamColorSettings, activeLeagueId).catch((err) => {
        console.warn('[Auto OBS Sync] Failed to update Team Color Sources:', err);
      });
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [activeLeagueId, debounceMs, getObsRef, isConnected, teamColorSettings]);
}
