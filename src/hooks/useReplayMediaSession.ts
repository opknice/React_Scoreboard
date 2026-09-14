import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { FileMessage } from '../types/instantReplay';
import { REPLAY_PROTOCOL_VERSION } from '../types/instantReplay';

export interface ReplayMediaSession {
  key: string;
  objectUrl: string;
  fileName: string;
  playbackId: string | null;
  playlistItemId: string | null;
  playlistSessionId: string | null;
  attempt: 1 | 2;
  resumeTime: number;
  isPlaylist: boolean;
}

interface ReplayMediaSessionController {
  session: ReplayMediaSession | null;
  sessionRef: RefObject<ReplayMediaSession | null>;
  activate: (message: FileMessage, mime: string) => ReplayMediaSession;
}

/**
 * Owns immutable playback sessions and their Blob URLs. A new key is produced
 * for every file attempt so React replaces the video element and stale DOM
 * media events remain associated with the session that created them.
 */
export function useReplayMediaSession(): ReplayMediaSessionController {
  const [session, setSession] = useState<ReplayMediaSession | null>(null);
  const sessionRef = useRef<ReplayMediaSession | null>(null);
  const allocatedUrlsRef = useRef(new Set<string>());
  const fallbackIdRef = useRef(0);

  const activate = useCallback((message: FileMessage, mime: string): ReplayMediaSession => {
    const previous = sessionRef.current;
    if (previous) {
      URL.revokeObjectURL(previous.objectUrl);
      allocatedUrlsRef.current.delete(previous.objectUrl);
    }

    const objectUrl = URL.createObjectURL(new Blob([message.data], { type: mime }));
    allocatedUrlsRef.current.add(objectUrl);

    const playbackId = message.playbackId || null;
    const playlistSessionId = message.playlistSessionId || null;
    const playlistItemId = message.playlistItemId || null;
    const nextSession: ReplayMediaSession = {
      key: playbackId || `single-${Date.now()}-${++fallbackIdRef.current}`,
      objectUrl,
      fileName: message.name,
      playbackId,
      playlistItemId,
      playlistSessionId,
      attempt: message.attempt === 2 ? 2 : 1,
      resumeTime: Number.isFinite(message.resumeTime) ? Math.max(0, message.resumeTime || 0) : 0,
      isPlaylist: message.protocolVersion === REPLAY_PROTOCOL_VERSION
        && Boolean(playbackId && playlistSessionId && playlistItemId),
    };

    sessionRef.current = nextSession;
    setSession(nextSession);
    return nextSession;
  }, []);

  useEffect(() => () => {
    for (const objectUrl of allocatedUrlsRef.current) URL.revokeObjectURL(objectUrl);
    allocatedUrlsRef.current.clear();
    sessionRef.current = null;
  }, []);

  return { session, sessionRef, activate };
}
