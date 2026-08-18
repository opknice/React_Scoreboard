import { useCallback, useEffect, useRef, useState } from 'react';
import { useObsVideoFolderContext } from '../context/useObsVideoFolderContext';
import { useReplayChannel } from '../hooks/useReplayChannel';
import { useReplayPlaylist } from '../hooks/useReplayPlaylist';
import { formatTime, formatSize, findLatestFile, getVideoMimeType } from '../utils/replayFormatters';
import ReplayPlaylistPanel from './ReplayPlaylistPanel';
import { MACRO_CHANNELS, postMacroChannelMessage } from '../macros/macroChannels';
import {
  isReplayPlaylistItemEndedEvent,
  REPLAY_PLAYLIST_CONTROL_CHANNEL,
  createReplayFileId,
  type CommandMessage,
  type ReplayPlaylistCompletedEvent,
  type ReplayPlaylistStatus,
} from '../types/instantReplay';
import './InstantReplayControl.css';

const STORAGE_KEYS = {
  REPLAY_DURATION: 'replayDuration',
} as const;

const DEFAULTS = {
  REPLAY_DURATION: 8,
} as const;

type ReplayPlaybackMode = 'single' | 'playlist';

interface ReplayPlaybackOptions {
  mode?: ReplayPlaybackMode;
  playlistItemId?: string;
  playlistSessionId?: string;
}

function loadSettings() {
  try {
    const replayDuration = Number(localStorage.getItem(STORAGE_KEYS.REPLAY_DURATION));
    return {
      replayDuration: isFinite(replayDuration) && replayDuration > 0 ? replayDuration : DEFAULTS.REPLAY_DURATION,
    };
  } catch {
    return {
      replayDuration: DEFAULTS.REPLAY_DURATION,
    };
  }
}

function saveSettings(settings: { replayDuration?: number }) {
  try {
    if (settings.replayDuration !== undefined) {
      localStorage.setItem(STORAGE_KEYS.REPLAY_DURATION, String(settings.replayDuration));
    }
  } catch {
    // ignore
  }
}

