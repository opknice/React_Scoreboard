import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type {
  ChannelMessage,
  CommandMessage,
  ReplayPlaybackFailureReason,
  ReplayPlaylistCompletedEvent,
  ReplayPlaylistControlEvent,
  ReplayPlaylistFailure,
  ReplayPlaylistItem,
  ReplayPlaylistStatus,
} from '../types/instantReplay';
import {
  isReplayPlaylistControlEvent,
  REPLAY_PLAYLIST_CONTROL_CHANNEL,
  REPLAY_PROTOCOL_VERSION,
} from '../types/instantReplay';
import { getVideoMimeType } from '../utils/replayFormatters';

const STALL_TIMEOUT_MS = 3_000;
const SCREEN_READY_TIMEOUT_MS = 5_000;
const MEDIA_READY_TIMEOUT_MS = 15_000;
const SCREEN_TTL_MS = 4_000;
const MIN_PROGRESS_SECONDS = 0.05;
const END_EPSILON_SECONDS = 0.25;

interface RunnerState {
  status: ReplayPlaylistStatus;
  currentItemId: string | null;
  currentIndex: number;
  attempt: 0 | 1 | 2;
  failures: ReplayPlaylistFailure[];
}

const INITIAL_STATE: RunnerState = {
  status: 'idle',
  currentItemId: null,
  currentIndex: -1,
  attempt: 0,
  failures: [],
};

type RunnerAction =
  | { type: 'reset'; status: ReplayPlaylistStatus }
  | { type: 'start' }
  | { type: 'item'; itemId: string; index: number; attempt: 1 | 2; status: ReplayPlaylistStatus }
  | { type: 'status'; status: ReplayPlaylistStatus }
  | { type: 'failure'; failure: ReplayPlaylistFailure }
  | { type: 'finish'; status: 'completed' | 'completed_with_errors' };

function reducer(state: RunnerState, action: RunnerAction): RunnerState {
  switch (action.type) {
    case 'reset':
      return { ...INITIAL_STATE, status: action.status };
    case 'start':
      return { ...INITIAL_STATE, status: 'waiting_for_screen' };
    case 'item':
      return {
        ...state,
        currentItemId: action.itemId,
        currentIndex: action.index,
        attempt: action.attempt,
        status: action.status,
      };
    case 'status':
      return { ...state, status: action.status };
    case 'failure':
      return { ...state, failures: [...state.failures, action.failure] };
    case 'finish':
      return {
        ...state,
        currentItemId: null,
        currentIndex: -1,
        attempt: 0,
        status: action.status,
      };
    default:
      return state;
  }
}

interface ActiveAttempt {
  generation: number;
  sessionId: string;
  item: ReplayPlaylistItem;
  file: File;
  index: number;
  attempt: 1 | 2;
  playbackId: string;
  lastConfirmedTime: number;
  duration: number | null;
  handlingOutcome: boolean;
  mediaDispatched: boolean;
}

interface ScreenHealth {
  lastHeartbeatAt: number;
  playbackId: string | null;
  lastProgressAt: number;
  currentTime: number;
  failed: boolean;
}

interface CompletionSummary {
  sessionId: string;
  playedItemCount: number;
  failures: ReplayPlaylistFailure[];
  lastPlaylistItemId?: string;
}

interface UseReplayPlaylistRunnerOptions {
  items: ReplayPlaylistItem[];
  resolveItem: (item: ReplayPlaylistItem, files?: File[]) => File | null;
  send: (message: ChannelMessage) => void;
  createId: () => string;
  onFileLoaded: (fileName: string, playbackId: string) => void;
  onError: (message: string) => void;
  onCompleted: (summary: CompletionSummary) => void;
}

export interface ReplayPlaylistRunner {
  status: ReplayPlaylistStatus;
  currentItemId: string | null;
  currentIndex: number;
  attempt: 0 | 1 | 2;
  failures: ReplayPlaylistFailure[];
  activeScreenCount: number;
  isLoading: boolean;
  start: (files: File[]) => Promise<void>;
  stop: (pause?: boolean) => void;
}

function isPlaybackEvent(event: ReplayPlaylistControlEvent): event is Exclude<
  ReplayPlaylistControlEvent,
  { type: 'ReplayScreenReady' | 'ReplayScreenHeartbeat' }
