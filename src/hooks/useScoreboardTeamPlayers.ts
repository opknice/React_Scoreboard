import { useCallback, useEffect, useRef, useState } from 'react';
import type { Player } from '../config/supabaseClient';
import { subscribeTeamData } from '../utils/leagueDataEvents';

export interface ScoreboardTeamPlayersState {
  players: Player[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

type TeamPlayersFetcher = (teamId: string) => Promise<Player[]>;

/** Loads the roster for one scoreboard team and ignores stale responses. */
export function useScoreboardTeamPlayers(
  teamId: string | null,
  leagueId: string | null,
  fetchPlayers: TeamPlayersFetcher,
): ScoreboardTeamPlayersState {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;

    if (!teamId || !leagueId) {
      setPlayers([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    void fetchPlayers(teamId)
      .then((nextPlayers) => {
        if (requestId !== requestIdRef.current) return;
        setPlayers(nextPlayers);
      })
      .catch((nextError: unknown) => {
        if (requestId !== requestIdRef.current) return;
        setPlayers([]);
        setError(nextError instanceof Error ? nextError.message : 'ไม่สามารถโหลดรายชื่อนักเตะได้');
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });

    return () => {
      requestIdRef.current += 1;
    };
  }, [fetchPlayers, leagueId, refreshToken, teamId]);

  const refresh = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!teamId || !leagueId) return;
    return subscribeTeamData(leagueId, teamId, ['players'], refresh);
  }, [leagueId, teamId, refresh]);

  return { players, loading, error, refresh };
}
