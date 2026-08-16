// InstantReplayScreen.tsx
// Screen Mode component for Instant Replay system - displays video in OBS Browser Source
// Requirements: 10.1, 10.2, 10.3, 10.4

import { useRef, useState, useEffect, useCallback } from 'react';
import { useReplayChannel } from '../hooks/useReplayChannel';
import type { ChannelMessage } from '../types/instantReplay';
import { isFileMessage as checkIsFileMessage, isCommandMessage as checkIsCommandMessage } from '../types/instantReplay';
import './InstantReplayScreen.css';

/**
 * InstantReplayScreen Component
 * 
 * Displays video playback for OBS Browser Source at /replay/screen route.
 * Handles incoming video files and playback commands via BroadcastChannel.
 * Enforces loop playback between markerA and markerB when set.
 * 
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
 */
export default function InstantReplayScreen() {
  // Video element reference (Requirement 10.2)
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Blob URL reference for cleanup
  const objectUrlRef = useRef<string | null>(null);
  const canPlayHandlerRef = useRef<(() => void) | null>(null);
  const videoErrorHandlerRef = useRef<(() => void) | null>(null);
  const activeFileNameRef = useRef<string | null>(null);
  const activePlaybackIdRef = useRef<string | null>(null);
  const activePlaylistItemIdRef = useRef<string | null>(null);
  const activePlaylistSessionIdRef = useRef<string | null>(null);
  
  // BroadcastChannel hook integration (Requirement 10.4)
  const { channelRef, send } = useReplayChannel();
  
  // BroadcastChannel for replay events (cross-tab/cross-process communication)
  const replayEventChannelRef = useRef<BroadcastChannel | null>(null);
  
  // Initialize replay events channel
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('replay-events');
      replayEventChannelRef.current = channel;
      console.log('[InstantReplayScreen] Replay events channel initialized');
      
      return () => {
        channel.close();
        replayEventChannelRef.current = null;
        console.log('[InstantReplayScreen] Replay events channel closed');
      };
    } catch (e) {
      console.error('[InstantReplayScreen] Failed to create BroadcastChannel:', e);
    }
  }, []);
  
  // Component state (Requirement 10.1, 10.2)
  const [hasVideo, setHasVideo] = useState(false);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);

  // Refs to hold latest loop markers without stale closure issues (Bug #2)
  // handleTimeUpdate reads these directly so loop enforcement is always current
  const loopARef = useRef<number | null>(null);
  const loopBRef = useRef<number | null>(null);
  const lastStatusAtRef = useRef(0);

  // Bug #2 fix: keep refs in sync with state so handleTimeUpdate always reads latest values
  useEffect(() => { loopARef.current = loopA; }, [loopA]);
  useEffect(() => { loopBRef.current = loopB; }, [loopB]);

  /**
   * Send status message back to Control Panel
   * Contains video metadata and current playback state
   * Validates: Requirement 6.5, 6.6, 6.7
   */
  const sendStatusMessage = useCallback((force = false) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const now = performance.now();
    if (!force && now - lastStatusAtRef.current < 200) return;
    lastStatusAtRef.current = now;

    send({
      type: 'status',
      playbackId: activePlaybackIdRef.current || undefined,
      duration: video.duration,
      currentTime: video.currentTime,
      markerA: loopARef.current,
      markerB: loopBRef.current,
    });
  }, [send]);

  /**
   * Handle incoming BroadcastChannel messages
   * Processes file messages and command messages
   * Validates: Requirements 2.5, 6.2, 10.5, 10.6, 10.7, 10.8
   */
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    const video = videoRef.current;

    const cleanupPendingPlaybackHandlers = () => {
      if (!video) return;
      if (canPlayHandlerRef.current) {
        video.removeEventListener('canplay', canPlayHandlerRef.current);
        video.removeEventListener('loadeddata', canPlayHandlerRef.current);
        canPlayHandlerRef.current = null;
      }
      if (videoErrorHandlerRef.current) {
        video.removeEventListener('error', videoErrorHandlerRef.current);
        videoErrorHandlerRef.current = null;
      }
    };

    channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
      const message = event.data;
      const video = videoRef.current;
      if (!video) return;

      // Handle file message (Requirement 2.5)
      if (checkIsFileMessage(message)) {
        cleanupPendingPlaybackHandlers();
        activeFileNameRef.current = message.name;
        activePlaybackIdRef.current = message.playbackId || null;
        activePlaylistItemIdRef.current = message.playlistItemId || null;
        activePlaylistSessionIdRef.current = message.playlistSessionId || null;
        // Revoke previous Blob URL to free memory (Requirement 10.9)
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }

        // Create new Blob URL and assign to video element
        const blob = new Blob([message.data], { type: message.mime });
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        // objectUrlRef is the source of truth — no redundant state needed (Bug #1 fix)
        video.src = url;
        setHasVideo(true);

        // Reset playback state (Requirement 10.5, 7.6)
        video.playbackRate = 0.85;
        setLoopA(null);
        setLoopB(null);
        loopARef.current = null;
        loopBRef.current = null;
        lastStatusAtRef.current = 0;

        // Bug #3 fix: wait for canplay before calling play() so the video element
        // is actually ready — avoids NotAllowedError / silent failure in OBS/browsers
        const onCanPlay = () => {
          cleanupPendingPlaybackHandlers();
          void video.play().catch((error) => {
            console.warn('[InstantReplayScreen] Video play was blocked or failed:', error);
          });
        };
        const onVideoError = () => {
          const detail = video.error ? `code ${video.error.code}` : 'unknown media error';
          console.error(`[InstantReplayScreen] Failed to load replay video "${message.name}" (${message.mime}): ${detail}`);
          cleanupPendingPlaybackHandlers();
        };
        canPlayHandlerRef.current = onCanPlay;
        videoErrorHandlerRef.current = onVideoError;
        video.addEventListener('canplay', onCanPlay, { once: true });
        video.addEventListener('loadeddata', onCanPlay, { once: true });
        video.addEventListener('error', onVideoError, { once: true });
        video.load();

        if (video.readyState >= 2) {
          onCanPlay();
        }
        return;
      }

      // Handle command messages (Requirement 6.2)
      if (checkIsCommandMessage(message)) {
        const { action, value } = message;

        // Play command (Requirement 10.7)
        if (action === 'play') {
          void video.play().catch(() => undefined);
        }

        // Pause command (Requirement 10.8)
        if (action === 'pause') {
          video.pause();
        }

        // Seek command
        if (action === 'seek' && typeof value === 'number') {
          video.currentTime = value;
        }

        // Set loop marker A (Requirement 7.1)
        if (action === 'setA') {
          const markerValue = typeof value === 'number' ? value : video.currentTime;
          setLoopA(markerValue);
          loopARef.current = markerValue;
        }

        // Set loop marker B (Requirement 7.1)
        if (action === 'setB') {
          const markerValue = typeof value === 'number' ? value : video.currentTime;
          setLoopB(markerValue);
          loopBRef.current = markerValue;
        }

        // Clear loop markers (Requirement 7.6)
        if (action === 'clearLoop') {
          setLoopA(null);
          setLoopB(null);
          loopARef.current = null;
          loopBRef.current = null;
        }

        // Set playback speed
        if (action === 'setSpeed' && typeof value === 'number') {
          video.playbackRate = Math.max(0.25, Math.min(2, value));
        }
      }
    };

    // Cleanup: revoke Blob URL on unmount (Requirement 10.9)
    return () => {
      channel.onmessage = null;
      cleanupPendingPlaybackHandlers();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  // Bug #1 fix: removed `send` from deps — this effect only sets channel.onmessage
  // and does not call send. Including send caused unnecessary re-registration every
  // time send's identity changed, risking a brief window where onmessage was null.
  }, [channelRef]);

  /**
   * Enforce loop playback boundaries and send status updates
   * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.7
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      // Bug #2 fix: read from refs (not state) so we always have the latest marker
      // values even when React hasn't flushed the state update yet
      const a = loopARef.current;
      const b = loopBRef.current;

      // Check loop boundaries when both markers are set (Requirement 7.1, 7.4)
      if (a !== null && b !== null) {
        // If currentTime exceeds markerB, seek to markerA (Requirement 7.2)
        // BUT: Allow video to reach natural end if markerB is at the end
        const isMarkerBAtEnd = Math.abs(b - video.duration) < 0.5; // Within 0.5s of end
        
        if (video.currentTime > b && !isMarkerBAtEnd) {
          video.currentTime = a;
        }

        // If currentTime is less than markerA, seek to markerA (Requirement 7.3)
        if (video.currentTime < a - 0.1) {
          video.currentTime = a;
        }
      }

      // Send status update on time change (Requirement 6.7)
      sendStatusMessage();
    };

    const handleLoadedMetadata = () => {
      // Send initial status with duration (Requirement 6.6)
      sendStatusMessage(true);
    };

    const handleVideoEnded = () => {
      // Emit replay event via BroadcastChannel for cross-process communication
      const channel = replayEventChannelRef.current;
      if (channel) {
        const eventData = {
          type: 'ReplayVideoEnded',
          videoElement: 'InstantReplayScreen',
          fileName: activeFileNameRef.current,
          playbackId: activePlaybackIdRef.current,
          playlistItemId: activePlaylistItemIdRef.current,
          playlistSessionId: activePlaylistSessionIdRef.current,
          timestamp: Date.now(),
          duration: video.duration,
          currentTime: video.currentTime,
          videoSrc: video.src
        };
        
        console.log('[InstantReplay] Video playback ended - broadcasting event');
        console.log('[InstantReplay] Event data:', eventData);
        
        try {
          channel.postMessage(eventData);
          console.log('[InstantReplay] ReplayVideoEnded event broadcast successfully');
        } catch (e) {
          console.error('[InstantReplay] Failed to broadcast event:', e);
        }
      } else {
        console.warn('[InstantReplay] Video playback ended - replay events channel not available');
      }
    };

    // Attach event listeners (Requirement 7.4)
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleVideoEnded);

    // Cleanup event listeners
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleVideoEnded);
    };
  // loopA/loopB removed from deps: loop enforcement now reads loopARef/loopBRef
  // directly so the listener doesn't need to re-register on every marker change.
  // sendStatusMessage stays because it carries loopA/loopB in the status payload.
  }, [sendStatusMessage]);

  return (
    <main className="instant-replay-screen">
      {/* Video element with required attributes (Requirement 10.2) */}
      <video
        ref={videoRef}
        muted
        playsInline
        preload="auto"
        className="instant-replay-screen-video"
      />
      
      {/* Waiting placeholder when no video loaded (Requirement 10.3) */}
      {!hasVideo && (
        <div className="instant-replay-screen-empty">WAITING FOR REPLAY FEED</div>
      )}
    </main>
  );
}
