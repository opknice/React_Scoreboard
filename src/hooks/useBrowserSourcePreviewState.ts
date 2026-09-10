import { useEffect, useState } from 'react';
import { isScoreboardStateEvent, SCOREBOARD_EVENT_CHANNEL, SCOREBOARD_STATE_STORAGE_KEY, type ScoreboardStateEvent } from '../types/scoreboardEvent';
import { isPlayerDisplayState, PLAYER_DISPLAY_STORAGE_KEY, type PlayerDisplayState } from '../types/playerDisplayEvent';

function readStored<T>(key: string, validate: (value: unknown) => value is T): T | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return validate(value) ? value : null;
  } catch { return null; }
}

/** A read-only preview: never publishes display or animation events to OBS. */
export function useBrowserSourcePreviewState() {
  const [match, setMatch] = useState(() => readStored<ScoreboardStateEvent>(SCOREBOARD_STATE_STORAGE_KEY, isScoreboardStateEvent));
  const [player, setPlayer] = useState(() => readStored<PlayerDisplayState>(PLAYER_DISPLAY_STORAGE_KEY, isPlayerDisplayState));
  useEffect(() => {
    const receive = (value: unknown) => {
      if (isScoreboardStateEvent(value)) setMatch(value);
      if (isPlayerDisplayState(value)) setPlayer(value);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SCOREBOARD_STATE_STORAGE_KEY && event.key !== PLAYER_DISPLAY_STORAGE_KEY) return;
      try { receive(JSON.parse(event.newValue ?? 'null')); } catch { /* Ignore incomplete external writes. */ }
    };
    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel(SCOREBOARD_EVENT_CHANNEL);
      channel.onmessage = event => receive(event.data);
    } catch { /* Stored data remains available without BroadcastChannel. */ }
    window.addEventListener('storage', onStorage);
    return () => { channel?.close(); window.removeEventListener('storage', onStorage); };
  }, []);
  return { match, player };
}
