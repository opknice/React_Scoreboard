import { useCallback, useEffect, useRef, useState } from 'react';
import { useObsVideoFolderContext } from '../context/useObsVideoFolderContext';
import { getVideoMimeType } from '../utils/replayFormatters';
import './VarReplayPage.css';

const CHANNEL_NAME = 'scoreboard_var_replay_studio_v2';
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|avi|mkv)$/i;

type VarReplayMode = 'control' | 'screen';
type Marker = 'A' | 'B';
type Command =
  | { type: 'file'; data: ArrayBuffer; mime: string; name: string }
  | { type: 'cmd'; action: string; value?: number | Transform };
type Transform = { zoom: number; x: number; y: number };
type StatusMessage = {
  type: 'status';
  duration: number;
  currentTime: number;
  markerA: number | null;
  markerB: number | null;
  isPlaying: boolean;
};
type ChannelMessage = Command | StatusMessage;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isVideoFile(file: File) {
  return file.type.startsWith('video/') || VIDEO_EXTENSIONS.test(file.name);
}

function useReplayChannel() {
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  const send = useCallback((message: ChannelMessage) => {
    channelRef.current?.postMessage(message);
  }, []);

  return { channelRef, send };
}

/* ── Header ─────────────────────────────────────────────── */
function Header({ onCopyUrl, copied }: { onCopyUrl: () => void; copied: boolean }) {
  return (
    <header className="var-header">
      <div>
        <div className="var-brand">VAR Controller</div>

      </div>
      <button
        className={`var-button-header ${copied ? 'copied' : ''}`}
        type="button"
        onClick={onCopyUrl}
      >
        <i className={copied ? 'fas fa-check' : 'fas fa-link'} />
        <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอก URL สำหรับ OBS'}</span>
      </button>
    </header>
  );
}

/* ── Screen (output window) ──────────────────────────────── */
function VarReplayScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const canPlayHandlerRef = useRef<(() => void) | null>(null);
  const videoErrorHandlerRef = useRef<(() => void) | null>(null);
  const { channelRef, send } = useReplayChannel();
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const loopARef = useRef<number | null>(null);
  const loopBRef = useRef<number | null>(null);
  const lastStatusAtRef = useRef(0);
  const [transform, setTransform] = useState<Transform>({ zoom: 1, x: 0, y: 0 });
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => { loopARef.current = loopA; }, [loopA]);
  useEffect(() => { loopBRef.current = loopB; }, [loopB]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const sendStatus = useCallback((force = false) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const now = performance.now();
    if (!force && now - lastStatusAtRef.current < 200) return;
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

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    const mountedVideo = videoRef.current;

    const cleanupPendingPlaybackHandlers = () => {
      if (!mountedVideo) return;
      if (canPlayHandlerRef.current) {
        mountedVideo.removeEventListener('canplay', canPlayHandlerRef.current);
        mountedVideo.removeEventListener('loadeddata', canPlayHandlerRef.current);
        canPlayHandlerRef.current = null;
      }
      if (videoErrorHandlerRef.current) {
        mountedVideo.removeEventListener('error', videoErrorHandlerRef.current);
        videoErrorHandlerRef.current = null;
      }
    };

    channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
      const message = event.data;
      const video = videoRef.current;
      if (!video) return;

      if (message.type === 'file') {
        cleanupPendingPlaybackHandlers();
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = URL.createObjectURL(new Blob([message.data], { type: message.mime }));
        video.src = objectUrlRef.current;
        setHasVideo(true);
        video.playbackRate = 1;
        setLoopA(null);
        setLoopB(null);
        loopARef.current = null;
        loopBRef.current = null;
        setTransform({ zoom: 1, x: 0, y: 0 });
        lastStatusAtRef.current = 0;

        const onCanPlay = () => {
          cleanupPendingPlaybackHandlers();
          void video.play().catch((error) => {
            console.warn('[VarReplayScreen] Video play was blocked or failed:', error);
          });
        };
        const onVideoError = () => {
          const detail = video.error ? `code ${video.error.code}` : 'unknown media error';
          console.error(`[VarReplayScreen] Failed to load VAR replay video "${message.name}" (${message.mime}): ${detail}`);
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

      if (message.type !== 'cmd') return;

      if (message.action === 'play')  void video.play().catch(() => undefined);
      if (message.action === 'pause') video.pause();
      if ((message.action === 'speed' || message.action === 'setSpeed') && typeof message.value === 'number') video.playbackRate = message.value;
      if (message.action === 'seek'  && typeof message.value === 'number') video.currentTime = message.value;
      if (message.action === 'clearLoop') {
        setLoopA(null);
        setLoopB(null);
        loopARef.current = null;
        loopBRef.current = null;
      }
      if (message.action === 'setA') {
        const value = typeof message.value === 'number' ? message.value : video.currentTime;
        const currentB = loopBRef.current;
        if (currentB !== null && value > currentB) {
          setLoopA(currentB); setLoopB(value);
          loopARef.current = currentB; loopBRef.current = value;
        } else {
          setLoopA(value);
          loopARef.current = value;
        }
      }
      if (message.action === 'setB') {
        const value = typeof message.value === 'number' ? message.value : video.currentTime;
        const currentA = loopARef.current;
        if (currentA !== null && value < currentA) {
          setLoopB(currentA); setLoopA(value);
          loopBRef.current = currentA; loopARef.current = value;
        } else {
          setLoopB(value);
          loopBRef.current = value;
        }
      }
      if (message.action === 'transform' && typeof message.value === 'object') {
        setTransform(message.value as Transform);
      }
    };

    return () => {
      channel.onmessage = null;
      cleanupPendingPlaybackHandlers();
    };
  }, [channelRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (loopARef.current !== null && loopBRef.current !== null && video.currentTime > loopBRef.current) {
        video.currentTime = loopARef.current;
      }
      if (loopARef.current !== null && loopBRef.current !== null && video.currentTime < loopARef.current - 0.1) {
        video.currentTime = loopARef.current;
      }
      sendStatus();
    };

    const onLoadedMetadata = () => sendStatus(true);
    const onPlaybackStatus = () => sendStatus();

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('play', onPlaybackStatus);
    video.addEventListener('pause', onPlaybackStatus);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', onPlaybackStatus);
      video.removeEventListener('pause', onPlaybackStatus);
    };
  }, [sendStatus]);

  return (
    <main className="var-screen">
      <video
        ref={videoRef}
        muted
        playsInline
        preload="auto"
        className="var-screen-video"
        style={{ transform: `scale(${transform.zoom}) translate(${transform.x}%, ${transform.y}%)` }}
      />
      {!hasVideo && <div className="var-screen-empty">รอสัญญาณรีเพลย์</div>}
    </main>
  );
}

