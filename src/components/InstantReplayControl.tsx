import { useCallback, useEffect, useRef, useState } from 'react';
import { useObsVideoFolderContext } from '../context/useObsVideoFolderContext';
import { useReplayChannel } from '../hooks/useReplayChannel';
import { formatTime, formatSize, findLatestFile, getBrowserVideoMimeType, isBrowserPlayableVideoFile } from '../utils/replayFormatters';
import {
  MAX_BROADCAST_FALLBACK_SIZE,
  MAX_REPLAY_FILE_SIZE,
  storeLatestReplayFile,
  uploadReplayFile,
} from '../utils/replayFileStore';
import type { CommandMessage } from '../types/instantReplay';
import './InstantReplayControl.css';

const STORAGE_KEYS = {
  REPLAY_DURATION: 'replayDuration',
} as const;

const DEFAULTS = {
  REPLAY_DURATION: 8,
} as const;

const SPEED_PRESETS = [0.5, 0.75, 0.8, 1, 1.25, 1.5] as const;
const MIN_SPEED = 0.25;
const MAX_SPEED = 2;

type ReplayUiStatus = 'ready' | 'scanning' | 'uploading' | 'loading' | 'playing' | 'paused' | 'error';

const STATUS_COPY: Record<ReplayUiStatus, { label: string; icon: string; tone: string }> = {
  ready: { label: 'พร้อมส่ง Replay', icon: 'fa-circle-check', tone: 'ready' },
  scanning: { label: 'กำลังค้นหาคลิปล่าสุด…', icon: 'fa-spinner fa-spin', tone: 'loading' },
  uploading: { label: 'กำลังส่ง Replay ไปยัง OBS…', icon: 'fa-cloud-arrow-up', tone: 'loading' },
  loading: { label: 'กำลังโหลด Replay ใน OBS…', icon: 'fa-spinner fa-spin', tone: 'loading' },
  playing: { label: 'กำลังเล่น Replay', icon: 'fa-play', tone: 'playing' },
  paused: { label: 'หยุดชั่วคราว', icon: 'fa-pause', tone: 'paused' },
  error: { label: 'เกิดข้อผิดพลาด', icon: 'fa-triangle-exclamation', tone: 'error' },
};

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
  const [replayStatus, setReplayStatus] = useState<ReplayUiStatus>('ready');
  const [isPlaying, setIsPlaying] = useState(false);

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

  // Fix #2: keep ref in sync with state
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  const recentClips = videoFolder.videoFiles.filter(isBrowserPlayableVideoFile);
  const unsupportedVideoCount = videoFolder.videoFiles.length - recentClips.length;
  const CLIPS_VISIBLE = 3; // number of items shown before scrolling
  const hasLoadedReplay = Boolean(loadedFileName);
  const status = !videoFolder.isConnected ? null : STATUS_COPY[replayStatus];

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

  const loadAndPlayFile = useCallback(async (targetFile: File) => {
    try {
      setErrorMsg(null);
      setIsLoadingFile(true);
      setReplayStatus('uploading');
      setIsPlaying(false);

      if (!isBrowserPlayableVideoFile(targetFile)) {
        throw new Error('รูปแบบไฟล์นี้เล่นใน OBS Browser ไม่ได้ กรุณาใช้ MP4, WebM หรือ MKV ที่ OBS รองรับ');
      }

      if (targetFile.size > MAX_REPLAY_FILE_SIZE) {
        throw new Error(`ไฟล์รีเพลย์ใหญ่เกิน ${Math.round(MAX_REPLAY_FILE_SIZE / (1024 * 1024))} MB`);
      }

      try {
        // Preferred path for OBS: the local Vite server stores the file and
        // OBS streams it over HTTP, so separate browser profiles work too.
        const httpReference = await uploadReplayFile(targetFile);
        send({ type: 'fileUrl', file: httpReference });
      } catch (serverError) {
        try {
          // Fallback for production/static hosting where the local endpoint
          // does not exist. Only metadata crosses BroadcastChannel.
          const fileReference = await storeLatestReplayFile(targetFile);
          send({ type: 'fileRef', file: fileReference });
        } catch (storageError) {
          // Keep compatibility with locked-down browser profiles, but do not
          // allow large files to use the old memory-heavy path.
          if (targetFile.size > MAX_BROADCAST_FALLBACK_SIZE) {
            throw new Error('ไม่สามารถแชร์ไฟล์ Replay ขนาดใหญ่ไปยัง OBS ได้');
          }

          console.warn('[InstantReplay] HTTP/IndexedDB unavailable; using small-file fallback', { serverError, storageError });
          const data = await targetFile.arrayBuffer();
          send({
            type: 'file',
            data,
            mime: getBrowserVideoMimeType(targetFile) || 'video/mp4',
            name: targetFile.name,
          });
        }
      }

      setLoadedFileName(targetFile.name);
      setDuration(0);
      setCurrentTime(0);
      setMarkerA(null);
      setMarkerB(null);
      
      // Set default playback speed to 0.8x
      setPlaybackSpeed(0.8);
      setReplayStatus('loading');
      sendCommand('setSpeed', 0.8);
      sendCommand('play');
    } catch (error) {
      console.error('Failed to load file:', error);
      setReplayStatus('error');
      const message = error instanceof Error
        ? error.message
        : `ไม่สามารถโหลดไฟล์ Replay "${targetFile.name}" ได้ กรุณาลองใหม่อีกครั้ง`;
      setErrorMsg(message);
    } finally {
      setIsLoadingFile(false);
    }
  }, [send, sendCommand]);

  const loadAndPlayLatestFile = useCallback(async () => {
    if (!videoFolder.isConnected) {
      setReplayStatus('error');
      setErrorMsg('ยังไม่ได้เชื่อมต่อโฟลเดอร์วิดีโอ — กลับไปหน้าหลักแล้วกด Connect');
      return;
    }

    setReplayStatus('scanning');
    setErrorMsg(null);
    let currentFiles = videoFolder.videoFiles;
    if (videoFolder.folderHandle) {
      try {
        currentFiles = await videoFolder.rescan();
      } catch (err) {
        console.warn('Failed to rescan folder:', err);
      }
    }

    const playableFiles = currentFiles.filter(isBrowserPlayableVideoFile);
    const latestFile = findLatestFile(playableFiles);
    if (!latestFile) {
      setReplayStatus('error');
      setErrorMsg(
        currentFiles.length > 0
          ? 'พบไฟล์วิดีโอ แต่ OBS Browser ไม่รองรับ Container หรือ Codec ของไฟล์นั้น'
          : 'ไม่พบไฟล์ Replay ในโฟลเดอร์ที่เชื่อมต่อ',
      );
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
    const safeSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));
    setPlaybackSpeed(safeSpeed);
    sendCommand('setSpeed', safeSpeed);
  }, [sendCommand]);

  const handlePlayPause = useCallback(() => {
    if (!hasLoadedReplay) return;
    if (isPlaying) {
      sendCommand('pause');
      setIsPlaying(false);
      setReplayStatus('paused');
    } else {
      sendCommand('play');
      setIsPlaying(true);
      setReplayStatus('playing');
    }
  }, [hasLoadedReplay, isPlaying, sendCommand]);

  const handleReplayAgain = useCallback(() => {
    if (!hasLoadedReplay || duration <= 0) return;
    const start = calculateTrimStartTime(duration, replayDuration);
    sendCommand('seek', start);
    sendCommand('play');
    setCurrentTime(start);
    setIsPlaying(true);
    setReplayStatus('playing');
  }, [calculateTrimStartTime, duration, hasLoadedReplay, replayDuration, sendCommand]);

  const onCopyUrl = useCallback(async () => {
    try {
      const url = `${window.location.origin}${import.meta.env.BASE_URL}replay/screen`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
      // Fallback: create temporary input element
      const input = document.createElement('input');
      input.value = `${window.location.origin}${import.meta.env.BASE_URL}replay/screen`;
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
      if (message.type === 'playbackError') {
        setIsPlaying(false);
        setReplayStatus('error');
        setErrorMsg(message.message || 'OBS Browser ไม่สามารถเล่นไฟล์ Replay นี้ได้');
        return;
      }
      if (message.type !== 'status') return;

      setDuration(message.duration);
      setCurrentTime(message.currentTime);
      setMarkerA(message.markerA);
      setMarkerB(message.markerB);
      if (typeof message.isPlaying === 'boolean') {
        setIsPlaying(message.isPlaying);
        setReplayStatus(message.isPlaying ? 'playing' : 'paused');
      } else if (message.duration > 0) {
        setReplayStatus('playing');
      }

      // Fix #2: use durationRef to avoid stale closure — applyAutoTrim fires
      // correctly on first status message after a new file is loaded
      if (message.duration > 0 && durationRef.current === 0) {
        applyAutoTrim(message.duration);
      }
    };

    channel.addEventListener('message', handleMessage);
    return () => channel.removeEventListener('message', handleMessage);
  // duration removed from deps — durationRef handles it without causing re-registration
  }, [channelRef, applyAutoTrim]);

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
        <div className="replay-status-row" role="status" aria-live="polite">
          <span className={`replay-status-dot ${status?.tone || 'disconnected'}`} aria-hidden="true" />
          <i className={`fas ${status?.icon || 'fa-plug-circle-xmark'}`} aria-hidden="true" />
          <span>{status?.label || 'ยังไม่ได้เชื่อมต่อโฟลเดอร์ Replay'}</span>
          {hasLoadedReplay && <strong title={loadedFileName}>{loadedFileName}</strong>}
        </div>

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
            <span><strong>ขั้นตอนที่ 1:</strong> กลับไปหน้าหลักเพื่อเชื่อมต่อโฟลเดอร์วิดีโอ OBS Replay ก่อนใช้งาน</span>
          </div>
        )}

        {/* ── 1-Click action ── */}
        <div className="one-click-action-bar">
          <button
            className={`one-click-btn ${isLoadingFile ? 'loading' : ''}`}
            onClick={() => void loadAndPlayLatestFile()}
            disabled={isLoadingFile || !videoFolder.isConnected}
            title="ค้นหาไฟล์ล่าสุด ส่งไปยัง OBS และเริ่มเล่น Replay"
            aria-label="โหลด Replay ล่าสุด"
          >
            <i className={`fas ${isLoadingFile ? 'fa-spinner fa-spin' : 'fa-bolt'}`}></i>
            <span>{isLoadingFile ? 'กำลังโหลด Replay…' : '⚡ โหลด Replay ล่าสุด'}</span>
          </button>
        </div>

        {/* ── Recent clips ── */}
        {recentClips.length > 0 && (
          <div className="replay-section">
            {/* VAR-style heading: label left, cyan value right */}
            <div className="replay-section-heading">
              <span>ขั้นตอนที่ 2 · เลือกคลิป Replay</span>
              <b>{recentClips.length} คลิป</b>
            </div>
            <p className="replay-section-hint">คลิปล่าสุดอยู่ด้านบน กด “เล่น” เพื่อส่งคลิปนั้นไปยัง OBS</p>
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
                      <span title={file.name}>{file.name}</span>
                        {isCurrent && <span className="active-badge">
                          {replayStatus === 'loading' || replayStatus === 'uploading' ? 'กำลังโหลด' : replayStatus === 'paused' ? 'หยุดชั่วคราว' : 'กำลังเล่น'}
                        </span>}
                      </div>
                      <div className="clip-sub">
                        <span>{formatSize(file.size)}</span>
                        <span>·</span>
                        <span>{new Date(file.lastModified).toLocaleTimeString('th-TH')}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`replay-button ${isCurrent ? 'replay-button-small' : 'replay-button-primary replay-button-small'}`}
                      onClick={() => void loadAndPlayFile(file)}
                      disabled={isLoadingFile}
                    >
                      <i className={`fas ${isCurrent ? 'fa-redo' : 'fa-play'}`}></i>
                      <span>{isCurrent ? 'เล่นซ้ำ' : 'เล่น'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {videoFolder.isConnected && recentClips.length === 0 && (
          <div className="replay-empty-state" role="status">
            <i className={`fas ${unsupportedVideoCount > 0 ? 'fa-file-circle-exclamation' : 'fa-film'}`} aria-hidden="true" />
            <strong>{unsupportedVideoCount > 0 ? 'พบไฟล์ แต่รูปแบบยังเล่นใน OBS Browser ไม่ได้' : 'ยังไม่พบไฟล์ Replay'}</strong>
            <span>
              {unsupportedVideoCount > 0
                ? 'กรุณาตั้งค่า OBS Recording Format เป็น MP4, WebM หรือ MKV ที่ OBS รองรับ แล้วบันทึกคลิปใหม่'
                : 'ตรวจสอบว่า OBS บันทึกวิดีโอไว้ในโฟลเดอร์ที่เชื่อมต่อแล้ว จากนั้นกดสแกนใหม่ที่หน้าหลัก'}
            </span>
          </div>
        )}

        {hasLoadedReplay && (
          <div className="replay-transport" aria-label="ตัวควบคุมการเล่น Replay">
            <button type="button" className="replay-button replay-button-primary" onClick={handlePlayPause}>
              <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`} aria-hidden="true" />
              {isPlaying ? 'หยุดชั่วคราว' : 'เล่น Replay'}
            </button>
            <button type="button" className="replay-button replay-button-secondary" onClick={handleReplayAgain} disabled={duration <= 0}>
              <i className="fas fa-rotate-left" aria-hidden="true" />
              เล่นซ้ำช่วงที่เลือก
            </button>
          </div>
        )}

        {/* ── Playback speed ── */}
        {loadedFileName && (
          <div className="replay-section">
            {/* Speed value shown in heading (replaces inline-style badge) */}
            <div className="replay-section-heading">
              <span>ขั้นตอนที่ 3 · ความเร็วการเล่น</span>
              <b>{playbackSpeed.toFixed(2)}×</b>
            </div>
            <div className="speed-control">
              <div className="speed-presets">
                {SPEED_PRESETS.map((speed) => (
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
                   min={MIN_SPEED}
                   max={MAX_SPEED}
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
              <span>ขั้นตอนที่ 4 · ไทม์ไลน์และช่วง Replay</span>
              
            </div>
            <div className="timeline-container">
              <div className="timeline-labels">
                <span>00:00</span>
                <span className="current-time-label">{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <p className="replay-section-hint">คลิกหรือใช้ปุ่มลูกศรบนแถบเพื่อเลื่อนเวลา</p>
              <div
                className="timeline-track"
                role="slider"
                tabIndex={0}
                aria-label="ตำแหน่งการเล่น Replay"
                aria-valuemin={0}
                aria-valuemax={duration}
                aria-valuenow={currentTime}
                onClick={handleTimelineClick}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    event.preventDefault();
                    const delta = event.key === 'ArrowLeft' ? -1 : 1;
                    const nextTime = Math.max(0, Math.min(duration, currentTime + delta));
                    setCurrentTime(nextTime);
                    sendCommand('seek', nextTime);
                  }
                }}
              >
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
            <span>ระยะเวลา Replay</span>
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
              max={Math.max(30, Math.ceil(duration))}
              step="0.5"
              value={replayDuration}
              onChange={(e) => handleReplayDurationChange(Number(e.target.value))}
              className="replay-slider"
            />
          </div>
        </div>

      </section>
    </main>
  );
}
