/**
 * VarPreviewPage — หน้าวิดีโอ-only สำหรับใช้เป็น OBS Browser Source
 * เส้นทาง: /var-preview
 * ขนาด OBS: 1920x1080 (16:9)
 * ซิงค์วิดีโอกับ InstantReplayPage ผ่าน BroadcastChannel
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { VarState } from '../types/var';

export const VarPreviewPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [clipPath, setClipPath] = useState<string | null>(null);
  const [speed, setSpeed] = useState<number>(1.0);
  const [zoom, setZoom] = useState<number>(1.0);
  const [panXPercent, setPanXPercent] = useState<number>(0);
  const [panYPercent, setPanYPercent] = useState<number>(0);
  const [panXRaw, setPanXRaw] = useState<number>(0);
  const [panYRaw, setPanYRaw] = useState<number>(0);
  const [status, setStatus] = useState<string>('IDLE');
  const [decision, setDecision] = useState<string | null>(null);
  const [customText, setCustomText] = useState<string | null>(null);
  
  // CRITICAL FIX: Lazy load video src to avoid Windows File Lock contention
  // OBS Browser Source (CEF) also sends HTTP request when src is set, causing lock conflict
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);
  const pendingClipPathRef = useRef<string | null>(null);

  const applyState = useCallback((state: VarState) => {
    const newClip = state.clipPath || state.rawClipPath || null;
    const didClipChange = newClip !== clipPath;
    
    setClipPath(newClip);
    setStatus(state.status || 'IDLE');
    setDecision(state.decision || null);
    setCustomText(state.customDecisionText || null);
    
    if (newClip) {
      pendingClipPathRef.current = newClip;
      const isVarActive = state.status && state.status !== 'IDLE';
      if (isVarActive || didClipChange) {
        loadVideoIfNeeded(newClip);
      }
    }

    const vc = state.videoControls;
    if (vc) {
      setSpeed(vc.browserSpeed || 1.0);
      setZoom(vc.browserZoom || 1.0);

      if (vc.browserPanXPercent !== undefined) {
        setPanXPercent(vc.browserPanXPercent);
      } else {
        setPanXPercent(0);
      }

      if (vc.browserPanYPercent !== undefined) {
        setPanYPercent(vc.browserPanYPercent);
      } else {
        setPanYPercent(0);
      }

      setPanXRaw(vc.browserPanX || 0);
      setPanYRaw(vc.browserPanY || 0);

      // Playhead & Play/Pause Synchronization
      if (videoRef.current && vc.currentTime !== undefined) {
        const timeDiff = Math.abs(videoRef.current.currentTime - vc.currentTime);
        // If paused (frame step), sync exact frame (>0.01s). If playing, only correct drift if >0.3s to prevent stutter.
        if ((!vc.isPlaying && timeDiff > 0.01) || (vc.isPlaying && timeDiff > 0.3)) {
          videoRef.current.currentTime = vc.currentTime;
        }

        if (vc.isPlaying === false) {
          if (!videoRef.current.paused) videoRef.current.pause();
        } else if (vc.isPlaying === true && (vc.browserSpeed || 1.0) !== 0) {
          if (videoRef.current.paused) videoRef.current.play().catch(() => {});
        }
      }
    }
  }, [clipPath]);
  
  // Load video src on-demand
  const loadVideoIfNeeded = useCallback((pathToLoad: string) => {
    if (!pathToLoad) return;
    
    const pendingUrl = `/api/video?path=${encodeURIComponent(pathToLoad)}`;
    
    if (videoSrc !== pendingUrl) {
      console.log('[VarPreviewPage] Auto-loading video:', pathToLoad);
      setVideoSrc(pendingUrl);
      setHasLoadedOnce(true);
      
      if (videoRef.current) {
        videoRef.current.src = pendingUrl;
        videoRef.current.load();
      }
    }
  }, [videoSrc]);

  // Listen for real-time updates from BroadcastChannel, storage events, and lightweight interval polling
  useEffect(() => {
    let lastSavedString = '';

    const checkLocalStorage = () => {
      try {
        const saved = localStorage.getItem('playinstant_var_state');
        if (saved && saved !== lastSavedString) {
          lastSavedString = saved;
          applyState(JSON.parse(saved));
        }
      } catch {
        // Ignore
      }
    };

    // Initial check
    checkLocalStorage();

    // Lightweight 250ms fallback polling for OBS CEF browser source
    const timerId = setInterval(checkLocalStorage, 250);

    // 1. BroadcastChannel (for same browser process)
    let channel: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel('playinstant_var_channel');
      channel.onmessage = (event) => {
        if (event.data?.type === 'VAR_STATE_UPDATE' && event.data.state) {
          lastSavedString = JSON.stringify(event.data.state);
          applyState(event.data.state);
        }
      };
    }

    // 2. Storage Event (for cross-process updates between Chrome & OBS CEF)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'playinstant_var_state' && e.newValue) {
        lastSavedString = e.newValue;
        try {
          applyState(JSON.parse(e.newValue));
        } catch {
          // Ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(timerId);
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [applyState]);

  // Sync playback speed
  useEffect(() => {
    if (videoRef.current && hasLoadedOnce) {
      if (speed === 0) {
        videoRef.current.pause();
      } else {
        videoRef.current.playbackRate = Math.max(0.1, speed);
        videoRef.current.play().catch(() => {});
      }
    }
  }, [speed, clipPath, hasLoadedOnce]);

  // Compute pan style (prefer percentage for 100% resolution-independent scaling)
  const panStyleX = panXPercent !== 0 ? `${panXPercent}%` : `${panXRaw}px`;
  const panStyleY = panYPercent !== 0 ? `${panYPercent}%` : `${panYRaw}px`;

  // Decision badge colors
  const decisionColors: Record<string, string> = {
    GOAL: 'bg-emerald-600 text-white',
    NO_GOAL: 'bg-red-700 text-white',
    PENALTY: 'bg-amber-600 text-white',
    NO_PENALTY: 'bg-slate-700 text-white',
    RED_CARD: 'bg-rose-700 text-white',
    NO_RED_CARD: 'bg-slate-700 text-white',
    CONFIRMED: 'bg-teal-600 text-white',
    OVERTURNED: 'bg-indigo-700 text-white',
    CUSTOM: 'bg-purple-700 text-white',
  };

  return (
    <div
      className="w-screen h-screen bg-black overflow-hidden relative flex items-center justify-center"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      {/* 16:9 Aspect Video Box matching VarWindow Controller */}
      <div className="w-full aspect-video relative overflow-hidden bg-black flex items-center justify-center">
        {hasLoadedOnce && videoSrc ? (
          <div
            className="w-full h-full transition-transform duration-75"
            style={{
              transform: `scale(${zoom}) translate(${panStyleX}, ${panStyleY})`,
            }}
          >
            <video
              ref={videoRef}
              className="w-full h-full object-contain pointer-events-none"
              playsInline
              muted={false}
              preload="none"
            />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <div className="text-slate-800 text-6xl font-black tracking-widest opacity-20 select-none">
              PLAYINSTANT
            </div>
            <div className="text-slate-700 text-sm opacity-30">VAR REPLAY STANDBY</div>
          </div>
        )}
      </div>

      {/* VAR STATUS Overlay Badge (top-left) */}
      {status !== 'IDLE' && status !== 'PLAYING' && (
        <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/70 border border-white/10 px-4 py-2 rounded-lg z-30">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
          <span className="text-white font-black text-sm tracking-widest uppercase">
            VAR {status}
          </span>
        </div>
      )}

      {/* VAR DECISION Overlay (bottom center) */}
      {decision && status === 'DECISION' && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-30">
          <div className="bg-black/80 border border-white/20 text-white text-[10px] font-black tracking-[0.3em] px-3 py-1 rounded-t-lg uppercase">
            VIDEO ASSISTANT REFEREE
          </div>
          <div className={`px-10 py-3 rounded-lg text-2xl font-black tracking-widest shadow-2xl uppercase text-center ${decisionColors[decision] || 'bg-slate-700 text-white'}`}>
            {decision === 'CUSTOM' ? (customText || 'VAR DECISION') : decision.replace(/_/g, ' ')}
          </div>
        </div>
      )}
    </div>
  );
};

export default VarPreviewPage;
