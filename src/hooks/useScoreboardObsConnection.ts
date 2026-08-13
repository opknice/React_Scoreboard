import { useEffect, useRef } from 'react';

interface ScoreboardObsConnectionApi {
  connect: (url?: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
}

interface UseScoreboardObsConnectionOptions {
  obs: ScoreboardObsConnectionApi;
  onConnected: () => void;
  onError: () => void;
}

/** Owns the controller's OBS connection lifecycle. */
export function useScoreboardObsConnection({
  obs,
  onConnected,
  onError,
}: UseScoreboardObsConnectionOptions): void {
  const obsRef = useRef(obs);
  const onConnectedRef = useRef(onConnected);
  const onErrorRef = useRef(onError);

  obsRef.current = obs;
  onConnectedRef.current = onConnected;
  onErrorRef.current = onError;

  useEffect(() => {
    obsRef.current.connect('ws://localhost:4455')
      .then((connected) => {
        if (connected) onConnectedRef.current();
      })
      .catch(() => {
        onErrorRef.current();
      });

    return () => {
      void obsRef.current.disconnect();
    };
  }, []);
}
