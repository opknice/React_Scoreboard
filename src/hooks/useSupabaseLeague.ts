import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { League, Team, Match } from '../config/supabaseClient';
import { supabase, isSupabaseConfigured } from '../config/supabaseClient';
import { LeagueService, type StandingsRow } from '../services/leagueService';

const ACTIVE_LEAGUE_STORAGE_KEY = 'supabase_active_league_id';

export function useSupabaseLeague(
  notify?: (msg: string, type?: 'info' | 'success' | 'error') => void,
  userEmail?: string
) {
  const [isConfigured] = useState<boolean>(isSupabaseConfigured);
  const [leagues, setLeagues] = useState<League[]>([]);
  const userEmailRef = useRef(userEmail);
  userEmailRef.current = userEmail;

  const getStorageKey = useCallback((email?: string) => {
    const clean = email ? email.trim().toLowerCase() : '';
    return clean ? `${ACTIVE_LEAGUE_STORAGE_KEY}_${clean}` : ACTIVE_LEAGUE_STORAGE_KEY;
  }, []);

  const [activeLeagueId, setActiveLeagueId] = useState<string>(() => {
    return localStorage.getItem(getStorageKey(userEmail)) || '';
  });
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeLeague = useMemo(() => {
    return leagues.find((l) => l.id === activeLeagueId) || null;
  }, [leagues, activeLeagueId]);

  const activeLeagueIdRef = useRef(activeLeagueId);
  activeLeagueIdRef.current = activeLeagueId;

  // Load all leagues for the current user
  const fetchLeagues = useCallback(async (silent = false) => {
    if (!isConfigured) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const currentEmail = userEmailRef.current;
      const data = await LeagueService.getLeagues(currentEmail);
      setLeagues(data);
      const currentActive = activeLeagueIdRef.current;
      const key = getStorageKey(currentEmail);
      if (data.length > 0 && currentActive) {
        const currentValid = data.some((l) => l.id === currentActive);
        if (!currentValid) {
          setActiveLeagueId('');
          localStorage.removeItem(key);
        }
      } else if (!data.length) {
        setActiveLeagueId('');
        localStorage.removeItem(key);
      }
    } catch (err: any) {
      console.error('Failed to load leagues from Supabase:', err);
      setError(err.message || 'Failed to load leagues');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isConfigured, getStorageKey]);

  // Load teams and matches for the active league
  const fetchLeagueDetails = useCallback(async (leagueId: string, silent = false) => {
    if (!isConfigured || !leagueId) {
      setTeams([]);
      setMatches([]);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const [teamsData, matchesData] = await Promise.all([
        LeagueService.getTeamsByLeague(leagueId),
        LeagueService.getMatchesByLeague(leagueId),
      ]);
      setTeams(teamsData);
      setMatches(matchesData);
    } catch (err: any) {
      console.error(`Failed to load details for league ${leagueId}:`, err);
      setError(err.message || 'Failed to load league details');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isConfigured]);

  const fetchLeaguesRef = useRef(fetchLeagues);
  fetchLeaguesRef.current = fetchLeagues;

  const fetchLeagueDetailsRef = useRef(fetchLeagueDetails);
  fetchLeagueDetailsRef.current = fetchLeagueDetails;

  // Handle user change
  useEffect(() => {
    const key = getStorageKey(userEmail);
    const saved = localStorage.getItem(key) || '';
    setActiveLeagueId(saved);
    fetchLeagues();
  }, [userEmail, fetchLeagues, getStorageKey]);

  // Initial load & Cross-instance sync (Syncs both leagues list AND current league matches/teams)
  useEffect(() => {
    const handleSync = (e?: Event) => {
      if (e && 'key' in e) {
        const storageEvt = e as StorageEvent;
        const key = getStorageKey(userEmailRef.current);
        if (storageEvt.key && storageEvt.key !== key && storageEvt.key !== ACTIVE_LEAGUE_STORAGE_KEY) {
          return;
        }
      }
      const key = getStorageKey(userEmailRef.current);
      const saved = localStorage.getItem(key) || '';
      if (saved !== activeLeagueIdRef.current) {
        setActiveLeagueId(saved);
      }
      void fetchLeaguesRef.current(true);
      const currentId = saved || activeLeagueIdRef.current;
      if (currentId) {
        void fetchLeagueDetailsRef.current(currentId, true);
      }
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('supabase_league_changed', handleSync);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('supabase_league_changed', handleSync);
    };
  }, [getStorageKey]);

  // Supabase Realtime Subscription: Automatically sync leagues, teams, and matches live
  // Use a stable unique channel name per hook instance to avoid conflicts when
  // multiple components (ScoreboardController + LeagueManagementModal) both mount this hook.
  const realtimeChannelIdRef = useRef(`realtime_league_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

  useEffect(() => {
    if (!isConfigured || !supabase) return;

    const channel = supabase
      .channel(realtimeChannelIdRef.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leagues' },
        () => {
          void fetchLeaguesRef.current(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams' },
        (payload) => {
          const currentId = activeLeagueIdRef.current;
          const newRecord = payload.new as { league_id?: string } | undefined;
          const oldRecord = payload.old as { league_id?: string } | undefined;
          if (!currentId || newRecord?.league_id === currentId || oldRecord?.league_id === currentId) {
            if (currentId) void fetchLeagueDetailsRef.current(currentId, true);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
          const currentId = activeLeagueIdRef.current;
          const newRecord = payload.new as { league_id?: string } | undefined;
          const oldRecord = payload.old as { league_id?: string } | undefined;
          if (!currentId || newRecord?.league_id === currentId || oldRecord?.league_id === currentId) {
            if (currentId) void fetchLeagueDetailsRef.current(currentId, true);
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase && channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [isConfigured]);

  // Load teams & matches whenever activeLeagueId changes
  useEffect(() => {
    if (activeLeagueId) {
      fetchLeagueDetails(activeLeagueId);
    } else {
      setTeams([]);
      setMatches([]);
    }
  }, [activeLeagueId, fetchLeagueDetails]);

  // Change active league
  const selectLeague = useCallback((leagueId: string) => {
    setActiveLeagueId(leagueId);
    const key = getStorageKey(userEmailRef.current);
    if (leagueId) {
      localStorage.setItem(key, leagueId);
    } else {
      localStorage.removeItem(key);
    }
    window.dispatchEvent(new CustomEvent('supabase_league_changed'));
  }, [getStorageKey]);

  // League Actions
  const createLeague = useCallback(async (payload: Omit<League, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const email = userEmailRef.current ? userEmailRef.current.trim().toLowerCase() : undefined;
      const created = await LeagueService.createLeague({
        ...payload,
        created_by: payload.created_by || email || undefined,
      });
      setLeagues((prev) => [created, ...prev]);
      selectLeague(created.id);
      window.dispatchEvent(new CustomEvent('supabase_league_changed'));
      notify?.(`สร้างลีก "${created.name}" สำเร็จ`, 'success');
      return created;
    } catch (err: any) {
      notify?.(`สร้างลีกไม่สำเร็จ: ${err.message}`, 'error');
      throw err;
    }
  }, [notify, selectLeague]);

  const updateLeague = useCallback(async (id: string, updates: Partial<League>) => {
    try {
      const updated = await LeagueService.updateLeague(id, updates);
      setLeagues((prev) => prev.map((l) => (l.id === id ? updated : l)));
      window.dispatchEvent(new CustomEvent('supabase_league_changed'));
      notify?.(`อัปเดตข้อมูลลีกสำเร็จ`, 'success');
      return updated;
    } catch (err: any) {
      notify?.(`อัปเดตไม่สำเร็จ: ${err.message}`, 'error');
      throw err;
    }
  }, [notify]);

  const deleteLeague = useCallback(async (id: string) => {
    try {
      await LeagueService.deleteLeague(id);
      setLeagues((prev) => prev.filter((l) => l.id !== id));
      if (activeLeagueId === id) {
        const remaining = leagues.filter((l) => l.id !== id);
        const nextId = remaining.length > 0 ? remaining[0].id : '';
        selectLeague(nextId);
      }
      notify?.(`ลบลีกเรียบร้อยแล้ว`, 'info');
      window.dispatchEvent(new CustomEvent('supabase_league_changed'));
    } catch (err: any) {
      notify?.(`ลบลีกไม่สำเร็จ: ${err.message}`, 'error');
      throw err;
    }
  }, [activeLeagueId, leagues, notify, selectLeague]);

  // Team Actions
  const createTeam = useCallback(async (payload: Omit<Team, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const created = await LeagueService.createTeam(payload);
      setTeams((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'th')));
      window.dispatchEvent(new CustomEvent('supabase_league_changed'));
      notify?.(`เพิ่มทีม "${created.name}" สำเร็จ`, 'success');
      return created;
    } catch (err: any) {
      notify?.(`เพิ่มทีมไม่สำเร็จ: ${err.message}`, 'error');
      throw err;
    }
  }, [notify]);

  const updateTeam = useCallback(async (id: string, updates: Partial<Team>) => {
    try {
      const updated = await LeagueService.updateTeam(id, updates);
      setTeams((prev) => prev.map((t) => (t.id === id ? updated : t)).sort((a, b) => a.name.localeCompare(b.name, 'th')));
      window.dispatchEvent(new CustomEvent('supabase_league_changed'));
      notify?.(`อัปเดตทีม "${updated.name}" สำเร็จ`, 'success');
      return updated;
    } catch (err: any) {
      notify?.(`อัปเดตทีมไม่สำเร็จ: ${err.message}`, 'error');
      throw err;
    }
  }, [notify]);

  const deleteTeam = useCallback(async (id: string) => {
    try {
      await LeagueService.deleteTeam(id);
      setTeams((prev) => prev.filter((t) => t.id !== id));
      window.dispatchEvent(new CustomEvent('supabase_league_changed'));
      notify?.(`ลบทีมเรียบร้อยแล้ว`, 'info');
    } catch (err: any) {
      notify?.(`ลบทีมไม่สำเร็จ: ${err.message}`, 'error');
      throw err;
    }
  }, [notify]);

  const uploadTeamLogo = useCallback(async (file: File | Blob, fileName: string) => {
    try {
      return await LeagueService.uploadTeamLogo(file, fileName);
    } catch (err: any) {
      notify?.(`อัปโหลดโลโก้ไม่สำเร็จ: ${err.message}`, 'error');
      throw err;
    }
  }, [notify]);

  // Match Actions
  const createMatch = useCallback(async (payload: Omit<Match, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const created = await LeagueService.createMatch(payload);
      setMatches((prev) => [...prev, created].sort((a, b) => a.match_number - b.match_number));
      window.dispatchEvent(new CustomEvent('supabase_league_changed'));
      notify?.(`เพิ่มแมตช์ที่ ${created.match_number} เรียบร้อยแล้ว`, 'success');
      return created;
    } catch (err: any) {
      notify?.(`เพิ่มแมตช์ไม่สำเร็จ: ${err.message}`, 'error');
      throw err;
    }
  }, [notify]);

  const createMatchesBatch = useCallback(async (batch: Omit<Match, 'id' | 'created_at' | 'updated_at'>[]) => {
    try {
      const created = await LeagueService.createMatchesBatch(batch);
      setMatches((prev) => [...prev, ...created].sort((a, b) => a.match_number - b.match_number));
      window.dispatchEvent(new CustomEvent('supabase_league_changed'));
      notify?.(`เพิ่มตารางแข่ง ${created.length} แมตช์เรียบร้อยแล้ว`, 'success');
      return created;
    } catch (err: any) {
      notify?.(`เพิ่มตารางแข่งไม่สำเร็จ: ${err.message}`, 'error');
      throw err;
    }
  }, [notify]);

  const updateMatch = useCallback(async (id: string, updates: Partial<Match>) => {
    try {
      const updated = await LeagueService.updateMatch(id, updates);
      setMatches((prev) => prev.map((m) => (m.id === id ? updated : m)).sort((a, b) => a.match_number - b.match_number));
      window.dispatchEvent(new CustomEvent('supabase_league_changed'));
      notify?.(`อัปเดตแมตช์ที่ ${updated.match_number} สำเร็จ`, 'success');
      return updated;
    } catch (err: any) {
      notify?.(`อัปเดตแมตช์ไม่สำเร็จ: ${err.message}`, 'error');
      throw err;
    }
  }, [notify]);

  const deleteMatch = useCallback(async (id: string) => {
    try {
      await LeagueService.deleteMatch(id);
      setMatches((prev) => prev.filter((m) => m.id !== id));
      window.dispatchEvent(new CustomEvent('supabase_league_changed'));
      notify?.(`ลบแมตช์เรียบร้อยแล้ว`, 'info');
    } catch (err: any) {
      notify?.(`ลบแมตช์ไม่สำเร็จ: ${err.message}`, 'error');
      throw err;
    }
  }, [notify]);

  const clearMatches = useCallback(async () => {
    if (!activeLeagueId) return;
    try {
      await LeagueService.deleteMatchesByLeague(activeLeagueId);
      setMatches([]);
      window.dispatchEvent(new CustomEvent('supabase_league_changed'));
      notify?.(`ล้างตารางการแข่งขันทั้งหมดแล้ว`, 'info');
    } catch (err: any) {
      notify?.(`ล้างตารางแข่งไม่สำเร็จ: ${err.message}`, 'error');
      throw err;
    }
  }, [activeLeagueId, notify]);

  const standings: StandingsRow[] = useMemo(() => {
    return LeagueService.calculateStandings(matches, teams);
  }, [matches, teams]);

  return {
    isConfigured,
    leagues,
    activeLeagueId,
    activeLeague,
    teams,
    matches,
    standings,
    loading,
    error,
    selectLeague,
    fetchLeagues,
    refreshLeagueDetails: () => activeLeagueId && fetchLeagueDetails(activeLeagueId),
    createLeague,
    updateLeague,
    deleteLeague,
    createTeam,
    updateTeam,
    deleteTeam,
    uploadTeamLogo,
    createMatch,
    createMatchesBatch,
    updateMatch,
    deleteMatch,
    clearMatches,
  };
}
