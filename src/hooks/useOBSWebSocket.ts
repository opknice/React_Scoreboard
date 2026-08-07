import { useState, useRef, useEffect } from 'react';
import OBSWebSocket from 'obs-websocket-js';

export const useOBSWebSocket = (onHotkeyAction?: (action: string) => void, onEvent?: (eventType: string, eventData: any) => void) => {
  const [isConnected, setIsConnected] = useState(false);
  const obsRef = useRef<OBSWebSocket | null>(null);
  // Track whether we are in the middle of a connect attempt (suppress false ConnectionClosed events)
  const isConnectingRef = useRef(false);
  // Always hold the latest callback — avoids stale closure when state changes
  const onHotkeyActionRef = useRef(onHotkeyAction);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onHotkeyActionRef.current = onHotkeyAction;
    onEventRef.current = onEvent;
  });

  // Generation counter: each connect() call gets a unique ID.
  // After every async await, we verify our generation is still current.
  // If disconnect() or a newer connect() was called in the meantime,
  // our generation is stale → we clean up without storing the instance.
  // This fixes the React 18 StrictMode double-mount race condition where
  // obs.connect() completes AFTER the component cleanup, leaving two
  // active OBS instances that both fire CustomEvent (causing score +=2).
  const connectGenRef = useRef(0);

  const connect = async (url = 'ws://localhost:4455', password = '', maxRetries = 3) => {
    // Claim a new generation for this connect call
    const myGen = ++connectGenRef.current;

    // Disconnect and fully discard any existing instance first
    if (obsRef.current) {
      try {
        obsRef.current.removeAllListeners();
        await obsRef.current.disconnect();
      } catch (e) {
        // Safe to ignore
      }
      obsRef.current = null;
    }

    // Bail out if a newer connect/disconnect invalidated us during the await above
    if (myGen !== connectGenRef.current) return false;

    isConnectingRef.current = true;
    let lastErr: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Create a FRESH instance for each attempt.
      // Reusing the same instance and calling obs.connect() again accumulates
      // internal WebSocket handlers, causing CustomEvent to fire twice.
      const obs = new OBSWebSocket();

      obs.on('CustomEvent', (eventData: any) => {
        const data = eventData.eventData || eventData;
        const action = data.action;
        console.log('[OBS Hotkey Bridge] Received action:', action);
        // Use ref so we always call the LATEST version of the callback (avoids stale closure)
        if (action && onHotkeyActionRef.current) {
          onHotkeyActionRef.current(action);
        }
        // Also call event logger if available
        if (onEventRef.current) {
          onEventRef.current('CustomEvent', data);
        }
      });

      // Subscribe to all OBS events for logging
      const eventTypes = [
        // General events
        'ExitStarted',
        'VendorEvent',
        
        // Config events
        'CurrentSceneCollectionChanging',
        'CurrentSceneCollectionChanged',
        'SceneCollectionListChanged',
        'CurrentProfileChanging',
        'CurrentProfileChanged',
        'ProfileListChanged',
        
        // Scenes events
        'SceneCreated',
        'SceneRemoved',
        'SceneNameChanged',
        'CurrentProgramSceneChanged',
        'CurrentPreviewSceneChanged',
        'SceneListChanged',
        
        // Inputs (Sources) events
        'InputCreated',
        'InputRemoved',
        'InputNameChanged',
        'InputActiveStateChanged',
        'InputShowStateChanged',
        'InputMuteStateChanged',
        'InputVolumeChanged',
        'InputAudioBalanceChanged',
        'InputAudioSyncOffsetChanged',
        'InputAudioTracksChanged',
        'InputAudioMonitorTypeChanged',
        'InputVolumeMeters',
        
        // Transitions events
        'CurrentSceneTransitionChanged',
        'CurrentSceneTransitionDurationChanged',
        'SceneTransitionStarted',
        'SceneTransitionEnded',
        'SceneTransitionVideoEnded',
        
        // Filters events
        'SourceFilterListReindexed',
        'SourceFilterCreated',
        'SourceFilterRemoved',
        'SourceFilterNameChanged',
        'SourceFilterEnableStateChanged',
        
        // Scene Items events
        'SceneItemCreated',
        'SceneItemRemoved',
        'SceneItemListReindexed',
        'SceneItemEnableStateChanged',
        'SceneItemLockStateChanged',
        'SceneItemSelected',
        'SceneItemTransformChanged',
        
        // Outputs events
        'StreamStateChanged',
        'RecordStateChanged',
        'ReplayBufferStateChanged',
        'VirtualcamStateChanged',
        'ReplayBufferSaved',
        
        // Media Inputs events
        'MediaInputPlaybackStarted',
        'MediaInputPlaybackEnded',
        'MediaInputActionTriggered',
        
        // Ui events
        'StudioModeStateChanged',
        'ScreenshotSaved'
      ];

      // Subscribe to all events
      eventTypes.forEach(eventType => {
        obs.on(eventType as any, (data: any) => {
          if (onEventRef.current) {
            onEventRef.current(eventType, data);
          }
        });
      });

      obs.on('ConnectionClosed', () => {
        // Ignore spurious close events during connection setup/retry
        if (!isConnectingRef.current) {
          setIsConnected(false);
          console.log('[OBS Connection] Connection closed');
        }
      });

      try {
        await obs.connect(url, password || undefined);

        // After awaiting, check if we were superseded (StrictMode cleanup or re-connect)
        if (myGen !== connectGenRef.current) {
          console.log(`[OBS Connection] connect() gen ${myGen} superseded — cleaning up obs instance`);
          try { obs.removeAllListeners(); } catch {}
          try { await obs.disconnect(); } catch {}
          return false;
        }

        // Success — store this instance and stop retrying
        obsRef.current = obs;
        isConnectingRef.current = false;
        setIsConnected(true);
        console.log(`[OBS Connection] Connected successfully (attempt ${attempt})`);
        return true;
      } catch (err) {
        lastErr = err;
        // Clean up failed instance before creating a new one
        try { obs.removeAllListeners(); } catch {}
        try { await obs.disconnect(); } catch {}

        // Check generation before retrying
        if (myGen !== connectGenRef.current) return false;

        console.warn(`[OBS Connection] Attempt ${attempt}/${maxRetries} failed:`, err);
        if (attempt < maxRetries) {
          await new Promise((res) => setTimeout(res, 1000));
          // Check again after the wait
          if (myGen !== connectGenRef.current) return false;
        }
      }
    }

    isConnectingRef.current = false;
    setIsConnected(false);
    console.error('[OBS Connection] All connection attempts failed:', lastErr);
    throw lastErr;
  };

  const disconnect = async () => {
    // Invalidate any in-progress connect() calls
    connectGenRef.current++;

    if (obsRef.current) {
      try {
        obsRef.current.removeAllListeners();
        await obsRef.current.disconnect();
      } catch (e) {
        // Ignore
      }
      obsRef.current = null;
      setIsConnected(false);
    }
  };

  const setText = async (sourceName: string, text: string) => {
    // Check obsRef instead of isConnected state to avoid timing issues
    if (!obsRef.current) return;
    try {
      await obsRef.current.call('SetInputSettings', {
        inputName: sourceName,
        inputSettings: { text: String(text) }
      });
    } catch (err) {
      console.error(`OBS error setting text on source '${sourceName}':`, err);
    }
  };

  const setImage = async (sourceName: string, filename: string, logoFolderPath: string) => {
    // Check obsRef instead of isConnected state to avoid timing issues
    if (!obsRef.current) return;
    try {
      let filePath = '';
      if (filename) {
        const hasExt = /\.(png|jpe?g|gif|webp)$/i.test(filename);
        filePath = `${logoFolderPath}/${filename}${hasExt ? '' : '.png'}`;
      }
      await obsRef.current.call('SetInputSettings', {
        inputName: sourceName,
        inputSettings: { file: filePath }
      });
    } catch (err) {
      console.error(`OBS error setting image on source '${sourceName}':`, err);
    }
  };

  const setSourceColor = async (sourceName: string, hexColor: string) => {
    // Check obsRef instead of isConnected state to avoid timing issues
    if (!obsRef.current || !hexColor) return;
    try {
      const cleanHex = hexColor.substring(1);
      const r = cleanHex.substring(0, 2);
      const g = cleanHex.substring(2, 4);
      const b = cleanHex.substring(4, 6);
      // Convert to OBS hex format: AABBGGRR represented as integer
      const obsColor = parseInt("FF" + b + g + r, 16);

      await obsRef.current.call('SetInputSettings', {
        inputName: sourceName,
        inputSettings: { color: obsColor }
      });
    } catch (err) {
      console.error(`OBS error setting color on source '${sourceName}':`, err);
    }
  };

  const setSceneItemEnabled = async (sceneName: string, sceneItemId: number, enabled: boolean) => {
    // Check obsRef instead of isConnected state to avoid timing issues
    if (!obsRef.current) {
      console.warn(`[OBS] setSceneItemEnabled called but obsRef is null (scene: ${sceneName}, itemId: ${sceneItemId}, enabled: ${enabled})`);
      return;
    }
    try {
      console.log(`[OBS] Setting scene item ${sceneItemId} to ${enabled ? 'ENABLED' : 'DISABLED'} in scene "${sceneName}"...`);
      await obsRef.current.call('SetSceneItemEnabled', {
        sceneName,
        sceneItemId,
        sceneItemEnabled: enabled
      });
      console.log(`[OBS] ✓ Scene item ${sceneItemId} is now ${enabled ? 'ENABLED' : 'DISABLED'}`);
    } catch (err: any) {
      console.error(`[OBS] Error setting scene item enabled:`, err?.message || err);
    }
  };

  const getSceneItemId = async (sceneName: string, sourceName: string) => {
    // Check obsRef instead of isConnected state to avoid timing issues
    if (!obsRef.current) {
      console.warn(`[OBS] getSceneItemId called but obsRef is null (scene: ${sceneName}, source: ${sourceName})`);
      return null;
    }
    try {
      console.log(`[OBS] Getting scene item id for "${sourceName}" in scene "${sceneName}"...`);
      const response = await obsRef.current.call('GetSceneItemId', {
        sceneName,
        sourceName
      });
      console.log(`[OBS] Found scene item id: ${response.sceneItemId}`);
      return response.sceneItemId;
    } catch (err: any) {
      console.error(`[OBS] Error getting scene item id for "${sourceName}" in scene "${sceneName}":`, err?.message || err);
      return null;
    }
  };

  // Raw OBS call method for advanced usage
  const call = async (requestType: string, requestData?: Record<string, any>): Promise<any> => {
    if (!obsRef.current) {
      throw new Error('OBS is not connected');
    }
    return await obsRef.current.call(requestType as any, requestData);
  };

  // Get obsRef for advanced usage (e.g., OBS Setup Service)
  const getObsRef = () => obsRef.current;

  return {
    isConnected,
    connect,
    disconnect,
    setText,
    setImage,
    setSourceColor,
    setSceneItemEnabled,
    getSceneItemId,
    call,
    getObsRef
  };
};