export default function InstantReplayControl() {
  const videoFolder = useObsVideoFolderContext();
  const { channelRef, send } = useReplayChannel();
  // Fix #2: ref to track latest duration without stale closure issues
  const durationRef = useRef(0);
  const clipsListRef = useRef<HTMLDivElement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [copied, setCopied] = useState(false);

  const [loadedFileName, setLoadedFileName] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  // State values are intentionally unused in the current UI (tracked for future use);
  // setMarkerA/setMarkerB are actively called to mirror the screen's marker state.
  // Prefixed with _ to satisfy TS6133 while keeping the setter names readable.
  const [_markerA, setMarkerA] = useState<number | null>(null);
  const [_markerB, setMarkerB] = useState<number | null>(null);
  // Fix #1: use lazy initializers so loadSettings() runs once on mount only
  const [replayDuration, setReplayDuration] = useState(() => loadSettings().replayDuration);
  // Fix #4: track "Full" preset active state separately from replayDuration value
  const [isFullMode, setIsFullMode] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(0.8); // Default: 0.8x
  const playlist = useReplayPlaylist(videoFolder.videoFiles);
  const playlistItems = playlist.items;
  const resolvePlaylistItem = playlist.resolveItem;
  const [playlistStatus, setPlaylistStatus] = useState<ReplayPlaylistStatus>('idle');
  const [playlistCurrentItemId, setPlaylistCurrentItemId] = useState<string | null>(null);
  const [playlistCurrentIndex, setPlaylistCurrentIndex] = useState(-1);

  const playlistSessionRef = useRef<string | null>(null);
  const playlistIndexRef = useRef(-1);
  const playbackModeRef = useRef<ReplayPlaybackMode>('single');
  const currentPlaybackIdRef = useRef<string | null>(null);
  const lastHandledEndedPlaybackIdRef = useRef<string | null>(null);

  // Fix #2: keep ref in sync with state
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  const recentClips = videoFolder.videoFiles;
  const CLIPS_VISIBLE = 3; // number of items shown before scrolling

  // Scroll-fade: remove fade mask when the list is scrolled to the bottom
  useEffect(() => {
    const el = clipsListRef.current;
    if (!el) return;
    const update = () => {
      const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 4;
      if (atBottom) {
        el.removeAttribute('data-overflowing');
      } else {
        el.setAttribute('data-overflowing', 'true');
      }
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    // Re-run when clip list length changes
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [recentClips.length]);

  const sendCommand = useCallback((action: CommandMessage['action'], value?: number) => {
    send({ type: 'cmd', action, value });
  }, [send]);

  const cancelPlaylist = useCallback(() => {
    playlistSessionRef.current = null;
    playlistIndexRef.current = -1;
    playbackModeRef.current = 'single';
    currentPlaybackIdRef.current = null;
    lastHandledEndedPlaybackIdRef.current = null;
    setPlaylistCurrentItemId(null);
    setPlaylistCurrentIndex(-1);
    setPlaylistStatus((current) => current === 'playing' ? 'stopped' : current);
  }, []);

  const createPlaybackId = useCallback(() => (
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `replay_${Date.now()}_${Math.random().toString(36).slice(2)}`
  ), []);

  const loadAndPlayFile = useCallback(async (
    targetFile: File,
    options: ReplayPlaybackOptions = {},
  ): Promise<boolean> => {
    const mode = options.mode || 'single';
    if (mode === 'single') cancelPlaylist();

    try {
      setErrorMsg(null);
      setIsLoadingFile(true);

      const playbackId = createPlaybackId();
      playbackModeRef.current = mode;
      currentPlaybackIdRef.current = playbackId;

      const data = await targetFile.arrayBuffer();
      send({
        type: 'file',
        data,
        mime: getVideoMimeType(targetFile),
        name: targetFile.name,
        playbackId,
        playlistItemId: options.playlistItemId,
        playlistSessionId: options.playlistSessionId,
      });

      setLoadedFileName(targetFile.name);
      durationRef.current = 0;
      setDuration(0);
      setCurrentTime(0);
      setMarkerA(null);
      setMarkerB(null);

      if (mode === 'playlist') {
        // Highlights should play in full at natural speed, independently of
        // the short/slow Instant Replay settings.
        setPlaybackSpeed(1);
        sendCommand('clearLoop');
        sendCommand('setSpeed', 1);
      } else {
        setPlaybackSpeed(0.8);
        sendCommand('setSpeed', 0.8);
      }
      sendCommand('play');
      return true;
    } catch (error) {
      console.error('Failed to load file:', error);
      setErrorMsg(`ไม่สามารถโหลดไฟล์รีเพลย์ "${targetFile.name}" ได้`);
      return false;
    } finally {
      setIsLoadingFile(false);
    }
  }, [cancelPlaylist, createPlaybackId, send, sendCommand]);

  const finishPlaylist = useCallback((status: ReplayPlaylistStatus) => {
    const completedSessionId = playlistSessionRef.current;
    const completedItemIndex = playlistIndexRef.current;
    const lastPlaylistItemId = completedItemIndex >= 0
      ? playlistItems[completedItemIndex]?.id
      : undefined;

    if (status === 'completed' && completedSessionId) {
      const completedEvent: ReplayPlaylistCompletedEvent = {
        type: 'ReplayPlaylistCompleted',
        videoElement: 'InstantReplayScreen',
        playlistSessionId: completedSessionId,
        completedItemCount: Math.max(0, completedItemIndex + 1),
        lastPlaylistItemId,
        timestamp: Date.now(),
      };

      postMacroChannelMessage(MACRO_CHANNELS.replayEvents, { ...completedEvent });
    }

    playlistSessionRef.current = null;
    playlistIndexRef.current = -1;
    playbackModeRef.current = 'single';
    currentPlaybackIdRef.current = null;
    lastHandledEndedPlaybackIdRef.current = null;
    setPlaylistCurrentItemId(null);
    setPlaylistCurrentIndex(-1);
    setPlaylistStatus(status);
  }, [playlistItems]);

  const playPlaylistFromIndex = useCallback(async (
    sessionId: string,
    startIndex: number,
    availableFiles: File[],
  ): Promise<void> => {
    for (let index = startIndex; index < playlistItems.length; index += 1) {
      if (playlistSessionRef.current !== sessionId) return;

      const item = playlistItems[index];
      const file = resolvePlaylistItem(item, availableFiles);
      if (!file) {
        setErrorMsg(`ข้ามไฟล์ใน Playlist เนื่องจากไม่พบไฟล์ "${item.fileName}"`);
        continue;
      }

      playlistIndexRef.current = index;
      setPlaylistCurrentIndex(index);
      setPlaylistCurrentItemId(item.id);

      const loaded = await loadAndPlayFile(file, {
        mode: 'playlist',
        playlistItemId: item.id,
        playlistSessionId: sessionId,
      });

      if (loaded) return;
      setErrorMsg(`ไม่สามารถโหลดไฟล์ "${item.fileName}" ได้ ระบบจะข้ามไปไฟล์ถัดไป`);
    }

    if (playlistSessionRef.current === sessionId) {
      finishPlaylist('completed');
    }
  }, [finishPlaylist, loadAndPlayFile, playlistItems, resolvePlaylistItem]);

  const startPlaylist = useCallback(async () => {
    if (!videoFolder.isConnected) {
      setErrorMsg('กรุณาเชื่อมต่อโฟลเดอร์วิดีโอก่อนเล่น Playlist');
      return;
    }
    if (playlistItems.length === 0) {
      setErrorMsg('ยังไม่มีวิดีโอใน Playlist');
      return;
    }

    const availableFiles = videoFolder.folderHandle
      ? await videoFolder.rescan()
      : videoFolder.videoFiles;
    const sessionId = createPlaybackId();

    playlistSessionRef.current = sessionId;
    playlistIndexRef.current = -1;
    playbackModeRef.current = 'playlist';
    currentPlaybackIdRef.current = null;
    lastHandledEndedPlaybackIdRef.current = null;
    setPlaylistCurrentItemId(null);
    setPlaylistCurrentIndex(-1);
    setPlaylistStatus('playing');

    await playPlaylistFromIndex(sessionId, 0, availableFiles);
  }, [createPlaybackId, playPlaylistFromIndex, playlistItems.length, videoFolder]);

  const stopPlaylist = useCallback(() => {
    if (playlistStatus === 'playing') sendCommand('pause');
    cancelPlaylist();
  }, [cancelPlaylist, playlistStatus, sendCommand]);

  const loadAndPlayLatestFile = useCallback(async () => {
    if (!videoFolder.isConnected) {
      setErrorMsg('ยังไม่ได้เชื่อมต่อโฟลเดอร์วิดีโอ — กลับไปหน้าหลักแล้วกด Connect');
      return;
    }

    let currentFiles = videoFolder.videoFiles;
    if (videoFolder.folderHandle) {
      try {
        currentFiles = await videoFolder.rescan();
      } catch (err) {
        console.warn('Failed to rescan folder:', err);
      }
    }

    const latestFile = findLatestFile(currentFiles);
    if (!latestFile) {
      setErrorMsg('ไม่พบไฟล์วิดีโอในโฟลเดอร์ที่เชื่อมต่อ');
      return;
    }

    await loadAndPlayFile(latestFile);
  }, [videoFolder, loadAndPlayFile]);

  const calculateTrimStartTime = useCallback((clipDuration: number, clipReplayDuration: number): number => {
    if (clipReplayDuration >= clipDuration) return 0;
    return clipDuration - clipReplayDuration;
  }, []);

  const applyAutoTrim = useCallback((clipDuration: number) => {
    const trimStartTime = calculateTrimStartTime(clipDuration, replayDuration);
    sendCommand('setA', trimStartTime);
    sendCommand('setB', clipDuration);
    sendCommand('seek', trimStartTime);
    sendCommand('play');
    setMarkerA(trimStartTime);
    setMarkerB(clipDuration);
  }, [replayDuration, calculateTrimStartTime, sendCommand]);

  const handleReplayDurationChange = useCallback((value: number) => {
    setReplayDuration(value);
    setIsFullMode(false); // Fix #4: any manual change exits full mode
    saveSettings({ replayDuration: value });

    if (duration > 0) {
      const trimStartTime = calculateTrimStartTime(duration, value);
      sendCommand('setA', trimStartTime);
      sendCommand('setB', duration);
      sendCommand('seek', trimStartTime);
      setMarkerA(trimStartTime);
      setMarkerB(duration);
    }
  }, [duration, calculateTrimStartTime, sendCommand]);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    sendCommand('setSpeed', speed);
  }, [sendCommand]);

  const onCopyUrl = useCallback(async () => {
    const screenUrl = `${window.location.origin}${import.meta.env.BASE_URL}replay/screen`;
    try {
      await navigator.clipboard.writeText(screenUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
      // Fallback: create temporary input element
      const input = document.createElement('input');
      input.value = screenUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const handleTimelineClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    sendCommand('seek', percentage * duration);
  }, [duration, sendCommand]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type !== 'status') return;
      if (message.playbackId && message.playbackId !== currentPlaybackIdRef.current) return;

      setDuration(message.duration);
      setCurrentTime(message.currentTime);
      setMarkerA(message.markerA);
      setMarkerB(message.markerB);

      // Fix #2: use durationRef to avoid stale closure — applyAutoTrim fires
      // correctly on first status message after a new file is loaded
      if (message.duration > 0 && durationRef.current === 0) {
        if (playbackModeRef.current === 'single') {
          applyAutoTrim(message.duration);
        } else {
          // Playlist items are full-length highlights and must not inherit the
          // short Instant Replay trim markers from the previous clip.
          setMarkerA(null);
          setMarkerB(null);
        }
      }
    };

    channel.addEventListener('message', handleMessage);
    return () => channel.removeEventListener('message', handleMessage);
  // duration removed from deps — durationRef handles it without causing re-registration
  }, [channelRef, applyAutoTrim]);

  // The screen notifies the control panel when a playlist item ends. This is
  // intentionally a private channel so Auto Macros only see the final
  // ReplayPlaylistCompleted event, not every highlight clip.
  useEffect(() => {
    let replayEventChannel: BroadcastChannel | null = null;

    try {
      replayEventChannel = new BroadcastChannel(REPLAY_PLAYLIST_CONTROL_CHANNEL);
      replayEventChannel.onmessage = (event: MessageEvent<unknown>) => {
        if (!isReplayPlaylistItemEndedEvent(event.data)) return;
        if (playbackModeRef.current !== 'playlist') return;

        const endedEvent = event.data;
        const activeSessionId = playlistSessionRef.current;
        const activePlaybackId = currentPlaybackIdRef.current;
        if (!activeSessionId) return;
        if (endedEvent.playlistSessionId !== activeSessionId) return;
        if (endedEvent.playbackId !== activePlaybackId) return;
        if (endedEvent.playbackId === lastHandledEndedPlaybackIdRef.current) return;

        const activeItem = playlistItems[playlistIndexRef.current];
        if (activeItem && endedEvent.playlistItemId !== activeItem.id) return;

        lastHandledEndedPlaybackIdRef.current = endedEvent.playbackId;
        void playPlaylistFromIndex(
          activeSessionId,
          playlistIndexRef.current + 1,
          videoFolder.videoFiles,
        );
      };
    } catch (error) {
      console.error('[InstantReplayControl] Failed to create replay events channel:', error);
    }

    return () => {
      replayEventChannel?.close();
    };
  }, [playPlaylistFromIndex, playlistItems, videoFolder.videoFiles]);

  // Listen for BroadcastChannel commands from Macros
  useEffect(() => {
    let replayControlChannel: BroadcastChannel | null = null;

    try {
      replayControlChannel = new BroadcastChannel('replay-control');
      console.log('[InstantReplayControl] Replay control channel created, listening for commands...');

      replayControlChannel.onmessage = (event) => {
        const eventData = event.data;
        console.log('[InstantReplayControl] Received broadcast event:', eventData);

        if (eventData.type === 'LoadLatestReplay') {
          console.log('[InstantReplayControl] LoadLatestReplay triggered, calling loadAndPlayLatestFile...');
          void loadAndPlayLatestFile();
        }
      };
    } catch (e) {
      console.error('[InstantReplayControl] Failed to create replay control channel:', e);
    }

    return () => {
      if (replayControlChannel) {
        replayControlChannel.close();
        console.log('[InstantReplayControl] Replay control channel closed');
      }
    };
  }, [loadAndPlayLatestFile]);

  const trimStart = duration > 0
    ? calculateTrimStartTime(duration, replayDuration)
    : null;

  return (
    <main className="instant-replay-control">
      {/* ── Header ── */}
      <header className="replay-header">
        <div>
          {/* VAR-style brand: cyan prefix + white label */}
          <div className="replay-brand">Replay Controller</div>
          {/* Animated live dot + subtitle */}

        </div>
        <button className={`var-button var-button-header ${copied ? 'copied' : ''}`} type="button" onClick={onCopyUrl}>
          <i className={copied ? 'fas fa-check' : 'fas fa-link'}></i>
          <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอก URL สำหรับ OBS'}</span>
        </button>
      </header>

      <section className="replay-control-body">
        {/* ── Alerts ── */}
        {errorMsg && (
          <div className="replay-alert replay-alert-error">
            <i className="fas fa-exclamation-triangle"></i>
            <span>{errorMsg}</span>
            <button className="alert-close" type="button" onClick={() => setErrorMsg(null)}>&times;</button>
          </div>
        )}

        {!videoFolder.isConnected && (
          <div className="var-folder-info" style={{ color: '#d9534f' }}>
            <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }} />
            <span>ใช้โฟลเดอร์จากหน้าหลัก — กลับไปกด Connect ที่แถบ &quot;โฟลเดอร์วิดีโอ OBS Replay&quot;</span>
          </div>
        )}

        {/* ── 1-Click action ── */}
        <div className="one-click-action-bar">
          <button
            className={`one-click-btn ${isLoadingFile ? 'loading' : ''}`}
            onClick={() => void loadAndPlayLatestFile()}
            disabled={isLoadingFile || !videoFolder.isConnected}
            title="คลิกเดียวเพื่อสแกน โหลด ตัด และเล่นไฟล์รีเพลย์ล่าสุดทันที"
          >
            <i className={`fas ${isLoadingFile ? 'fa-spinner fa-spin' : 'fa-bolt'}`}></i>
            <span>{isLoadingFile ? 'กำลังโหลดรีเพลย์...' : '⚡ คลิกเดียว โหลดและเล่นรีเพลย์ล่าสุด'}</span>
          </button>
        </div>

        {/* ── Recent clips ── */}
        {recentClips.length > 0 && (
          <div className="replay-section">
            {/* VAR-style heading: label left, cyan value right */}
            <div className="replay-section-heading">
              <span>คลังวิดีโอ</span>
              <b>{recentClips.length} คลิป</b>
            </div>
            <div
              ref={clipsListRef}
              className="recent-clips-list"
              style={{ '--clips-visible': CLIPS_VISIBLE } as React.CSSProperties}
            >
              {recentClips.map((file, idx) => {
                const isCurrent = file.name === loadedFileName;
                return (
                  <div
                    key={`${file.name}-${file.lastModified}-${idx}`}
                    className={`recent-clip-item ${isCurrent ? 'active' : ''}`}
                  >
                    <div className="clip-meta">
                      <div className="clip-name">
                        <i className="fas fa-file-video"></i>
                        <span>{file.name}</span>
                        {isCurrent && <span className="active-badge">กำลังเล่น</span>}
                      </div>
                      <div className="clip-sub">
                        <span>{formatSize(file.size)}</span>
                        <span>·</span>
                        <span>{new Date(file.lastModified).toLocaleTimeString('th-TH')}</span>
                      </div>
                    </div>
                    <div className="recent-clip-actions">
                      <button
                        type="button"
                        className={`replay-button ${isCurrent ? 'replay-button-small' : 'replay-button-primary replay-button-small'}`}
                        onClick={() => void loadAndPlayFile(file)}
                        disabled={isLoadingFile}
                      >
                        <i className={`fas ${isCurrent ? 'fa-redo' : 'fa-play'}`}></i>
                        <span>{isCurrent ? 'เล่นซ้ำ' : 'เล่น'}</span>
                      </button>
                      <button
                        type="button"
                        className="replay-button replay-button-small"
                        onClick={() => {
                          const added = playlist.addFile(file);
                          if (!added) setErrorMsg(`วิดีโอ "${file.name}" มีอยู่ใน Playlist แล้ว`);
                        }}
                        disabled={playlist.items.some((item) => item.id === createReplayFileId(file))}
                        title="เพิ่มวิดีโอนี้เข้า Playlist"
                      >
                        <i className="fas fa-plus"></i>
                        <span>เพิ่ม</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Playback speed ── */}
        {loadedFileName && (
          <div className="replay-section">
            {/* Speed value shown in heading (replaces inline-style badge) */}
            <div className="replay-section-heading">
              <span>ความเร็วการเล่น</span>
              <b>{playbackSpeed.toFixed(2)}×</b>
            </div>
            <div className="speed-control">
              <div className="speed-presets">
                {[0.2, 0.4, 0.6, 0.8, 1, 1.25, 1.5].map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    className={`replay-button replay-button-preset speed-preset-btn ${playbackSpeed === speed ? 'active' : ''}`}
                    onClick={() => handleSpeedChange(speed)}
                  >
                    {speed}×
                  </button>
                ))}
              </div>
              <div className="speed-slider-row">
                <span className="speed-label-min">0.25×</span>
                <input
                  type="range"
                  className="replay-slider speed-slider"
                  min={0.25}
                  max={2}
                  step={0.05}
                  value={playbackSpeed}
                  onChange={(e) => handleSpeedChange(Number(e.target.value))}
                />
                <span className="speed-label-max">2×</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Timeline ── */}
        {loadedFileName && duration > 0 && (
          <div className="replay-section">
            {/* Duration shown in heading, current time in timeline-labels */}
            <div className="replay-section-heading">
              <span>ไทม์ไลน์ · จุดตัด</span>
              
            </div>
            <div className="timeline-container">
              <div className="timeline-labels">
                <span>00:00</span>
                <span className="current-time-label">{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <div className="timeline-track" onClick={handleTimelineClick}>
                <div className="timeline-progress" style={{ width: `${(currentTime / duration) * 100}%` }} />
                {trimStart !== null && (
                  <div
                    className="timeline-trim-region"
                    style={{
                      left: `${(trimStart / duration) * 100}%`,
                      width: `${((duration - trimStart) / duration) * 100}%`,
                    }}
                  />
                )}
                {trimStart !== null && (
                  <div className="timeline-marker timeline-marker-trim" style={{ left: `${(trimStart / duration) * 100}%` }}>
                    <span>ตัด</span>
                  </div>
                )}
                <div className="timeline-playhead" style={{ left: `${(currentTime / duration) * 100}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* ── Settings ── */}
        <div className="replay-section">
          {/* Replay duration value shown in heading, replaces setting-label */}
          <div className="replay-section-heading">
            <span>ระยะเวลารีเพลย์</span>
            <b>{replayDuration} วินาที</b>
          </div>
          <div className="setting-group">
            <div className="preset-buttons">
              {[5, 8, 10, 15].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  // Bug #6 fix: active only when NOT in full mode, preventing both
                  // a preset and "Full" from lighting up when duration === preset value
                  className={`replay-button replay-button-preset ${!isFullMode && replayDuration === preset ? 'active' : ''}`}
                  onClick={() => handleReplayDurationChange(preset)}
                >
                  {preset}s
                </button>
              ))}
              <button
                type="button"
                className={`replay-button replay-button-preset ${isFullMode ? 'active' : ''}`}
                onClick={() => {
                  if (duration > 0) {
                    handleReplayDurationChange(duration);
                    setIsFullMode(true); // Fix #4: explicitly mark full mode active
                  }
                }}
                disabled={duration === 0}
              >
                เต็ม
              </button>
            </div>
            <input
              type="range"
              min="3"
              max="30"
              step="0.5"
              value={replayDuration}
              onChange={(e) => handleReplayDurationChange(Number(e.target.value))}
              className="replay-slider"
            />
          </div>
        </div>

        {/* ── Highlight playlist (kept at the bottom of the Replay modal) ── */}
        <ReplayPlaylistPanel
          items={playlist.items}
          missingItems={playlist.missingItems}
          status={playlistStatus}
          currentItemId={playlistCurrentItemId}
          currentIndex={playlistCurrentIndex}
          isLoading={isLoadingFile}
          isFolderConnected={videoFolder.isConnected}
          onPlayAll={() => void startPlaylist()}
          onStop={stopPlaylist}
          onRemove={playlist.removeItem}
          onMove={playlist.moveItem}
          onClear={() => {
            playlist.clear();
            setPlaylistCurrentItemId(null);
            setPlaylistCurrentIndex(-1);
          }}
        />

      </section>
    </main>
  );
}
