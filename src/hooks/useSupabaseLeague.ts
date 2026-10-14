import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { League, Team, Match, Player, PlayerMatchStat } from '../config/supabaseClient';
import { supabase, isSupabaseConfigured } from '../config/supabaseClient';
import { LeagueService, type StandingsRow } from '../services/leagueService';
import { dedupeRequest, leagueMemoryCache } from '../utils/memoryCache';
import type { LogoStorageProvider } from '../types/logoStorage';
import { dispatchLeagueChanged, readLeagueDataChange, affectsLeagueData, LEAGUE_DATA_EVENT, type LeagueDataTable } from '../utils/leagueDataEvents';

const LEAGUES_CACHE_PREFIX = 'leagues:';
const DETAILS_CACHE_PREFIX = 'league-details:';

function normalizeEmail(email?: string): string {
  return email?.trim().toLowerCase() || 'anonymous';
}

function getLeaguesCacheKey(email?: string): string {
  return `${LEAGUES_CACHE_PREFIX}${normalizeEmail(email)}`;
}

function getTeamsCacheKey(leagueId: string): string {
  return `${DETAILS_CACHE_PREFIX}${leagueId}:teams`;
}

function getMatchesCacheKey(leagueId: string): string {
  return `${DETAILS_CACHE_PREFIX}${leagueId}:matches`;
}

function invalidateLeagueDetailsCache(leagueId: string): void {
  leagueMemoryCache.invalidate(getTeamsCacheKey(leagueId));
  leagueMemoryCache.invalidate(getMatchesCacheKey(leagueId));
}

function filterRowsByLeague<T extends { league_id: string }>(rows: T[], leagueId: string): T[] {
  return rows.filter((row) => row.league_id === leagueId);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

type RealtimeTable = LeagueDataTable;

interface SharedRealtimeChange {
  table: RealtimeTable;
  newLeagueId?: string;
  oldLeagueId?: string;
  newTeamId?: string;
  oldTeamId?: string;
}

type SharedRealtimeListener = (change: SharedRealtimeChange) => void;

export interface UseSupabaseLeagueResult {
  isConfigured: boolean;
  leagues: League[];
  activeLeagueId: string;
  activeLeague: League | null;
  teams: Team[];
  matches: Match[];
  standings: StandingsRow[];
  loading: boolean;
  detailsLoading: boolean;
  detailsLoadedLeagueId: string | null;
  refreshing: boolean;
  error: string | null;
  selectLeague: (leagueId: string) => void;
  /** Capture before awaiting work that will subsequently update scoreboard UI. */
  captureActiveContext: () => () => boolean;
  fetchLeagues: (silent?: boolean) => Promise<void>;
  refreshLeagueDetails: () => Promise<LeagueDetailsResult | null>;
  createLeague: (payload: Omit<League, 'id' | 'created_at' | 'updated_at'>) => Promise<League>;
  updateLeague: (id: string, updates: Partial<League>, options?: UpdateLeagueOptions) => Promise<League>;
  deleteLeague: (id: string) => Promise<void>;
  createTeam: (payload: Omit<Team, 'id' | 'created_at' | 'updated_at'>) => Promise<Team>;
  updateTeam: (id: string, updates: Partial<Team>) => Promise<Team>;
  deleteTeam: (id: string) => Promise<void>;
  getPlayersByTeam: (teamId: string) => Promise<Player[]>;
  createPlayer: (payload: Omit<Player, 'id' | 'created_at' | 'updated_at'>) => Promise<Player>;
  updatePlayer: (id: string, updates: Partial<Player>) => Promise<Player>;
  deletePlayer: (id: string, teamId: string) => Promise<void>;
  getPlayerMatchStats: (teamId: string) => Promise<PlayerMatchStat[]>;
  upsertPlayerMatchStat: (payload: Omit<PlayerMatchStat, 'id' | 'created_at' | 'updated_at'>) => Promise<PlayerMatchStat>;
  deletePlayerMatchStat: (id: string) => Promise<void>;
  uploadTeamLogo: (
    file: File | Blob,
    fileName: string,
    provider?: LogoStorageProvider,
  ) => Promise<string>;
  createMatch: (payload: Omit<Match, 'id' | 'created_at' | 'updated_at'>) => Promise<Match>;
  updateMatch: (id: string, updates: Partial<Match>) => Promise<Match>;
  deleteMatch: (id: string) => Promise<void>;
  clearMatches: () => Promise<void>;
}

export interface UpdateLeagueOptions {
  silent?: boolean;
}

export interface LeagueDetailsResult {
  teams: Team[];
  matches: Match[];
}

let sharedRealtimeChannel: RealtimeChannel | null = null;
const sharedRealtimeListeners = new Set<SharedRealtimeListener>();

function readLeagueId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const leagueId = (value as Record<string, unknown>).league_id;
  return typeof leagueId === 'string' ? leagueId : undefined;
}

