import { useState, useEffect, useRef } from 'react';

interface MacroState {
  isEnabled: boolean;
  logs: string[];
  lastTrigger: string;
}

export function useAutoMacros(obs: any) {
  // Replay Macro State
  const [replayState, setReplayState] = useState<MacroState>(() => ({
    isEnabled: localStorage.getItem('replayAutoSwitch') === 'true',
    logs: [],
    lastTrigger: ''
  }));

  // Main Stream Macro State
  const [mainStreamState, setMainStreamState] = useState<MacroState>(() => ({
    isEnabled: localStorage.getItem('mainStreamAutoSwitch') === 'true',
    logs: [],
    lastTrigger: ''
  }));

  const isProcessingReplayRef = useRef(false);
  const isProcessingMainStreamRef = useRef(false);

  // --- Helper: Add log ---
  const addReplayLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    const logEntry = `[${time}] ${message}`;
    setReplayState((prev) => ({
      ...prev,
      logs: [...prev.logs.slice(-9), logEntry]
    }));
    console.log('[ReplayAutoSwitcher]', message);
  };

  const addMainStreamLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    const logEntry = `[${time}] ${message}`;
    setMainStreamState((prev) => ({
      ...prev,
      logs: [...prev.logs.slice(-9), logEntry]
    }));
    console.log('[MainStreamAutoSwitcher]', message);
  };

  // --- Macro #1: Replay Buffer Saved → Switch to Replay ---
  useEffect(() => {
    if (!obs.isConnected || !replayState.isEnabled) return;

    const obsRef = obs.getObsRef();
    if (!obsRef) return;

    const handleReplayBufferSaved = async (data: any) => {
      if (isProcessingReplayRef.current) {
        addReplayLog('⚠️ Already processing, skipping...');
        return;
      }

      isProcessingReplayRef.current = true;
      const savedPath = data.savedReplayPath || 'Unknown';

      try {
        addReplayLog('🎬 Replay Buffer Saved detected!');
        addReplayLog(`📁 File: ${savedPath}`);

        addReplayLog('⏳ Waiting 3.5 seconds...');
        await new Promise((resolve) => setTimeout(resolve, 3500));

        addReplayLog('🔄 Switching to Replay scene...');
        await obsRef.call('SetCurrentProgramScene', { sceneName: 'Replay' });

        addReplayLog('✅ Successfully switched to Replay!');
        setReplayState((prev) => ({
          ...prev,
          lastTrigger: new Date().toLocaleTimeString()
        }));
      } catch (error: any) {
        addReplayLog(`❌ Error: ${error.message}`);
      } finally {
        isProcessingReplayRef.current = false;
      }
    };

    obsRef.on('ReplayBufferSaved', handleReplayBufferSaved);
    addReplayLog('✨ Auto-switch enabled and listening...');

    return () => {
      obsRef.off('ReplayBufferSaved', handleReplayBufferSaved);
      addReplayLog('🛑 Auto-switch disabled');
    };
  }, [obs.isConnected, replayState.isEnabled]);

  // --- Macro #2: Media Playback Ended → Switch to Main Stream ---
  useEffect(() => {
    if (!obs.isConnected || !mainStreamState.isEnabled) return;

    const obsRef = obs.getObsRef();
    if (!obsRef) return;

    const handleMediaPlaybackEnded = async (data: any) => {
      const inputName = data.inputName;

      if (inputName !== 'Source Replay') {
        return; // Ignore other media sources
      }

      if (isProcessingMainStreamRef.current) {
        addMainStreamLog('⚠️ Already processing, skipping...');
        return;
      }

      isProcessingMainStreamRef.current = true;

      try {
        addMainStreamLog(`🎬 Media ended: ${inputName}`);

        // 1. Switch scene to Main Stream
        addMainStreamLog('🔄 Switching to Main Stream scene...');
        await obsRef.call('SetCurrentProgramScene', { sceneName: 'Main Stream' });

        // 2. Wait 2 seconds
        addMainStreamLog('⏳ Wait 2s...');
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 3. Show Goal_Alert
        addMainStreamLog('👁️ Showing Goal_Alert...');
        const goalAlertId = await obsRef.call('GetSceneItemId', {
          sceneName: 'Main Stream',
          sourceName: 'Goal_Alert'
        });
        if (goalAlertId && goalAlertId.sceneItemId !== undefined) {
          await obsRef.call('SetSceneItemEnabled', {
            sceneName: 'Main Stream',
            sceneItemId: goalAlertId.sceneItemId,
            sceneItemEnabled: true
          });
        }

        // 4. Wait 3 seconds
        addMainStreamLog('⏳ Wait 3s...');
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // 5. Hide Goal_Alert
        addMainStreamLog('🙈 Hiding Goal_Alert...');
        if (goalAlertId && goalAlertId.sceneItemId !== undefined) {
          await obsRef.call('SetSceneItemEnabled', {
            sceneName: 'Main Stream',
            sceneItemId: goalAlertId.sceneItemId,
            sceneItemEnabled: false
          });
        }

        // 6. Wait 1 second
        addMainStreamLog('⏳ Wait 1s...');
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // 7. Show Main_events
        addMainStreamLog('👁️ Showing Main_events...');
        const mainEventsId = await obsRef.call('GetSceneItemId', {
          sceneName: 'Main Stream',
          sourceName: 'Main_events'
        });
        if (mainEventsId && mainEventsId.sceneItemId !== undefined) {
          await obsRef.call('SetSceneItemEnabled', {
            sceneName: 'Main Stream',
            sceneItemId: mainEventsId.sceneItemId,
            sceneItemEnabled: true
          });
        }

        addMainStreamLog('✅ Successfully completed all actions!');
        setMainStreamState((prev) => ({
          ...prev,
          lastTrigger: new Date().toLocaleTimeString()
        }));
      } catch (error: any) {
        addMainStreamLog(`❌ Error: ${error.message}`);
      } finally {
        isProcessingMainStreamRef.current = false;
      }
    };

    obsRef.on('MediaInputPlaybackEnded', handleMediaPlaybackEnded);
    addMainStreamLog('✨ Auto-switch enabled and listening...');

    return () => {
      obsRef.off('MediaInputPlaybackEnded', handleMediaPlaybackEnded);
      addMainStreamLog('🛑 Auto-switch disabled');
    };
  }, [obs.isConnected, mainStreamState.isEnabled]);

  // --- Save to localStorage when enabled state changes ---
  useEffect(() => {
    localStorage.setItem('replayAutoSwitch', String(replayState.isEnabled));
  }, [replayState.isEnabled]);

  useEffect(() => {
    localStorage.setItem('mainStreamAutoSwitch', String(mainStreamState.isEnabled));
  }, [mainStreamState.isEnabled]);

  // --- Control Functions ---
  const toggleReplay = (enabled: boolean) => {
    setReplayState((prev) => ({ ...prev, isEnabled: enabled }));
  };

  const toggleMainStream = (enabled: boolean) => {
    setMainStreamState((prev) => ({ ...prev, isEnabled: enabled }));
  };

  const clearReplayLogs = () => {
    setReplayState((prev) => ({ ...prev, logs: [] }));
  };

  const clearMainStreamLogs = () => {
    setMainStreamState((prev) => ({ ...prev, logs: [] }));
  };

  return {
    replayMacro: {
      isEnabled: replayState.isEnabled,
      logs: replayState.logs,
      lastTrigger: replayState.lastTrigger,
      onToggle: toggleReplay,
      onClearLogs: clearReplayLogs
    },
    mainStreamMacro: {
      isEnabled: mainStreamState.isEnabled,
      logs: mainStreamState.logs,
      lastTrigger: mainStreamState.lastTrigger,
      onToggle: toggleMainStream,
      onClearLogs: clearMainStreamLogs
    }
  };
}
