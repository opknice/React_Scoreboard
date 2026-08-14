import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject, WheelEvent as ReactWheelEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useObsVideoFolderContext } from '../../context/useObsVideoFolderContext';
import { getVideoMimeType, isVideoFile } from '../../utils/replayFormatters';
import { useVarReplayV2Channel } from './useVarReplayV2Channel';
import { usePreviewScrollLock } from './usePreviewScrollLock';
import type { VarReplayV2Message, VarReplayV2State, VarReplayV2Transform } from './varReplayV2Protocol';
import styles from './VarReplayV2.module.css';

type VarReplayV2Mode = 'control' | 'screen';
type Marker = 'A' | 'B';
type PanDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  frameWidth: number;
  frameHeight: number;
};

const SPEED_PRESETS = [0.25, 0.5, 0.75, 1] as const;

function createDefaultReplayState(): VarReplayV2State {
  return {
    duration: 0,
    currentTime: 0,
    markerA: null,
    markerB: null,
    speed: 1,
    isPlaying: false,
    loopEnabled: false,
    transform: { zoom: 1, x: 0, y: 0 },
  };
}

function formatTime(seconds: number, precision = false) {
  if (!Number.isFinite(seconds) || seconds < 0) return precision ? '00:00.00' : '0:00';
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return precision
    ? `${String(minutes).padStart(2, '0')}:${remaining.toFixed(2).padStart(5, '0')}`
    : `${minutes}:${String(Math.floor(remaining)).padStart(2, '0')}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getMaxPan(zoom: number) {
  return Math.max(0, 50 - (50 / Math.max(1, zoom)));
}

function clampTransform(transform: VarReplayV2Transform): VarReplayV2Transform {
  const zoom = clamp(transform.zoom, 1, 10);
  if (zoom <= 1) return { zoom: 1, x: 0, y: 0 };
  const maxPan = getMaxPan(zoom);
  return {
    zoom,
    x: clamp(transform.x, -maxPan, maxPan),
    y: clamp(transform.y, -maxPan, maxPan),
  };
}

function zoomAroundPointer(
  transform: VarReplayV2Transform,
  nextZoom: number,
  pointerX: number,
  pointerY: number,
) {
  if (nextZoom <= 1) return { zoom: 1, x: 0, y: 0 };
  const scaleRatio = nextZoom / transform.zoom;
  return clampTransform({
    zoom: nextZoom,
    x: pointerX * (1 - scaleRatio) + transform.x * scaleRatio,
    y: pointerY * (1 - scaleRatio) + transform.y * scaleRatio,
  });
}

function getMarkerValues(marker: Marker, time: number, currentA: number | null, currentB: number | null) {
  if (marker === 'A' && currentB !== null && time > currentB) {
    return { markerA: currentB, markerB: time };
  }
  if (marker === 'B' && currentA !== null && time < currentA) {
    return { markerA: time, markerB: currentA };
  }
  return {
    markerA: marker === 'A' ? time : currentA,
    markerB: marker === 'B' ? time : currentB,
  };
}

function usePreviewObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return undefined;
    }

    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  return url;
}

function Header({
  screenUrl,
  screenReady,
  folderName,
  copied,
  onBack,
  onCopy,
}: {
  screenUrl: string;
  screenReady: boolean;
  folderName: string;
  copied: boolean;
  onBack: () => void;
  onCopy: () => void;
}) {
  const openScreen = () => window.open(screenUrl, '_blank', 'noopener,noreferrer');

  return (
    <header className={styles.header}>
      <div className={styles.brandBlock}>
        <div className={styles.brand}>VAR Controller</div>
        <div className={styles.headerMeta}>
          <span className={`${styles.statusDot} ${screenReady ? styles.statusReady : styles.statusWaiting}`} />
          {screenReady ? 'OBS Screen พร้อมใช้งาน' : 'รอ OBS Screen'}
          <span className={styles.separator}>·</span>
          โฟลเดอร์: {folderName || 'ยังไม่ได้เชื่อมต่อ'}
        </div>
      </div>
      <div className={styles.headerActions}>
        <button className={styles.secondaryButton} type="button" onClick={onBack}>
          กลับ Scoreboard Control
        </button>
        <button className={styles.secondaryButton} type="button" onClick={openScreen}>
          เปิด Screen
        </button>
        <button className={styles.primaryButton} type="button" onClick={onCopy}>
          {copied ? 'คัดลอกแล้ว!' : 'คัดลอก URL OBS'}
        </button>
      </div>
    </header>
  );
}

function Library({
  files,
  selectedFileName,
  onSelect,
}: {
  files: File[];
  selectedFileName: string;
  onSelect: (file: File) => void;
}) {
  const [search, setSearch] = useState('');
  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? files.filter((file) => file.name.toLowerCase().includes(query)) : files;
  }, [files, search]);

  return (
    <section className={styles.panel}>
      <div className={styles.sectionHeading}>
        <span>คลังวิดีโอ</span>
        <b>{files.length} ไฟล์</b>
      </div>
      <input
        className={styles.searchInput}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="ค้นหาชื่อไฟล์..."
        aria-label="ค้นหาชื่อไฟล์วิดีโอ"
      />
      <div className={styles.fileList}>
        {filteredFiles.length === 0 ? (
          <div className={styles.emptySmall}>{files.length === 0 ? 'ยังไม่มีไฟล์วิดีโอ' : 'ไม่พบไฟล์ที่ค้นหา'}</div>
        ) : filteredFiles.map((file) => (
          <button
            className={`${styles.fileRow} ${selectedFileName === file.name ? styles.fileSelected : ''}`}
            key={`${file.name}-${file.lastModified}`}
            type="button"
            onClick={() => onSelect(file)}
          >
            <span className={styles.fileName} title={file.name}>{file.name}</span>
            <small>{Math.max(1, Math.round(file.size / 1024 / 1024))} MB</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function Preview({
  videoRef,
  previewUrl,
  transform,
  currentTime,
  duration,
  isPlaying,
  onZoom,
  onResetTransform,
  onTransformChange,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  previewUrl: string | null;
  transform: VarReplayV2Transform;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onZoom: (value: number) => void;
  onResetTransform: () => void;
  onTransformChange: (transform: VarReplayV2Transform, smooth?: boolean) => void;
}) {
  const panDragRef = useRef<PanDragState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isPointerInside, setIsPointerInside] = useState(false);

  usePreviewScrollLock(isPointerInside);

  const handlePanStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || transform.zoom <= 1.01) return;
    const frame = event.currentTarget.getBoundingClientRect();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: transform.x,
      startY: transform.y,
      frameWidth: frame.width,
      frameHeight: frame.height,
    };
    setIsPanning(true);
  };

  const handlePanMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const maxPan = getMaxPan(transform.zoom);
    const deltaX = ((event.clientX - drag.startClientX) / drag.frameWidth) * 100;
    const deltaY = ((event.clientY - drag.startClientY) / drag.frameHeight) * 100;
    onTransformChange({
      zoom: transform.zoom,
      x: clamp(drag.startX + deltaX, -maxPan, maxPan),
      y: clamp(drag.startY + deltaY, -maxPan, maxPan),
    });
  };

  const handlePanEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    panDragRef.current = null;
    setIsPanning(false);
  };

  const handlePreviewWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const frame = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - frame.left) / frame.width - 0.5) * 100;
    const pointerY = ((event.clientY - frame.top) / frame.height - 0.5) * 100;
    const normalizedDelta = event.deltaMode === 1
      ? event.deltaY * 16
      : event.deltaMode === 2
        ? event.deltaY * frame.height
        : event.deltaY;
    const nextZoom = clamp(Number((transform.zoom * Math.exp(-normalizedDelta * 0.0008)).toFixed(3)), 1, 10);
    if (nextZoom === transform.zoom) return;
    onTransformChange(zoomAroundPointer(transform, nextZoom, pointerX, pointerY), true);
  };

  return (
    <div className={styles.previewLayout}>
      <section className={styles.previewPanel}>
        <div className={styles.previewHeader}>
          <span>Preview</span>
          <span className={isPlaying ? styles.playingLabel : styles.pausedLabel}>{isPlaying ? 'กำลังเล่น' : 'หยุดชั่วคราว'}</span>
        </div>
        <div
          className={`${styles.previewFrame} ${transform.zoom > 1.01 ? styles.canPan : ''} ${isPanning ? styles.isPanning : ''}`}
          onMouseEnter={() => setIsPointerInside(true)}
          onMouseLeave={() => setIsPointerInside(false)}
          onPointerDown={handlePanStart}
          onPointerMove={handlePanMove}
          onPointerUp={handlePanEnd}
          onPointerCancel={handlePanEnd}
          onWheel={handlePreviewWheel}
        >
          {previewUrl ? (
            <video
              ref={videoRef}
              className={styles.previewVideo}
              src={previewUrl}
              muted
              playsInline
              preload="metadata"
              style={{
                transform: `scale(${transform.zoom}) translate(${transform.x}%, ${transform.y}%)`,
                transition: isPanning ? 'none' : 'transform 140ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          ) : (
            <div className={styles.previewEmpty}>เลือกวิดีโอจากคลังเพื่อเริ่มต้น</div>
          )}
          <div className={styles.previewTime}>{formatTime(currentTime, true)} / {formatTime(duration, true)}</div>
          {transform.zoom > 1.01 && !isPanning && <div className={styles.panHint}>คลิกซ้ายค้างแล้วลากเพื่อ Pan</div>}
        </div>
      </section>
      <ZoomControlRail zoom={transform.zoom} onZoom={onZoom} onReset={onResetTransform} />
    </div>
  );
}

function ZoomControlRail({
  zoom,
  onZoom,
  onReset,
}: {
  zoom: number;
  onZoom: (value: number) => void;
  onReset: () => void;
}) {
  return (
    <aside className={styles.zoomRail} aria-label="การควบคุมซูมวิดีโอ">
      <div className={styles.controlLabel}>
        <span>ซูม</span>
        <b>{zoom.toFixed(1)}x</b>
      </div>
      <input
        className={styles.zoomSlider}
        aria-label="ซูมวิดีโอ"
        type="range"
        min="1"
        max="10"
        step="0.1"
        value={zoom}
        onChange={(event) => onZoom(Number(event.target.value))}
      />
      <button className={`${styles.secondaryButton} ${styles.zoomResetButton}`} type="button" onClick={onReset}>
        รีเซ็ต Pan / Zoom
      </button>
    </aside>
  );
}

function Timeline({
  timelineRef,
  duration,
  currentTime,
  markerA,
  markerB,
  onSeek,
  onMarkerPointerDown,
}: {
  timelineRef: RefObject<HTMLDivElement | null>;
  duration: number;
  currentTime: number;
  markerA: number | null;
  markerB: number | null;
  onSeek: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onMarkerPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, marker: Marker) => void;
}) {
  const toPercent = (time: number | null) => (duration && time !== null ? clamp((time / duration) * 100, 0, 100) : 0);

  return (
    <section className={styles.panel}>
      <div className={styles.sectionHeading}>
        <span>Timeline</span>
        <b>{formatTime(currentTime, true)} / {formatTime(duration, true)}</b>
      </div>
      <div className={styles.timeline} ref={timelineRef} onPointerDown={onSeek} role="slider" aria-label="ตำแหน่งวิดีโอ" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={currentTime} tabIndex={0}>
        <div className={styles.timelineTrack} />
        <div className={styles.timelineFill} style={{ width: `${toPercent(currentTime)}%` }} />
        {markerA !== null && (
          <button
            className={`${styles.marker} ${styles.markerA}`}
            style={{ left: `${toPercent(markerA)}%` }}
            type="button"
            aria-label={`ลากจุด A ${formatTime(markerA, true)}`}
            onPointerDown={(event) => onMarkerPointerDown(event, 'A')}
          >A</button>
        )}
        {markerB !== null && (
          <button
            className={`${styles.marker} ${styles.markerB}`}
            style={{ left: `${toPercent(markerB)}%` }}
            type="button"
            aria-label={`ลากจุด B ${formatTime(markerB, true)}`}
            onPointerDown={(event) => onMarkerPointerDown(event, 'B')}
          >B</button>
        )}
      </div>
      <div className={styles.timeRow}>
        <span>{formatTime(currentTime, true)}</span>
        <span>{formatTime(duration, true)}</span>
      </div>
    </section>
  );
}

function QuickActions({
  isPlaying,
  markerA,
  markerB,
  loopEnabled,
  onPlayPause,
  onMarker,
  onLoop,
  onClear,
}: {
  isPlaying: boolean;
  markerA: number | null;
  markerB: number | null;
  loopEnabled: boolean;
  onPlayPause: () => void;
  onMarker: (marker: Marker) => void;
  onLoop: () => void;
  onClear: () => void;
}) {
  return (
    <div className={styles.quickActions}>
      <button className={`${styles.actionButton} ${isPlaying ? styles.pauseButton : styles.playButton}`} type="button" onClick={onPlayPause}>
        {isPlaying ? 'หยุดชั่วคราว' : 'เล่น'} <kbd>Space</kbd>
      </button>
      <button className={`${styles.actionButton} ${markerA !== null ? styles.activeButton : ''}`} type="button" onClick={() => onMarker('A')}>
        ตั้งจุด A {markerA !== null && <strong>{formatTime(markerA, true)}</strong>} <kbd>A</kbd>
      </button>
      <button className={`${styles.actionButton} ${markerB !== null ? styles.activeButton : ''}`} type="button" onClick={() => onMarker('B')}>
        ตั้งจุด B {markerB !== null && <strong>{formatTime(markerB, true)}</strong>} <kbd>B</kbd>
      </button>
      <button className={`${styles.actionButton} ${loopEnabled ? styles.loopButton : ''}`} type="button" onClick={onLoop}>
        Loop {loopEnabled ? 'เปิด' : 'ปิด'} <kbd>L</kbd>
      </button>
      <button className={`${styles.actionButton} ${styles.clearButton}`} type="button" onClick={onClear}>
        ล้างจุด <kbd>R</kbd>
      </button>
    </div>
  );
}

function SpeedControl({
  speed,
  onSpeed,
}: {
  speed: number;
  onSpeed: (value: number) => void;
}) {
  return (
    <section className={styles.speedControlPanel}>
      <div className={styles.controlLabel}>
        <span>ความเร็ว</span>
        <b>{speed.toFixed(2)}x</b>
      </div>
      <div className={styles.speedGrid}>
        {SPEED_PRESETS.map((preset) => (
          <button className={`${styles.speedButton} ${speed === preset ? styles.activeButton : ''}`} key={preset} type="button" onClick={() => onSpeed(preset)}>{preset}x</button>
        ))}
      </div>
      <input aria-label="ความเร็ววิดีโอ" type="range" min="0.01" max="2" step="0.01" value={speed} onChange={(event) => onSpeed(Number(event.target.value))} />
    </section>
  );
}

function VarReplayV2Control({ onBack }: { onBack?: () => void }) {
  const navigate = useNavigate();
  const videoFolder = useObsVideoFolderContext();
  const { channelRef, send } = useVarReplayV2Channel();
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const markerDragRef = useRef<Marker | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loadedFile, setLoadedFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [markerA, setMarkerA] = useState<number | null>(null);
  const [markerB, setMarkerB] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [transform, setTransform] = useState<VarReplayV2Transform>({ zoom: 1, x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [screenReady, setScreenReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const actualPreviewUrl = usePreviewObjectUrl(loadedFile);
  const currentFileRef = useRef<{ data: ArrayBuffer; mime: string; name: string } | null>(null);
  const currentStateRef = useRef<VarReplayV2State>(createDefaultReplayState());

  const files = useMemo(
    () => (videoFolder.isConnected ? videoFolder.videoFiles.filter(isVideoFile).sort((a, b) => b.lastModified - a.lastModified) : []),
    [videoFolder.isConnected, videoFolder.videoFiles],
  );

  const sendCommand = useCallback((message: Extract<VarReplayV2Message, { type: 'command' }>) => {
    send(message);
  }, [send]);

  const sendCurrentFile = useCallback(() => {
    const currentFile = currentFileRef.current;
    if (!currentFile) return;
    send({
      type: 'file',
      ...currentFile,
      state: currentStateRef.current,
    });
  }, [send]);

  useEffect(() => {
    currentStateRef.current = {
      duration,
      currentTime,
      markerA,
      markerB,
      speed,
      isPlaying,
      loopEnabled,
      transform,
    };
  }, [currentTime, duration, isPlaying, loopEnabled, markerA, markerB, speed, transform]);

  const setTransformAndSend = (next: VarReplayV2Transform, smooth = false) => {
    const safe = clampTransform(next);
    setTransform(safe);
    sendCommand({ type: 'command', action: 'set-transform', value: safe, smooth });
  };

  const loadFile = useCallback(async (file: File) => {
    try {
      setError('');
      setSelectedFile(file);
      setLoadedFile(file);
      setDuration(0);
      setCurrentTime(0);
      setMarkerA(null);
      setMarkerB(null);
      setSpeed(1);
      setTransform({ zoom: 1, x: 0, y: 0 });
      setLoopEnabled(false);
      setIsPlaying(true);
      const data = await file.arrayBuffer();
      const initialState: VarReplayV2State = {
        duration: 0,
        currentTime: 0,
        markerA: null,
        markerB: null,
        speed: 1,
        isPlaying: true,
        loopEnabled: false,
        transform: { zoom: 1, x: 0, y: 0 },
      };
      currentFileRef.current = { data, mime: getVideoMimeType(file), name: file.name };
      currentStateRef.current = initialState;
      sendCurrentFile();
    } catch {
      setError('ไม่สามารถโหลดไฟล์วิดีโอได้');
      setIsPlaying(false);
    }
  }, [sendCurrentFile]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (isPlaying) {
      video?.pause();
      sendCommand({ type: 'command', action: 'pause' });
      setIsPlaying(false);
    } else {
      void video?.play().catch(() => undefined);
      sendCommand({ type: 'command', action: 'play' });
      setIsPlaying(true);
    }
  }, [isPlaying, sendCommand]);

  const setMarker = useCallback((marker: Marker) => {
    const next = getMarkerValues(marker, currentTime, markerA, markerB);
    setMarkerA(next.markerA);
    setMarkerB(next.markerB);
    sendCommand({ type: 'command', action: 'set-marker', marker, value: currentTime });

    // เมื่อกำหนดจุด A และ B ครบ ให้เริ่มเล่นช่วง loop อัตโนมัติทันที
    if (next.markerA !== null && next.markerB !== null) {
      setCurrentTime(next.markerA);
      if (videoRef.current) videoRef.current.currentTime = next.markerA;
      sendCommand({ type: 'command', action: 'seek', value: next.markerA });
      setLoopEnabled(true);
      sendCommand({ type: 'command', action: 'set-loop', enabled: true });
      void videoRef.current?.play().catch(() => undefined);
      sendCommand({ type: 'command', action: 'play' });
      setIsPlaying(true);
      setError('');
    }
  }, [currentTime, markerA, markerB, sendCommand]);

  const clearMarkers = useCallback(() => {
    setMarkerA(null);
    setMarkerB(null);
    setLoopEnabled(false);
    sendCommand({ type: 'command', action: 'clear-markers' });
  }, [sendCommand]);

  const toggleLoop = useCallback(() => {
    if (markerA === null || markerB === null) {
      setError('ต้องตั้งจุด A และ B ก่อนเปิด Loop');
      return;
    }
    const enabled = !loopEnabled;
    setLoopEnabled(enabled);
    sendCommand({ type: 'command', action: 'set-loop', enabled });
  }, [loopEnabled, markerA, markerB, sendCommand]);

  const handleSpeed = (value: number) => {
    setSpeed(value);
    if (videoRef.current) videoRef.current.playbackRate = value;
    sendCommand({ type: 'command', action: 'set-speed', value });
  };

  const handleSeek = useCallback((time: number) => {
    const safeTime = clamp(time, 0, duration);
    setCurrentTime(safeTime);
    if (videoRef.current) videoRef.current.currentTime = safeTime;
    sendCommand({ type: 'command', action: 'seek', value: safeTime });
  }, [duration, sendCommand]);

  const onSeek = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    handleSeek(((event.clientX - rect.left) / rect.width) * duration);
  };

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!markerDragRef.current || !timelineRef.current || !duration) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const time = clamp(((event.clientX - rect.left) / rect.width) * duration, 0, duration);
      const marker = markerDragRef.current;
      const next = getMarkerValues(marker, time, markerA, markerB);
      setMarkerA(next.markerA);
      setMarkerB(next.markerB);
      sendCommand({ type: 'command', action: 'set-marker', marker, value: time });
    };
    const onPointerUp = () => { markerDragRef.current = null; };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [duration, markerA, markerB, sendCommand]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    channel.onmessage = (event: MessageEvent<VarReplayV2Message>) => {
      const message = event.data;
      if (message.type === 'request-sync') {
        sendCurrentFile();
        return;
      }
      if (message.type !== 'status') return;
      setScreenReady(message.ready);
      if (Number.isFinite(message.duration) && message.duration > 0) setDuration(message.duration);
      setCurrentTime(message.currentTime);
      setMarkerA(message.markerA);
      setMarkerB(message.markerB);
      setIsPlaying(message.isPlaying);
      setLoopEnabled(message.loopEnabled);
    };
    return () => { channel.onmessage = null; };
  }, [channelRef, sendCurrentFile]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !actualPreviewUrl) return;
    video.load();
    void video.play().catch(() => undefined);
  }, [actualPreviewUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoadedMetadata = () => setDuration(video.duration);
    const onTimeUpdate = () => {
      if (loopEnabled && markerA !== null && markerB !== null && video.currentTime > markerB) {
        video.currentTime = markerA;
      }
      setCurrentTime(video.currentTime);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [actualPreviewUrl, loopEnabled, markerA, markerB]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      } else if (event.key.toLowerCase() === 'a') {
        setMarker('A');
      } else if (event.key.toLowerCase() === 'b') {
        setMarker('B');
      } else if (event.key.toLowerCase() === 'r') {
        clearMarkers();
      } else if (event.key.toLowerCase() === 'l') {
        toggleLoop();
      } else if (event.key === 'ArrowLeft') {
        handleSeek(currentTime - 0.5);
      } else if (event.key === 'ArrowRight') {
        handleSeek(currentTime + 0.5);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearMarkers, currentTime, handleSeek, toggleLoop, togglePlay, setMarker]);

  const screenUrl = `${window.location.origin}${import.meta.env.BASE_URL}var-replay-v2/screen`;
  const copyUrl = () => {
    void navigator.clipboard?.writeText(screenUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const backToScoreboard = () => {
    if (onBack) {
      onBack();
      return;
    }
    navigate('/');
  };

  return (
    <main className={`${styles.control} ${onBack ? styles.modalControl : ''}`}>
      <Header screenUrl={screenUrl} screenReady={screenReady} folderName={videoFolder.folderName} copied={copied} onBack={backToScoreboard} onCopy={copyUrl} />
      <div className={styles.body}>
        {!videoFolder.isConnected && (
          <div className={styles.infoBanner}>
            <span>ยังไม่ได้เชื่อมต่อโฟลเดอร์วิดีโอ</span>
            {onBack ? (
              <button className={styles.inlineLinkButton} type="button" onClick={onBack}>กลับหน้าหลักเพื่อเลือกโฟลเดอร์</button>
            ) : (
              <a href={`${import.meta.env.BASE_URL}`}>กลับหน้าหลักเพื่อเลือกโฟลเดอร์</a>
            )}
          </div>
        )}
        {error && <div className={styles.errorBanner} role="alert">{error}</div>}
        <div className={styles.mainGrid}>
          <Library files={files} selectedFileName={selectedFile?.name || ''} onSelect={(file) => void loadFile(file)} />
          <div className={styles.workspace}>
            <Preview
              videoRef={videoRef}
              previewUrl={actualPreviewUrl}
              transform={transform}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onZoom={(value) => setTransformAndSend({ ...transform, zoom: value }, true)}
              onResetTransform={() => setTransformAndSend({ zoom: 1, x: 0, y: 0 }, true)}
              onTransformChange={setTransformAndSend}
            />
            <SpeedControl speed={speed} onSpeed={handleSpeed} />
            <Timeline
              timelineRef={timelineRef}
              duration={duration}
              currentTime={currentTime}
              markerA={markerA}
              markerB={markerB}
              onSeek={onSeek}
              onMarkerPointerDown={(event, marker) => { event.stopPropagation(); markerDragRef.current = marker; }}
            />
            <QuickActions isPlaying={isPlaying} markerA={markerA} markerB={markerB} loopEnabled={loopEnabled} onPlayPause={togglePlay} onMarker={setMarker} onLoop={toggleLoop} onClear={clearMarkers} />
            <div className={styles.footer}>{loadedFile?.name || 'ยังไม่ได้โหลดสื่อ'} <span>V2 Channel: v3</span></div>
          </div>
        </div>
      </div>
    </main>
  );
}

function VarReplayV2Screen() {
  const { channelRef, send } = useVarReplayV2Channel();
  const videoRef = useRef<HTMLVideoElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const pendingStateRef = useRef<VarReplayV2State | null>(null);
  const [markerA, setMarkerA] = useState<number | null>(null);
  const [markerB, setMarkerB] = useState<number | null>(null);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [transform, setTransform] = useState<VarReplayV2Transform>({ zoom: 1, x: 0, y: 0 });
  const [smoothTransform, setSmoothTransform] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [, setCurrentTime] = useState(0);
  const [, setSpeed] = useState(1);
  const markerARef = useRef<number | null>(null);
  const markerBRef = useRef<number | null>(null);
  const loopEnabledRef = useRef(false);
  const transformTimeoutRef = useRef<number | null>(null);

  useEffect(() => { markerARef.current = markerA; }, [markerA]);
  useEffect(() => { markerBRef.current = markerB; }, [markerB]);
  useEffect(() => { loopEnabledRef.current = loopEnabled; }, [loopEnabled]);

  const sendStatus = useCallback(() => {
    const video = videoRef.current;
    send({
      type: 'status',
      ready: true,
      duration: video && Number.isFinite(video.duration) ? video.duration : 0,
      currentTime: video?.currentTime || 0,
      markerA: markerARef.current,
      markerB: markerBRef.current,
      isPlaying: Boolean(video && !video.paused),
      loopEnabled: loopEnabledRef.current,
    });
  }, [send]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    const applyMarker = (marker: Marker, value: number) => {
      const next = getMarkerValues(marker, value, markerARef.current, markerBRef.current);
      setMarkerA(next.markerA);
      setMarkerB(next.markerB);
      markerARef.current = next.markerA;
      markerBRef.current = next.markerB;
    };

    channel.onmessage = (event: MessageEvent<VarReplayV2Message>) => {
      const message = event.data;
      const video = videoRef.current;
      if (message.type === 'file') {
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const nextUrl = URL.createObjectURL(new Blob([message.data], { type: message.mime }));
        objectUrlRef.current = nextUrl;
        pendingStateRef.current = message.state || null;
        setMarkerA(null);
        setMarkerB(null);
        markerARef.current = null;
        markerBRef.current = null;
        setLoopEnabled(false);
        loopEnabledRef.current = false;
        setTransform({ zoom: 1, x: 0, y: 0 });
        setCurrentTime(0);
        setSpeed(1);
        if (message.state) {
          setMarkerA(message.state.markerA);
          setMarkerB(message.state.markerB);
          markerARef.current = message.state.markerA;
          markerBRef.current = message.state.markerB;
          setLoopEnabled(message.state.loopEnabled);
          loopEnabledRef.current = message.state.loopEnabled;
          setTransform(clampTransform(message.state.transform));
          setSpeed(clamp(message.state.speed, 0.01, 2));
        }
        setVideoUrl(nextUrl);
        setHasVideo(true);
        return;
      }
      if (message.type !== 'command' || !video) return;
      if (message.action === 'play') void video.play().catch(() => undefined);
      if (message.action === 'pause') video.pause();
      if (message.action === 'seek' && typeof message.value === 'number') video.currentTime = message.value;
      if (message.action === 'set-speed' && typeof message.value === 'number') video.playbackRate = message.value;
      if (message.action === 'set-marker' && message.marker && typeof message.value === 'number') applyMarker(message.marker, message.value);
      if (message.action === 'clear-markers') {
        setMarkerA(null); setMarkerB(null); setLoopEnabled(false);
        markerARef.current = null; markerBRef.current = null; loopEnabledRef.current = false;
      }
      if (message.action === 'set-loop' && typeof message.enabled === 'boolean') {
        setLoopEnabled(message.enabled);
        loopEnabledRef.current = message.enabled;
      }
      if (message.action === 'set-transform' && typeof message.value === 'object') {
        setTransform(message.value);
        setSmoothTransform(Boolean(message.smooth));
        if (transformTimeoutRef.current !== null) window.clearTimeout(transformTimeoutRef.current);
        if (message.smooth) {
          transformTimeoutRef.current = window.setTimeout(() => {
            setSmoothTransform(false);
            transformTimeoutRef.current = null;
          }, 180);
        }
      }
      window.setTimeout(sendStatus, 0);
    };
    sendStatus();
    // Request after the receiver is attached so an immediate controller response
    // cannot arrive before this Screen has installed its message handler.
    send({ type: 'request-sync' });
    return () => { channel.onmessage = null; };
  }, [channelRef, send, sendStatus]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    video.src = videoUrl;
    video.load();
    let stateApplied = false;
    const applyStateWhenReady = () => {
      if (stateApplied) return;
      stateApplied = true;
      const state = pendingStateRef.current;
      if (!state) {
        void video.play().catch(() => undefined);
        sendStatus();
        return;
      }

      const nextTime = clamp(state.currentTime, 0, Number.isFinite(video.duration) ? video.duration : state.currentTime);
      video.currentTime = nextTime;
      video.playbackRate = clamp(state.speed, 0.01, 2);
      setCurrentTime(nextTime);
      setSpeed(video.playbackRate);

      if (state.isPlaying) {
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
      pendingStateRef.current = null;
      sendStatus();
    };

    video.addEventListener('loadedmetadata', applyStateWhenReady, { once: true });
    if (video.readyState >= 1) applyStateWhenReady();
    return () => video.removeEventListener('loadedmetadata', applyStateWhenReady);
  }, [sendStatus, videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      if (loopEnabledRef.current && markerARef.current !== null && markerBRef.current !== null && video.currentTime > markerBRef.current) {
        video.currentTime = markerARef.current;
      }
      sendStatus();
    };
    const onPlayback = () => sendStatus();
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onPlayback);
    video.addEventListener('play', onPlayback);
    video.addEventListener('pause', onPlayback);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onPlayback);
      video.removeEventListener('play', onPlayback);
      video.removeEventListener('pause', onPlayback);
    };
  }, [sendStatus]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    if (transformTimeoutRef.current !== null) window.clearTimeout(transformTimeoutRef.current);
  }, []);

  return (
    <main className={styles.screen}>
      <video
        ref={videoRef}
        className={styles.screenVideo}
        muted
        playsInline
        preload="auto"
        style={{
          transform: `scale(${transform.zoom}) translate(${transform.x}%, ${transform.y}%)`,
          transition: smoothTransform ? 'transform 140ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
        }}
      />
      {!hasVideo && <div className={styles.screenEmpty}>รอสัญญาณ VAR Replay V2</div>}
    </main>
  );
}

export default function VarReplayV2Page({ mode, onBack }: { mode: VarReplayV2Mode; onBack?: () => void }) {
  return mode === 'screen' ? <VarReplayV2Screen /> : <VarReplayV2Control onBack={onBack} />;
}
