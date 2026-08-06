import { useState, useEffect, useRef, useCallback } from 'react';
import { useOBSWebSocket } from './useOBSWebSocket';
import type {
  VarState,
  VarSettings,
  VarMode,
  VarDecision,
  VarLogEntry,
  VarSpeed,
  VarVideoControls
} from '../types/var';

const DEFAULT_SETTINGS: VarSettings = {
  replayFolderPath: '',
  goalSceneName: 'Goal Replay',
  varSceneName: 'VAR',
  mainSceneName: 'Main Stream',
  mediaSourceName: 'VAR_Replay_Source',
  soundSourceName: 'VAR_Sound',
  overlaySourceName: 'VAR_Overlay',
  goalTrimStart: 10,
  goalTrimDuration: 10,
  autoReturnToMain: true,
  autoReturnDelaySec: 2,
};

const DEFAULT_CONTROLS: VarVideoControls = {
  browserSpeed: 1.0,
  browserZoom: 1.0,
  browserPanX: 0,
  browserPanY: 0,
  browserPanXPercent: 0,
  browserPanYPercent: 0,
  currentTime: 0,
  isPlaying: false,
  inPoint: 0,
  outPoint: 0,
  duration: 0,
  obsZoom: 1.0,
  obsPanX: 0,
  obsPanY: 0,
  obsSpeed: 1.0,
  isReEncoding: false,
};

