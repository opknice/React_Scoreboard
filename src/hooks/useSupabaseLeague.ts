import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { League, Team, Match } from '../config/supabaseClient';
import { supabase, isSupabaseConfigured } from '../config/supabaseClient';
import { LeagueService, type StandingsRow } from '../services/leagueService';
import { dedupeRequest, leagueMemoryCache } from '../utils/memoryCache';

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

type RealtimeTable = 'leagues' | 'teams' | 'matches';

interface SharedRealtimeChange {
  table: RealtimeTable;
  newLeagueId?: string;
  oldLeagueId?: string;
}

type SharedRealtimeListener = (change: SharedRealtimeChange) => void;

interface LeagueChangedEventDetail {
  type: 'data-changed';
  leagueId?: string;
}

function dispatchLeagueChanged(leagueId?: string): void {
  window.dispatchEvent(new CustomEvent<LeagueChangedEventDetail>('supabase_league_changed', {
    detail: { type: 'data-changed', leagueId },
  }));
}

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
  fetchLeagues: (silent?: boolean) => Promise<void>;
  refreshLeagueDetails: () => Promise<LeagueDetailsResult | null>;
  createLeague: (payload: Omit<League, 'id' | 'created_at' | 'updated_at'>) => Promise<League>;
  updateLeague: (id: string, updates: Partial<League>) => Promise<League>;
  deleteLeague: (id: string) => Promise<void>;
  createTeam: (payload: Omit<Team, 'id' | 'created_at' | 'updated_at'>) => Promise<Team>;
  updateTeam: (id: string, updates: Partial<Team>) => Promise<Team>;
  deleteTeam: (id: string) => Promise<void>;
  uploadTeamLogo: (file: File | Blob, fileName: string) => Promise<string>;
  createMatch: (payload: Omit<Match, 'id' | 'created_at' | 'updated_at'>) => Promise<Match>;
  updateMatch: (id: string, updates: Partial<Match>) => Promise<Match>;
  deleteMatch: (id: string) => Promise<void>;
  clearMatches: () => Promise<void>;
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

