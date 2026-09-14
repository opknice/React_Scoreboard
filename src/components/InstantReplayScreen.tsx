import { useCallback, useEffect, useRef, useState } from 'react';
import { useReplayChannel } from '../hooks/useReplayChannel';
import { useReplayMediaSession } from '../hooks/useReplayMediaSession';
import type {
  ChannelMessage,
  CommandMessage,
  ReplayPlaybackFailureReason,
  ReplayPlaylistItemEndedEvent,
  ReplayVideoEndedEvent,
} from '../types/instantReplay';
import {
  isCommandMessage,
  isFileMessage,
  REPLAY_PLAYLIST_CONTROL_CHANNEL,
  REPLAY_PROTOCOL_VERSION,
} from '../types/instantReplay';
import './InstantReplayScreen.css';

const PLAYBACK_PROGRESS_INTERVAL_MS = 200;
const SEEK_READY_TIMEOUT_MS = 3_000;
const SEEK_TOLERANCE_SECONDS = 0.1;

interface QueuedCommand {
  sessionKey: string;
  message: CommandMessage;
}

function clampSeekTime(value: number, duration: number): number {
  const safeValue = Math.max(0, value);
  return Number.isFinite(duration)
    ? Math.min(safeValue, Math.max(0, duration - 0.05))
    : safeValue;
}