/* ── Control panel ───────────────────────────────────────── */
function VarReplayControl() {
  const videoFolder = useObsVideoFolderContext();
  const timelineRef = useRef<HTMLDivElement>(null);
  const markerDragRef = useRef<Marker | null>(null);
  const panCleanupRef = useRef<(() => void) | null>(null);
  const { channelRef, send } = useReplayChannel();

  const [loadedFileName, setLoadedFileName] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [markerA, setMarkerA] = useState<number | null>(null);
  const [markerB, setMarkerB] = useState<number | null>(null);
  const markerARef = useRef<number | null>(null);
  const markerBRef = useRef<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);

  // Refs sync
  useEffect(() => { markerARef.current = markerA; }, [markerA]);
  useEffect(() => { markerBRef.current = markerB; }, [markerB]);

  // Pan cleanup on unmount
  useEffect(() => { return () => { panCleanupRef.current?.(); }; }, []);

  const videoFiles = videoFolder.isConnected
    ? videoFolder.videoFiles
        .filter(isVideoFile)
        .sort((a, b) => b.lastModified - a.lastModified)
    : [];

  const timeToPercent = useCallback((time: number) => {
    if (!duration) return 0;
    return Math.max(0, Math.min(100, (time / duration) * 100));
  }, [duration]);

  const percentToTime = useCallback((percent: number) => {
    return Math.max(0, Math.min(duration, (percent / 100) * duration));
  }, [duration]);

  const sendCommand = useCallback((action: string, value?: number | Transform) => {
    send({ type: 'cmd', action, value });
  }, [send]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      sendCommand('pause');
      setIsPlaying(false);
    } else {
      sendCommand('play');
      setIsPlaying(true);
    }
  }, [isPlaying, sendCommand]);

  // Listen for status from Screen
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
      const data = event.data;
      if (data.type !== 'status') return;
      setDuration(data.duration);
      setCurrentTime(data.currentTime);
      setMarkerA(data.markerA);
      setMarkerB(data.markerB);
      setIsPlaying(data.isPlaying);
    };
    return () => { channel.onmessage = null; };
  }, [channelRef]);

  // Marker drag on timeline
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (markerDragRef.current && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        if (rect.width === 0) return;
        const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
        const time = percentToTime(percent);
        const dragging = markerDragRef.current;
        sendCommand(dragging === 'A' ? 'setA' : 'setB', time);
        if (dragging === 'A') {
          const currentB = markerBRef.current;
          if (currentB !== null && time > currentB) {
            setMarkerA(currentB); setMarkerB(time);
            markerARef.current = currentB; markerBRef.current = time;
            markerDragRef.current = 'B';
          } else {
            setMarkerA(time);
            markerARef.current = time;
          }
        } else {
          const currentA = markerARef.current;
          if (currentA !== null && time < currentA) {
            setMarkerB(currentA); setMarkerA(time);
            markerBRef.current = currentA; markerARef.current = time;
            markerDragRef.current = 'A';
          } else {
            setMarkerB(time);
            markerBRef.current = time;
          }
        }
      }
    };
    const onPointerUp = () => { markerDragRef.current = null; };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [percentToTime, sendCommand]);

  const loadFile = useCallback(async (file: File) => {
    const data = await file.arrayBuffer();
    send({ type: 'file', data, mime: getVideoMimeType(file), name: file.name });
    setLoadedFileName(file.name);
    setDuration(0);
    setCurrentTime(0);
    setMarkerA(null);
    setMarkerB(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSpeed(1);
    setIsPlaying(true);
  }, [send]);

  const seekFromPointer = (event: React.PointerEvent) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    if (rect.width === 0) return;
    const percent = ((event.clientX - rect.left) / rect.width) * 100;
    const time = percentToTime(percent);
    setCurrentTime(time);
    sendCommand('seek', time);
  };

  const setMarker = (marker: Marker) => {
    sendCommand(marker === 'A' ? 'setA' : 'setB', currentTime);
    if (marker === 'A') {
      if (markerB !== null && currentTime > markerB) {
        setMarkerA(markerB); setMarkerB(currentTime);
      } else {
        setMarkerA(currentTime);
      }
    } else {
      if (markerA !== null && currentTime < markerA) {
        setMarkerB(markerA); setMarkerA(currentTime);
      } else {
        setMarkerB(currentTime);
      }
    }
  };

  const updateZoom = (nextZoom: number) => {
    const oldSize = 100 / zoom;
    const centerX = pan.x + oldSize / 2;
    const centerY = pan.y + oldSize / 2;
    const nextSize = 100 / nextZoom;
    const nextPan = {
      x: Math.max(0, Math.min(100 - nextSize, centerX - nextSize / 2)),
      y: Math.max(0, Math.min(100 - nextSize, centerY - nextSize / 2)),
    };
    setZoom(nextZoom);
    setPan(nextPan);
    sendCommand('transform', {
      zoom: nextZoom,
      x: 50 - (nextPan.x + nextSize / 2),
      y: 50 - (nextPan.y + nextSize / 2),
    });
  };

  const resetTransform = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    sendCommand('transform', { zoom: 1, x: 0, y: 0 });
  };

  const startPan = (event: React.PointerEvent) => {
    if (zoom <= 1.01) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    const frame = event.currentTarget.getBoundingClientRect();
    const move = (moveEvent: PointerEvent) => {
      const size = 100 / zoom;
      const nextPan = {
        x: Math.max(0, Math.min(100 - size, start.panX + ((moveEvent.clientX - start.x) / frame.width) * 100)),
        y: Math.max(0, Math.min(100 - size, start.panY + ((moveEvent.clientY - start.y) / frame.height) * 100)),
      };
      setPan(nextPan);
      sendCommand('transform', { zoom, x: 50 - (nextPan.x + size / 2), y: 50 - (nextPan.y + size / 2) });
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      panCleanupRef.current = null;
    };
    panCleanupRef.current = end;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };

  const screenUrl = `${window.location.origin}${import.meta.env.BASE_URL}var-replay/screen`;

  const handleCopyUrl = useCallback(() => {
    void navigator.clipboard?.writeText(screenUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [screenUrl]);

  /* ── Speed presets ─────────────────────────────────────── */
  const SPEED_PRESETS = [0.25, 0.5, 0.75, 1] as const;

  return (
    <main className="var-control">
      <Header onCopyUrl={handleCopyUrl} copied={copied} />

      <section className="var-control-body">

        {/* ── Info banner when folder not connected ── */}
        {!videoFolder.isConnected && (
<div className="var-folder-info" style={{ color: '#d9534f' }}>
  <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }} />
  <span>ใช้โฟลเดอร์จากหน้าหลัก — กลับไปกด Connect ที่แถบ &quot;โฟลเดอร์วิดีโอ OBS Replay&quot;</span>
</div>
        )}

        {/* ── Video Library ── */}
        {videoFiles.length > 0 && (
          <section className="var-library">
            <div className="var-section-heading">
              <span>คลังวิดีโอ · {videoFolder.folderName}</span>
              <b>ทั้งหมด {videoFiles.length} ไฟล์</b>
            </div>
            <div className="var-file-list-wrap">
              <div className="var-file-list">
                {videoFiles.map((file) => (
                  <button
                    className={`var-file-row ${loadedFileName === file.name ? 'is-selected' : ''}`}
                    key={`${file.name}-${file.lastModified}`}
                    type="button"
                    onClick={() => void loadFile(file)}
                  >
                    <span>
                      <i className="fas fa-file-video" style={{ color: '#39d5ff', fontSize: '.8rem' }} />
                      {file.name}
                    </span>
                    <small>{formatSize(file.size)} · {new Date(file.lastModified).toLocaleString('th-TH')}</small>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Timeline ── */}
        <section className="var-panel var-timeline-panel">
          <div className="var-section-heading">
            <span>ไทม์ไลน์ · จุดตัด</span>
            <b style={{ fontFamily: 'monospace' }}>{formatTime(currentTime)} / {formatTime(duration)}</b>
          </div>
          <div
            className="var-timeline"
            ref={timelineRef}
            onPointerDown={seekFromPointer}
          >
            <div className="var-track" />
            <div
              className="var-track-fill"
              style={{ width: `${timeToPercent(currentTime)}%` }}
            />
            {markerA !== null && (
              <button
                className="var-marker"
                style={{ left: `${timeToPercent(markerA)}%` }}
                onPointerDown={(event) => { event.stopPropagation(); markerDragRef.current = 'A'; }}
              >
                <b>A</b>
              </button>
            )}
            {markerB !== null && (
              <button
                className="var-marker var-marker-b"
                style={{ left: `${timeToPercent(markerB)}%` }}
                onPointerDown={(event) => { event.stopPropagation(); markerDragRef.current = 'B'; }}
              >
                <b>B</b>
              </button>
            )}
          </div>
          <div className="var-time-row">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </section>

        {/* ── Playback commands ── */}
        <div className="var-command-grid">
          <button
            className={`var-button ${isPlaying ? 'var-button-pause' : 'var-button-play'}`}
            type="button"
            onClick={togglePlayPause}
          >
            {isPlaying ? <><i className="fas fa-pause" /> หยุดชั่วคราว</> : <><i className="fas fa-play" /> เล่น</>}
          </button>
          <button
            className={`var-button var-button-marker ${markerA !== null ? 'is-active' : ''}`}
            type="button"
            onClick={() => setMarker('A')}
          >
            <i className="fas fa-map-marker-alt" /> ตั้งจุด A
          </button>
          <button
            className={`var-button var-button-marker ${markerB !== null ? 'is-active' : ''}`}
            type="button"
            onClick={() => setMarker('B')}
          >
            <i className="fas fa-map-marker-alt" /> ตั้งจุด B
          </button>
        </div>
        <button
          className="var-button var-button-clear"
          type="button"
          onClick={() => { setMarkerA(null); setMarkerB(null); sendCommand('clearLoop'); }}
        >
          <i className="fas fa-times-circle" /> ล้างลูป
        </button>

        {/* ── Speed ── */}
        <section className="var-panel var-speed-panel">
          <div className="var-control-label">
            <span>ความเร็วการเล่น</span>
            <b>{speed.toFixed(2)}x</b>
          </div>
          <div className="var-speed-presets">
            {SPEED_PRESETS.map((s) => (
              <button
                key={s}
                className={`var-button ${speed === s ? 'is-active' : ''}`}
                type="button"
                onClick={() => { setSpeed(s); sendCommand('speed', s); }}
              >
                {s}x
              </button>
            ))}
          </div>
          <input
            type="range"
            min="0.01"
            max="2"
            step="0.01"
            value={speed}
            onChange={(event) => {
              const value = Number(event.target.value);
              setSpeed(value);
              sendCommand('speed', value);
            }}
          />
        </section>

        {/* ── Pan & Zoom ── */}
        <section className="var-panel var-pan-panel">
          <div className="var-pan-area">
            <div className="var-pan-frame" onPointerDown={startPan}>
              <div
                className="var-pan-viewport"
                style={{
                  width: `${100 / zoom}%`,
                  height: `${100 / zoom}%`,
                  left: `${pan.x}%`,
                  top: `${pan.y}%`,
                }}
              />
            </div>
            <button
              className="var-button var-button-outline"
              type="button"
              onClick={resetTransform}
            >
              <i className="fas fa-compress-alt" /> รีเซ็ตซูมและตำแหน่ง
            </button>
          </div>
          <div className="var-zoom-control">
            <span>ซูม</span>
            <input
              type="range"
              min="1"
              max="10"
              step="0.1"
              value={zoom}
              onChange={(event) => updateZoom(Number(event.target.value))}
            />
            <b>{zoom.toFixed(1)}x</b>
          </div>
        </section>

        {/* ── Footer ── */}
        <div className="var-footer-info">
          <span>{loadedFileName || 'ยังไม่ได้โหลดสื่อ'}</span>
        </div>

      </section>
    </main>
  );
}

export default function VarReplayPage({ mode }: { mode: VarReplayMode }) {
  return mode === 'screen' ? <VarReplayScreen /> : <VarReplayControl />;
}
