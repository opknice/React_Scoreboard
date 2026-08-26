import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onValue, ref, remove, update, type Database } from 'firebase/database';
import type { FirebaseSaveTarget } from '../utils/excelParser';

export interface DatabaseMatch {
  id: string;
  date?: string;
  teamA?: string;
  teamB?: string;
  scoreA?: number | string;
  scoreB?: number | string;
  roundLabel?: string;
  url?: string;
}

interface UseScoreboardDatabaseOptions {
  activeDb: Database | null;
  targets: FirebaseSaveTarget[];
  selectedTargetId: string;
  notify: (message: string, type?: string) => void;
}

export function useScoreboardDatabase({
  activeDb,
  targets,
  selectedTargetId,
  notify,
}: UseScoreboardDatabaseOptions) {
  const [matches, setMatches] = useState<DatabaseMatch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [editingMatch, setEditingMatch] = useState<DatabaseMatch | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const selectedTarget = useMemo(
    () => targets.find((target) => target.id === selectedTargetId),
    [selectedTargetId, targets],
  );

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
  }, [activeDb, selectedTarget]);

  const loadMatches = useCallback(() => {
    if (!selectedTarget || !activeDb) {
      notifyRef.current('กรุณาเลือกลีกและตรวจสอบการเชื่อมต่อ Firebase', 'error');
      return;
    }

    unsubscribeRef.current?.();
    setIsLoading(true);

    try {
      unsubscribeRef.current = onValue(
        ref(activeDb, 'matches'),
        (snapshot) => {
          const value = snapshot.val();
          const nextMatches: DatabaseMatch[] = value
            ? Object.entries(value).map(([id, match]) => ({
              id,
              ...(match as Omit<DatabaseMatch, 'id'>),
            }))
            : [];

          nextMatches.sort((a, b) => (
            new Date(b.date || '1970-01-01').getTime()
            - new Date(a.date || '1970-01-01').getTime()
          ));
          setMatches(nextMatches);
          setIsLoading(false);
        },
        (error) => {
          setIsLoading(false);
          notifyRef.current(`Error: ${error.message}`, 'error');
        },
      );
    } catch (error: any) {
      setIsLoading(false);
      notifyRef.current(`Error: ${error?.message || error}`, 'error');
    }
  }, [activeDb, selectedTarget]);

  const deleteMatch = useCallback((match: DatabaseMatch) => {
    if (!selectedTarget || !activeDb) return;
    if (!window.confirm(`ต้องการลบแมตช์ ${match.teamA || ''} vs ${match.teamB || ''} ใช่หรือไม่?`)) return;

    remove(ref(activeDb, `matches/${match.id}`))
      .then(() => {
        notifyRef.current('ลบข้อมูลสำเร็จ', 'success');
        loadMatches();
      })
      .catch((error) => notifyRef.current(`ลบข้อมูลไม่สำเร็จ: ${error.message}`, 'error'));
  }, [activeDb, loadMatches, selectedTarget]);

  const saveEditedMatch = useCallback((match: DatabaseMatch) => {
    if (!selectedTarget || !activeDb) return;

    const updated = {
      date: match.date || '',
      teamA: match.teamA || '',
      scoreA: parseInt(String(match.scoreA ?? 0), 10) || 0,
      teamB: match.teamB || '',
      scoreB: parseInt(String(match.scoreB ?? 0), 10) || 0,
      roundLabel: match.roundLabel || '',
      url: match.url || '',
    };

    update(ref(activeDb, `matches/${match.id}`), updated)
      .then(() => {
        notifyRef.current('บันทึกข้อมูลสำเร็จ', 'success');
        setEditingMatch(null);
        loadMatches();
      })
      .catch((error) => notifyRef.current(`บันทึกไม่สำเร็จ: ${error.message}`, 'error'));
  }, [activeDb, loadMatches, selectedTarget]);

  const filteredMatches = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return matches.filter((match) => {
      const matchesSearch = [match.teamA, match.teamB, match.roundLabel]
        .some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
      if (!matchesSearch) return false;
      if (dateFilter === 'all') return true;

      const matchDate = new Date(match.date || '1970-01-01');
      matchDate.setHours(0, 0, 0, 0);
      const days = dateFilter === 'today' ? 0 : dateFilter === 'week' ? 7 : 30;
      const earliest = new Date(today);
      earliest.setDate(earliest.getDate() - days);
      return matchDate >= earliest && matchDate <= today;
    });
  }, [dateFilter, matches, searchTerm]);

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
    closeEdit: () => setEditingMatch(null),
    saveEditedMatch,
  };
}