function readTeamId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const id = (value as Record<string, unknown>).team_id;
  return typeof id === 'string' ? id : undefined;
}

function emitSharedRealtimeChange(change: SharedRealtimeChange): void {
  // Forward once per server event, regardless of the number of hook instances.
  dispatchLeagueChanged(change.newLeagueId ?? change.oldLeagueId, change.table, change.newTeamId ?? change.oldTeamId);
  if (change.oldLeagueId && (change.oldLeagueId !== change.newLeagueId || change.oldTeamId !== change.newTeamId)) {
    dispatchLeagueChanged(change.oldLeagueId, change.table, change.oldTeamId);
  }
  sharedRealtimeListeners.forEach((listener) => listener(change));
}

function ensureSharedRealtimeChannel(): void {
  if (sharedRealtimeChannel || !supabase) return;

  sharedRealtimeChannel = supabase
    .channel('supabase_league_shared_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leagues' }, () => {
      emitSharedRealtimeChange({ table: 'leagues' });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, (payload) => {
      emitSharedRealtimeChange({
        table: 'teams',
        newLeagueId: readLeagueId(payload.new),
        oldLeagueId: readLeagueId(payload.old),
      });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
      emitSharedRealtimeChange({
        table: 'matches',
        newLeagueId: readLeagueId(payload.new),
        oldLeagueId: readLeagueId(payload.old),
      });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, (payload) => {
      emitSharedRealtimeChange({ table: 'players', newLeagueId: readLeagueId(payload.new), oldLeagueId: readLeagueId(payload.old), newTeamId: readTeamId(payload.new), oldTeamId: readTeamId(payload.old) });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'player_match_stats' }, (payload) => {
      emitSharedRealtimeChange({ table: 'player_match_stats', newLeagueId: readLeagueId(payload.new), oldLeagueId: readLeagueId(payload.old), newTeamId: readTeamId(payload.new), oldTeamId: readTeamId(payload.old) });
    })
    .subscribe();
}

function subscribeToSharedRealtime(listener: SharedRealtimeListener): () => void {
  sharedRealtimeListeners.add(listener);
  ensureSharedRealtimeChannel();

  return () => {
    sharedRealtimeListeners.delete(listener);
    if (sharedRealtimeListeners.size === 0 && sharedRealtimeChannel && supabase) {
      const channel = sharedRealtimeChannel;
      sharedRealtimeChannel = null;
      void supabase.removeChannel(channel);
    }
  };
}

export function useSupabaseLeague(
  notify?: (msg: string, type?: 'info' | 'success' | 'error') => void,
  userEmail?: string,
): UseSupabaseLeagueResult {
  const [isConfigured] = useState<boolean>(isSupabaseConfigured);
  const [leagues, setLeagues] = useState<League[]>([]);
  const userEmailRef = useRef(userEmail);
  userEmailRef.current = userEmail;

  // The selected league is intentionally session-scoped. A new page load must
  // always start with the placeholder instead of restoring a previous league.
  const [activeLeagueId, setActiveLeagueId] = useState<string>('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [detailsLoadedLeagueId, setDetailsLoadedLeagueId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeLeague = useMemo(() => {
    return leagues.find((l) => l.id === activeLeagueId) || null;
  }, [leagues, activeLeagueId]);

  const activeLeagueIdRef = useRef(activeLeagueId);
  activeLeagueIdRef.current = activeLeagueId;
  const leaguesRequestIdRef = useRef(0);
  const detailsRequestIdRef = useRef(0);
  const leaguesRefreshTimerRef = useRef<number | null>(null);
  const detailsRefreshTimerRef = useRef<number | null>(null);

  const contextVersionRef = useRef(0);
  const mountedRef = useRef(false);
  const rowRequestIds = useRef({ teams: 0, matches: 0 });
  const loadedLeagueRef = useRef(detailsLoadedLeagueId);
  loadedLeagueRef.current = detailsLoadedLeagueId;
  const pendingTables = useRef(new Set<'teams' | 'matches'>());

  const captureContext = useCallback(() => {
    const version = contextVersionRef.current;
    const email = userEmailRef.current;
    const leagueId = activeLeagueIdRef.current;
    return () => mountedRef.current && contextVersionRef.current === version
      && userEmailRef.current === email && activeLeagueIdRef.current === leagueId;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      contextVersionRef.current += 1;
      leaguesRequestIdRef.current += 1;
      detailsRequestIdRef.current += 1;
    };
  }, []);

  // Load all leagues for the current user
  const fetchLeagues = useCallback(async (silent = false) => {
    if (!isConfigured) return;
    const requestId = ++leaguesRequestIdRef.current;
    const currentEmail = userEmailRef.current;
    const cacheKey = getLeaguesCacheKey(currentEmail);
    const cached = leagueMemoryCache.read<League[]>(cacheKey);

    // Render cached data immediately, then always revalidate in the background.
    if (cached) setLeagues(cached.data);
    if (!silent && !cached) setLoading(true);
    if (silent) setRefreshing(true);
    if (!silent) setRefreshing(false);
    setError(null);
    try {
      const data = await dedupeRequest(cacheKey, () => LeagueService.getLeagues(currentEmail));
      leagueMemoryCache.write(cacheKey, data);
      if (requestId !== leaguesRequestIdRef.current) return;
      setLeagues(data);
      const currentActive = activeLeagueIdRef.current;
      
      // Validate current active league
      if (data.length > 0 && currentActive) {
        const currentValid = data.some((l) => l.id === currentActive);
        if (!currentValid) {
          if (import.meta.env.DEV) {
            console.log('[fetchLeagues] Current league invalid, clearing selection');
          }
          contextVersionRef.current += 1;
          activeLeagueIdRef.current = '';
          setActiveLeagueId('');
        }
      } else if (!data.length) {
        contextVersionRef.current += 1;
        activeLeagueIdRef.current = '';
        setActiveLeagueId('');
      }
    } catch (err: unknown) {
      if (requestId !== leaguesRequestIdRef.current) return;
      console.error('Failed to load leagues from Supabase:', err);
      setError(getErrorMessage(err, 'Failed to load leagues'));
    } finally {
      if (requestId === leaguesRequestIdRef.current) {
        setLoading(false);
        if (silent) setRefreshing(false);
      }
    }
  }, [isConfigured]);

  // Load teams and matches for the active league
  const fetchLeagueDetails = useCallback(async (
    leagueId: string,
    silent = false,
  ): Promise<LeagueDetailsResult | null> => {
    if (import.meta.env.DEV) {
      console.log('[fetchLeagueDetails] Called with:', { leagueId, silent, activeLeagueIdRef: activeLeagueIdRef.current });
    }
    
    if (!isConfigured || !leagueId) {
      if (import.meta.env.DEV) {
        console.log('[fetchLeagueDetails] Early return: not configured or no leagueId');
      }
      detailsRequestIdRef.current += 1;
      setTeams([]);
      setMatches([]);
      setDetailsLoading(false);
      setDetailsLoadedLeagueId(null);
      if (silent) setRefreshing(false);
      return null;
    }

    // A delayed refresh for an old league must never touch the active league's
    // state. This is the primary boundary against stale cross-league data.
    if (activeLeagueIdRef.current !== leagueId) {
      if (import.meta.env.DEV) {
        console.log('[fetchLeagueDetails] Blocked: activeLeagueIdRef mismatch', { 
          requested: leagueId, 
          current: activeLeagueIdRef.current 
        });
      }
      return null;
    }

    const requestId = ++detailsRequestIdRef.current;
    const isCurrent = captureContext();
    const teamsRequestId = ++rowRequestIds.current.teams;
    const matchesRequestId = ++rowRequestIds.current.matches;

    // A fresh server response is required before auto-loading a match. This
    // prevents stale cached details from being treated as the current league.
    setDetailsLoading(true);
    setDetailsLoadedLeagueId(null);
    const teamsCacheKey = getTeamsCacheKey(leagueId);
    const matchesCacheKey = getMatchesCacheKey(leagueId);
    const cachedTeams = leagueMemoryCache.read<Team[]>(teamsCacheKey);
    const cachedMatches = leagueMemoryCache.read<Match[]>(matchesCacheKey);
    const hasCachedDetails = Boolean(cachedTeams || cachedMatches);

    // Keep the current screen responsive while the latest data is fetched.
    if (activeLeagueIdRef.current === leagueId) {
      if (cachedTeams) setTeams(filterRowsByLeague(cachedTeams.data, leagueId));
      if (cachedMatches) setMatches(filterRowsByLeague(cachedMatches.data, leagueId));
    }
    if (!silent && !hasCachedDetails) setLoading(true);
    if (silent) setRefreshing(true);
    if (!silent) setRefreshing(false);
    try {
      const [teamsData, matchesData] = await Promise.all([
        dedupeRequest(teamsCacheKey, () => LeagueService.getTeamsByLeague(leagueId)),
        dedupeRequest(matchesCacheKey, () => LeagueService.getMatchesByLeague(leagueId)),
      ]);
      const scopedTeams = filterRowsByLeague(teamsData, leagueId);
      const scopedMatches = filterRowsByLeague(matchesData, leagueId);
      leagueMemoryCache.write(teamsCacheKey, scopedTeams);
      leagueMemoryCache.write(matchesCacheKey, scopedMatches);
      if (!isCurrent()) return null;

      const result = { teams: scopedTeams, matches: scopedMatches };

      // A newer request for the same league owns the React state commit, but
      // this response is still valid for its direct caller. This prevents a
      // manual refresh from reporting failure when a realtime refresh starts
      // while both requests are sharing the same in-flight server response.
      if (requestId === detailsRequestIdRef.current) {
        if (teamsRequestId === rowRequestIds.current.teams) setTeams(scopedTeams);
        if (matchesRequestId === rowRequestIds.current.matches) setMatches(scopedMatches);
        setDetailsLoadedLeagueId(leagueId);
      }

      return result;
    } catch (err: unknown) {
      if (requestId !== detailsRequestIdRef.current || !isCurrent()) return null;
      console.error(`Failed to load details for league ${leagueId}:`, err);
      setError(getErrorMessage(err, 'Failed to load league details'));
      return null;
    } finally {
      if (requestId === detailsRequestIdRef.current && isCurrent()) {
        setDetailsLoading(false);
        setLoading(false);
        if (silent) setRefreshing(false);
      }
    }
  }, [isConfigured, captureContext]);

  const fetchLeaguesRef = useRef(fetchLeagues);
  fetchLeaguesRef.current = fetchLeagues;

  const fetchLeagueDetailsRef = useRef(fetchLeagueDetails);
  fetchLeagueDetailsRef.current = fetchLeagueDetails;

  const scheduleLeaguesRefresh = useCallback(() => {
    if (leaguesRefreshTimerRef.current !== null) {
      window.clearTimeout(leaguesRefreshTimerRef.current);
    }
    leaguesRefreshTimerRef.current = window.setTimeout(() => {
      leaguesRefreshTimerRef.current = null;
      void fetchLeaguesRef.current(true);
    }, 200);
  }, []);

  const refreshRows = useCallback(async (leagueId: string, tables: Set<'teams' | 'matches'>) => {
    if (activeLeagueIdRef.current !== leagueId) return;
    if (loadedLeagueRef.current !== leagueId) {
      await fetchLeagueDetailsRef.current(leagueId, true);
      return;
    }
    const isCurrent = captureContext();
    await Promise.all([...tables].map(async (table) => {
      const requestId = ++rowRequestIds.current[table];
      const key = table === 'teams' ? getTeamsCacheKey(leagueId) : getMatchesCacheKey(leagueId);
      try {
        if (table === 'teams') {
          const rows = filterRowsByLeague(await dedupeRequest(key, () => LeagueService.getTeamsByLeague(leagueId)), leagueId);
          if (!isCurrent() || requestId !== rowRequestIds.current.teams) return;
          leagueMemoryCache.write(key, rows);
          setTeams(rows);
        } else {
          const rows = filterRowsByLeague(await dedupeRequest(key, () => LeagueService.getMatchesByLeague(leagueId)), leagueId);
          if (!isCurrent() || requestId !== rowRequestIds.current.matches) return;
          leagueMemoryCache.write(key, rows);
          setMatches(rows);
        }
      } catch (error) {
        if (isCurrent()) setError(getErrorMessage(error, 'Failed to refresh league data'));
      }
    }));
  }, [captureContext]);

  const scheduleDetailsRefresh = useCallback((leagueId: string, table?: 'teams' | 'matches') => {
    if (table) pendingTables.current.add(table);
    else { pendingTables.current.add('teams'); pendingTables.current.add('matches'); }
    if (detailsRefreshTimerRef.current !== null) window.clearTimeout(detailsRefreshTimerRef.current);
    detailsRefreshTimerRef.current = window.setTimeout(() => {
      detailsRefreshTimerRef.current = null;
      const tables = pendingTables.current;
      pendingTables.current = new Set();
      void refreshRows(leagueId, tables);
    }, 200);
  }, [refreshRows]);

  // Handle user change
  useEffect(() => {
    // Never carry a league selection across users or page sessions.
    contextVersionRef.current += 1;
    pendingTables.current.clear();
    activeLeagueIdRef.current = '';
    detailsRequestIdRef.current += 1;
    setActiveLeagueId('');
    setTeams([]);
    setMatches([]);
    setDetailsLoading(false);
    setDetailsLoadedLeagueId(null);
    void fetchLeagues();
  }, [userEmail, fetchLeagues]);

  useEffect(() => {
    const handleSync = (event: Event) => {
      const change = readLeagueDataChange(event);
      if (!change) return;
      if (!change.table || change.table === 'leagues') {
        leagueMemoryCache.invalidatePrefix(LEAGUES_CACHE_PREFIX);
        scheduleLeaguesRefresh();
      }
      const currentId = activeLeagueIdRef.current;
      if (!currentId || !affectsLeagueData(change, currentId)) return;
      if (!change.table || change.table === 'teams' || change.table === 'matches') {
        if (change.table === 'teams') leagueMemoryCache.invalidate(getTeamsCacheKey(currentId));
        else if (change.table === 'matches') leagueMemoryCache.invalidate(getMatchesCacheKey(currentId));
        else invalidateLeagueDetailsCache(currentId);
        scheduleDetailsRefresh(currentId, change.table);
      }
    };
    window.addEventListener(LEAGUE_DATA_EVENT, handleSync);
    return () => window.removeEventListener(LEAGUE_DATA_EVENT, handleSync);
  }, [scheduleDetailsRefresh, scheduleLeaguesRefresh]);

  useEffect(() => {
    if (!isConfigured || !supabase) return;
    return subscribeToSharedRealtime(() => {});
  }, [isConfigured]);

  useEffect(() => {
    return () => {
      if (leaguesRefreshTimerRef.current !== null) {
        window.clearTimeout(leaguesRefreshTimerRef.current);
        leaguesRefreshTimerRef.current = null;
      }
      if (detailsRefreshTimerRef.current !== null) {
        window.clearTimeout(detailsRefreshTimerRef.current);
        detailsRefreshTimerRef.current = null;
      }
    };
  }, []);

  // Load teams & matches whenever activeLeagueId changes
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[useEffect activeLeagueId] Triggered:', { activeLeagueId });
    }
    if (activeLeagueId) {
      void fetchLeagueDetails(activeLeagueId);
    } else {
      setTeams([]);
      setMatches([]);
      setDetailsLoading(false);
      setDetailsLoadedLeagueId(null);
    }
  }, [activeLeagueId, fetchLeagueDetails]);

  // Change active league
  const selectLeague = useCallback((leagueId: string) => {
    if (import.meta.env.DEV) {
      console.log('[selectLeague] Called with:', leagueId);
    }
    const previousLeagueId = activeLeagueIdRef.current;
    if (previousLeagueId !== leagueId) {
      contextVersionRef.current += 1;
      pendingTables.current.clear();
      // Invalidate any in-flight request for the previous league immediately.
      detailsRequestIdRef.current += 1;
    }
    activeLeagueIdRef.current = leagueId;
    if (import.meta.env.DEV) {
      console.log('[selectLeague] Updated activeLeagueIdRef.current to:', activeLeagueIdRef.current);
    }
    setActiveLeagueId(leagueId);

    if (previousLeagueId !== leagueId) {
      setTeams([]);
      setMatches([]);
      setDetailsLoadedLeagueId(null);
      setDetailsLoading(Boolean(leagueId));
    }
  }, []);

  // League Actions
  const createLeague = useCallback(async (payload: Omit<League, 'id' | 'created_at' | 'updated_at'>) => {
    const isCurrent = captureContext();
    try {
      const email = userEmailRef.current ? userEmailRef.current.trim().toLowerCase() : undefined;
      const created = await LeagueService.createLeague({
        ...payload,
        created_by: payload.created_by || email || undefined,
      });
      leagueMemoryCache.invalidatePrefix(LEAGUES_CACHE_PREFIX);
      if (isCurrent()) setLeagues((prev) => [created, ...prev]);
      if (isCurrent()) selectLeague(created.id);
      dispatchLeagueChanged(created.id, 'leagues');
      notify?.(`สร้างลีก "${created.name}" สำเร็จ`, 'success');
      return created;
    } catch (err: unknown) {
      notify?.(`สร้างลีกไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [captureContext, notify, selectLeague]);

  const updateLeague = useCallback(async (
    id: string,
    updates: Partial<League>,
    options: UpdateLeagueOptions = {},
  ) => {
    const isCurrent = captureContext();
    try {
      const updated = await LeagueService.updateLeague(id, updates);
      leagueMemoryCache.invalidatePrefix(LEAGUES_CACHE_PREFIX);
      if (isCurrent()) setLeagues((prev) => prev.map((l) => (l.id === id ? updated : l)));
      dispatchLeagueChanged(updated.id, 'leagues');
      if (!options.silent) notify?.(`อัปเดตข้อมูลลีกสำเร็จ`, 'success');
      return updated;
    } catch (err: unknown) {
      if (!options.silent) {
        notify?.(`อัปเดตไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      }
      throw err;
    }
  }, [captureContext, notify]);

  const deleteLeague = useCallback(async (id: string) => {
    const isCurrent = captureContext();
    try {
      await LeagueService.deleteLeague(id);
      leagueMemoryCache.invalidatePrefix(LEAGUES_CACHE_PREFIX);
      leagueMemoryCache.invalidatePrefix(DETAILS_CACHE_PREFIX);
      if (isCurrent()) setLeagues((prev) => prev.filter((l) => l.id !== id));
      if (isCurrent() && activeLeagueIdRef.current === id) {
        const remaining = leagues.filter((l) => l.id !== id);
        const nextId = remaining.length > 0 ? remaining[0].id : '';
        selectLeague(nextId);
      }
      notify?.(`ลบลีกเรียบร้อยแล้ว`, 'info');
      dispatchLeagueChanged(id, 'leagues');
    } catch (err: unknown) {
      notify?.(`ลบลีกไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [captureContext, leagues, notify, selectLeague]);

  // Team Actions
  const createTeam = useCallback(async (payload: Omit<Team, 'id' | 'created_at' | 'updated_at'>) => {
    const isCurrent = captureContext();
    try {
      const activeId = activeLeagueIdRef.current;
      if (!activeId || payload.league_id !== activeId) {
        throw new Error('ไม่สามารถเพิ่มทีมข้ามลีกได้ กรุณาเลือก League ปัจจุบันใหม่');
      }
      const created = await LeagueService.createTeam(payload);
      invalidateLeagueDetailsCache(created.league_id);
      if (isCurrent()) setTeams((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'th')));
      dispatchLeagueChanged(created.league_id, 'teams');
      notify?.(`เพิ่มทีม "${created.name}" สำเร็จ`, 'success');
      return created;
    } catch (err: unknown) {
      notify?.(`เพิ่มทีมไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [captureContext, notify]);

  const updateTeam = useCallback(async (id: string, updates: Partial<Team>) => {
    const isCurrent = captureContext();
    try {
      const activeId = activeLeagueIdRef.current;
      if (!activeId || (updates.league_id !== undefined && updates.league_id !== activeId)) {
        throw new Error('ไม่สามารถแก้ไขทีมข้ามลีกได้ กรุณาเลือก League ปัจจุบันใหม่');
      }
      const updated = await LeagueService.updateTeam(id, updates, activeId);
      invalidateLeagueDetailsCache(updated.league_id);
      if (isCurrent()) setTeams((prev) => prev.map((t) => (t.id === id ? updated : t)).sort((a, b) => a.name.localeCompare(b.name, 'th')));
      dispatchLeagueChanged(updated.league_id, 'teams');
      notify?.(`อัปเดตทีม "${updated.name}" สำเร็จ`, 'success');
      return updated;
    } catch (err: unknown) {
      notify?.(`อัปเดตทีมไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [captureContext, notify]);

  const deleteTeam = useCallback(async (id: string) => {
    const isCurrent = captureContext();
    try {
      const activeId = activeLeagueIdRef.current;
      if (!activeId) throw new Error('กรุณาเลือก League ก่อนลบทีม');
      await LeagueService.deleteTeam(id, activeId);
      invalidateLeagueDetailsCache(activeId);
      if (isCurrent()) setTeams((prev) => prev.filter((t) => t.id !== id));
      dispatchLeagueChanged(activeId, 'teams');
      dispatchLeagueChanged(activeId, 'matches');
      dispatchLeagueChanged(activeId, 'players', id);
      dispatchLeagueChanged(activeId, 'player_match_stats', id);
      notify?.(`ลบทีมเรียบร้อยแล้ว`, 'info');
    } catch (err: unknown) {
      notify?.(`ลบทีมไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [captureContext, notify]);

  const getPlayersByTeam = useCallback(async (teamId: string) => {
    const leagueId = activeLeagueIdRef.current;
    if (!leagueId || !teamId) return [];
    return LeagueService.getPlayersByTeam(teamId, leagueId);
  }, []);

  const createPlayer = useCallback(async (payload: Omit<Player, 'id' | 'created_at' | 'updated_at'>) => {
    const leagueId = activeLeagueIdRef.current;
    if (!leagueId || payload.league_id !== leagueId) throw new Error('ไม่สามารถเพิ่มนักเตะข้ามลีกได้');
    try {
      const created = await LeagueService.createPlayer(payload);
      dispatchLeagueChanged(created.league_id, 'players', created.team_id);
      notify?.(`เพิ่มนักเตะ "${created.name}" สำเร็จ`, 'success');
      return created;
    } catch (err: unknown) {
      notify?.(`เพิ่มนักเตะไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [notify]);

  const updatePlayer = useCallback(async (id: string, updates: Partial<Player>) => {
    const leagueId = activeLeagueIdRef.current;
    const teamId = updates.team_id;
    if (!leagueId || !teamId) throw new Error('ต้องระบุทีมและลีกของนักเตะ');
    try {
      const updated = await LeagueService.updatePlayer(id, updates, teamId, leagueId);
      dispatchLeagueChanged(updated.league_id, 'players', updated.team_id);
      notify?.(`อัปเดตนักเตะ "${updated.name}" สำเร็จ`, 'success');
      return updated;
    } catch (err: unknown) {
      notify?.(`อัปเดตนักเตะไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [notify]);

  const deletePlayer = useCallback(async (id: string, teamId: string) => {
    const leagueId = activeLeagueIdRef.current;
    if (!leagueId) throw new Error('กรุณาเลือกลีกก่อนลบนักเตะ');
    try {
      await LeagueService.deletePlayer(id, teamId, leagueId);
      dispatchLeagueChanged(leagueId, 'players', teamId);
      dispatchLeagueChanged(leagueId, 'player_match_stats', teamId);
      notify?.('ลบนักเตะเรียบร้อยแล้ว', 'info');
    } catch (err: unknown) {
      notify?.(`ลบนักเตะไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [notify]);

  const getPlayerMatchStats = useCallback(async (teamId: string) => {
    const leagueId = activeLeagueIdRef.current;
    if (!leagueId || !teamId) return [];
    return LeagueService.getPlayerMatchStats(teamId, leagueId);
  }, []);

  const upsertPlayerMatchStat = useCallback(async (payload: Omit<PlayerMatchStat, 'id' | 'created_at' | 'updated_at'>) => {
    const leagueId = activeLeagueIdRef.current;
    if (!leagueId || payload.league_id !== leagueId) throw new Error('ไม่สามารถบันทึกสถิติข้ามลีกได้');
    const saved = await LeagueService.upsertPlayerMatchStat(payload);
    dispatchLeagueChanged(saved.league_id, 'player_match_stats', saved.team_id);
    return saved;
  }, []);

  const deletePlayerMatchStat = useCallback(async (id: string) => {
    const leagueId = activeLeagueIdRef.current;
    if (!leagueId) throw new Error('กรุณาเลือกลีกก่อนลบสถิติ');
    await LeagueService.deletePlayerMatchStat(id, leagueId);
    dispatchLeagueChanged(leagueId, 'player_match_stats');
  }, []);

  const uploadTeamLogo = useCallback(async (
    file: File | Blob,
    fileName: string,
    provider: LogoStorageProvider = 'supabase',
  ) => {
    try {
      return await LeagueService.uploadTeamLogo(file, fileName, provider);
    } catch (err: unknown) {
      notify?.(`อัปโหลดโลโก้ไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [notify]);

  // Match Actions
  const createMatch = useCallback(async (payload: Omit<Match, 'id' | 'created_at' | 'updated_at'>) => {
    const isCurrent = captureContext();
    try {
      const activeId = activeLeagueIdRef.current;
      if (!activeId || payload.league_id !== activeId) {
        throw new Error('ไม่สามารถเพิ่มแมตช์ข้ามลีกได้ กรุณาเลือก League ปัจจุบันใหม่');
      }
      const created = await LeagueService.createMatch(payload);
      invalidateLeagueDetailsCache(created.league_id);
      if (isCurrent()) setMatches((prev) => [...prev, created].sort((a, b) => a.match_number - b.match_number));
      dispatchLeagueChanged(created.league_id, 'matches');
      notify?.(`เพิ่มแมตช์ที่ ${created.match_number} เรียบร้อยแล้ว`, 'success');
      return created;
    } catch (err: unknown) {
      notify?.(`เพิ่มแมตช์ไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [captureContext, notify]);

  const updateMatch = useCallback(async (id: string, updates: Partial<Match>) => {
    const isCurrent = captureContext();
    try {
      const activeId = activeLeagueIdRef.current;
      if (!activeId || (updates.league_id !== undefined && updates.league_id !== activeId)) {
        throw new Error('ไม่สามารถแก้ไขแมตช์ข้ามลีกได้ กรุณาเลือก League ปัจจุบันใหม่');
      }
      const currentMatch = matches.find((match) => match.id === id && match.league_id === activeId);
      if (!currentMatch) {
        throw new Error('ไม่พบแมตช์ใน League ปัจจุบัน กรุณารีเฟรชข้อมูลก่อนบันทึก');
      }
      if (!currentMatch.updated_at) {
        throw new Error('ไม่พบเวอร์ชันข้อมูลแมตช์ กรุณารีเฟรชข้อมูลก่อนบันทึก');
      }
      const updated = await LeagueService.updateMatch(id, updates, activeId, currentMatch.updated_at);
      invalidateLeagueDetailsCache(updated.league_id);
      if (isCurrent()) setMatches((prev) => prev.map((m) => (m.id === id ? updated : m)).sort((a, b) => a.match_number - b.match_number));
      dispatchLeagueChanged(updated.league_id, 'matches');
      notify?.(`อัปเดตแมตช์ที่ ${updated.match_number} สำเร็จ`, 'success');
      return updated;
    } catch (err: unknown) {
      notify?.(`อัปเดตแมตช์ไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [captureContext, matches, notify]);

  const deleteMatch = useCallback(async (id: string) => {
    const isCurrent = captureContext();
    try {
      const activeId = activeLeagueIdRef.current;
      if (!activeId) throw new Error('กรุณาเลือก League ก่อนลบแมตช์');
      await LeagueService.deleteMatch(id, activeId);
      invalidateLeagueDetailsCache(activeId);
      if (isCurrent()) setMatches((prev) => prev.filter((m) => m.id !== id));
      dispatchLeagueChanged(activeId, 'matches');
      dispatchLeagueChanged(activeId, 'player_match_stats');
      notify?.(`ลบแมตช์เรียบร้อยแล้ว`, 'info');
    } catch (err: unknown) {
      notify?.(`ลบแมตช์ไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [captureContext, notify]);

  const clearMatches = useCallback(async () => {
    const activeId = activeLeagueIdRef.current;
    if (!activeId) return;
    const isCurrent = captureContext();
    try {
      await LeagueService.deleteMatchesByLeague(activeId);
      invalidateLeagueDetailsCache(activeId);
      if (isCurrent()) setMatches([]);
      dispatchLeagueChanged(activeId, 'matches');
      dispatchLeagueChanged(activeId, 'player_match_stats');
      notify?.(`ล้างตารางการแข่งขันทั้งหมดแล้ว`, 'info');
    } catch (err: unknown) {
      notify?.(`ล้างตารางแข่งไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [captureContext, notify]);

  const standings: StandingsRow[] = useMemo(() => {
    return LeagueService.calculateStandings(matches, teams);
  }, [matches, teams]);

  const refreshLeagueDetails = useCallback(async (): Promise<LeagueDetailsResult | null> => {
    if (activeLeagueId) {
      return fetchLeagueDetails(activeLeagueId);
    }
    return null;
  }, [activeLeagueId, fetchLeagueDetails]);

  return useMemo<UseSupabaseLeagueResult>(() => ({
    captureActiveContext: captureContext,
    isConfigured,
    leagues,
    activeLeagueId,
    activeLeague,
    teams,
    matches,
    standings,
    loading,
    detailsLoading,
    detailsLoadedLeagueId,
    refreshing,
    error,
    selectLeague,
    fetchLeagues,
    refreshLeagueDetails,
    createLeague,
    updateLeague,
    deleteLeague,
    createTeam,
    updateTeam,
    deleteTeam,
    getPlayersByTeam,
    createPlayer,
    updatePlayer,
    deletePlayer,
    getPlayerMatchStats,
    upsertPlayerMatchStat,
    deletePlayerMatchStat,
    uploadTeamLogo,
    createMatch,
    updateMatch,
    deleteMatch,
    clearMatches,
  }), [
    captureContext,
    activeLeague,
    activeLeagueId,
    clearMatches,
    createLeague,
    createMatch,
    createTeam,
    deleteLeague,
    deleteMatch,
    deleteTeam,
    getPlayersByTeam,
    createPlayer,
    updatePlayer,
    deletePlayer,
    getPlayerMatchStats,
    upsertPlayerMatchStat,
    deletePlayerMatchStat,
    detailsLoadedLeagueId,
    detailsLoading,
    error,
    fetchLeagues,
    isConfigured,
    leagues,
    loading,
    matches,
    refreshLeagueDetails,
    refreshing,
    selectLeague,
    standings,
    teams,
    updateLeague,
    updateMatch,
    updateTeam,
    uploadTeamLogo,
  ]);
}
