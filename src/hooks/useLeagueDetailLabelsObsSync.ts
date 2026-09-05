import { useEffect, useRef } from 'react';
import type { OBSWebSocketApi } from './useOBSWebSocket';
import {
  LEAGUE_DETAIL_LABEL_KEYS,
  type LeagueDetailLabels,
} from '../types/leagueDetailLabels';

interface UseLeagueDetailLabelsObsSyncOptions {
  obs: Pick<OBSWebSocketApi, 'isConnected' | 'setText'>;
  activeLeagueId: string;
  labels: LeagueDetailLabels;
}

/** Syncs league-wide labels to existing OBS sources; it never creates sources. */
export function useLeagueDetailLabelsObsSync({
  obs,
  activeLeagueId,
  labels,
}: UseLeagueDetailLabelsObsSyncOptions): void {
  const obsRef = useRef(obs);
  obsRef.current = obs;

  useEffect(() => {
    if (!activeLeagueId || !obs.isConnected) return;

    for (const key of LEAGUE_DETAIL_LABEL_KEYS) {
      const sourceName = `label_${key.slice('label'.length)}`;
      void obsRef.current.setText(sourceName, labels[key]);
    }
  }, [activeLeagueId, labels, obs.isConnected]);
}
