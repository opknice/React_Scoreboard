import { useEffect, useState } from 'react';
import { listSupabaseLeagues, type LeagueRecord } from '../services/supabaseLeagueService';

interface UseSupabaseLeaguesResult {
  leagues: LeagueRecord[];
  isLoading: boolean;
  error: string | null;
}

export function useSupabaseLeagues(enabled: boolean): UseSupabaseLeaguesResult {
  const [leagues, setLeagues] = useState<LeagueRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLeagues([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let mounted = true;
    setIsLoading(true);
    setError(null);

    void listSupabaseLeagues()
      .then((nextLeagues) => {
        if (!mounted) return;
        setLeagues(nextLeagues);
        setIsLoading(false);
      })
      .catch((reason: unknown) => {
        if (!mounted) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setLeagues([]);
        setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [enabled]);

  return { leagues, isLoading, error };
}