/** Displays the active replay in an OBS Browser Source. */
export default function InstantReplayScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackPhaseRef = useRef<'idle' | 'loading' | 'playing'>('idle');
  const screenIdRef = useRef(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `replay-screen-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const replayEventChannelRef = useRef<BroadcastChannel | null>(null);
  const playlistControlChannelRef = useRef<BroadcastChannel | null>(null);
  const commandQueueRef = useRef<QueuedCommand[]>([]);
  const mountedSessionKeyRef = useRef<string | null>(null);
  const applyCommandRef = useRef<((command: QueuedCommand) => void) | null>(null);
  const lastStatusAtRef = useRef(0);
  const loopARef = useRef<number | null>(null);
  const loopBRef = useRef<number | null>(null);

  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const { channelRef, send } = useReplayChannel();
  const { session, sessionRef, activate } = useReplayMediaSession();

  useEffect(() => { loopARef.current = loopA; }, [loopA]);
  useEffect(() => { loopBRef.current = loopB; }, [loopB]);

  useEffect(() => {
    let replayEventsChannel: BroadcastChannel | null = null;
    let playlistControlChannel: BroadcastChannel | null = null;

    try {
      replayEventsChannel = new BroadcastChannel('replay-events');
      replayEventChannelRef.current = replayEventsChannel;
      playlistControlChannel = new BroadcastChannel(REPLAY_PLAYLIST_CONTROL_CHANNEL);
      playlistControlChannelRef.current = playlistControlChannel;

      const postScreenPresence = (type: 'ReplayScreenReady' | 'ReplayScreenHeartbeat') => {
        playlistControlChannel?.postMessage({
          type,
          protocolVersion: REPLAY_PROTOCOL_VERSION,
          screenId: screenIdRef.current,
          playbackId: sessionRef.current?.playbackId || undefined,
          timestamp: Date.now(),
        });
      };

      postScreenPresence('ReplayScreenReady');
      const heartbeatId = window.setInterval(() => postScreenPresence('ReplayScreenHeartbeat'), 1_000);
      return () => {
        replayEventsChannel?.close();
        playlistControlChannel?.close();
        window.clearInterval(heartbeatId);
        replayEventChannelRef.current = null;
        playlistControlChannelRef.current = null;
      };
    } catch (error) {
      console.error('[InstantReplayScreen] Failed to create BroadcastChannel:', error);
    }
  }, [sessionRef]);

  const sendStatusMessage = useCallback((force = false) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const now = performance.now();
    if (!force && now - lastStatusAtRef.current < PLAYBACK_PROGRESS_INTERVAL_MS) return;
    lastStatusAtRef.current = now;

    send({
      type: 'status',
      playbackId: sessionRef.current?.playbackId || undefined,
      duration: video.duration,
      currentTime: video.currentTime,
      markerA: loopARef.current,
      markerB: loopBRef.current,
    });
  }, [send, sessionRef]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;

    channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
      const message = event.data;

      if (isFileMessage(message)) {
        if (message.targetScreenId && message.targetScreenId !== screenIdRef.current) return;

        const probe = videoRef.current || document.createElement('video');
        const isMatroska = /matroska/i.test(message.mime) || /\.mkv$/i.test(message.name);
        const mimeCandidates = isMatroska
          ? [message.mime, 'video/matroska', 'video/x-matroska']
          : [message.mime];
        const selectedMime = mimeCandidates.find((mime) => probe.canPlayType(mime) !== '') || message.mime;
        if (isMatroska && mimeCandidates.every((mime) => probe.canPlayType(mime) === '')) {
          console.warn('[InstantReplayScreen] CEF could not confirm Matroska support; guarded playback will still be attempted');
        }

        playbackPhaseRef.current = 'loading';
        commandQueueRef.current = [];
        mountedSessionKeyRef.current = null;
        applyCommandRef.current = null;
        setLoopA(null);
        setLoopB(null);
        loopARef.current = null;
        loopBRef.current = null;
        lastStatusAtRef.current = 0;

        try {
          const nextSession = activate(message, selectedMime);
          if (nextSession.isPlaylist) {
            playlistControlChannelRef.current?.postMessage({
              type: 'ReplayMediaReceived',
              protocolVersion: REPLAY_PROTOCOL_VERSION,
              screenId: screenIdRef.current,
              playlistSessionId: nextSession.playlistSessionId,
              playlistItemId: nextSession.playlistItemId,
              playbackId: nextSession.playbackId,
              attempt: nextSession.attempt,
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          console.error('[InstantReplayScreen] Unable to create replay media session:', error);
          if (message.playlistSessionId && message.playlistItemId && message.playbackId) {
            playlistControlChannelRef.current?.postMessage({
              type: 'ReplayPlaybackFailed',
              protocolVersion: REPLAY_PROTOCOL_VERSION,
              screenId: screenIdRef.current,
              playlistSessionId: message.playlistSessionId,
              playlistItemId: message.playlistItemId,
              playbackId: message.playbackId,
              attempt: message.attempt === 2 ? 2 : 1,
              reason: 'load_error',
              currentTime: 0,
              timestamp: Date.now(),
            });
          }
        }
        return;
      }

      if (!isCommandMessage(message)) return;
      if (message.targetScreenId && message.targetScreenId !== screenIdRef.current) return;
      const activeSession = sessionRef.current;
      if (!activeSession) return;
      if (message.playbackId && message.playbackId !== activeSession.playbackId) return;
      if (message.playlistSessionId && message.playlistSessionId !== activeSession.playlistSessionId) return;

      const queuedCommand = { sessionKey: activeSession.key, message };
      if (mountedSessionKeyRef.current === activeSession.key && applyCommandRef.current) {
        applyCommandRef.current(queuedCommand);
      } else {
        // File and command messages may arrive in one render batch. Retain the
        // commands until the keyed video element for this session has mounted.
        commandQueueRef.current = [...commandQueueRef.current.slice(-19), queuedCommand];
      }
    };

    return () => { channel.onmessage = null; };
  }, [activate, channelRef, sessionRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !session) return;

    let disposed = false;
    let metadataReady = false;
    let dataReady = false;
    let seekReady = session.resumeTime <= 0;
    let resumePrepared = false;
    let desiredPlaying = true;
    let playInFlight = false;
    let terminalReported = false;
    let lastPlaylistProgressAt = 0;
    let pendingSeek: number | null = null;
    let seekTimeoutId: number | null = null;

    const isCurrentSession = () => !disposed && sessionRef.current?.key === session.key;
    const getSafeDuration = () => Number.isFinite(video.duration) ? video.duration : null;
    const clearSeekTimeout = () => {
      if (seekTimeoutId !== null) {
        window.clearTimeout(seekTimeoutId);
        seekTimeoutId = null;
      }
    };
    const playlistIdentity = session.isPlaylist ? {
      protocolVersion: REPLAY_PROTOCOL_VERSION,
      screenId: screenIdRef.current,
      playlistSessionId: session.playlistSessionId as string,
      playlistItemId: session.playlistItemId as string,
      playbackId: session.playbackId as string,
      attempt: session.attempt,
    } : null;

    const reportPlaybackFailure = (reason: Exclude<ReplayPlaybackFailureReason, 'stalled'>) => {
      if (!isCurrentSession() || terminalReported || !playlistIdentity) return;
      terminalReported = true;
      clearSeekTimeout();
      playlistControlChannelRef.current?.postMessage({
        type: 'ReplayPlaybackFailed',
        ...playlistIdentity,
        reason,
        currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
        mediaErrorCode: video.error?.code,
        timestamp: Date.now(),
      });
    };

    const maybePlay = () => {
      if (!isCurrentSession() || terminalReported || !desiredPlaying
        || !metadataReady || !seekReady || !dataReady || playInFlight) return;
      playInFlight = true;
      void video.play().catch((error) => {
        console.warn('[InstantReplayScreen] Video play was blocked or failed:', error);
        reportPlaybackFailure('play_error');
      }).finally(() => { playInFlight = false; });
    };

    const armSeekTimeout = () => {
      clearSeekTimeout();
      seekTimeoutId = window.setTimeout(() => {
        if (!seekReady && isCurrentSession()) reportPlaybackFailure('load_error');
      }, SEEK_READY_TIMEOUT_MS);
    };

    const seekBeforePlayback = (requestedTime: number) => {
      const targetTime = clampSeekTime(requestedTime, video.duration);
      if (Math.abs(video.currentTime - targetTime) <= SEEK_TOLERANCE_SECONDS) {
        seekReady = true;
        maybePlay();
        return;
      }
      seekReady = false;
      try {
        video.currentTime = targetTime;
        armSeekTimeout();
      } catch (error) {
        console.warn('[InstantReplayScreen] Unable to seek to replay position:', error);
        reportPlaybackFailure('load_error');
      }
    };

    const prepareResume = () => {
      if (!isCurrentSession() || resumePrepared) return;
      resumePrepared = true;
      metadataReady = true;
      sendStatusMessage(true);
      if (playlistIdentity) {
        playlistControlChannelRef.current?.postMessage({
          type: 'ReplayMediaReady',
          ...playlistIdentity,
          duration: getSafeDuration(),
          timestamp: Date.now(),
        });
      }
      const requestedTime = pendingSeek ?? session.resumeTime;
      pendingSeek = null;
      if (requestedTime > 0) seekBeforePlayback(requestedTime);
      else {
        seekReady = true;
        maybePlay();
      }
    };

    const handleLoadedMetadata = () => prepareResume();
    const handleLoadedData = () => {
      if (!isCurrentSession()) return;
      dataReady = true;
      maybePlay();
    };
    const handleCanPlay = () => {
      if (!isCurrentSession()) return;
      dataReady = true;
      maybePlay();
    };
    const handleSeeked = () => {
      if (!isCurrentSession()) return;
      clearSeekTimeout();
      seekReady = true;
      dataReady = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
      maybePlay();
    };
    const handlePlaying = () => {
      if (!isCurrentSession() || terminalReported) return;
      playbackPhaseRef.current = 'playing';
      playInFlight = false;
      if (playlistIdentity) {
        playlistControlChannelRef.current?.postMessage({
          type: 'ReplayPlaybackStarted',
          ...playlistIdentity,
          currentTime: video.currentTime,
          duration: getSafeDuration(),
          timestamp: Date.now(),
        });
      }
    };
    const handleTimeUpdate = () => {
      if (!isCurrentSession() || terminalReported) return;
      const a = loopARef.current;
      const b = loopBRef.current;
      if (a !== null && b !== null) {
        const isMarkerBAtEnd = Number.isFinite(video.duration) && Math.abs(b - video.duration) < 0.5;
        if (video.currentTime > b && !isMarkerBAtEnd) video.currentTime = a;
        if (video.currentTime < a - 0.1) video.currentTime = a;
      }
      sendStatusMessage();

      const now = performance.now();
      if (playlistIdentity && now - lastPlaylistProgressAt >= PLAYBACK_PROGRESS_INTERVAL_MS) {
        lastPlaylistProgressAt = now;
        playlistControlChannelRef.current?.postMessage({
          type: 'ReplayPlaybackProgress',
          ...playlistIdentity,
          currentTime: video.currentTime,
          duration: getSafeDuration(),
          timestamp: Date.now(),
        });
      }
    };
    const reportPlaybackWait = (type: 'ReplayPlaybackWaiting' | 'ReplayPlaybackStalled') => {
      if (!isCurrentSession() || playbackPhaseRef.current !== 'playing' || !playlistIdentity) return;
      playlistControlChannelRef.current?.postMessage({
        type,
        ...playlistIdentity,
        currentTime: video.currentTime,
        timestamp: Date.now(),
      });
    };
    const handleWaiting = () => reportPlaybackWait('ReplayPlaybackWaiting');
    const handleStalled = () => reportPlaybackWait('ReplayPlaybackStalled');
    const handleMediaError = () => {
      if (!isCurrentSession()) return;
      const detail = video.error ? `code ${video.error.code}` : 'unknown media error';
      console.error(`[InstantReplayScreen] Replay video failed (${detail})`);
      reportPlaybackFailure(playbackPhaseRef.current === 'loading' ? 'load_error' : 'decode_error');
    };
    const handlePlaybackAborted = () => {
      if (!isCurrentSession() || playbackPhaseRef.current !== 'playing') return;
      reportPlaybackFailure('decode_error');
    };
    const handleVideoEnded = () => {
      if (!isCurrentSession() || terminalReported || playbackPhaseRef.current !== 'playing' || !video.ended) return;
      terminalReported = true;
      clearSeekTimeout();
      playbackPhaseRef.current = 'idle';

      if (playlistIdentity) {
        const eventData: ReplayPlaylistItemEndedEvent = {
          type: 'ReplayPlaylistItemEnded',
          videoElement: 'InstantReplayScreen',
          fileName: session.fileName,
          ...playlistIdentity,
          timestamp: Date.now(),
          duration: getSafeDuration(),
          currentTime: video.currentTime,
        };
        playlistControlChannelRef.current?.postMessage(eventData);
        return;
      }

      const eventData: ReplayVideoEndedEvent = {
        type: 'ReplayVideoEnded',
        videoElement: 'InstantReplayScreen',
        fileName: session.fileName,
        playbackId: session.playbackId || undefined,
        timestamp: Date.now(),
        duration: getSafeDuration() ?? video.currentTime,
        currentTime: video.currentTime,
      };
      replayEventChannelRef.current?.postMessage(eventData);
    };

    const applyCommand = (command: QueuedCommand) => {
      if (!isCurrentSession() || command.sessionKey !== session.key) return;
      const { action, value } = command.message;
      if (action === 'play') {
        desiredPlaying = true;
        maybePlay();
      } else if (action === 'pause') {
        desiredPlaying = false;
        video.pause();
      } else if (action === 'seek' && typeof value === 'number') {
        if (!metadataReady) pendingSeek = value;
        else if (playbackPhaseRef.current === 'playing') video.currentTime = clampSeekTime(value, video.duration);
        else seekBeforePlayback(value);
      } else if (action === 'setA') {
        const markerValue = typeof value === 'number' ? value : video.currentTime;
        setLoopA(markerValue);
        loopARef.current = markerValue;
      } else if (action === 'setB') {
        const markerValue = typeof value === 'number' ? value : video.currentTime;
        setLoopB(markerValue);
        loopBRef.current = markerValue;
      } else if (action === 'clearLoop') {
        setLoopA(null);
        setLoopB(null);
        loopARef.current = null;
        loopBRef.current = null;
      } else if (action === 'setSpeed' && typeof value === 'number') {
        video.playbackRate = Math.max(0.25, Math.min(2, value));
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('stalled', handleStalled);
    video.addEventListener('error', handleMediaError);
    video.addEventListener('abort', handlePlaybackAborted);
    video.addEventListener('ended', handleVideoEnded);

    mountedSessionKeyRef.current = session.key;
    applyCommandRef.current = applyCommand;
    playbackPhaseRef.current = 'loading';
    video.playbackRate = 0.85;
    video.src = session.objectUrl;
    video.load();

    const queuedCommands = commandQueueRef.current.filter((command) => command.sessionKey === session.key);
    commandQueueRef.current = [];
    queuedCommands.forEach(applyCommand);
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) prepareResume();
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      dataReady = true;
      maybePlay();
    }

    return () => {
      disposed = true;
      clearSeekTimeout();
      video.pause();
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('error', handleMediaError);
      video.removeEventListener('abort', handlePlaybackAborted);
      video.removeEventListener('ended', handleVideoEnded);
      if (mountedSessionKeyRef.current === session.key) mountedSessionKeyRef.current = null;
      if (applyCommandRef.current === applyCommand) applyCommandRef.current = null;
    };
  }, [sendStatusMessage, session, sessionRef]);

  return (
    <main className="instant-replay-screen">
      {session && (
        <video
          key={session.key}
          ref={videoRef}
          muted
          playsInline
          preload="auto"
          className="instant-replay-screen-video"
        />
      )}
      {!session && <div className="instant-replay-screen-empty">WAITING FOR REPLAY FEED</div>}
    </main>
  );
}