export function useVarSystem(obs: ReturnType<typeof useOBSWebSocket>) {
  const [varState, setVarState] = useState<VarState>(() => {
    const saved = localStorage.getItem('playinstant_var_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...parsed, status: 'IDLE' };
      } catch {
        // Ignore parse error
      }
    }
    return { status: 'IDLE', videoControls: DEFAULT_CONTROLS };
  });

  const [settings, setSettings] = useState<VarSettings>(() => {
    const saved = localStorage.getItem('playinstant_var_settings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {
        // Ignore
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [log, setLog] = useState<VarLogEntry[]>(() => {
    const saved = localStorage.getItem('playinstant_var_log');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Ignore
      }
    }
    return [];
  });

  const pendingReplayResolveRef = useRef<((path: string) => void) | null>(null);
  const pendingReplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Maintain ref to latest varState to prevent stale state closures during async calls
  const varStateRef = useRef<VarState>(varState);
  useEffect(() => {
    varStateRef.current = varState;
  }, [varState]);

  // Sync settings & log to localStorage
  useEffect(() => {
    localStorage.setItem('playinstant_var_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('playinstant_var_log', JSON.stringify(log));
  }, [log]);

  // Setup BroadcastChannel for cross-tab synchronization
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('playinstant_var_channel');
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        if (event.data?.type === 'VAR_STATE_UPDATE') {
          setVarState(event.data.state);
          varStateRef.current = event.data.state;
        }
      };

      return () => {
        channel.close();
      };
    }
  }, []);

  const broadcastState = useCallback((newState: VarState) => {
    setVarState(newState);
    varStateRef.current = newState;

    // Exclude high-frequency currentTime from localStorage to eliminate disk I/O bottleneck
    try {
      localStorage.setItem('playinstant_var_state', JSON.stringify(newState));
    } catch (e) {
      // Ignore storage errors
    }

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'VAR_STATE_UPDATE',
        state: newState,
      });
    }
  }, []);

  // Listen directly for OBS ReplayBufferSaved event
  useEffect(() => {
    const obsRef = obs.getObsRef();
    if (!obsRef || !obs.isConnected) return;

    const handleReplaySaved = (data: any) => {
      const savedPath: string = data.savedReplayPath || data.outputPath || '';
      console.log('[PlayInstant] ReplayBufferSaved event received:', savedPath);
      if (pendingReplayResolveRef.current && savedPath) {
        if (pendingReplayTimerRef.current) {
          clearTimeout(pendingReplayTimerRef.current);
          pendingReplayTimerRef.current = null;
        }
        pendingReplayResolveRef.current(savedPath);
        pendingReplayResolveRef.current = null;
      }
    };

    try {
      obsRef.on('ReplayBufferSaved', handleReplaySaved);
    } catch (e) {
      console.error('[PlayInstant] Failed to attach ReplayBufferSaved listener:', e);
    }

    return () => {
      try {
        obsRef.off('ReplayBufferSaved', handleReplaySaved);
      } catch {
        // Ignore
      }
    };
  }, [obs.isConnected]);

  // Promise helper to wait for ReplayBufferSaved with clean timeout handling
  const waitForReplaySaved = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (pendingReplayTimerRef.current) {
        clearTimeout(pendingReplayTimerRef.current);
        pendingReplayTimerRef.current = null;
      }

      pendingReplayResolveRef.current = resolve;
      pendingReplayTimerRef.current = setTimeout(() => {
        if (pendingReplayResolveRef.current) {
          pendingReplayResolveRef.current = null;
          pendingReplayTimerRef.current = null;
          reject(new Error('Timeout: OBS ReplayBufferSaved event not received within 15s'));
        }
      }, 15000);
    });
  }, []);

  // Update OBS Scene Item Transform for OBS Zoom / Pan
  const updateOBSSceneTransform = useCallback(
    async (zoom: number, panX: number, panY: number, sceneName?: string) => {
      if (!obs.isConnected) return;
      const targetScene = sceneName || (varState.mode === 'goal' ? settings.goalSceneName : settings.varSceneName);
      try {
        const obsRef = obs.getObsRef();
        if (!obsRef) return;

        // Get scene item id for media source
        const itemIdRes = await obs.call('GetSceneItemId', {
          sceneName: targetScene,
          sourceName: settings.mediaSourceName,
        }).catch(() => null);

        if (itemIdRes && itemIdRes.sceneItemId) {
          await obs.call('SetSceneItemTransform', {
            sceneName: targetScene,
            sceneItemId: itemIdRes.sceneItemId,
            sceneItemTransform: {
              scaleX: zoom,
              scaleY: zoom,
              positionX: panX,
              positionY: panY,
            },
          });
        }
      } catch (err) {
        console.warn('[PlayInstant] Failed to set OBS transform:', err);
      }
    },
    [obs, varState.mode, settings]
  );

  // Trigger VAR or Goal replay mode
  const triggerVar = useCallback(
    async (mode: VarMode, specificClipPath?: string) => {
      const now = Date.now();
      let currentClip = specificClipPath;

      let newState: VarState = {
        ...varStateRef.current,
        status: 'SAVING',
        mode,
        startedAt: now,
        errorMessage: undefined,
      };
      broadcastState(newState);

      try {
        if (!currentClip) {
          // Tell OBS to save replay buffer
          if (obs.isConnected) {
            await obs.call('SaveReplayBuffer');
            currentClip = await waitForReplaySaved();
            // Wait 500ms for OBS to cleanly close file handle on Windows
            await new Promise((resolve) => setTimeout(resolve, 500));
          } else {
            throw new Error('OBS Studio is not connected. Please connect OBS first.');
          }
        }

        newState = { ...newState, rawClipPath: currentClip, clipPath: currentClip };

        // Trim clip if in Goal mode
        if (mode === 'goal') {
          newState = { ...newState, status: 'TRIMMING' };
          broadcastState(newState);

          const trimRes = await fetch('/api/ffmpeg/trim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: currentClip,
              start: settings.goalTrimStart,
              duration: settings.goalTrimDuration,
            }),
          });
          const trimData = await trimRes.json();
          if (!trimRes.ok) throw new Error(trimData.error || 'Failed to trim video clip');
          currentClip = trimData.outputPath;
          newState = { ...newState, clipPath: currentClip };
        }

        // Load clip into OBS Media Source
        newState = { ...newState, status: 'LOADING' };
        broadcastState(newState);

        if (obs.isConnected) {
          try {
            await obs.call('SetInputSettings', {
              inputName: settings.mediaSourceName,
              inputSettings: {
                local_file: currentClip,
                restart_on_activate: true,
              },
            });

            await obs.call('TriggerMediaInputAction', {
              inputName: settings.mediaSourceName,
              mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART',
            });

            // Play sound effect if sound source is configured
            if (settings.soundSourceName) {
              obs.call('TriggerMediaInputAction', {
                inputName: settings.soundSourceName,
                mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART',
              }).catch(() => {});
            }

            // Switch scene in OBS
            const targetScene = mode === 'goal' ? settings.goalSceneName : settings.varSceneName;
            await obs.call('SetCurrentProgramScene', { sceneName: targetScene }).catch(() => {});
          } catch (obsErr) {
            console.warn('[useVarSystem] OBS action warning:', obsErr);
          }
        }

        newState = {
          ...newState,
          status: 'PLAYING',
          videoControls: { ...varStateRef.current.videoControls, obsSpeed: 1.0, isPlaying: true, currentTime: 0 },
        };
        broadcastState(newState);
      } catch (err: any) {
        newState = {
          ...newState,
          status: 'ERROR',
          errorMessage: err.message || 'An error occurred during replay processing',
        };
        broadcastState(newState);
      }
    },
    [settings, obs, waitForReplaySaved, broadcastState]
  );

  // Announce VAR Decision
  const announceDecision = useCallback(
    (decision: VarDecision, customText?: string) => {
      const currentState = varStateRef.current;
      const newState: VarState = {
        ...currentState,
        status: 'DECISION',
        decision,
        customDecisionText: customText,
      };
      broadcastState(newState);

      // Add entry to log
      const newEntry: VarLogEntry = {
        id: 'log_' + Date.now(),
        mode: currentState.mode || 'var',
        decision,
        customDecisionText: customText,
        timestamp: Date.now(),
        clipPath: currentState.clipPath,
        obsSpeedUsed: currentState.videoControls.obsSpeed,
      };
      setLog((prev) => [newEntry, ...prev]);
    },
    [broadcastState]
  );

  // Preview Clip — loads clip into VarWindow without touching OBS at all
  const previewClip = useCallback((clipPath: string) => {
    const currentState = varStateRef.current;
    const newState: VarState = {
      ...currentState,
      status: 'IDLE',
      clipPath,
      rawClipPath: clipPath,
      videoControls: {
        ...DEFAULT_CONTROLS,
        isPlaying: false,
      },
    };
    broadcastState(newState);
  }, [broadcastState]);

  // Clear VAR / Return to Main Scene
  const clearVar = useCallback(async () => {
    if (obs.isConnected) {
      await obs.call('SetCurrentProgramScene', {
        sceneName: settings.mainSceneName,
      }).catch(() => {});
    }

    const newState: VarState = {
      status: 'IDLE',
      mode: undefined,
      rawClipPath: undefined,
      clipPath: undefined,
      decision: undefined,
      customDecisionText: undefined,
      errorMessage: undefined,
      videoControls: DEFAULT_CONTROLS,
    };
    broadcastState(newState);
  }, [obs, settings.mainSceneName, broadcastState]);

  // Set OBS Replay Speed (re-encode via FFmpeg & reload into OBS)
  const setOBSSpeed = useCallback(
    async (speed: VarSpeed) => {
      const currentState = varStateRef.current;
      if (!currentState.clipPath) return;

      let newState: VarState = {
        ...currentState,
        status: 'RE_ENCODING',
        videoControls: { ...currentState.videoControls, isReEncoding: true },
      };
      broadcastState(newState);

      try {
        const res = await fetch('/api/ffmpeg/speed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: currentState.rawClipPath || currentState.clipPath,
            speed,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to change OBS video speed');

        const speedClipPath = data.outputPath;

        if (obs.isConnected) {
          await obs.call('SetInputSettings', {
            inputName: settings.mediaSourceName,
            inputSettings: {
              local_file: speedClipPath,
              restart_on_activate: true,
            },
          });
          await obs.call('TriggerMediaInputAction', {
            inputName: settings.mediaSourceName,
            mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART',
          });
        }

        newState = {
          ...varStateRef.current,
          status: 'PLAYING',
          clipPath: speedClipPath,
          videoControls: {
            ...varStateRef.current.videoControls,
            obsSpeed: speed,
            isReEncoding: false,
          },
        };
        broadcastState(newState);
      } catch (err: any) {
        newState = {
          ...varStateRef.current,
          status: 'ERROR',
          errorMessage: err.message,
          videoControls: { ...varStateRef.current.videoControls, isReEncoding: false },
        };
        broadcastState(newState);
      }
    },
    [obs, settings, broadcastState]
  );

  // Set Reverse Playback for Browser Preview
  const setReversePlayback = useCallback(
    async (speed: number) => {
      const currentState = varStateRef.current;
      if (!currentState.clipPath) return;

      let newState: VarState = {
        ...currentState,
        status: 'RE_ENCODING',
        videoControls: { ...currentState.videoControls, isReEncoding: true },
      };
      broadcastState(newState);

      try {
        const res = await fetch('/api/ffmpeg/reverse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: currentState.rawClipPath || currentState.clipPath,
            speed,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to render reverse video playback');

        newState = {
          ...varStateRef.current,
          status: 'PLAYING',
          clipPath: data.outputPath,
          videoControls: {
            ...varStateRef.current.videoControls,
            browserSpeed: speed,
            isReEncoding: false,
          },
        };
        broadcastState(newState);
      } catch (err: any) {
        newState = {
          ...varStateRef.current,
          status: 'ERROR',
          errorMessage: err.message,
          videoControls: { ...varStateRef.current.videoControls, isReEncoding: false },
        };
        broadcastState(newState);
      }
    },
    [broadcastState]
  );

  // Update Controls State
  const updateVideoControls = useCallback(
    (controlsPartial: Partial<VarVideoControls>) => {
      const currentState = varStateRef.current;
      const updatedControls = { ...currentState.videoControls, ...controlsPartial };
      const newState: VarState = {
        ...currentState,
        videoControls: updatedControls,
      };
      broadcastState(newState);

      // If OBS Zoom or Pan changed, sync to OBS
      if (
        controlsPartial.obsZoom !== undefined ||
        controlsPartial.obsPanX !== undefined ||
        controlsPartial.obsPanY !== undefined
      ) {
        updateOBSSceneTransform(
          updatedControls.obsZoom,
          updatedControls.obsPanX,
          updatedControls.obsPanY
        );
      }
    },
    [broadcastState, updateOBSSceneTransform]
  );

  return {
    varState,
    settings,
    setSettings,
    log,
    setLog,
    triggerVar,
    previewClip,
    announceDecision,
    clearVar,
    setOBSSpeed,
    setReversePlayback,
    updateVideoControls,
  };
}