> {
  return event.type !== 'ReplayScreenReady' && event.type !== 'ReplayScreenHeartbeat';
}

export function useReplayPlaylistRunner({
  items,
  resolveItem,
  send,
  createId,
  onFileLoaded,
  onError,
  onCompleted,
}: UseReplayPlaylistRunnerOptions): ReplayPlaylistRunner {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [activeScreenCount, setActiveScreenCount] = useState(0);
  const stateRef = useRef(state);
  const itemsRef = useRef(items);
  const resolveItemRef = useRef(resolveItem);
  const callbacksRef = useRef({ onFileLoaded, onError, onCompleted });
  const generationRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const sessionItemsRef = useRef<ReplayPlaylistItem[]>([]);
  const sessionFilesRef = useRef<File[]>([]);
  const activeAttemptRef = useRef<ActiveAttempt | null>(null);
  const failuresRef = useRef<ReplayPlaylistFailure[]>([]);
  const playedItemCountRef = useRef(0);
  const screensRef = useRef(new Map<string, ScreenHealth>());
  const mediaTimeoutRef = useRef<number | null>(null);
  const handledPlaybackIdsRef = useRef(new Set<string>());
  const playIndexRef = useRef<(index: number, attempt: 1 | 2, resumeTime: number) => Promise<void>>(async () => undefined);
  const failAttemptRef = useRef<(reason: ReplayPlaybackFailureReason) => void>(() => undefined);
  const completeItemRef = useRef<() => void>(() => undefined);

  stateRef.current = state;
  itemsRef.current = items;
  resolveItemRef.current = resolveItem;
  callbacksRef.current = { onFileLoaded, onError, onCompleted };

  const clearMediaTimeout = useCallback(() => {
    if (mediaTimeoutRef.current !== null) {
      window.clearTimeout(mediaTimeoutRef.current);
      mediaTimeoutRef.current = null;
    }
  }, []);

  const isCurrentAttempt = useCallback((event: {
    playlistSessionId: string;
    playlistItemId: string;
    playbackId: string;
    attempt: 1 | 2;
  }): boolean => {
    const active = activeAttemptRef.current;
    return Boolean(active
      && active.generation === generationRef.current
      && event.playlistSessionId === active.sessionId
      && event.playlistItemId === active.item.id
      && event.playbackId === active.playbackId
      && event.attempt === active.attempt);
  }, []);

  const sendScopedCommand = useCallback((
    action: CommandMessage['action'],
    value: number | undefined,
    active: ActiveAttempt,
    targetScreenId?: string,
  ) => {
    send({
      type: 'cmd',
      action,
      value,
      playbackId: active.playbackId,
      playlistSessionId: active.sessionId,
      targetScreenId,
    });
  }, [send]);

  const finish = useCallback(() => {
    clearMediaTimeout();
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    const failures = [...failuresRef.current];
    const lastIndex = activeAttemptRef.current?.index ?? sessionItemsRef.current.length - 1;
    const lastPlaylistItemId = lastIndex >= 0 ? sessionItemsRef.current[lastIndex]?.id : undefined;
    const status = failures.length > 0 ? 'completed_with_errors' : 'completed';

    activeAttemptRef.current = null;
    sessionIdRef.current = null;
    dispatch({ type: 'finish', status });
    callbacksRef.current.onCompleted({
      sessionId,
      playedItemCount: playedItemCountRef.current,
      failures,
      lastPlaylistItemId,
    });
  }, [clearMediaTimeout]);

  const recordFailure = useCallback((
    item: ReplayPlaylistItem,
    reason: ReplayPlaybackFailureReason,
    attempts: number,
    lastConfirmedTime: number,
  ) => {
    const failure: ReplayPlaylistFailure = {
      itemId: item.id,
      fileName: item.fileName,
      reason,
      failedAt: Date.now(),
      lastConfirmedTime,
      attempts,
    };
    failuresRef.current = [...failuresRef.current, failure];
    dispatch({ type: 'failure', failure });
  }, []);

  const completeItem = useCallback(() => {
    const active = activeAttemptRef.current;
    if (!active || active.handlingOutcome || handledPlaybackIdsRef.current.has(active.playbackId)) return;
    active.handlingOutcome = true;
    handledPlaybackIdsRef.current.add(active.playbackId);
    clearMediaTimeout();
    playedItemCountRef.current += 1;
    dispatch({ type: 'status', status: 'advancing' });
    void playIndexRef.current(active.index + 1, 1, 0);
  }, [clearMediaTimeout]);
  completeItemRef.current = completeItem;

  const failAttempt = useCallback((reason: ReplayPlaybackFailureReason) => {
    const active = activeAttemptRef.current;
    if (!active || active.handlingOutcome) return;
    active.handlingOutcome = true;
    clearMediaTimeout();

    if (active.attempt === 1) {
      const resumeTime = active.lastConfirmedTime;
      dispatch({ type: 'status', status: 'retrying' });
      void playIndexRef.current(active.index, 2, resumeTime);
      return;
    }

    recordFailure(active.item, reason, 2, active.lastConfirmedTime);
    callbacksRef.current.onError(`ข้ามไฟล์ "${active.item.fileName}" หลังลองเล่นใหม่แล้ว`);
    dispatch({ type: 'status', status: 'advancing' });
    void playIndexRef.current(active.index + 1, 1, 0);
  }, [clearMediaTimeout, recordFailure]);
  failAttemptRef.current = failAttempt;

  const playIndex = useCallback(async (index: number, attempt: 1 | 2, resumeTime: number): Promise<void> => {
    const generation = generationRef.current;
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    for (let nextIndex = index; nextIndex < sessionItemsRef.current.length; nextIndex += 1) {
      if (generation !== generationRef.current || sessionId !== sessionIdRef.current) return;
      const item = sessionItemsRef.current[nextIndex];
      const file = resolveItemRef.current(item, sessionFilesRef.current);
      if (!file) {
        recordFailure(item, 'load_error', 0, 0);
        callbacksRef.current.onError(`ข้ามไฟล์ "${item.fileName}" เนื่องจากไม่พบไฟล์ในโฟลเดอร์`);
        await playIndexRef.current(nextIndex + 1, 1, 0);
        return;
      }

      const playbackId = createId();
      const active: ActiveAttempt = {
        generation,
        sessionId,
        item,
        file,
        index: nextIndex,
        attempt,
        playbackId,
        lastConfirmedTime: Math.max(0, resumeTime),
        duration: null,
        handlingOutcome: false,
        mediaDispatched: false,
      };
      activeAttemptRef.current = active;
      dispatch({
        type: 'item',
        itemId: item.id,
        index: nextIndex,
        attempt,
        status: attempt === 2 ? 'retrying' : 'loading',
      });

      const now = Date.now();
      screensRef.current.forEach((screen) => {
        screen.playbackId = playbackId;
        screen.lastProgressAt = now;
        screen.currentTime = active.lastConfirmedTime;
        screen.failed = false;
      });

      try {
        const data = await file.arrayBuffer();
        if (generation !== generationRef.current
          || sessionId !== sessionIdRef.current
          || activeAttemptRef.current?.playbackId !== playbackId) return;

        send({
          type: 'file',
          data,
          mime: getVideoMimeType(file),
          name: file.name,
          playbackId,
          playlistItemId: item.id,
          playlistSessionId: sessionId,
          protocolVersion: REPLAY_PROTOCOL_VERSION,
          attempt,
          resumeTime: active.lastConfirmedTime,
        });
        active.mediaDispatched = true;
        callbacksRef.current.onFileLoaded(file.name, playbackId);
        sendScopedCommand('clearLoop', undefined, active);
        sendScopedCommand('setSpeed', 1, active);
        sendScopedCommand('play', undefined, active);

        clearMediaTimeout();
        mediaTimeoutRef.current = window.setTimeout(() => {
          if (activeAttemptRef.current?.playbackId === playbackId
            && stateRef.current.status !== 'playing') {
            failAttemptRef.current('load_error');
          }
        }, MEDIA_READY_TIMEOUT_MS);
        return;
      } catch (error) {
        if (generation !== generationRef.current || sessionId !== sessionIdRef.current) return;
        console.error('[ReplayPlaylistRunner] Failed to read video file:', error);
        if (attempt === 1) {
          active.handlingOutcome = true;
          await playIndexRef.current(nextIndex, 2, active.lastConfirmedTime);
          return;
        }
        recordFailure(item, 'load_error', 2, active.lastConfirmedTime);
        callbacksRef.current.onError(`ไม่สามารถโหลดไฟล์ "${item.fileName}" ได้ ระบบจะข้ามไปไฟล์ถัดไป`);
        await playIndexRef.current(nextIndex + 1, 1, 0);
        return;
      }
    }

    if (generation === generationRef.current && sessionId === sessionIdRef.current) finish();
  }, [clearMediaTimeout, createId, finish, recordFailure, send, sendScopedCommand]);
  playIndexRef.current = playIndex;

  const waitForReadyScreen = useCallback(async (generation: number): Promise<boolean> => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < SCREEN_READY_TIMEOUT_MS) {
      if (generation !== generationRef.current) return false;
      const now = Date.now();
      if ([...screensRef.current.values()].some((screen) => now - screen.lastHeartbeatAt <= SCREEN_TTL_MS)) return true;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    }
    return false;
  }, []);

  const start = useCallback(async (files: File[]) => {
    generationRef.current += 1;
    const generation = generationRef.current;
    clearMediaTimeout();
    sessionIdRef.current = createId();
    sessionItemsRef.current = [...itemsRef.current];
    sessionFilesRef.current = files;
    failuresRef.current = [];
    playedItemCountRef.current = 0;
    activeAttemptRef.current = null;
    handledPlaybackIdsRef.current.clear();
    dispatch({ type: 'start' });

    const hasScreen = await waitForReadyScreen(generation);
    if (generation !== generationRef.current) return;
    if (!hasScreen) {
      sessionIdRef.current = null;
      dispatch({ type: 'reset', status: 'screen_unavailable' });
      callbacksRef.current.onError('ไม่พบ Replay Screen ที่พร้อมใช้งาน กรุณา Refresh Browser Source ใน OBS');
      return;
    }
    await playIndexRef.current(0, 1, 0);
  }, [clearMediaTimeout, createId, waitForReadyScreen]);

  const stop = useCallback((pause = true) => {
    const active = activeAttemptRef.current;
    generationRef.current += 1;
    clearMediaTimeout();
    if (pause && active) sendScopedCommand('pause', undefined, active);
    activeAttemptRef.current = null;
    sessionIdRef.current = null;
    dispatch({ type: 'reset', status: 'stopped' });
  }, [clearMediaTimeout, sendScopedCommand]);

  const syncActivePlaybackToScreen = useCallback(async (screenId: string) => {
    const active = activeAttemptRef.current;
    if (!active || active.handlingOutcome || !active.mediaDispatched) return;
    const expectedPlaybackId = active.playbackId;
    try {
      const data = await active.file.arrayBuffer();
      if (activeAttemptRef.current?.playbackId !== expectedPlaybackId
        || active.generation !== generationRef.current) return;
      send({
        type: 'file',
        data,
        mime: getVideoMimeType(active.file),
        name: active.file.name,
        playbackId: active.playbackId,
        playlistItemId: active.item.id,
        playlistSessionId: active.sessionId,
        protocolVersion: REPLAY_PROTOCOL_VERSION,
        attempt: active.attempt,
        resumeTime: active.lastConfirmedTime,
        targetScreenId: screenId,
      });
      sendScopedCommand('clearLoop', undefined, active, screenId);
      sendScopedCommand('setSpeed', 1, active, screenId);
      sendScopedCommand('play', undefined, active, screenId);
    } catch (error) {
      console.warn('[ReplayPlaylistRunner] Failed to synchronize a late Replay Screen:', error);
    }
  }, [send, sendScopedCommand]);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(REPLAY_PLAYLIST_CONTROL_CHANNEL);
      channel.onmessage = (messageEvent: MessageEvent<unknown>) => {
        if (!isReplayPlaylistControlEvent(messageEvent.data)) return;
        const event = messageEvent.data;
        const now = Date.now();
        const existing = screensRef.current.get(event.screenId);
        const screen: ScreenHealth = existing || {
          lastHeartbeatAt: now,
          playbackId: null,
          lastProgressAt: now,
          currentTime: 0,
          failed: false,
        };
        screen.lastHeartbeatAt = now;
        screensRef.current.set(event.screenId, screen);

        if (event.type === 'ReplayScreenReady') {
          void syncActivePlaybackToScreen(event.screenId);
          return;
        }

        if (!isPlaybackEvent(event) || !isCurrentAttempt(event)) return;
        const active = activeAttemptRef.current;
        if (!active) return;
        screen.playbackId = active.playbackId;

        if (event.type === 'ReplayMediaReady') {
          active.duration = event.duration;
          return;
        }
        if (event.type === 'ReplayPlaybackStarted') {
          clearMediaTimeout();
          active.duration = event.duration;
          active.lastConfirmedTime = Math.max(active.lastConfirmedTime, event.currentTime);
          screen.currentTime = event.currentTime;
          screen.lastProgressAt = now;
          screen.failed = false;
          dispatch({ type: 'status', status: 'playing' });
          return;
        }
        if (event.type === 'ReplayPlaybackProgress') {
          clearMediaTimeout();
          active.duration = event.duration;
          if (event.currentTime >= screen.currentTime + MIN_PROGRESS_SECONDS) {
            screen.lastProgressAt = now;
            screen.currentTime = event.currentTime;
          }
          active.lastConfirmedTime = Math.max(active.lastConfirmedTime, event.currentTime);
          screen.failed = false;
          if (stateRef.current.status !== 'playing') dispatch({ type: 'status', status: 'playing' });
          return;
        }
        if (event.type === 'ReplayPlaybackFailed') {
          screen.failed = true;
          const activeScreens = [...screensRef.current.values()].filter((candidate) => (
            now - candidate.lastHeartbeatAt <= SCREEN_TTL_MS && candidate.playbackId === active.playbackId
          ));
          if (activeScreens.length > 0 && activeScreens.every((candidate) => candidate.failed)) {
            failAttemptRef.current(event.reason);
          }
          return;
        }
        if (event.type === 'ReplayPlaylistItemEnded') completeItemRef.current();
      };
    } catch (error) {
      console.error('[ReplayPlaylistRunner] Failed to create control channel:', error);
    }
    return () => channel?.close();
  }, [clearMediaTimeout, isCurrentAttempt, syncActivePlaybackToScreen]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const liveScreens = [...screensRef.current.values()].filter((screen) => now - screen.lastHeartbeatAt <= SCREEN_TTL_MS);
      setActiveScreenCount((current) => current === liveScreens.length ? current : liveScreens.length);

      const active = activeAttemptRef.current;
      if (!active || stateRef.current.status !== 'playing' || active.handlingOutcome) return;
      const playbackScreens = liveScreens.filter((screen) => screen.playbackId === active.playbackId && !screen.failed);
      if (playbackScreens.some((screen) => now - screen.lastProgressAt < STALL_TIMEOUT_MS)) return;

      if (active.duration !== null && active.duration - active.lastConfirmedTime <= END_EPSILON_SECONDS) {
        completeItemRef.current();
        return;
      }
      dispatch({ type: 'status', status: 'stalled' });
      failAttemptRef.current('stalled');
    }, 250);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => () => {
    generationRef.current += 1;
    clearMediaTimeout();
  }, [clearMediaTimeout]);

  return {
    status: state.status,
    currentItemId: state.currentItemId,
    currentIndex: state.currentIndex,
    attempt: state.attempt,
    failures: state.failures,
    activeScreenCount,
    isLoading: state.status === 'loading'
      || state.status === 'waiting_for_screen'
      || state.status === 'retrying',
    start,
    stop,
  };
}

export function createReplayPlaylistCompletedEvent(summary: CompletionSummary): ReplayPlaylistCompletedEvent {
  return {
    type: 'ReplayPlaylistCompleted',
    videoElement: 'InstantReplayScreen',
    playlistSessionId: summary.sessionId,
    completedItemCount: summary.playedItemCount,
    playedItemCount: summary.playedItemCount,
    failedItemCount: summary.failures.length,
    failedItems: summary.failures,
    outcome: summary.failures.length > 0 ? 'completed_with_errors' : 'completed',
    lastPlaylistItemId: summary.lastPlaylistItemId,
    timestamp: Date.now(),
  };
}
