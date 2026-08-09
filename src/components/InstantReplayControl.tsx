import { useCallback, useEffect, useRef, useState } from 'react';
import { useObsVideoFolderContext } from '../context/ObsVideoFolderContext';
import { useReplayChannel } from '../hooks/useReplayChannel';
import { formatTime, formatSize, findLatestFile } from '../utils/replayFormatters';
import type { CommandMessage } from '../types/instantReplay';
import './InstantReplayControl.css';

const STORAGE_KEYS = {
  REPLAY_DURATION: 'replayDuration',
} as const;

const DEFAULTS = {
  REPLAY_DURATION: 8,
} as const;

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

  const loadAndPlayFile = useCallback(async (targetFile: File) => {
    try {
      setErrorMsg(null);
      setIsLoadingFile(true);

      const data = await targetFile.arrayBuffer();
      send({
        type: 'file',
        data,
        mime: targetFile.type || 'video/mp4',
        name: targetFile.name,
      });

      setLoadedFileName(targetFile.name);
      setDuration(0);
      setCurrentTime(0);
      setMarkerA(null);
      setMarkerB(null);
      
      // Set default playback speed to 0.8x
      setPlaybackSpeed(0.8);
      sendCommand('setSpeed', 0.8);
      sendCommand('play');
    } catch (error) {
      console.error('Failed to load file:', error);
      setErrorMsg(`Failed to load replay file "${targetFile.name}".`);
    } finally {
      setIsLoadingFile(false);
    }
  }, [send, sendCommand]);

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
      setErrorMsg('No video files found in the connected folder.');
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

      setDuration(message.duration);
      setCurrentTime(message.currentTime);
      setMarkerA(message.markerA);
      setMarkerB(message.markerB);

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

  const trimStart = duration > 0
    ? calculateTrimStartTime(duration, replayDuration)
    : null;

  return (
    <main className="instant-replay-control">
      <header className="replay-header">
        <div>
          <div className="replay-brand">INSTANT REPLAY CONTROL</div>
          <div className="replay-subtitle">LIVE BROADCAST REPLAY SYSTEM</div>
        </div>
      </header>

      <section className="replay-control-body">
        {errorMsg && (
          <div className="replay-alert replay-alert-error">
            <i className="fas fa-exclamation-triangle"></i>
            <span>{errorMsg}</span>
            <button className="alert-close" type="button" onClick={() => setErrorMsg(null)}>&times;</button>
          </div>
        )}

        {!videoFolder.isConnected && (
          <div className="replay-alert replay-alert-info">
            <i className="fas fa-info-circle"></i>
            <span>ใช้โฟลเดอร์วิดีโอจากหน้าหลัก — กลับไปกด Connect ที่แถบ &quot;โฟลเดอร์วิดีโอ OBS Replay&quot;</span>
          </div>
        )}

        <div className="one-click-action-bar">
          <button
            className={`one-click-btn ${isLoadingFile ? 'loading' : ''}`}
            onClick={() => void loadAndPlayLatestFile()}
            disabled={isLoadingFile || !videoFolder.isConnected}
            title="1-Click to scan, load, trim, and stream the latest replay file instantly"
          >
            <i className={`fas ${isLoadingFile ? 'fa-spinner fa-spin' : 'fa-bolt'}`}></i>
            <span>{isLoadingFile ? 'LOADING REPLAY...' : '⚡ 1-CLICK LOAD & PLAY LATEST REPLAY'}</span>
          </button>
        </div>

        {recentClips.length > 0 && (
          <div className="replay-section">
            <h3>🎬 Recent Replay Clips ({recentClips.length})</h3>
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
                        {isCurrent && <span className="active-badge">PLAYING</span>}
                      </div>
                      <div className="clip-sub">
                        <span>{formatSize(file.size)}</span>
                        <span>•</span>
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
                      <span>{isCurrent ? 'Replay' : 'Play'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loadedFileName && (
          <div className="replay-section" style={{ position: 'relative' }}>
            <div style={{ 
              position: 'absolute', 
              top: '12px', 
              right: '16px', 
              fontSize: '0.7rem', 
              fontWeight: 700, 
              color: '#39d5ff',
              background: 'rgba(57, 213, 255, 0.1)',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(57, 213, 255, 0.3)'
            }}>
              {playbackSpeed.toFixed(2)}×
            </div>
            <h3>🎚️ Playback Speed</h3>
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

        {loadedFileName && duration > 0 && (
          <div className="replay-section">
            <h3>⏱️ Timeline & Markers</h3>
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
                    <span>TRIM</span>
                  </div>
                )}
                <div className="timeline-playhead" style={{ left: `${(currentTime / duration) * 100}%` }} />
              </div>
            </div>
          </div>
        )}

        <div className="replay-section">
          <h3>⚙️ Settings</h3>
          <div className="setting-group">
            <div className="setting-label">
              <span>Replay Duration</span>
              <span className="setting-value">{replayDuration}s</span>
            </div>
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
                Full
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

        
      </section>
    </main>
  );
}
