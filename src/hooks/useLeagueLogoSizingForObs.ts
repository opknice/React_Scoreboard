import { useEffect, useMemo, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { LeagueService } from '../services/leagueService';
import {
  DEFAULT_LEAGUE_LOGO_SIZING,
  parseLeagueLogoSizing,
  type LeagueLogoSizingSettings,
} from '../types/leagueLogoSizing';
import { supabase } from '../config/supabaseClient';
import { useLeagueLogoScalePreview } from './useLeagueLogoScalePreviewSync';

interface UseLeagueLogoSizingForObsOptions {
  leagueId: string | null | undefined;
  sessionId: string;
  initialSizing?: LeagueLogoSizingSettings;
}

/** Loads persisted league sizing and overlays temporary Slider values received from the editor. */
export function useLeagueLogoSizingForObs({
  leagueId,
  sessionId,
  initialSizing,
}: UseLeagueLogoSizingForObsOptions): LeagueLogoSizingSettings {
  const normalizedInitial = useMemo(
    () => initialSizing ? parseLeagueLogoSizing({ logoSizing: initialSizing }) : DEFAULT_LEAGUE_LOGO_SIZING,
    [initialSizing],
  );
  const [persistedSizing, setPersistedSizing] = useState<LeagueLogoSizingSettings>(normalizedInitial);

  useEffect(() => {
    let isDisposed = false;
    let channel: RealtimeChannel | null = null;

    setPersistedSizing(normalizedInitial);
    if (!leagueId || leagueId === 'excel') return () => { isDisposed = true; };

    const loadSizing = async () => {
      try {
        const league = await LeagueService.getLeagueById(leagueId);
        if (!isDisposed && league) setPersistedSizing(parseLeagueLogoSizing(league.settings));
      } catch (error: unknown) {
        console.error('[LeagueLogoSizing] Failed to load league settings:', error);
      }
    };

    void loadSizing();
    if (supabase) {
      channel = supabase
        .channel(`league-logo-sizing:${leagueId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'leagues', filter: `id=eq.${leagueId}` },
          () => { void loadSizing(); },
        )
        .subscribe();
    }

    return () => {
      isDisposed = true;
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [leagueId, normalizedInitial]);

  return useLeagueLogoScalePreview({
    sessionId,
    leagueId,
    persistedSizing,
  });
}
