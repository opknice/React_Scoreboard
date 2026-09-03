import { useState, useEffect, useMemo } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useSearchParams } from 'react-router-dom';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';
import { getLogoSrc, listenToFirebaseTeams } from '../utils/logoResolver';
import { parseFirebaseConfigFromSearchParams } from '../utils/firebaseUrlConfig';
import { useDisableZoom } from '../hooks/useDisableZoom';
import { calculateFinishedStandings } from '../utils/standingsCalculator';
import type { OverlayMatch, OverlayTeam } from '../types/overlay';

export default function LeagueTableStandalone() {
  useDisableZoom();
  const [searchParams] = useSearchParams();
  const [matches, setMatches] = useState<OverlayMatch[]>([]);
  const [registeredTeams, setRegisteredTeams] = useState<OverlayTeam[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const leagueId = searchParams.get('league') || 'excel';
  const title = searchParams.get('title') || 'League Table';
  const defaultLogo = searchParams.get('defaultLogo') || 'images/logo.png';
  const showHeader = searchParams.get('header') !== '0';
  const logoParam = searchParams.get('logo') || '';
  const backgroundParam = searchParams.get('background') || '';

  const firebaseConfig = useMemo(() => parseFirebaseConfigFromSearchParams(searchParams), [searchParams]);
  const standingsRows = useMemo(
    () => calculateFinishedStandings(matches, registeredTeams),
    [matches, registeredTeams],
  );

  useEffect(() => {
    let isCancelled = false;
    let supabaseChannel: RealtimeChannel | null = null;
    let firebaseCleanup: (() => void) | null = null;

    // 1. Try Supabase first if configured and leagueId looks like a Supabase ID / not 'excel'
    const loadFromSupabase = async () => {
      try {
        const { LeagueService } = await import('../services/leagueService');
        const { isSupabaseConfigured, supabase } = await import('../config/supabaseClient');
        if (isSupabaseConfigured() && leagueId && leagueId !== 'excel') {
          const [supabaseMatches, supabaseTeams] = await Promise.all([
            LeagueService.getMatchesByLeague(leagueId),
            LeagueService.getTeamsByLeague(leagueId),
          ]);
          if (isCancelled) return true;
          // Map to match structure expected by calculateStandings
          const formatted = supabaseMatches.map((m) => {
            const teamAObj = supabaseTeams.find((t) => t.id === m.team_a_id);
            const teamBObj = supabaseTeams.find((t) => t.id === m.team_b_id);
            return {
              id: m.id,
              teamA: m.team_a_name,
              teamB: m.team_b_name,
              scoreA: m.score_a,
              scoreB: m.score_b,
              status: m.status,
              logoA: teamAObj?.logo_url || '',
              logoB: teamBObj?.logo_url || '',
            };
          });
          setRegisteredTeams(supabaseTeams.map((team) => ({
            id: team.id,
            name: team.name,
            logo: team.logo_url || '',
          })));
          setMatches(formatted);
          setLoading(false);

          // Setup Realtime subscription for automatic updates on OBS
          if (!supabaseChannel && supabase) {
            supabaseChannel = supabase
              .channel(`public:league_table_${leagueId}`)
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'matches', filter: `league_id=eq.${leagueId}` },
                () => {
                  void loadFromSupabase();
                }
              )
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'teams', filter: `league_id=eq.${leagueId}` },
                () => {
                  void loadFromSupabase();
                }
              )
              .subscribe();
          }

          return true;
        }
      } catch (err: any) {
        console.warn('Supabase fetch failed in LeagueTableStandalone, trying Firebase fallback:', err);
      }
      return false;
    };

    loadFromSupabase().then((loaded) => {
      if (isCancelled) return;
      if (loaded) return;

      if (!firebaseConfig) {
        setErrorMsg('ไม่พบข้อมูลลีก หรือการตั้งค่า Database');
        setLoading(false);
        return;
      }

      try {
        const appName = `standalone-table-${leagueId}-${Date.now()}`;
        const app = getApps().some(a => a.name === appName) ? getApp(appName) : initializeApp(firebaseConfig, appName);
        const db = getDatabase(app);
        const matchesRef = ref(db, 'matches');

        const unsubTeams = listenToFirebaseTeams(db, (teamsMap) => {
          setRegisteredTeams(Object.entries(teamsMap).map(([id, team]) => ({
            id,
            name: team.name,
            logo: team.logo,
          })));
        });

        const unsubscribe = onValue(
          matchesRef,
          (snapshot) => {
            const items: OverlayMatch[] = [];
            snapshot.forEach((child) => {
              items.push({ id: child.key, ...child.val() });
            });
            setMatches(items);
            setLoading(false);
          },
          (err) => {
            setErrorMsg(`โหลดข้อมูลล้มเหลว: ${err.message}`);
            setLoading(false);
          }
        );

        firebaseCleanup = () => {
          unsubscribe();
          unsubTeams();
        };
      } catch (err: any) {
        setErrorMsg(`เกิดข้อผิดพลาด: ${err.message}`);
        setLoading(false);
      }
    });

    return () => {
      isCancelled = true;
      firebaseCleanup?.();
      if (supabaseChannel) {
        void import('../config/supabaseClient').then(({ supabase }) => {
          if (supabase && supabaseChannel) void supabase.removeChannel(supabaseChannel);
        });
      }
    };
  }, [firebaseConfig, leagueId, searchParams]);

  if (loading) {
    return (
      <div className="overlay-status" style={{ minHeight: '100vh' }}>
        กำลังโหลดตารางคะแนน...
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', color: '#ef4444', textAlign: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️ เกิดข้อผิดพลาด</h1>
          <p style={{ fontSize: '1.2rem', color: '#cbd5e1' }}>{errorMsg}</p>
        </div>
      </div>
    );
  }

  const renderLogo = (logoIdentifier: string | undefined, teamName: string) => {
    const logoSrc = getLogoSrc(logoIdentifier, teamName);
    
    return (
      <img
        key={`${logoSrc}-${teamName}`}
        className="overlay-logo"
        src={logoSrc}
        alt={teamName}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          if (defaultLogo && target.src !== defaultLogo) {
            target.src = defaultLogo;
          } else {
            target.style.display = 'none';
          }
        }}
      />
    );
  };

  if (standingsRows.length === 0) {
    return (
      <div className="overlay-status" style={{ minHeight: '100vh' }}>
        ยังไม่มีข้อมูลตารางคะแนน
      </div>
    );
  }

  const mainStyle: React.CSSProperties = backgroundParam ? {
    backgroundImage: `url("${backgroundParam}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    minHeight: '100vh',
    width: '100%'
  } : {
    minHeight: '100vh',
    width: '100%'
  };

  return (
    <div style={mainStyle}>
      <div className="overlay-app">
        {showHeader && (
          <header className="overlay-header">
            {logoParam && <img src={logoParam} alt="" />}
            <h1 className="overlay-title">{title}</h1>
          </header>
        )}

        <div style={{ width: 'min(1600px, 96vw)', margin: '0 auto', overflowX: 'auto' }}>
          <table className="overlay-table">
            <thead>
              <tr>
                <th>อันดับ</th>
                <th style={{ textAlign: 'left' }}>ทีม</th>
                <th>แข่ง</th>
                <th>ชนะ</th>
                <th>เสมอ</th>
                <th>แพ้</th>
                <th>ได้</th>
                <th>เสีย</th>
                <th>ผลต่าง</th>
                <th>คะแนน</th>
              </tr>
            </thead>
            <tbody>
              {standingsRows.map((row, index) => (
                <tr key={row.team}>
                  <td style={{ fontWeight: 400 }}>{index + 1}</td>
                  <td className="overlay-team-cell">
                  {renderLogo(row.logo, row.team)}
                  {row.team}
                </td>
                  <td>{row.P}</td>
                  <td>{row.W}</td>
                  <td>{row.D}</td>
                  <td>{row.L}</td>
                  <td>{row.GF}</td>
                  <td>{row.GA}</td>
                  <td className={row.GD > 0 ? 'overlay-win' : row.GD < 0 ? 'overlay-lose' : 'overlay-draw'}>
                    {row.GD > 0 ? `+${row.GD}` : row.GD}
                  </td>
                  <td style={{ fontWeight: 400, color: '#3b82f6' }}>
                    {row.Pts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
