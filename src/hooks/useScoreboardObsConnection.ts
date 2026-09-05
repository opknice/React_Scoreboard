import { useEffect, useRef } from 'react';

interface ScoreboardObsConnectionApi {
  connect: (url?: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
}

interface UseScoreboardObsConnectionOptions {
  obs: ScoreboardObsConnectionApi;
  onConnected: () => void;
  onError: () => void;
  /** Delay the first connection until after the controller has painted. */
  initialConnectDelayMs?: number;
}

/** Owns the controller's OBS connection lifecycle. */
export function useScoreboardObsConnection({
  obs,
  onConnected,
  onError,
  initialConnectDelayMs = 250,
}: UseScoreboardObsConnectionOptions): void {
  const obsRef = useRef(obs);
  const onConnectedRef = useRef(onConnected);
  const onErrorRef = useRef(onError);

  obsRef.current = obs;
  onConnectedRef.current = onConnected;
  onErrorRef.current = onError;

  useEffect(() => {
    let disposed = false;
    const connectAfterPaint = () => {
      if (disposed) return;
      obsRef.current.connect('ws://localhost:4455')
        .then((connected) => {
          if (!disposed && connected) onConnectedRef.current();
        })
        .catch(() => {
          if (!disposed) onErrorRef.current();
        });
    };
    const timerId = window.setTimeout(connectAfterPaint, Math.max(0, initialConnectDelayMs));

    return () => {
      disposed = true;
      window.clearTimeout(timerId);
      void obsRef.current.disconnect();
    };
  }, [initialConnectDelayMs]);
}
