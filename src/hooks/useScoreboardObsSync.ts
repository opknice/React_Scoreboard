import { useEffect, useRef } from 'react';

interface ScoreboardObsApi {
  isConnected: boolean;
  setText: (sourceName: string, text: string) => Promise<void>;
}

interface UseScoreboardObsSyncOptions {
  obs: ScoreboardObsApi;
  scoreA: number;
  scoreB: number;
}

/** Keeps score sources synchronized; timer synchronization has its own render boundary. */
export function useScoreboardObsSync({
  obs,
  scoreA,
  scoreB,
}: UseScoreboardObsSyncOptions): void {
  const obsRef = useRef(obs);
  obsRef.current = obs;

  useEffect(() => {
    void obsRef.current.setText('score_team_a', String(scoreA));
  }, [scoreA, obs.isConnected]);

  useEffect(() => {
    void obsRef.current.setText('score_team_b', String(scoreB));
  }, [scoreB, obs.isConnected]);

}
