export type LeagueDataTable = 'leagues' | 'teams' | 'matches' | 'players' | 'player_match_stats';

export interface LeagueDataChange {
  type: 'data-changed';
  table?: LeagueDataTable;
  leagueId?: string;
  teamId?: string;
}

export const LEAGUE_DATA_EVENT = 'supabase_league_changed';

export function dispatchLeagueChanged(leagueId?: string, table?: LeagueDataTable, teamId?: string): void {
  window.dispatchEvent(new CustomEvent<LeagueDataChange>(LEAGUE_DATA_EVENT, {
    detail: { type: 'data-changed', leagueId, table, teamId },
  }));
}

export function readLeagueDataChange(event: Event): LeagueDataChange | null {
  if (!(event instanceof CustomEvent) || !event.detail || typeof event.detail !== 'object') return null;
  const detail = event.detail as LeagueDataChange;
  return detail.type === 'data-changed' ? detail : null;
}

/** Missing IDs (notably DELETE payloads) invalidate all consumers of that table. */
export function affectsLeagueData(change: LeagueDataChange, leagueId: string, teamId?: string): boolean {
  return (!change.leagueId || change.leagueId === leagueId)
    && (!teamId || !change.teamId || change.teamId === teamId);
}

export function subscribeTeamData(
  leagueId: string,
  teamId: string,
  tables: LeagueDataTable[],
  refresh: (tables: Set<LeagueDataTable>) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending = new Set<LeagueDataTable>();
  const listener = (event: Event) => {
    const change = readLeagueDataChange(event);
    if (!change || !affectsLeagueData(change, leagueId, teamId)) return;
    if (change.table && !tables.includes(change.table)) return;
    for (const table of change.table ? [change.table] : tables) pending.add(table);
    clearTimeout(timer);
    timer = setTimeout(() => {
      const changed = pending;
      pending = new Set();
      refresh(changed);
    }, 200);
  };
  window.addEventListener(LEAGUE_DATA_EVENT, listener);
  return () => {
    clearTimeout(timer);
    window.removeEventListener(LEAGUE_DATA_EVENT, listener);
  };
}
