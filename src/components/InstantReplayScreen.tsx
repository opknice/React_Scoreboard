// InstantReplayScreen.tsx
// Screen Mode component for Instant Replay system - displays video in OBS Browser Source
// Requirements: 10.1, 10.2, 10.3, 10.4

import { useRef, useState, useEffect, useCallback } from 'react';
import { useReplayChannel } from '../hooks/useReplayChannel';
import type { ChannelMessage } from '../types/instantReplay';
import { isFileMessage as checkIsFileMessage, isCommandMessage as checkIsCommandMessage } from '../types/instantReplay';
import {
  getLatestReplayHttpReference,
  getLatestReplayReference,
  readReplayFile,
} from '../utils/replayFileStore';
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
  const errorHandlerRef = useRef<(() => void) | null>(null);
  
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
  const loadGenerationRef = useRef(0);

  // Bug #2 fix: keep refs in sync with state so handleTimeUpdate always reads latest values
  useEffect(() => { loopARef.current = loopA; }, [loopA]);
  useEffect(() => { loopBRef.current = loopB; }, [loopB]);

  /**
   * Send status message back to Control Panel
   * Contains video metadata and current playback state
   * Validates: Requirement 6.5, 6.6, 6.7
   */
  const sendStatusMessage = useCallback(() => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const now = performance.now();
    if (now - lastStatusAtRef.current < 200) return;
    lastStatusAtRef.current = now;

    send({
      type: 'status',
      duration: video.duration,
      currentTime: video.currentTime,
      markerA: loopARef.current,
      markerB: loopBRef.current,
      isPlaying: !video.paused,
    });
  }, [send]);

  const loadVideoSource = useCallback((source: Blob | string) => {
    const video = videoRef.current;
    if (!video) return;

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    if (canPlayHandlerRef.current) {
      video.removeEventListener('canplay', canPlayHandlerRef.current);
      canPlayHandlerRef.current = null;
    }
    if (errorHandlerRef.current) {
      video.removeEventListener('error', errorHandlerRef.current);
      errorHandlerRef.current = null;
    }

    const url = typeof source === 'string' ? source : URL.createObjectURL(source);
    objectUrlRef.current = typeof source === 'string' ? null : url;
    video.src = url;
    video.load();
    setHasVideo(true);

    video.playbackRate = 0.85;
    setLoopA(null);
    setLoopB(null);
    loopARef.current = null;
    loopBRef.current = null;

    const onCanPlay = () => {
      void video.play().catch((error: unknown) => {
        console.warn('[InstantReplayScreen] Browser rejected replay playback', error);
        send({
          type: 'playbackError',
          name: video.currentSrc,
          message: 'OBS Browser ไม่สามารถเล่นไฟล์นี้ได้ อาจไม่รองรับ MKV Codec ภายในไฟล์',
          code: video.error?.code,
        });
      });
      video.removeEventListener('canplay', onCanPlay);
      canPlayHandlerRef.current = null;
    };
    const onError = () => {
      const error = video.error;
      console.warn('[InstantReplayScreen] Replay media error', {
        code: error?.code,
        message: error?.message,
        source: video.currentSrc,
      });
      send({
        type: 'playbackError',
        name: video.currentSrc,
        message: 'OBS Browser ไม่สามารถถอดรหัสไฟล์นี้ได้ อาจไม่รองรับ MKV Codec ภายในไฟล์',
        code: error?.code,
      });
    };
    canPlayHandlerRef.current = onCanPlay;
    errorHandlerRef.current = onError;
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onError);
  }, [send]);

  const loadFileReference = useCallback(async (fileReference: { id: string }) => {
    const generation = ++loadGenerationRef.current;
    const storedFile = await readReplayFile(fileReference.id);
    if (!storedFile || generation !== loadGenerationRef.current) return;
    loadVideoSource(storedFile.blob);
  }, [loadVideoSource]);

  /**
   * Handle incoming BroadcastChannel messages
   * Processes file messages and command messages
   * Validates: Requirements 2.5, 6.2, 10.5, 10.6, 10.7, 10.8
   */
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    const video = videoRef.current;

    channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
      const message = event.data;
      const video = videoRef.current;
      if (!video) return;

      // New path: only metadata crosses BroadcastChannel. The video Blob is
      // read from IndexedDB in this browser context.
      if (message.type === 'fileRef') {
        if (message.file && typeof message.file.id === 'string') {
          void loadFileReference(message.file);
        }
        return;
      }

      if (message.type === 'fileUrl') {
        try {
          const url = new URL(message.file.url, window.location.origin);
          if (url.origin === window.location.origin && url.pathname.startsWith('/api/replay/')) {
            loadGenerationRef.current += 1;
            loadVideoSource(url.toString());
          }
        } catch {
          console.warn('[InstantReplayScreen] Ignored invalid replay URL');
        }
        return;
      }

      // Handle file message (Requirement 2.5)
      if (checkIsFileMessage(message)) {
        loadGenerationRef.current += 1;
        loadVideoSource(new Blob([message.data], { type: message.mime }));
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

    // If OBS opens the screen after the controller, recover the latest clip
    // from IndexedDB instead of depending on a missed BroadcastChannel event.
    void getLatestReplayHttpReference().then(async (latestHttpReference) => {
      if (latestHttpReference) {
        loadGenerationRef.current += 1;
        loadVideoSource(latestHttpReference.url);
        return;
      }

      const latestIndexedDbReference = await getLatestReplayReference();
      if (latestIndexedDbReference) void loadFileReference(latestIndexedDbReference);
    });

    // Cleanup: revoke Blob URL on unmount (Requirement 10.9)
    return () => {
      channel.onmessage = null;
      if (canPlayHandlerRef.current) {
        video?.removeEventListener('canplay', canPlayHandlerRef.current);
        canPlayHandlerRef.current = null;
      }
      if (errorHandlerRef.current) {
        video?.removeEventListener('error', errorHandlerRef.current);
        errorHandlerRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  // This effect also owns the channel handler, so keep its dependencies stable.
  }, [channelRef, loadFileReference, loadVideoSource]);

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
      sendStatusMessage();
    };

    const handleVideoEnded = () => {
      // Emit replay event via BroadcastChannel for cross-process communication
      const channel = replayEventChannelRef.current;
      if (channel) {
        const eventData = {
          type: 'ReplayVideoEnded',
          videoElement: 'InstantReplayScreen',
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
    video.addEventListener('playing', sendStatusMessage);
    video.addEventListener('pause', sendStatusMessage);
    video.addEventListener('ended', handleVideoEnded);

    // Cleanup event listeners
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleVideoEnded);
      video.removeEventListener('playing', sendStatusMessage);
      video.removeEventListener('pause', sendStatusMessage);
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
        className="instant-replay-screen-video"
      />
      
      {/* Waiting placeholder when no video loaded (Requirement 10.3) */}
      {!hasVideo && (
        <div className="instant-replay-screen-empty">WAITING FOR REPLAY FEED</div>
      )}
    </main>
  );
}
