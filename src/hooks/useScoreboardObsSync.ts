import { useEffect, useRef } from 'react';

interface ScoreboardObsApi {
  isConnected: boolean;
  setText: (sourceName: string, text: string) => Promise<void>;
}

interface UseScoreboardObsSyncOptions {
  obs: ScoreboardObsApi;
  scoreA: number;
  scoreB: number;
  formattedTime: string;
  half: string;
}

/** Keeps the four scoreboard text sources synchronized with the local state. */
export function useScoreboardObsSync({
  obs,
  scoreA,
  scoreB,
  formattedTime,
  half,
}: UseScoreboardObsSyncOptions): void {
  const obsRef = useRef(obs);
  obsRef.current = obs;

  useEffect(() => {
    void obsRef.current.setText('score_team_a', String(scoreA));
  }, [scoreA, obs.isConnected]);

  useEffect(() => {
    void obsRef.current.setText('score_team_b', String(scoreB));
  }, [scoreB, obs.isConnected]);

  useEffect(() => {
    void obsRef.current.setText('time_counter', formattedTime);
  }, [formattedTime, obs.isConnected]);

  useEffect(() => {
    void obsRef.current.setText('half_text', half);
  }, [half, obs.isConnected]);
}
