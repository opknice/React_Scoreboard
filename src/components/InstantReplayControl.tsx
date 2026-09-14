import { useCallback, useEffect, useRef, useState } from 'react';
import { useObsVideoFolderContext } from '../context/useObsVideoFolderContext';
import { useReplayChannel } from '../hooks/useReplayChannel';
import { useReplayPlaylist } from '../hooks/useReplayPlaylist';
import {
  createReplayPlaylistCompletedEvent,
  useReplayPlaylistRunner,
} from '../hooks/useReplayPlaylistRunner';
import { formatSize, findLatestFile, getVideoMimeType } from '../utils/replayFormatters';
import ReplayPlaylistPanel from './ReplayPlaylistPanel';
import ReplayTimeline from './ReplayTimeline';
import { createReplayClock } from '../utils/replayClock';
import { MACRO_CHANNELS, postMacroChannelMessage } from '../macros/macroChannels';
import {
  createReplayFileId,
  type CommandMessage,
} from '../types/instantReplay';
import './InstantReplayControl.css';
import { getAppBaseUrl } from '../utils/appBaseUrl';
import { buildInstantReplayBrowserUrl } from '../utils/replayBrowserUrl';
import type { ReplayObsSetupProps } from '../types/replayObsSetup';

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

export default function InstantReplayControl({ obsSetup }: { obsSetup?: ReplayObsSetupProps }) {
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
  const [replayClock] = useState(createReplayClock);
  const screenUrl = buildInstantReplayBrowserUrl(getAppBaseUrl());
  // Fix #1: use lazy initializers so loadSettings() runs once on mount only
  const [replayDuration, setReplayDuration] = useState(() => loadSettings().replayDuration);
  // Fix #4: track "Full" preset active state separately from replayDuration value
  const [isFullMode, setIsFullMode] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(0.8); // Default: 0.8x
  const playlist = useReplayPlaylist(videoFolder.videoFiles);
  const playlistItems = playlist.items;
  const resolvePlaylistItem = playlist.resolveItem;
  const playbackModeRef = useRef<ReplayPlaybackMode>('single');
  const currentPlaybackIdRef = useRef<string | null>(null);
  const playlistStopRef = useRef<(pause?: boolean) => void>(() => undefined);

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

  const createPlaybackId = useCallback(() => (
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `replay_${Date.now()}_${Math.random().toString(36).slice(2)}`
  ), []);

  const handlePlaylistFileLoaded = useCallback((fileName: string, playbackId: string) => {
    playbackModeRef.current = 'playlist';
    currentPlaybackIdRef.current = playbackId;
    setLoadedFileName(fileName);
    durationRef.current = 0;
    setDuration(0);
    replayClock.setTime(0);
    setPlaybackSpeed(1);
  }, [replayClock]);

  const handlePlaylistCompleted = useCallback((summary: Parameters<typeof createReplayPlaylistCompletedEvent>[0]) => {
    const completedEvent = createReplayPlaylistCompletedEvent(summary);
    postMacroChannelMessage(MACRO_CHANNELS.replayEvents, { ...completedEvent });
    playbackModeRef.current = 'single';
    currentPlaybackIdRef.current = null;
  }, []);

  const playlistRunner = useReplayPlaylistRunner({
    items: playlistItems,
    resolveItem: resolvePlaylistItem,
    send,
    createId: createPlaybackId,
    onFileLoaded: handlePlaylistFileLoaded,
    onError: setErrorMsg,
    onCompleted: handlePlaylistCompleted,
  });
  playlistStopRef.current = playlistRunner.stop;

  const cancelPlaylist = useCallback(() => {
    playlistStopRef.current(false);
    playbackModeRef.current = 'single';
    currentPlaybackIdRef.current = null;
  }, []);

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
      replayClock.setTime(0);


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
  }, [cancelPlaylist, createPlaybackId, send, sendCommand, replayClock]);

  const startPlaylist = useCallback(async () => {
    if (!videoFolder.isConnected) {
      setErrorMsg('กรุณาเชื่อมต่อโฟลเดอร์วิดีโอก่อนเล่น Playlist');
      return;
    }
    if (playlistItems.length === 0) {
      setErrorMsg('ยังไม่มีวิดีโอใน Playlist');
      return;
    }

    let availableFiles = videoFolder.videoFiles;
    if (videoFolder.folderHandle) {
      try {
        availableFiles = await videoFolder.rescan();
      } catch (error) {
        console.warn('[InstantReplayControl] Playlist rescan failed:', error);
      }
    }
    playbackModeRef.current = 'playlist';
    await playlistRunner.start(availableFiles);
  }, [playlistItems.length, playlistRunner, videoFolder]);

  const stopPlaylist = useCallback(() => {
    playlistRunner.stop(true);
    playbackModeRef.current = 'single';
    currentPlaybackIdRef.current = null;
  }, [playlistRunner]);

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

    }
  }, [duration, calculateTrimStartTime, sendCommand]);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    sendCommand('setSpeed', speed);
  }, [sendCommand]);

  const onCopyUrl = useCallback(async () => {
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
  }, [screenUrl]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type !== 'status') return;
      if (message.playbackId && message.playbackId !== currentPlaybackIdRef.current) return;

      if (!Number.isFinite(message.duration) || message.duration < 0) return;
      if (message.duration !== durationRef.current) setDuration(message.duration);
      replayClock.setTime(message.currentTime);

      // Fix #2: use durationRef to avoid stale closure — applyAutoTrim fires
      // correctly on first status message after a new file is loaded
      if (message.duration > 0 && durationRef.current === 0) {
        if (playbackModeRef.current === 'single') {
          applyAutoTrim(message.duration);
        }
      }
      durationRef.current = message.duration;
    };

    channel.addEventListener('message', handleMessage);
    return () => channel.removeEventListener('message', handleMessage);
  // duration removed from deps — durationRef handles it without causing re-registration
  }, [channelRef, applyAutoTrim, replayClock]);

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

  const handleSeek = useCallback((seconds: number) => sendCommand('seek', seconds), [sendCommand]);
  const handlePlayAll = useCallback(() => { void startPlaylist(); }, [startPlaylist]);
  const clearPlaylist = playlist.clear;
  const handleClearPlaylist = useCallback(() => {
    clearPlaylist();
  }, [clearPlaylist]);

  const isPlaylistActive = [
    'loading',
    'waiting_for_screen',
    'playing',
    'stalled',
    'retrying',
    'advancing',
  ].includes(playlistRunner.status);
  const isReplayLoading = isLoadingFile || playlistRunner.isLoading;

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
          {obsSetup && (
            <div className="replay-header-obs-status" role="status">
              <span className={obsSetup.connected ? 'is-connected' : 'is-disconnected'}>
                OBS WebSocket: {obsSetup.connected ? 'Connected' : 'ยังไม่เชื่อมต่อ'}
              </span>
              {obsSetup.message && <span> — {obsSetup.message}</span>}
            </div>
          )}
          {/* Animated live dot + subtitle */}

        </div>
        <div className="replay-header-actions">
          {obsSetup && (
            <button
              type="button"
              className="replay-obs-add-button"
              disabled={!obsSetup.connected || obsSetup.busy}
              onClick={obsSetup.onQuickAdd}
            >
              <i className={`fas ${obsSetup.busy ? 'fa-spinner fa-spin' : 'fa-plug'}`} />
              {obsSetup.busy ? 'กำลังตั้งค่า...' : 'Quick Add to OBS'}
            </button>
          )}
          <button className={`var-button var-button-header ${copied ? 'copied' : ''}`} type="button" onClick={onCopyUrl}>
            <i className={copied ? 'fas fa-check' : 'fas fa-link'}></i>
            <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอก URL สำหรับ OBS'}</span>
          </button>
        </div>
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
            className={`one-click-btn ${isReplayLoading ? 'loading' : ''}`}
            onClick={() => void loadAndPlayLatestFile()}
            disabled={isReplayLoading || !videoFolder.isConnected}
            title="คลิกเดียวเพื่อสแกน โหลด ตัด และเล่นไฟล์รีเพลย์ล่าสุดทันที"
          >
            <i className={`fas ${isReplayLoading ? 'fa-spinner fa-spin' : 'fa-bolt'}`}></i>
            <span>{isReplayLoading ? 'กำลังโหลดรีเพลย์...' : '⚡ คลิกเดียว โหลดและเล่นรีเพลย์ล่าสุด'}</span>
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
                        disabled={isReplayLoading}
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
                        disabled={isPlaylistActive || playlist.items.some((item) => item.id === createReplayFileId(file))}
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
                    disabled={isPlaylistActive}
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
                  disabled={isPlaylistActive}
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
            <ReplayTimeline
              clock={replayClock}
              duration={duration}
              trimStart={playbackModeRef.current === 'single' ? trimStart : null}
              onSeek={handleSeek}
              disabled={isPlaylistActive}
            />
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
                  disabled={isPlaylistActive}
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
                disabled={duration === 0 || isPlaylistActive}
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
              disabled={isPlaylistActive}
              className="replay-slider"
            />
          </div>
        </div>

        {/* ── Highlight playlist (kept at the bottom of the Replay modal) ── */}
        <ReplayPlaylistPanel
          items={playlist.items}
          missingItems={playlist.missingItems}
          status={playlistRunner.status}
          currentItemId={playlistRunner.currentItemId}
          currentIndex={playlistRunner.currentIndex}
          attempt={playlistRunner.attempt}
          failures={playlistRunner.failures}
          activeScreenCount={playlistRunner.activeScreenCount}
          isLoading={isReplayLoading}
          isFolderConnected={videoFolder.isConnected}
          onPlayAll={handlePlayAll}
          onStop={stopPlaylist}
          onRemove={playlist.removeItem}
          onMove={playlist.moveItem}
          onClear={handleClearPlaylist}
        />

      </section>
    </main>
  );
}