function emitSharedRealtimeChange(change: SharedRealtimeChange): void {
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
          activeLeagueIdRef.current = '';
          setActiveLeagueId('');
        }
      } else if (!data.length) {
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
      if (activeLeagueIdRef.current !== leagueId) return null;

      const result = { teams: scopedTeams, matches: scopedMatches };

      // A newer request for the same league owns the React state commit, but
      // this response is still valid for its direct caller. This prevents a
      // manual refresh from reporting failure when a realtime refresh starts
      // while both requests are sharing the same in-flight server response.
      if (requestId === detailsRequestIdRef.current) {
        setTeams(scopedTeams);
        setMatches(scopedMatches);
        setDetailsLoadedLeagueId(leagueId);
      }

      return result;
    } catch (err: unknown) {
      if (requestId !== detailsRequestIdRef.current || activeLeagueIdRef.current !== leagueId) return null;
      console.error(`Failed to load details for league ${leagueId}:`, err);
      setError(getErrorMessage(err, 'Failed to load league details'));
      return null;
    } finally {
      if (requestId === detailsRequestIdRef.current) {
        setDetailsLoading(false);
        setLoading(false);
        if (silent) setRefreshing(false);
      }
    }
  }, [isConfigured]);

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

  const scheduleDetailsRefresh = useCallback((leagueId: string) => {
    if (detailsRefreshTimerRef.current !== null) {
      window.clearTimeout(detailsRefreshTimerRef.current);
    }
    detailsRefreshTimerRef.current = window.setTimeout(() => {
      detailsRefreshTimerRef.current = null;
      void fetchLeagueDetailsRef.current(leagueId, true);
    }, 200);
  }, []);

  useEffect(() => () => {
    if (leaguesRefreshTimerRef.current !== null) {
      window.clearTimeout(leaguesRefreshTimerRef.current);
    }
    if (detailsRefreshTimerRef.current !== null) {
      window.clearTimeout(detailsRefreshTimerRef.current);
    }
  }, []);

  // Handle user change
  useEffect(() => {
    // Never carry a league selection across users or page sessions.
    activeLeagueIdRef.current = '';
    detailsRequestIdRef.current += 1;
    setActiveLeagueId('');
    setTeams([]);
    setMatches([]);
    setDetailsLoading(false);
    setDetailsLoadedLeagueId(null);
    void fetchLeagues();
  }, [userEmail, fetchLeagues]);

  // Initial load & Cross-instance sync (Syncs both leagues list AND current league matches/teams)
  useEffect(() => {
    const handleSync = (event: Event) => {
      const detail = event instanceof CustomEvent
        && event.detail
        && typeof event.detail === 'object'
        ? event.detail as Partial<LeagueChangedEventDetail>
        : undefined;
      const changedLeagueId = typeof detail?.leagueId === 'string'
        ? detail.leagueId
        : undefined;
      scheduleLeaguesRefresh();
      const currentId = activeLeagueIdRef.current;
      if (currentId && (!changedLeagueId || changedLeagueId === currentId)) {
        scheduleDetailsRefresh(currentId);
      }
    };

    window.addEventListener('supabase_league_changed', handleSync);

    return () => {
      window.removeEventListener('supabase_league_changed', handleSync);
    };
  }, [scheduleDetailsRefresh, scheduleLeaguesRefresh]);

  // Supabase Realtime Subscription: all hook instances share one channel.
  useEffect(() => {
    if (!isConfigured || !supabase) return undefined;

    return subscribeToSharedRealtime((change) => {
      if (change.table === 'leagues') {
        leagueMemoryCache.invalidatePrefix(LEAGUES_CACHE_PREFIX);
        leagueMemoryCache.invalidatePrefix(DETAILS_CACHE_PREFIX);
        scheduleLeaguesRefresh();
        return;
      }

      const currentId = activeLeagueIdRef.current;
      if (
        currentId &&
        (change.newLeagueId === currentId || change.oldLeagueId === currentId)
      ) {
        invalidateLeagueDetailsCache(currentId);
        scheduleDetailsRefresh(currentId);
      }
    });
  }, [
    isConfigured,
    scheduleDetailsRefresh,
    scheduleLeaguesRefresh,
  ]);

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
    try {
      const email = userEmailRef.current ? userEmailRef.current.trim().toLowerCase() : undefined;
      const created = await LeagueService.createLeague({
        ...payload,
        created_by: payload.created_by || email || undefined,
      });
      leagueMemoryCache.invalidatePrefix(LEAGUES_CACHE_PREFIX);
      setLeagues((prev) => [created, ...prev]);
      selectLeague(created.id);
      dispatchLeagueChanged(created.id);
      notify?.(`สร้างลีก "${created.name}" สำเร็จ`, 'success');
      return created;
    } catch (err: unknown) {
      notify?.(`สร้างลีกไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [notify, selectLeague]);

  const updateLeague = useCallback(async (id: string, updates: Partial<League>) => {
    try {
      const updated = await LeagueService.updateLeague(id, updates);
      leagueMemoryCache.invalidatePrefix(LEAGUES_CACHE_PREFIX);
      setLeagues((prev) => prev.map((l) => (l.id === id ? updated : l)));
      dispatchLeagueChanged(updated.id);
      notify?.(`อัปเดตข้อมูลลีกสำเร็จ`, 'success');
      return updated;
    } catch (err: unknown) {
      notify?.(`อัปเดตไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [notify]);

  const deleteLeague = useCallback(async (id: string) => {
    try {
      await LeagueService.deleteLeague(id);
      leagueMemoryCache.invalidatePrefix(LEAGUES_CACHE_PREFIX);
      leagueMemoryCache.invalidatePrefix(DETAILS_CACHE_PREFIX);
      setLeagues((prev) => prev.filter((l) => l.id !== id));
      if (activeLeagueId === id) {
        const remaining = leagues.filter((l) => l.id !== id);
        const nextId = remaining.length > 0 ? remaining[0].id : '';
        selectLeague(nextId);
      }
      notify?.(`ลบลีกเรียบร้อยแล้ว`, 'info');
      dispatchLeagueChanged(id);
    } catch (err: unknown) {
      notify?.(`ลบลีกไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [activeLeagueId, leagues, notify, selectLeague]);

  // Team Actions
  const createTeam = useCallback(async (payload: Omit<Team, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const activeId = activeLeagueIdRef.current;
      if (!activeId || payload.league_id !== activeId) {
        throw new Error('ไม่สามารถเพิ่มทีมข้ามลีกได้ กรุณาเลือก League ปัจจุบันใหม่');
      }
      const created = await LeagueService.createTeam(payload);
      invalidateLeagueDetailsCache(created.league_id);
      setTeams((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'th')));
      dispatchLeagueChanged(created.league_id);
      notify?.(`เพิ่มทีม "${created.name}" สำเร็จ`, 'success');
      return created;
    } catch (err: unknown) {
      notify?.(`เพิ่มทีมไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [notify]);

  const updateTeam = useCallback(async (id: string, updates: Partial<Team>) => {
    try {
      const activeId = activeLeagueIdRef.current;
      if (!activeId || (updates.league_id !== undefined && updates.league_id !== activeId)) {
        throw new Error('ไม่สามารถแก้ไขทีมข้ามลีกได้ กรุณาเลือก League ปัจจุบันใหม่');
      }
      const updated = await LeagueService.updateTeam(id, updates, activeId);
      invalidateLeagueDetailsCache(updated.league_id);
      setTeams((prev) => prev.map((t) => (t.id === id ? updated : t)).sort((a, b) => a.name.localeCompare(b.name, 'th')));
      dispatchLeagueChanged(updated.league_id);
      notify?.(`อัปเดตทีม "${updated.name}" สำเร็จ`, 'success');
      return updated;
    } catch (err: unknown) {
      notify?.(`อัปเดตทีมไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [notify]);

  const deleteTeam = useCallback(async (id: string) => {
    try {
      const activeId = activeLeagueIdRef.current;
      if (!activeId) throw new Error('กรุณาเลือก League ก่อนลบทีม');
      await LeagueService.deleteTeam(id, activeId);
      invalidateLeagueDetailsCache(activeId);
      setTeams((prev) => prev.filter((t) => t.id !== id));
      dispatchLeagueChanged(activeId);
      notify?.(`ลบทีมเรียบร้อยแล้ว`, 'info');
    } catch (err: unknown) {
      notify?.(`ลบทีมไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [notify]);

  const uploadTeamLogo = useCallback(async (file: File | Blob, fileName: string) => {
    try {
      return await LeagueService.uploadTeamLogo(file, fileName);
    } catch (err: unknown) {
      notify?.(`อัปโหลดโลโก้ไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [notify]);

  // Match Actions
  const createMatch = useCallback(async (payload: Omit<Match, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const activeId = activeLeagueIdRef.current;
      if (!activeId || payload.league_id !== activeId) {
        throw new Error('ไม่สามารถเพิ่มแมตช์ข้ามลีกได้ กรุณาเลือก League ปัจจุบันใหม่');
      }
      const created = await LeagueService.createMatch(payload);
      invalidateLeagueDetailsCache(created.league_id);
      setMatches((prev) => [...prev, created].sort((a, b) => a.match_number - b.match_number));
      dispatchLeagueChanged(created.league_id);
      notify?.(`เพิ่มแมตช์ที่ ${created.match_number} เรียบร้อยแล้ว`, 'success');
      return created;
    } catch (err: unknown) {
      notify?.(`เพิ่มแมตช์ไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [notify]);

  const updateMatch = useCallback(async (id: string, updates: Partial<Match>) => {
    try {
      const activeId = activeLeagueIdRef.current;
      if (!activeId || (updates.league_id !== undefined && updates.league_id !== activeId)) {
        throw new Error('ไม่สามารถแก้ไขแมตช์ข้ามลีกได้ กรุณาเลือก League ปัจจุบันใหม่');
      }
      const updated = await LeagueService.updateMatch(id, updates, activeId);
      invalidateLeagueDetailsCache(updated.league_id);
      setMatches((prev) => prev.map((m) => (m.id === id ? updated : m)).sort((a, b) => a.match_number - b.match_number));
      dispatchLeagueChanged(updated.league_id);
      notify?.(`อัปเดตแมตช์ที่ ${updated.match_number} สำเร็จ`, 'success');
      return updated;
    } catch (err: unknown) {
      notify?.(`อัปเดตแมตช์ไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [notify]);

  const deleteMatch = useCallback(async (id: string) => {
    try {
      const activeId = activeLeagueIdRef.current;
      if (!activeId) throw new Error('กรุณาเลือก League ก่อนลบแมตช์');
      await LeagueService.deleteMatch(id, activeId);
      invalidateLeagueDetailsCache(activeId);
      setMatches((prev) => prev.filter((m) => m.id !== id));
      dispatchLeagueChanged(activeId);
      notify?.(`ลบแมตช์เรียบร้อยแล้ว`, 'info');
    } catch (err: unknown) {
      notify?.(`ลบแมตช์ไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [notify]);

  const clearMatches = useCallback(async () => {
    if (!activeLeagueId) return;
    try {
      await LeagueService.deleteMatchesByLeague(activeLeagueId);
      invalidateLeagueDetailsCache(activeLeagueId);
      setMatches([]);
      dispatchLeagueChanged(activeLeagueId);
      notify?.(`ล้างตารางการแข่งขันทั้งหมดแล้ว`, 'info');
    } catch (err: unknown) {
      notify?.(`ล้างตารางแข่งไม่สำเร็จ: ${getErrorMessage(err, 'เกิดข้อผิดพลาด')}`, 'error');
      throw err;
    }
  }, [activeLeagueId, notify]);

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
    uploadTeamLogo,
    createMatch,
    updateMatch,
    deleteMatch,
    clearMatches,
  }), [
    activeLeague,
    activeLeagueId,
    clearMatches,
    createLeague,
    createMatch,
    createTeam,
    deleteLeague,
    deleteMatch,
    deleteTeam,
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
