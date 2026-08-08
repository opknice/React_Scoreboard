import { useCallback, useEffect, useRef, useState } from 'react';
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

function Header({ onCopyUrl, copied }: { onCopyUrl: () => void; copied: boolean }) {
  return (
    <header className="var-header">
      <div>
        <div className="var-brand"><span>LIVE / </span>VAR REPLAY STUDIO</div>
        <div className="var-subtitle">MATCH REVIEW CONSOLE</div>
      </div>
      <button className={`var-button var-button-header ${copied ? 'copied' : ''}`} type="button" onClick={onCopyUrl}>
        <i className={copied ? 'fas fa-check' : 'fas fa-link'}></i>
        <span>{copied ? 'COPIED!' : 'COPY OBS URL'}</span>
      </button>
    </header>
  );
}

function VarReplayScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const { channelRef, send } = useReplayChannel();
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [transform, setTransform] = useState<Transform>({ zoom: 1, x: 0, y: 0 });
  const [hasVideo, setHasVideo] = useState(false);

  const sendStatus = useCallback(() => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    send({
      type: 'status',
      duration: video.duration,
      currentTime: video.currentTime,
      markerA: loopA,
      markerB: loopB,
    });
  }, [loopA, loopB, send]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;

    channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
      const message = event.data;
      const video = videoRef.current;
      if (!video) return;

      if (message.type === 'file') {
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = URL.createObjectURL(new Blob([message.data], { type: message.mime }));
        video.src = objectUrlRef.current;
        setHasVideo(true);
        video.playbackRate = 1;
        setLoopA(null);
        setLoopB(null);
        setTransform({ zoom: 1, x: 0, y: 0 });
        void video.play().catch(() => undefined);
        return;
      }

      if (message.type !== 'cmd') return;

      if (message.action === 'play') void video.play().catch(() => undefined);
      if (message.action === 'pause') video.pause();
      if (message.action === 'speed' && typeof message.value === 'number') video.playbackRate = message.value;
      if (message.action === 'seek' && typeof message.value === 'number') video.currentTime = message.value;
      if (message.action === 'clearLoop') {
        setLoopA(null);
        setLoopB(null);
      }
      if (message.action === 'setA') {
        const value = typeof message.value === 'number' ? message.value : video.currentTime;
        setLoopA(value);
        if (loopB !== null && value > loopB) {
          setLoopA(loopB);
          setLoopB(value);
        }
      }
      if (message.action === 'setB') {
        const value = typeof message.value === 'number' ? message.value : video.currentTime;
        setLoopB(value);
        if (loopA !== null && value < loopA) {
          setLoopB(loopA);
          setLoopA(value);
        }
      }
      if (message.action === 'transform' && typeof message.value === 'object') setTransform(message.value);
    };

    return () => {
      channel.onmessage = null;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [channelRef, loopA, loopB]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      if (loopA !== null && loopB !== null && video.currentTime > loopB) video.currentTime = loopA;
      if (loopA !== null && loopB !== null && video.currentTime < loopA - 0.1) video.currentTime = loopA;
      sendStatus();
    };
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', sendStatus);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', sendStatus);
    };
  }, [loopA, loopB, sendStatus]);

  return (
    <main className="var-screen">
      <video
        ref={videoRef}
        muted
        playsInline
        className="var-screen-video"
        style={{ transform: `scale(${transform.zoom}) translate(${transform.x}%, ${transform.y}%)` }}
      />
      {!hasVideo && <div className="var-screen-empty">WAITING FOR REPLAY FEED</div>}
    </main>
  );
}

