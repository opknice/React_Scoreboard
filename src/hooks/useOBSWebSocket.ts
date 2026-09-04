import { useCallback, useMemo, useRef, useState } from 'react';
import OBSWebSocket from 'obs-websocket-js';
import type { OBSRequestTypes, OBSResponseTypes } from 'obs-websocket-js';
import { createLatestAsyncByKeyQueue } from '../utils/latestAsyncByKey';

type OBSForwardedEvent = 'CustomEvent' | 'ReplayBufferSaved';
type OBSForwardedEventData = Record<string, unknown>;

export interface OBSWebSocketApi {
  isConnected: boolean;
  connect: (
    url?: string,
    password?: string,
    maxRetries?: number,
    isAutomaticReconnect?: boolean,
  ) => Promise<boolean>;
  disconnect: () => Promise<void>;
  setText: (sourceName: string, text: string) => Promise<void>;
  setImage: (sourceName: string, filename: string, logoFolderPath: string) => Promise<void>;
  setSourceColor: (sourceName: string, hexColor: string) => Promise<void>;
  setSceneItemEnabled: (sceneName: string, sceneItemId: number, enabled: boolean) => Promise<void>;
  getSceneItemId: (sceneName: string, sourceName: string) => Promise<number | null>;
  call: <Type extends keyof OBSRequestTypes>(
    requestType: Type,
    requestData?: OBSRequestTypes[Type],
  ) => Promise<OBSResponseTypes[Type]>;
  getObsRef: () => OBSWebSocket | null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useOBSWebSocket = (
  onHotkeyAction?: (action: string) => void,
  onEvent?: (eventType: OBSForwardedEvent, eventData: OBSForwardedEventData) => void,
): OBSWebSocketApi => {
  const [isConnected, setIsConnected] = useState(false);
  const obsRef = useRef<OBSWebSocket | null>(null);
  // Track whether we are in the middle of a connect attempt (suppress false ConnectionClosed events)
  const isConnectingRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const isShuttingDownRef = useRef(false);
  const pendingObsRef = useRef<OBSWebSocket | null>(null);
  const connectionOptionsRef = useRef({
    url: 'ws://localhost:4455',
    password: '',
    maxRetries: 3,
  });
  // Always hold the latest callback — avoids stale closure when state changes
  const onHotkeyActionRef = useRef(onHotkeyAction);
  const onEventRef = useRef(onEvent);
  onHotkeyActionRef.current = onHotkeyAction;
  onEventRef.current = onEvent;

  // Generation counter: each connect() call gets a unique ID.
  // After every async await, we verify our generation is still current.
  // If disconnect() or a newer connect() was called in the meantime,
  // our generation is stale → we clean up without storing the instance.
  // This fixes the React 18 StrictMode double-mount race condition where
  // obs.connect() completes AFTER the component cleanup, leaving two
  // active OBS instances that both fire CustomEvent (causing score +=2).
  const connectGenRef = useRef(0);
  const textUpdateQueueRef = useRef<ReturnType<
    typeof createLatestAsyncByKeyQueue<string, string>
  > | null>(null);
  if (textUpdateQueueRef.current === null) {
    textUpdateQueueRef.current = createLatestAsyncByKeyQueue(
      async (sourceName, text) => {
        const obs = obsRef.current;
        if (!obs) return;
        await obs.call('SetInputSettings', {
          inputName: sourceName,
          inputSettings: { text },
        });
      },
      (error, sourceName) => {
        console.error(`OBS error setting text on source '${sourceName}':`, error);
      },
    );
  }
  const textUpdateQueue = textUpdateQueueRef.current;

  const disconnect = useCallback(async () => {
    // Invalidate any in-progress connect() calls.
    isShuttingDownRef.current = true;
    connectGenRef.current++;
    textUpdateQueue.clear();
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    isConnectingRef.current = false;

    const pendingObs = pendingObsRef.current;
    pendingObsRef.current = null;
    if (pendingObs) {
      try { pendingObs.removeAllListeners(); } catch {}
      try { await pendingObs.disconnect(); } catch {}
    }

    if (obsRef.current) {
      try {
        obsRef.current.removeAllListeners();
        await obsRef.current.disconnect();
      } catch {
        // The socket may already be closed.
      }
      obsRef.current = null;
      setIsConnected(false);
    }
  }, [textUpdateQueue]);

  const connect = useCallback(async (
    url = 'ws://localhost:4455',
    password = '',
    maxRetries = 3,
    isAutomaticReconnect = false,
  ) => {
    if (!isAutomaticReconnect) {
      isShuttingDownRef.current = false;
      connectionOptionsRef.current = { url, password, maxRetries };
    }

    // Do not start a new socket while OBS is intentionally shutting down.
    if (isShuttingDownRef.current) return false;

    // Claim a new generation for this connect call
    const myGen = ++connectGenRef.current;

    isConnectingRef.current = true;

    // Disconnect and fully discard any existing instance first
    if (obsRef.current) {
      try {
        obsRef.current.removeAllListeners();
        await obsRef.current.disconnect();
      } catch {
        // Safe to ignore
      }
      obsRef.current = null;
    }

    // Bail out if a newer connect/disconnect invalidated us during the await above
    if (myGen !== connectGenRef.current) return false;

    let lastErr: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (isShuttingDownRef.current || myGen !== connectGenRef.current) return false;

      // Create a FRESH instance for each attempt.
      // Reusing the same instance and calling obs.connect() again accumulates
      // internal WebSocket handlers, causing CustomEvent to fire twice.
      const obs = new OBSWebSocket();
      pendingObsRef.current = obs;

      obs.on('CustomEvent', (eventData) => {
        const wrappedData = eventData as unknown as OBSForwardedEventData;
        const nestedData = wrappedData.eventData;
        const data = nestedData && typeof nestedData === 'object'
          ? nestedData as OBSForwardedEventData
          : wrappedData;
        const action = typeof data.action === 'string' ? data.action : undefined;
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

      // Macro subscriptions register their own event listeners. Forward only
      // the replay event consumed by the video-folder rescan hook here.
      obs.on('ReplayBufferSaved', (eventData) => {
        onEventRef.current?.(
          'ReplayBufferSaved',
          eventData as unknown as OBSForwardedEventData,
        );
      });

      obs.on('ConnectionClosed', () => {
        // Ignore spurious close events during connection setup/retry
        if (!isConnectingRef.current && !isShuttingDownRef.current) {
          setIsConnected(false);
          console.log('[OBS Connection] Connection closed');
          if (reconnectTimerRef.current === null) {
            reconnectTimerRef.current = window.setTimeout(() => {
              reconnectTimerRef.current = null;
              const options = connectionOptionsRef.current;
              void connect(options.url, options.password, options.maxRetries, true).catch(() => undefined);
            }, 1500);
          }
        }
      });

      // OBS emits ExitStarted before unloading its WebSocket server. Closing
      // our client here prevents reconnect attempts from racing OBS shutdown.
      obs.on('ExitStarted', () => {
        isShuttingDownRef.current = true;
        connectGenRef.current++;
        if (reconnectTimerRef.current !== null) {
          window.clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        void disconnect();
      });

      try {
        await obs.connect(url, password || undefined);
        if (pendingObsRef.current === obs) pendingObsRef.current = null;

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
        if (pendingObsRef.current === obs) pendingObsRef.current = null;
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
  }, [disconnect]);

  const setText = useCallback(async (sourceName: string, text: string) => {
    // Check obsRef instead of isConnected state to avoid timing issues
    if (!obsRef.current) return;
    await textUpdateQueue.enqueue(sourceName, String(text));
  }, [textUpdateQueue]);

  const setImage = useCallback(async (sourceName: string, filename: string, logoFolderPath: string) => {
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
  }, []);

  const setSourceColor = useCallback(async (sourceName: string, hexColor: string) => {
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
  }, []);

  const setSceneItemEnabled = useCallback(async (sceneName: string, sceneItemId: number, enabled: boolean) => {
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
    } catch (error: unknown) {
      console.error('[OBS] Error setting scene item enabled:', getErrorMessage(error));
    }
  }, []);

  const getSceneItemId = useCallback(async (sceneName: string, sourceName: string) => {
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
    } catch (error: unknown) {
      console.error(`[OBS] Error getting scene item id for "${sourceName}" in scene "${sceneName}":`, getErrorMessage(error));
      return null;
    }
  }, []);

  // Raw OBS call method for advanced usage
  const call = useCallback(async <Type extends keyof OBSRequestTypes>(
    requestType: Type,
    requestData?: OBSRequestTypes[Type],
  ): Promise<OBSResponseTypes[Type]> => {
    if (!obsRef.current) {
      throw new Error('OBS is not connected');
    }
    return obsRef.current.call(requestType, requestData);
  }, []);

  // Get obsRef for advanced usage (e.g., OBS Setup Service)
  const getObsRef = useCallback(() => obsRef.current, []);

  return useMemo(() => ({
    isConnected,
    connect,
    disconnect,
    setText,
    setImage,
    setSourceColor,
    setSceneItemEnabled,
    getSceneItemId,
    call,
    getObsRef,
  }), [
    call,
    connect,
    disconnect,
    getObsRef,
    getSceneItemId,
    isConnected,
    setImage,
    setSceneItemEnabled,
    setSourceColor,
    setText,
  ]);
};
