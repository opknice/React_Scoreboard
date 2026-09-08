import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDisableZoom } from '../hooks/useDisableZoom';
import { SCOREBOARD_EVENT_CHANNEL } from '../types/scoreboardEvent';
import {
  createPlayerDisplayState,
  isPlayerDisplayState,
  PLAYER_DISPLAY_STORAGE_KEY,
  type PlayerDisplayState,
} from '../types/playerDisplayEvent';
import {
  DEFAULT_PLAYER_BROWSER_SETTINGS,
  isPlayerBrowserSettingsUpdatedEvent,
  normalizePlayerBrowserSettings,
  PLAYER_BROWSER_CANVAS_HEIGHT,
  PLAYER_BROWSER_CANVAS_WIDTH,
  PLAYER_BROWSER_SETTINGS_STORAGE_KEY,
  type PlayerBrowserElementSettings,
  type PlayerBrowserSettings,
} from '../types/playerBrowserSettings';
import UiIcon from './UiIcon';
import './PlayerBrowserSource.css';

function readStoredState(): PlayerDisplayState | null {
  try {
    const saved = localStorage.getItem(PLAYER_DISPLAY_STORAGE_KEY);
    if (!saved) return null;
    const parsed: unknown = JSON.parse(saved);
    return isPlayerDisplayState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readStoredSettings(): PlayerBrowserSettings {
  try {
    const saved = localStorage.getItem(PLAYER_BROWSER_SETTINGS_STORAGE_KEY);
    return saved ? normalizePlayerBrowserSettings(JSON.parse(saved)) : DEFAULT_PLAYER_BROWSER_SETTINGS;
  } catch {
    return DEFAULT_PLAYER_BROWSER_SETTINGS;
  }
}

function createHiddenState(state: PlayerDisplayState): PlayerDisplayState {
  return createPlayerDisplayState({
    visible: false,
    leagueId: state.leagueId,
    team: state.team,
    teamId: state.teamId,
    teamName: state.teamName,
    playerId: state.playerId,
    jerseyNumber: state.jerseyNumber,
    name: state.name,
    position: state.position,
    imageUrl: state.imageUrl,
    hideAt: null,
  });
}

export default function PlayerBrowserSource() {
  useDisableZoom();
  const [searchParams] = useSearchParams();
  const leagueId = searchParams.get('league')?.trim() || '';
  const [displayState, setDisplayState] = useState<PlayerDisplayState | null>(() => {
    const stored = readStoredState();
    return stored && (!leagueId || stored.leagueId === leagueId) ? stored : null;
  });
  const [settings, setSettings] = useState<PlayerBrowserSettings>(readStoredSettings);
  const [imageFailed, setImageFailed] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  const applyState = useCallback((nextState: PlayerDisplayState) => {
    if (leagueId && nextState.leagueId !== leagueId) return;
    setDisplayState(nextState);
  }, [leagueId]);

  const hideExpiredState = useCallback((state: PlayerDisplayState) => {
    const hidden = createHiddenState(state);
    try {
      localStorage.setItem(PLAYER_DISPLAY_STORAGE_KEY, JSON.stringify(hidden));
    } catch {
      // Keep the source usable when storage is unavailable.
    }
    setDisplayState(hidden);
  }, []);

  useEffect(() => {
    setImageFailed(false);
  }, [displayState?.eventId]);

  useEffect(() => {
    const stored = readStoredState();
    if (stored && (!leagueId || stored.leagueId === leagueId)) {
      applyState(stored);
    } else if (leagueId) {
      setDisplayState(null);
    }
  }, [applyState, leagueId]);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (isPlayerDisplayState(event.data)) applyState(event.data);
      if (isPlayerBrowserSettingsUpdatedEvent(event.data)) setSettings(event.data.settings);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === PLAYER_BROWSER_SETTINGS_STORAGE_KEY && event.newValue) {
        try {
          setSettings(normalizePlayerBrowserSettings(JSON.parse(event.newValue)));
        } catch {
          // Ignore malformed settings updates.
        }
        return;
      }
      if (event.key !== PLAYER_DISPLAY_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed: unknown = JSON.parse(event.newValue);
        if (isPlayerDisplayState(parsed)) applyState(parsed);
      } catch {
        // Ignore malformed storage updates.
      }
    };

    try {
      channel = new BroadcastChannel(SCOREBOARD_EVENT_CHANNEL);
      channel.addEventListener('message', handleMessage);
    } catch {
      // localStorage is still read on initial load and when the source reloads.
    }
    window.addEventListener('storage', handleStorage);

    return () => {
      channel?.removeEventListener('message', handleMessage);
      channel?.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [applyState]);

  useEffect(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (!displayState?.visible || displayState.hideAt === null) return undefined;

    const remainingMs = displayState.hideAt - Date.now();
    if (remainingMs <= 0) {
      hideExpiredState(displayState);
      return undefined;
    }

    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      hideExpiredState(displayState);
    }, remainingMs);

    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [displayState, hideExpiredState]);

  useEffect(() => () => {
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
  }, []);

  const isVisible = Boolean(displayState?.visible && displayState.playerId);

  const elementStyle = (element: PlayerBrowserElementSettings) => ({
    left: `${(element.x / PLAYER_BROWSER_CANVAS_WIDTH) * 100}%`,
    top: `${(element.y / PLAYER_BROWSER_CANVAS_HEIGHT) * 100}%`,
    fontSize: `${(element.size / PLAYER_BROWSER_CANVAS_WIDTH) * 100}vw`,
  });

  const imageStyle = (element: PlayerBrowserElementSettings) => ({
    ...elementStyle(element),
    width: `${(element.size / PLAYER_BROWSER_CANVAS_WIDTH) * 100}%`,
    // Percentage height is relative to canvas height, not its width.
    height: `${(element.size / PLAYER_BROWSER_CANVAS_HEIGHT) * 100}%`,
  });

  return (
    <main className="player-browser-source-root" aria-label="Player browser source">
      {isVisible && displayState ? (
        <article key={displayState.eventId} className="player-browser-canvas">
          <div className="player-browser-image" style={imageStyle(settings.image)}>
            {displayState.imageUrl && !imageFailed ? (
              <img
                src={displayState.imageUrl}
                alt={`รูปนักเตะ ${displayState.name}`}
                onError={() => setImageFailed(true)}
              />
            ) : (
              <div className="player-browser-photo-placeholder" aria-hidden="true">
                <UiIcon name="users" />
              </div>
            )}
          </div>
          <div className="player-browser-jersey" style={elementStyle(settings.jersey)}>
            #{displayState.jerseyNumber ?? ''}
          </div>
          <div className="player-browser-name" style={elementStyle(settings.name)}>
            <strong>{displayState.name}</strong>
            <span>{displayState.teamName}</span>
          </div>
        </article>
      ) : null}
    </main>
  );
}
