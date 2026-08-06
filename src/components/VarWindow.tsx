import React, { useRef, useState, useEffect } from 'react';
import type { VarState, VarVideoControls } from '../types/var';
import { Play, Pause, ZoomIn, ZoomOut, Volume2, VolumeX } from 'lucide-react';

interface VarWindowProps {
  varState: VarState;
  onUpdateControls: (controlsPartial: Partial<VarVideoControls>) => void;
}

export const VarWindow: React.FC<VarWindowProps> = ({
  varState,
  onUpdateControls,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPlayingAB, setIsPlayingAB] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // Mouse drag panning state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggingMarker, setDraggingMarker] = useState<'A' | 'B' | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const controls = varState.videoControls;
  const currentClipPath = varState.clipPath || varState.rawClipPath;

  // --- CRITICAL FIX: Never set <video src> until user clicks Play to avoid Windows File Lock contention
  // Problem: Browser automatically sends HTTP request even with preload="none" when src is set
  // Solution: Keep src empty until user explicitly clicks Play button
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);
  
  // Track pending clip path & last sync timestamp
  const pendingClipPathRef = useRef<string>('');
  const lastSyncTimeRef = useRef<number>(0);

  // Handle Video Metadata & Loaded Duration
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration || 0;
      setDuration(dur);
      const curr = videoRef.current.currentTime || 0;
      if (controls.outPoint === 0 || controls.outPoint > dur) {
        onUpdateControls({
          duration: dur,
          inPoint: 0,
          outPoint: dur,
          currentTime: curr,
        });
      }
    }
  };
  
  // Load video src on-demand
  const loadVideoIfNeeded = (forcedPath?: string) => {
    const targetPath = forcedPath || currentClipPath || pendingClipPathRef.current;
    if (!videoRef.current || !targetPath) return;
    
    const pendingUrl = `/api/video?path=${encodeURIComponent(targetPath)}`;
    
    if (videoSrc !== pendingUrl) {
      console.log('[VarWindow] Loading video src:', targetPath);
      setVideoSrc(pendingUrl);
      videoRef.current.src = pendingUrl;
      videoRef.current.load();
      setHasLoadedOnce(true);
      setCurrentTime(0);
      setDuration(0);
    }
  };

  // Sync clip selection & auto-load if status is active or controls specify playing
  useEffect(() => {
    const newPath = currentClipPath || '';
    pendingClipPathRef.current = newPath;
    
    if (!newPath) return;

    const isVarActive = varState.status === 'PLAYING' || varState.status === 'DECISION' || controls.isPlaying;

    if (newPath !== videoSrc) {
      if (isVarActive || hasLoadedOnce) {
        loadVideoIfNeeded(newPath);
        if (controls.isPlaying && videoRef.current) {
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      } else {
        // Auto load on selection to eliminate manual click barrier
        loadVideoIfNeeded(newPath);
      }
    } else if (isVarActive && videoRef.current && videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [currentClipPath, varState.status, controls.isPlaying, videoSrc]);

  // Handle Play/Pause — ONLY load video when user clicks Play for the first time
  const togglePlayPause = () => {
    if (!videoRef.current) return;
    
    // Load video on first play (lazy loading to avoid file lock)
    if (!hasLoadedOnce || !videoSrc) {
      loadVideoIfNeeded();
      // Wait for metadata to load before playing
      const playWhenReady = () => {
        if (!videoRef.current) return;
        const hasABPoints = controls.inPoint > 0 || (controls.outPoint > 0 && controls.outPoint < duration);
        if (hasABPoints) {
          setIsPlaying(true);
          setIsPlayingAB(true);
        } else {
          setIsPlaying(true);
        }
        videoRef.current.play().catch(() => {});
        onUpdateControls({ isPlaying: true, currentTime: videoRef.current.currentTime });
      };
      videoRef.current.addEventListener('loadedmetadata', playWhenReady, { once: true });
      return;
    }

    // Check if A-B points are properly set
    const hasABPoints = controls.inPoint > 0 || (controls.outPoint > 0 && controls.outPoint < duration);

    if (isPlaying) {
      // Currently playing → pause
      videoRef.current.pause();
      setIsPlaying(false);
      setIsPlayingAB(false);
      onUpdateControls({ isPlaying: false, currentTime: videoRef.current.currentTime });
    } else {
      // Currently paused → play from current position
      if (hasABPoints) {
        // If A-B points exist, enable A-B loop mode but play from current position
        setIsPlaying(true);
        setIsPlayingAB(true);
        videoRef.current.play().catch(() => {});
        onUpdateControls({ isPlaying: true, currentTime: videoRef.current.currentTime });
      } else {
        // No A-B points, play normally from current position
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
        onUpdateControls({ isPlaying: true, currentTime: videoRef.current.currentTime });
      }
    }
  };

  // Play A-B Segment — loops between Point A and Point B continuously
  const playABSegment = () => {
    if (!videoRef.current) return;
    
    // Load video if not loaded yet
    if (!hasLoadedOnce || !videoSrc) {
      loadVideoIfNeeded();
      const playABWhenReady = () => {
        if (!videoRef.current) return;
        const startPt = controls.inPoint || 0;
        videoRef.current.currentTime = startPt;
        setCurrentTime(startPt);
        setIsPlaying(true);
        setIsPlayingAB(true);
        videoRef.current.play().catch(() => {});
        onUpdateControls({ isPlaying: true, currentTime: startPt });
      };
      videoRef.current.addEventListener('loadedmetadata', playABWhenReady, { once: true });
      return;
    }
    
    if (isPlayingAB) {
      // Toggle off: stop looping
      videoRef.current.pause();
      setIsPlaying(false);
      setIsPlayingAB(false);
      onUpdateControls({ isPlaying: false, currentTime: videoRef.current.currentTime });
      return;
    }
    const startPt = controls.inPoint || 0;
    videoRef.current.currentTime = startPt;
    setCurrentTime(startPt);
    setIsPlaying(true);
    setIsPlayingAB(true);
    videoRef.current.play().catch(() => {});
    onUpdateControls({ isPlaying: true, currentTime: startPt });
  };

  // isSeeking flag — prevents OBS broadcast sync from overriding local seek
  const isSeekingRef = useRef<boolean>(false);

  // Step frame back or forward (1 frame ≈ 1/fps)
  const stepFrame = (seconds: number) => {
    if (!videoRef.current) return;

    // Pause immediately & flag as seeking (suppress BroadcastChannel during seek)
    videoRef.current.pause();
    setIsPlaying(false);
    setIsPlayingAB(false);
    isSeekingRef.current = true;

    const targetTime = Math.max(
      0,
      Math.min(duration || videoRef.current.duration || 9999, videoRef.current.currentTime + seconds)
    );

    // Seek to the target frame
    videoRef.current.currentTime = targetTime;

    // Wait for browser to finish decoding & rendering the frame, then broadcast
    const onSeeked = () => {
      if (!videoRef.current) return;
      const actualTime = videoRef.current.currentTime;
      setCurrentTime(actualTime);
      lastSyncTimeRef.current = actualTime;
      // Broadcast only once seek is done
      onUpdateControls({ isPlaying: false, currentTime: actualTime });
      isSeekingRef.current = false;
    };

    videoRef.current.addEventListener('seeked', onSeeked, { once: true });
  };


  // Handle Time Update — broadcast time every 100ms to keep OBS Browser Source frame-exact
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    // Skip normal sync while user is manually stepping frames
    if (isSeekingRef.current) return;

    const nowTime = videoRef.current.currentTime;
    setCurrentTime(nowTime);

    // Loop A-B: when reaching Point B, jump back to Point A and keep playing
    if (isPlayingAB && controls.outPoint > controls.inPoint && nowTime >= controls.outPoint) {
      const loopStart = controls.inPoint || 0;
      videoRef.current.currentTime = loopStart;
      setCurrentTime(loopStart);
      videoRef.current.play().catch(() => {});
      onUpdateControls({ isPlaying: true, currentTime: loopStart });
      return;
    }

    // Sync time to parent/BroadcastChannel at a reasonable interval (0.25s / 4fps) to avoid thread lag
    if (Math.abs(nowTime - lastSyncTimeRef.current) >= 0.25) {
      lastSyncTimeRef.current = nowTime;
      onUpdateControls({
        currentTime: nowTime,
        isPlaying: !videoRef.current.paused,
      });
    }
  };


  // Speed Slider Handler (0.1x to 2x, no negative speeds, no pause at 0)
  const handleSpeedSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseFloat(e.target.value);
    
    // Ensure minimum speed is 0.1x
    if (val < 0.1) val = 0.1;

    if (videoRef.current) {
      videoRef.current.playbackRate = val;
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    }
    setIsPlaying(true);
    onUpdateControls({ browserSpeed: val });
  };

  // Quick Speed Presets: [0.25x], [0.5x], [1x], [1.5x], [2x]
  const setQuickSpeed = (speed: number) => {
    // Ensure minimum speed is 0.1x
    if (speed < 0.1) speed = 0.1;
    
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      videoRef.current.play().catch(() => {});
    }
    setIsPlaying(true);
    onUpdateControls({ browserSpeed: speed });
  };


  // Mouse Pan Start
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (controls.browserZoom > 1.0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - controls.browserPanX, y: e.clientY - controls.browserPanY });
    }
  };

  // Mouse Pan Move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging && controls.browserZoom > 1.0 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const newPanX = e.clientX - dragStart.x;
      const newPanY = e.clientY - dragStart.y;
      const percentX = rect.width > 0 ? (newPanX / rect.width) * 100 : 0;
      const percentY = rect.height > 0 ? (newPanY / rect.height) * 100 : 0;

      onUpdateControls({
        browserPanX: newPanX,
        browserPanY: newPanY,
        browserPanXPercent: percentX,
        browserPanYPercent: percentY,
      });
    }
  };

  // Mouse Pan End
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Timeline Seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    setCurrentTime(time);
    onUpdateControls({ currentTime: time });
  };

  // Marker Drag Handlers
  const handleMarkerMouseDown = (marker: 'A' | 'B', e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingMarker(marker);
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingMarker || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, offsetX / rect.width));
    const newTime = percent * duration;

    if (draggingMarker === 'A') {
      onUpdateControls({ inPoint: newTime });
    } else if (draggingMarker === 'B') {
      onUpdateControls({ outPoint: newTime });
    }
  };

  const handleTimelineMouseUp = () => {
    setDraggingMarker(null);
  };

  // Global mouse up listener
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setDraggingMarker(null);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Format mm:ss.ss
  const formatTime = (timeInSec: number) => {
    const mins = Math.floor(timeInSec / 60);
    const secs = (timeInSec % 60).toFixed(1);
    return `${mins.toString().padStart(2, '0')}:${secs.padStart(4, '0')}`;
  };

  const panStyleX = controls.browserPanXPercent !== undefined
    ? `${controls.browserPanXPercent}%`
    : `${controls.browserPanX}px`;
  const panStyleY = controls.browserPanYPercent !== undefined
    ? `${controls.browserPanYPercent}%`
    : `${controls.browserPanY}px`;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-2xl flex flex-col gap-3 select-none text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-400 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-white font-bold tracking-wider">PLAYINSTANT VAR REVIEW WINDOW</span>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <span>Clip: <strong className="text-slate-200">{varState.clipPath?.split(/[/\\]/).pop() || 'No clip loaded'}</strong></span>
          <span>Zoom: <strong className="text-amber-400">{controls.browserZoom}x</strong></span>
        </div>
      </div>

      {/* Video + Zoom Sidebar Layout */}
      <div className="flex gap-2 items-start">
        {/* Video Container with Pan Drag */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`relative flex-1 aspect-video max-h-[550px] bg-black rounded-lg overflow-hidden border border-slate-800 cursor-${
            controls.browserZoom > 1.0 ? 'grab active:cursor-grabbing' : 'default'
          }`}
        >
          {pendingClipPathRef.current ? (
            <div
              className="w-full h-full transition-transform duration-75"
              style={{
                transform: `scale(${controls.browserZoom}) translate(${panStyleX}, ${panStyleY})`,
              }}
            >
              <video
                ref={videoRef}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain pointer-events-none"
                muted={isMuted}
                preload="none"
              />
              {!hasLoadedOnce && (
                <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-emerald-400 pointer-events-none">
                  <Play className="w-12 h-12 animate-pulse" />
                  <span className="text-sm font-bold">Click PLAY to load video</span>
                  <span className="text-xs text-slate-400">(Prevents Windows file lock conflict with OBS)</span>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-2">
              <span className="text-4xl">🎬</span>
              <span className="text-xs">No Replay Clip Selected — Double click a clip from Library</span>
            </div>
          )}

          {/* Loading overlay when FFmpeg is re-encoding */}
          {controls.isReEncoding && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20 text-amber-400">
              <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-bold tracking-widest uppercase">Rendering Video Speed / Reverse...</span>
            </div>
          )}

          {/* Status Overlay Badge */}
          {varState.status !== 'IDLE' && (
            <div className="absolute top-3 left-3 bg-red-600/90 text-white font-black text-[10px] tracking-widest px-2.5 py-1 rounded shadow-lg uppercase flex items-center gap-1.5 z-10">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
              <span>VAR MODE: {varState.status}</span>
            </div>
          )}
        </div>

        {/* Zoom Sidebar — vertical slider, height matches video container */}
        <div className="flex flex-col items-center justify-between w-10 py-2 px-1 bg-slate-950/60 rounded-lg border border-slate-800 self-stretch max-h-[550px]">
          <ZoomIn className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <input
            type="range"
            min={1.0}
            max={4.0}
            step={0.2}
            value={controls.browserZoom}
            onChange={(e) => onUpdateControls({ browserZoom: parseFloat(e.target.value) })}
            className="cursor-pointer accent-amber-500"
            style={{
              writingMode: 'vertical-lr',
              direction: 'rtl',
              width: '6px',
              height: 'calc(100% - 80px)',
            }}
            title={`Zoom: ${controls.browserZoom.toFixed(1)}x`}
          />
          <ZoomOut className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-[9px] font-mono text-amber-400 font-bold leading-none">{controls.browserZoom.toFixed(1)}x</span>
          <button
            onClick={() => onUpdateControls({ browserZoom: 1.0, browserPanX: 0, browserPanY: 0, browserPanXPercent: 0, browserPanYPercent: 0 })}
            className="text-[9px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded px-1 py-0.5 leading-none"
            title="Reset Zoom & Pan"
          >
            ⊙
          </button>
        </div>
      </div>

      {/* Frame Accurate Timeline & A/B Trim Controls */}
      <div className="flex flex-col gap-1.5 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Current: <strong className="text-emerald-400">{formatTime(currentTime)}</strong></span>
          <span>In (A): <strong className="text-blue-400">{formatTime(controls.inPoint)}</strong></span>
          <span>Out (B): <strong className="text-pink-400">{formatTime(controls.outPoint)}</strong></span>
          <span>Duration: <strong className="text-white">{formatTime(duration)}</strong></span>
        </div>

        {/* Timeline Slider with A/B Marker Notches & Selection Range */}
        {(() => {
          const maxDur = duration > 0 ? duration : 100;
          const inPct = Math.min(100, Math.max(0, (controls.inPoint / maxDur) * 100));
          const outPct = Math.min(100, Math.max(0, (controls.outPoint / maxDur) * 100));
          const hasIn = controls.inPoint > 0;
          const hasOut = controls.outPoint > 0 && controls.outPoint <= duration;
          const showRange = hasIn || (hasOut && controls.outPoint < duration);

          return (
            <div
              ref={timelineRef}
              className="relative w-full flex items-center py-3"
              onMouseMove={handleTimelineMouseMove}
              onMouseUp={handleTimelineMouseUp}
              onMouseLeave={handleTimelineMouseUp}
            >
              {/* Highlighted A-B Selection Bar */}
              {showRange && outPct > inPct && (
                <div
                  className="absolute h-2.5 bg-gradient-to-r from-blue-500/50 to-pink-500/50 rounded pointer-events-none z-0 border-y border-blue-400/30"
                  style={{ left: `${inPct}%`, width: `${outPct - inPct}%` }}
                />
              )}

              {/* Marker Notch A (In-Point) — Draggable */}
              {hasIn && (
                <div
                  className="absolute top-0 bottom-0 w-1 bg-blue-400 z-30 flex flex-col items-center cursor-ew-resize hover:bg-blue-300 hover:w-1.5 transition-all"
                  style={{ left: `${inPct}%` }}
                  onMouseDown={(e) => handleMarkerMouseDown('A', e)}
                  title="Drag to adjust Point A"
                >
                  <span className="text-[9px] font-mono font-black text-blue-300 -top-3.5 absolute bg-blue-950/90 px-1 py-0.2 rounded border border-blue-400 shadow pointer-events-none select-none">
                    A
                  </span>
                </div>
              )}

              {/* Marker Notch B (Out-Point) — Draggable */}
              {hasOut && (
                <div
                  className="absolute top-0 bottom-0 w-1 bg-pink-400 z-30 flex flex-col items-center cursor-ew-resize hover:bg-pink-300 hover:w-1.5 transition-all"
                  style={{ left: `${outPct}%` }}
                  onMouseDown={(e) => handleMarkerMouseDown('B', e)}
                  title="Drag to adjust Point B"
                >
                  <span className="text-[9px] font-mono font-black text-pink-300 -top-3.5 absolute bg-pink-950/90 px-1 py-0.2 rounded border border-pink-400 shadow pointer-events-none select-none">
                    B
                  </span>
                </div>
              )}

              <input
                type="range"
                min={0}
                max={maxDur}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 relative z-20"
              />
            </div>
          );
        })()}

        {/* Action Buttons for Play/Pause, Frame Step, and A/B Points */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5">
            {/* Main Play / Pause Button */}
            <button
              onClick={togglePlayPause}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black text-white flex items-center gap-1.5 shadow-lg transition-transform active:scale-95 ${
                isPlaying
                  ? 'bg-amber-600 hover:bg-amber-500 border border-amber-400/50'
                  : 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/50'
              }`}
              title="เล่น / หยุดวิดีโอ (Spacebar / Click)"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>PAUSE (⏸)</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>PLAY (▶)</span>
                </>
              )}
            </button>

            {/* Frame Step Back (-0.04s) */}
            <button
              onClick={() => stepFrame(-0.04)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 font-mono font-bold flex items-center gap-1"
              title="ถอยหลัง 1 เฟรม (0.04s)"
            >
              <span>⏮ -1 Frame</span>
            </button>

            {/* Frame Step Forward (+0.04s) */}
            <button
              onClick={() => stepFrame(0.04)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 font-mono font-bold flex items-center gap-1"
              title="เดินหน้า 1 เฟรม (0.04s)"
            >
              <span>+1 Frame ⏭</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onUpdateControls({ inPoint: currentTime })}
              className="bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 text-xs px-2.5 py-1.5 rounded-lg border border-blue-500/40 flex items-center gap-1 font-bold"
            >
              [A ⬇] Set In-Point
            </button>
            <button
              onClick={() => onUpdateControls({ outPoint: currentTime })}
              className="bg-pink-600/30 hover:bg-pink-600/50 text-pink-300 text-xs px-2.5 py-1.5 rounded-lg border border-pink-500/40 flex items-center gap-1 font-bold"
            >
              [B ⬇] Set Out-Point
            </button>
            <button
              onClick={playABSegment}
              className={`text-xs px-3 py-1.5 rounded-lg border font-black shadow flex items-center gap-1.5 transition-transform active:scale-95 ${
                isPlayingAB
                  ? 'bg-purple-600 text-white border-purple-400 animate-pulse'
                  : 'bg-purple-950/80 hover:bg-purple-800 text-purple-200 border-purple-500/50'
              }`}
              title="เล่นวิดีโอเฉพาะช่วงที่มาร์กจุด A ถึง B แล้วหยุดอัตโนมัติ"
            >
              <Play className="w-3.5 h-3.5 fill-current text-purple-300" />
              <span>▶ Play A-B</span>
            </button>
            <button
              onClick={() => onUpdateControls({ inPoint: 0, outPoint: duration })}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2 py-1.5 rounded-lg border border-slate-700"
            >
              Reset A/B
            </button>
          </div>
        </div>
      </div>

      {/* Speed Controls Section with Quick Buttons (0x to 2x, no negative) */}
      <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
        {/* Speed Slider & Buttons */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300">PLAYBACK SPEED:</span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-emerald-400 font-bold">{controls.browserSpeed.toFixed(2)}x</span>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1 rounded border border-slate-700 flex items-center justify-center"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
            </div>
          </div>

          {/* Slider (0.1x to 2x) */}
          <div className="relative w-full flex items-center">
            <input
              type="range"
              min={0.1}
              max={2.0}
              step={0.05}
              value={controls.browserSpeed}
              onChange={handleSpeedSliderChange}
              className="w-full h-2.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Quick Speed Buttons */}
          <div className="flex items-center justify-between gap-1">
            <button
              onClick={() => setQuickSpeed(0.25)}
              className={`flex-1 py-1 text-xs font-mono font-bold rounded border ${
                Math.abs(controls.browserSpeed - 0.25) < 0.01
                  ? 'bg-amber-600 text-white border-amber-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              0.25x
            </button>
            <button
              onClick={() => setQuickSpeed(0.5)}
              className={`flex-1 py-1 text-xs font-mono font-bold rounded border ${
                Math.abs(controls.browserSpeed - 0.5) < 0.01
                  ? 'bg-amber-600 text-white border-amber-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              0.5x
            </button>
            <button
              onClick={() => setQuickSpeed(1.0)}
              className={`flex-1 py-1 text-xs font-mono font-bold rounded border ${
                Math.abs(controls.browserSpeed - 1.0) < 0.01
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              1x
            </button>
            <button
              onClick={() => setQuickSpeed(1.5)}
              className={`flex-1 py-1 text-xs font-mono font-bold rounded border ${
                Math.abs(controls.browserSpeed - 1.5) < 0.01
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              1.5x
            </button>
            <button
              onClick={() => setQuickSpeed(2.0)}
              className={`flex-1 py-1 text-xs font-mono font-bold rounded border ${
                Math.abs(controls.browserSpeed - 2.0) < 0.01
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              2x
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