function VarReplayControl() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const markerDragRef = useRef<Marker | null>(null);
  const { channelRef, send } = useReplayChannel();
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [selectedFolderName, setSelectedFolderName] = useState('');
  const [loadedFileName, setLoadedFileName] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [markerA, setMarkerA] = useState<number | null>(null);
  const [markerB, setMarkerB] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);

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
    };
    return () => { channel.onmessage = null; };
  }, [channelRef]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (markerDragRef.current && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
        const time = percentToTime(percent);
        sendCommand(markerDragRef.current === 'A' ? 'setA' : 'setB', time);
        if (markerDragRef.current === 'A') setMarkerA(time); else setMarkerB(time);
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
    send({ type: 'file', data, mime: file.type || 'video/mp4', name: file.name });
    setLoadedFileName(file.name);
    setDuration(0);
    setCurrentTime(0);
    setMarkerA(null);
    setMarkerB(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSpeed(1);
    setIsPlaying(true); // Auto-play after loading
  }, [send]);

  const setLatestFiles = (files: File[], folderName = '') => {
    const allVideos = files.filter(isVideoFile);
    const latestFiles = allVideos.sort((a, b) => b.lastModified - a.lastModified).slice(0, 4);
    setSelectedFolderName(folderName);
    setVideoFiles(latestFiles);
  };

  const selectVideoFolder = async () => {
    const windowWithDirectoryPicker = window as Window & {
      showDirectoryPicker?: () => Promise<{ name: string; values: () => AsyncIterableIterator<{ kind: string; getFile: () => Promise<File> }> }>;
    };

    if (!windowWithDirectoryPicker.showDirectoryPicker) {
      folderInputRef.current?.click();
      return;
    }

    try {
      const directory = await windowWithDirectoryPicker.showDirectoryPicker();
      const files: File[] = [];
      for await (const entry of directory.values()) {
        if (entry.kind === 'file') files.push(await entry.getFile());
      }
      setLatestFiles(files, directory.name);
    } catch (error) {
      // User cancelled or error occurred
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('Failed to open folder:', error);
      }
    }
  };

  const handleFolderSelection = (files: FileList | null) => {
    const allFiles = Array.from(files || []);
    const folderName = allFiles[0]?.webkitRelativePath.split('/')[0] || '';
    setLatestFiles(allFiles, folderName);
  };

  const seekFromPointer = (event: React.PointerEvent) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const percent = ((event.clientX - rect.left) / rect.width) * 100;
    const time = percentToTime(percent);
    setCurrentTime(time);
    sendCommand('seek', time);
  };

  const setMarker = (marker: Marker) => {
    sendCommand(marker === 'A' ? 'setA' : 'setB', currentTime);
    if (marker === 'A') setMarkerA(currentTime); else setMarkerB(currentTime);
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
    sendCommand('transform', { zoom: nextZoom, x: 50 - (nextPan.x + nextSize / 2), y: 50 - (nextPan.y + nextSize / 2) });
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
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };

  const screenUrl = `${window.location.origin}${import.meta.env.BASE_URL}var-replay/screen`;

  const handleCopyUrl = useCallback(() => {
    void navigator.clipboard?.writeText(screenUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [screenUrl]);

  return (
    <main className="var-control">
      <Header onCopyUrl={handleCopyUrl} copied={copied} />
      <section className="var-control-body">
        <input ref={folderInputRef} type="file" accept="video/*" hidden multiple {...({ webkitdirectory: true, directory: true } as Record<string, boolean>)} onChange={(event) => handleFolderSelection(event.target.files)} />
        <button className="var-button var-button-primary var-folder-button" type="button" onClick={() => void selectVideoFolder()}>
          <i className="fas fa-folder-open"></i>
          <span>เลือกโฟลเดอร์วิดีโอ</span>
          <i className="fas fa-chevron-right"></i>
        </button>
        {selectedFolderName && (
          <div className="var-folder-info">
            <i className="fas fa-folder"></i> {selectedFolderName} · {videoFiles.length} ไฟล์วิดีโอ
          </div>
        )}
        {videoFiles.length > 0 && (
          <section className="var-library">
            <div className="var-section-heading"><span>VIDEO LIBRARY {selectedFolderName && `· ${selectedFolderName}`}</span><b>ล่าสุด {videoFiles.length} ไฟล์</b></div>
            <div className="var-file-list">
              {videoFiles.map((file) => (
                <button className={`var-file-row ${loadedFileName === file.name ? 'is-selected' : ''}`} key={`${file.name}-${file.lastModified}`} type="button" onClick={() => void loadFile(file)}>
                  <span>{file.name}</span><small>{formatSize(file.size)} · {new Date(file.lastModified).toLocaleString('th-TH')}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="var-panel var-timeline-panel">
          <div className="var-timeline" ref={timelineRef} onPointerDown={seekFromPointer}>
            <div className="var-track" />
            <div className="var-track-fill" style={{ width: `${timeToPercent(currentTime)}%` }} />
            {markerA !== null && <button className="var-marker" style={{ left: `${timeToPercent(markerA)}%` }} onPointerDown={(event) => { event.stopPropagation(); markerDragRef.current = 'A'; }}><b>A</b></button>}
            {markerB !== null && <button className="var-marker var-marker-b" style={{ left: `${timeToPercent(markerB)}%` }} onPointerDown={(event) => { event.stopPropagation(); markerDragRef.current = 'B'; }}><b>B</b></button>}
          </div>
          <div className="var-time-row"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
        </section>

        <div className="var-command-grid">
          <button 
            className={`var-button ${isPlaying ? 'var-button-pause' : 'var-button-play'}`} 
            type="button" 
            onClick={togglePlayPause}
          >
            {isPlaying ? '⏸️ PAUSE' : '▶️ PLAY'}
          </button>
          <button className={`var-button var-button-marker ${markerA !== null ? 'is-active' : ''}`} type="button" onClick={() => setMarker('A')}>SET A</button>
          <button className={`var-button var-button-marker ${markerB !== null ? 'is-active' : ''}`} type="button" onClick={() => setMarker('B')}>SET B</button>
        </div>
        <button className="var-button var-button-clear" type="button" onClick={() => { setMarkerA(null); setMarkerB(null); sendCommand('clearLoop'); }}>CLEAR LOOP</button>

        <section className="var-panel var-speed-panel">
          <div className="var-control-label"><span>SPEED</span><b>{speed.toFixed(2)}x</b></div>
          <div className="var-speed-presets">
            <button className={`var-button ${speed === 0.25 ? 'is-active' : ''}`} type="button" onClick={() => { setSpeed(0.25); sendCommand('speed', 0.25); }}>0.25x</button>
            <button className={`var-button ${speed === 0.5 ? 'is-active' : ''}`} type="button" onClick={() => { setSpeed(0.5); sendCommand('speed', 0.5); }}>0.5x</button>
            <button className={`var-button ${speed === 0.75 ? 'is-active' : ''}`} type="button" onClick={() => { setSpeed(0.75); sendCommand('speed', 0.75); }}>0.75x</button>
            <button className={`var-button ${speed === 1 ? 'is-active' : ''}`} type="button" onClick={() => { setSpeed(1); sendCommand('speed', 1); }}>1x</button>
          </div>
          <input type="range" min="0.01" max="2" step="0.01" value={speed} onChange={(event) => { const value = Number(event.target.value); setSpeed(value); sendCommand('speed', value); }} />
        </section>

        <section className="var-panel var-pan-panel">
          <div className="var-pan-area">
            <div className="var-pan-frame" onPointerDown={startPan}>
              <div className="var-pan-viewport" style={{ width: `${100 / zoom}%`, height: `${100 / zoom}%`, left: `${pan.x}%`, top: `${pan.y}%` }} />
            </div>
            <button className="var-button var-button-outline" type="button" onClick={resetTransform}>RESET ZOOM &amp; POSITION</button>
          </div>
          <div className="var-zoom-control"><span>ZOOM</span><input type="range" min="1" max="10" step="0.1" value={zoom} onChange={(event) => updateZoom(Number(event.target.value))} /><b>{zoom.toFixed(1)}x</b></div>
        </section>

        <div className="var-footer-info">
          <span>{loadedFileName || 'NO MEDIA LOADED'}</span>
        </div>
      </section>
    </main>
  );
}

export default function VarReplayPage({ mode }: { mode: VarReplayMode }) {
  return mode === 'screen' ? <VarReplayScreen /> : <VarReplayControl />;
}
