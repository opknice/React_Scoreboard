import { useCallback, useEffect, useRef, useState } from 'react';
import { useObsVideoFolderContext } from '../context/ObsVideoFolderContext';
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
  isPlaying: boolean; // [Fix 2] เพิ่ม field isPlaying
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
  // [Fix 1 & 7] เพิ่ม refs เก็บค่า loop ล่าสุด ให้ message handler อ่านได้โดยไม่ต้องอยู่ใน dependency array
  const loopARef = useRef<number | null>(null);
  const loopBRef = useRef<number | null>(null);
  const [transform, setTransform] = useState<Transform>({ zoom: 1, x: 0, y: 0 });
  const [hasVideo, setHasVideo] = useState(false);

  // Sync refs กับ state เสมอ
  useEffect(() => { loopARef.current = loopA; }, [loopA]);
  useEffect(() => { loopBRef.current = loopB; }, [loopB]);

  // [Fix 7] แยก cleanup objectUrl ออกมาเป็น effect ของตัวเอง
  // ทำให้ revoke เฉพาะตอน unmount จริง ๆ ไม่ใช่ทุกครั้งที่ loopA/B เปลี่ยน
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  // [Fix 2] sendStatus อ่าน loop จาก refs และส่ง isPlaying จาก video.paused จริง
  const sendStatus = useCallback(() => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    send({
      type: 'status',
      duration: video.duration,
      currentTime: video.currentTime,
      markerA: loopARef.current,
      markerB: loopBRef.current,
      isPlaying: !video.paused,
    });
  }, [send]); // ไม่ต้อง depend on loopA, loopB อีกต่อไป

  // [Fix 1 & 7] effect นี้ไม่ต้อง depend on loopA/loopB — ใช้ refs แทน
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
        // อัปเดต state และ refs พร้อมกัน
        setLoopA(null);
        setLoopB(null);
        loopARef.current = null;
        loopBRef.current = null;
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
        loopARef.current = null;
        loopBRef.current = null;
      }
      // [Fix 1] ใช้ refs อ่านค่าปัจจุบัน แทน closure state เก่า
      if (message.action === 'setA') {
        const value = typeof message.value === 'number' ? message.value : video.currentTime;
        const currentB = loopBRef.current;
        if (currentB !== null && value > currentB) {
          // swap: A ใหม่อยู่เกิน B → สลับ
          setLoopA(currentB);
          setLoopB(value);
          loopARef.current = currentB;
          loopBRef.current = value;
        } else {
          setLoopA(value);
          loopARef.current = value;
        }
      }
      if (message.action === 'setB') {
        const value = typeof message.value === 'number' ? message.value : video.currentTime;
        const currentA = loopARef.current;
        if (currentA !== null && value < currentA) {
          // swap: B ใหม่น้อยกว่า A → สลับ
          setLoopB(currentA);
          setLoopA(value);
          loopBRef.current = currentA;
          loopARef.current = value;
        } else {
          setLoopB(value);
          loopBRef.current = value;
        }
      }
      if (message.action === 'transform' && typeof message.value === 'object') setTransform(message.value);
    };

    return () => {
      channel.onmessage = null;
      // ไม่ revoke objectUrl ที่นี่แล้ว — จัดการใน effect แยกด้านบน
    };
  }, [channelRef]); // [Fix 1 & 7] ตัด loopA, loopB ออกจาก deps

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      // [Fix 1] ใช้ refs แทน state ใน timeupdate handler
      if (loopARef.current !== null && loopBRef.current !== null && video.currentTime > loopBRef.current) {
        video.currentTime = loopARef.current;
      }
      if (loopARef.current !== null && loopBRef.current !== null && video.currentTime < loopARef.current - 0.1) {
        video.currentTime = loopARef.current;
      }
      sendStatus();
    };
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', sendStatus);
    // [Fix 2] ฟัง play/pause events เพื่อส่งสถานะ isPlaying ที่ถูกต้องกลับไป Control
    video.addEventListener('play', sendStatus);
    video.addEventListener('pause', sendStatus);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', sendStatus);
      video.removeEventListener('play', sendStatus);
      video.removeEventListener('pause', sendStatus);
    };
  }, [sendStatus]); // ตอนนี้ depend แค่ sendStatus อย่างเดียว

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
  const videoFolder = useObsVideoFolderContext();
  const timelineRef = useRef<HTMLDivElement>(null);
  const markerDragRef = useRef<Marker | null>(null);
  // [Fix 5] ref เก็บ cleanup function ของ startPan เพื่อ cancel ได้ตอน unmount
  const panCleanupRef = useRef<(() => void) | null>(null);
  const { channelRef, send } = useReplayChannel();
  const [loadedFileName, setLoadedFileName] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [markerA, setMarkerA] = useState<number | null>(null);
  const [markerB, setMarkerB] = useState<number | null>(null);
  // [Fix 3 & 6] refs เก็บค่า marker ล่าสุดสำหรับ drag handler ที่ไม่มี stale closure
  const markerARef = useRef<number | null>(null);
  const markerBRef = useRef<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync marker refs กับ state
  useEffect(() => { markerARef.current = markerA; }, [markerA]);
  useEffect(() => { markerBRef.current = markerB; }, [markerB]);

  // [Fix 5] cleanup pan listeners ถ้า unmount ขณะกำลัง drag อยู่
  useEffect(() => {
    return () => { panCleanupRef.current?.(); };
  }, []);

  // [Fix 4] sort ตาม lastModified ก่อน slice เพื่อให้ได้ "ล่าสุด" จริง ๆ
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
      setIsPlaying(data.isPlaying); // [Fix 2] sync isPlaying จาก Screen จริง
    };
    return () => { channel.onmessage = null; };
  }, [channelRef]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (markerDragRef.current && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        if (rect.width === 0) return; // [Fix 6] guard กัน division by zero / Infinity
        const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
        const time = percentToTime(percent);
        const dragging = markerDragRef.current;
        sendCommand(dragging === 'A' ? 'setA' : 'setB', time);
        // [Fix 3] mirror swap logic จาก Screen และอัปเดต refs ด้วย
        if (dragging === 'A') {
          const currentB = markerBRef.current;
          if (currentB !== null && time > currentB) {
            setMarkerA(currentB);
            setMarkerB(time);
            markerARef.current = currentB;
            markerBRef.current = time;
            markerDragRef.current = 'B'; // สลับ marker ที่กำลัง drag
          } else {
            setMarkerA(time);
            markerARef.current = time;
          }
        } else {
          const currentA = markerARef.current;
          if (currentA !== null && time < currentA) {
            setMarkerB(currentA);
            setMarkerA(time);
            markerBRef.current = currentA;
            markerARef.current = time;
            markerDragRef.current = 'A'; // สลับ marker ที่กำลัง drag
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

  const seekFromPointer = (event: React.PointerEvent) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    if (rect.width === 0) return; // [Fix 6] guard กัน Infinity ใน seekFromPointer ด้วย
    const percent = ((event.clientX - rect.left) / rect.width) * 100;
    const time = percentToTime(percent);
    setCurrentTime(time);
    sendCommand('seek', time);
  };

  // [Fix 3] setMarker มี swap logic ตรงกับ Screen
  const setMarker = (marker: Marker) => {
    sendCommand(marker === 'A' ? 'setA' : 'setB', currentTime);
    if (marker === 'A') {
      if (markerB !== null && currentTime > markerB) {
        setMarkerA(markerB);
        setMarkerB(currentTime);
      } else {
        setMarkerA(currentTime);
      }
    } else {
      if (markerA !== null && currentTime < markerA) {
        setMarkerB(markerA);
        setMarkerA(currentTime);
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
    sendCommand('transform', { zoom: nextZoom, x: 50 - (nextPan.x + nextSize / 2), y: 50 - (nextPan.y + nextSize / 2) });
  };

  const resetTransform = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    sendCommand('transform', { zoom: 1, x: 0, y: 0 });
  };

  // [Fix 5] ลงทะเบียน cleanup ใน panCleanupRef เพื่อให้ unmount cancel ได้
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
    panCleanupRef.current = end; // [Fix 5] เก็บ cleanup ไว้ให้ unmount เรียกได้
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
        {!videoFolder.isConnected && (
          <div className="var-folder-info" style={{ marginBottom: '12px', color: '#fbbf24' }}>
            <i className="fas fa-info-circle"></i> ใช้โฟลเดอร์จากหน้าหลัก — กลับไปกด Connect ที่แถบ &quot;โฟลเดอร์วิดีโอ OBS Replay&quot;
          </div>
        )}
        {videoFiles.length > 0 && (
          <section className="var-library">
            <div className="var-section-heading"><span>VIDEO LIBRARY · {videoFolder.folderName}</span><b>ทั้งหมด {videoFiles.length} ไฟล์</b></div>
            <div className="var-file-list-wrap">
              <div className="var-file-list">
                {videoFiles.map((file) => (
                  <button className={`var-file-row ${loadedFileName === file.name ? 'is-selected' : ''}`} key={`${file.name}-${file.lastModified}`} type="button" onClick={() => void loadFile(file)}>
                    <span>{file.name}</span><small>{formatSize(file.size)} · {new Date(file.lastModified).toLocaleString('th-TH')}</small>
                  </button>
                ))}
              </div>
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
