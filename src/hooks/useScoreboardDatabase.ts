import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createSupabaseMatch,
  deleteSupabaseMatch,
  listSupabaseMatches,
  subscribeSupabaseMatches,
  updateSupabaseMatch,
} from '../services/supabaseLeagueService';

export interface DatabaseMatch {
  id: string;
  date?: string;
  teamA?: string;
  teamB?: string;
  scoreA?: number | string;
  scoreB?: number | string;
  roundLabel?: string;
  url?: string;
  logoA?: string;
  logoB?: string;
}

interface UseScoreboardDatabaseOptions {
  supabaseLeagueId: string;
  notify: (message: string, type?: string) => void;
}

export function useScoreboardDatabase({ supabaseLeagueId, notify }: UseScoreboardDatabaseOptions) {
  const [matches, setMatches] = useState<DatabaseMatch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [editingMatch, setEditingMatch] = useState<DatabaseMatch | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  useEffect(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setMatches([]);
    setEditingMatch(null);
    setIsLoading(false);

    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [supabaseLeagueId]);

  const loadMatches = useCallback(() => {
    if (!supabaseLeagueId) {
      notifyRef.current('กรุณาเลือกลีกก่อน', 'error');
      return;
    }

    unsubscribeRef.current?.();
    setIsLoading(true);
    void listSupabaseMatches(supabaseLeagueId)
      .then((nextMatches) => {
        setMatches(nextMatches);
        setIsLoading(false);
        unsubscribeRef.current = subscribeSupabaseMatches(
          supabaseLeagueId,
          (updatedMatches) => setMatches(updatedMatches),
          (error: unknown) => {
            const detail = error instanceof Error ? error.message : String(error);
            notifyRef.current(`Supabase Realtime error: ${detail}`, 'error');
          },
        );
      })
      .catch((error: unknown) => {
        setIsLoading(false);
        const detail = error instanceof Error ? error.message : String(error);
        notifyRef.current(`โหลดข้อมูลจาก Supabase ไม่สำเร็จ: ${detail}`, 'error');
      });
  }, [supabaseLeagueId]);

  const deleteMatch = useCallback((match: DatabaseMatch) => {
    if (!supabaseLeagueId) return;
    if (!window.confirm(`ต้องการลบแมตช์ ${match.teamA || ''} vs ${match.teamB || ''} ใช่หรือไม่?`)) return;

    void deleteSupabaseMatch(supabaseLeagueId, match.id)
      .then(() => {
        notifyRef.current('ลบข้อมูลจาก Supabase สำเร็จ', 'success');
        loadMatches();
      })
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error);
        notifyRef.current(`ลบข้อมูลจาก Supabase ไม่สำเร็จ: ${detail}`, 'error');
      });
  }, [loadMatches, supabaseLeagueId]);

  const saveEditedMatch = useCallback((match: DatabaseMatch) => {
    const teamA = match.teamA?.trim() || '';
    const teamB = match.teamB?.trim() || '';
    const scoreA = Math.max(0, parseInt(String(match.scoreA ?? 0), 10) || 0);
    const scoreB = Math.max(0, parseInt(String(match.scoreB ?? 0), 10) || 0);
    const normalizedMatch = {
      date: match.date?.trim() || null,
      teamA,
      scoreA,
      teamB,
      scoreB,
      roundLabel: match.roundLabel?.trim() || '',
      url: match.url?.trim() || '',
      logoA: match.logoA?.trim() || '',
      logoB: match.logoB?.trim() || '',
    };

    if (!teamA || !teamB) {
      notifyRef.current('กรุณาระบุชื่อทีม A และทีม B', 'error');
      return;
    }
    if (!supabaseLeagueId) return;

    const saveRequest = match.id
      ? updateSupabaseMatch(supabaseLeagueId, match.id, normalizedMatch)
      : createSupabaseMatch({ leagueId: supabaseLeagueId, ...normalizedMatch });

    void saveRequest
      .then(() => {
        notifyRef.current(`${match.id ? 'แก้ไข' : 'เพิ่ม'}ข้อมูลใน Supabase สำเร็จ`, 'success');
        setEditingMatch(null);
        loadMatches();
      })
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error);
        notifyRef.current(`บันทึกข้อมูลใน Supabase ไม่สำเร็จ: ${detail}`, 'error');
      });
  }, [loadMatches, supabaseLeagueId]);

  const openCreate = useCallback(() => {
    setEditingMatch({
      id: '',
      date: new Date().toISOString().slice(0, 10),
      teamA: '',
      teamB: '',
      scoreA: 0,
      scoreB: 0,
      roundLabel: '',
      url: '',
      logoA: '',
      logoB: '',
    });
  }, []);

  const closeEdit = useCallback(() => setEditingMatch(null), []);

  const filteredMatches = matches.filter((match) => {
    const normalizedSearch = searchTerm.toLowerCase();
    const matchesSearch = [match.teamA, match.teamB, match.roundLabel]
      .some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
    if (!matchesSearch) return false;
    if (dateFilter === 'all') return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const matchDate = new Date(match.date || '1970-01-01');
    matchDate.setHours(0, 0, 0, 0);
    const days = dateFilter === 'today' ? 0 : dateFilter === 'week' ? 7 : 30;
    const earliest = new Date(today);
    earliest.setDate(earliest.getDate() - days);
    return matchDate >= earliest && matchDate <= today;
  });

  return {
    matches: filteredMatches,
    searchTerm,
    setSearchTerm,
    dateFilter,
    setDateFilter,
    isLoading,
    loadMatches,
    deleteMatch,
    editingMatch,
    openEdit: setEditingMatch,
    openCreate,
    closeEdit,
    saveEditedMatch,
  };
}
