import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';
import { getLogoSrc, extractMatchLogo, listenToFirebaseTeams } from '../utils/logoResolver';
import { parseFirebaseConfigFromSearchParams } from '../utils/firebaseUrlConfig';
import { useDisableZoom } from '../hooks/useDisableZoom';

export default function AllScoreCombinedStandalone() {
  useDisableZoom();
  const [searchParams] = useSearchParams();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const leagueId = searchParams.get('league') || 'excel';
  const title = searchParams.get('title') || 'League Scoreboard & Standings';
  const defaultLogo = searchParams.get('defaultLogo') || 'images/logo.png';
  const dateParam = searchParams.get('date');
  const showHeader = searchParams.get('header') !== '0';
  const logoParam = searchParams.get('logo') || '';
  const backgroundParam = searchParams.get('background') || '';

  const firebaseConfig = useMemo(() => parseFirebaseConfigFromSearchParams(searchParams), [searchParams]);

  useEffect(() => {
    let supabaseChannel: any = null;

    const loadFromSupabase = async () => {
      try {
        const { LeagueService } = await import('../services/leagueService');
        const { isSupabaseConfigured, supabase } = await import('../config/supabaseClient');
        if (isSupabaseConfigured() && leagueId && leagueId !== 'excel') {
          const [supabaseMatches, supabaseTeams] = await Promise.all([
            LeagueService.getMatchesByLeague(leagueId),
            LeagueService.getTeamsByLeague(leagueId),
          ]);
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
              round: m.label1 || '',
              week: m.label2 || '',
              date: m.match_date ? new Date(m.match_date).toISOString().slice(0, 10) : '',
            };
          });
          setMatches(formatted);
          setLoading(false);

          // Setup Realtime subscription for automatic updates on OBS
          if (!supabaseChannel && supabase) {
            supabaseChannel = supabase
              .channel(`public:combined_table_${leagueId}`)
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
        console.warn('Supabase fetch failed in AllScoreCombinedStandalone, falling back to Firebase:', err);
      }
      return false;
    };

    loadFromSupabase().then((loaded) => {
      if (loaded) return;

      if (!firebaseConfig) {
        setErrorMsg('ไม่พบข้อมูลลีก หรือการตั้งค่า Database');
        setLoading(false);
        return;
      }

      try {
        const appName = `standalone-combined-${leagueId}-${Date.now()}`;
        const app = getApps().some((a) => a.name === appName) ? getApp(appName) : initializeApp(firebaseConfig, appName);
        const db = getDatabase(app);
        const matchesRef = ref(db, 'matches');

        const unsubTeams = listenToFirebaseTeams(db);

        const unsubscribe = onValue(
          matchesRef,
          (snapshot) => {
            const items: any[] = [];
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

        return () => {
          unsubscribe();
          unsubTeams();
        };
      } catch (err: any) {
        setErrorMsg(`เกิดข้อผิดพลาด: ${err.message}`);
        setLoading(false);
      }
    });

    return () => {
      if (supabaseChannel) {
        import('../config/supabaseClient').then(({ supabase }) => {
          if (supabase && supabaseChannel) {
            void supabase.removeChannel(supabaseChannel);
          }
        });
      }
    };
  }, [firebaseConfig, leagueId, searchParams]);

  if (loading) {
    return (
      <div className="combined-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '1.2rem', color: '#94a3b8' }}>กำลังโหลดข้อมูลการแข่งขันและตารางคะแนน...</div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="combined-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', color: '#ef4444', marginBottom: '1rem' }}>⚠️ เกิดข้อผิดพลาด</h1>
          <p style={{ fontSize: '1.1rem', color: '#cbd5e1' }}>{errorMsg}</p>
        </div>
      </div>
    );
  }

  // --- 1. Standings ranking calculation ---
  const calculateStandings = () => {
    const stats: Record<string, any> = {};
    matches.forEach((match) => {
      const teamA = (match.teamA || '').trim();
      const teamB = (match.teamB || '').trim();
      if (!teamA || !teamB) return;

      const scoreA = Number(match.scoreA);
      const scoreB = Number(match.scoreB);
      if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return;

      // Skip scheduled matches that have not been played yet (0-0)
      if (match.status === 'scheduled' && scoreA === 0 && scoreB === 0) {
        return;
      }

      const logoA = extractMatchLogo(match, 'A');
      const logoB = extractMatchLogo(match, 'B');
      stats[teamA] ||= { team: teamA, logo: logoA, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
      stats[teamB] ||= { team: teamB, logo: logoB, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
      if (!stats[teamA].logo && logoA) stats[teamA].logo = logoA;
      if (!stats[teamB].logo && logoB) stats[teamB].logo = logoB;

      const a = stats[teamA];
      const b = stats[teamB];

      a.P++;
      b.P++;
      a.GF += scoreA;
      a.GA += scoreB;
      b.GF += scoreB;
      b.GA += scoreA;

      if (scoreA > scoreB) {
        a.W++;
        a.Pts += 3;
        b.L++;
      } else if (scoreA < scoreB) {
        b.W++;
        b.Pts += 3;
        a.L++;
      } else {
        a.D++;
        b.D++;
        a.Pts++;
        b.Pts++;
      }
    });

    const rows = Object.values(stats)
      .map((row) => ({ ...row, GD: row.GF - row.GA }))
      .sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || a.team.localeCompare(b.team, 'th'));

    return rows;
  };

  const standingsRows = calculateStandings();

  // --- 2. Group matches by Date & Week ---
  const selectedDate = dateParam === 'today' ? new Date().toISOString().slice(0, 10) : dateParam && dateParam !== 'all' ? dateParam : '';
  const filteredMatches = selectedDate ? matches.filter((m) => m.date === selectedDate) : matches;

  const groups: Record<string, any[]> = {};
  filteredMatches.forEach((match) => {
    const date = match.date || '';
    let week = match.week || match.matchday || match.round || '1';

    if (!match.week && !match.matchday && !match.round && match.date) {
      const uniqueDates = [...new Set(matches.map((m) => m.date).filter(Boolean))].sort();
      const idx = uniqueDates.indexOf(match.date);
      week = idx >= 0 ? `${idx + 1}` : '1';
    }

    const weekNum = String(week).match(/\d+/)?.[0] || week;
    const key = `${date}|||${weekNum}`;

    groups[key] ||= [];
    groups[key].push(match);
  });

  const formatGroupTitle = (date: string, weekNum: string, sampleMatch?: any) => {
    const hasDate = date && date !== 'ไม่ระบุวันที่' && date.trim() !== '';
    const roundLabel = sampleMatch?.round || '';
    const weekLabel = sampleMatch?.week || (weekNum ? `สัปดาห์ที่ ${weekNum}` : '');

    if (hasDate) {
      const subInfo = [roundLabel, weekLabel].filter(Boolean).join(' • ');
      return `📅 วันที่ ${date} ${subInfo ? `(${subInfo})` : `(WEEK #${weekNum})`}`;
    }

    if (roundLabel && weekLabel) {
      return `🏆 ${roundLabel} • ${weekLabel}`;
    }

    if (roundLabel) {
      return `🏆 ${roundLabel} (WEEK #${weekNum})`;
    }

    if (weekLabel) {
      return `🏆 ${weekLabel}`;
    }

    return `🏆 ตารางการแข่งขัน (WEEK #${weekNum || '1'})`;
  };

  const renderLogo = (logoIdentifier: string | undefined, teamName: string) => {
    const logoSrc = getLogoSrc(logoIdentifier, teamName);

    return (
      <img
        key={`${logoSrc}-${teamName}`}
        className="combined-logo"
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

  const getResultClassColor = (score1: number, score2: number) => {
    if (score1 > score2) return 'overlay-win';
    if (score1 < score2) return 'overlay-lose';
    return 'overlay-draw';
  };

  const pageStyle: React.CSSProperties = backgroundParam
    ? {
      backgroundImage: `url("${backgroundParam}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }
    : {};

  return (
    <div className="combined-page" style={pageStyle}>
      <div className="combined-container">
        {showHeader && (
          <header className="combined-header">
            {logoParam && <img src={logoParam} alt="" style={{ height: '48px', objectFit: 'contain', marginBottom: '8px' }} />}
            <h1>{title}</h1>
          </header>
        )}

        {/* Section 1: League Standings Table */}
        <section style={{ marginBottom: '36px' }}>


          {standingsRows.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>ยังไม่มีข้อมูลตารางคะแนน</div>
          ) : (
            <div className="combined-table-wrapper">
              <table className="combined-table">
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
                      <td>{index + 1}</td>
                      <td className="combined-team-cell">
                        {renderLogo(row.logo, row.team)}
                        {/* Tooltip for truncated team names on mobile */}
                        <span title={row.team}>{row.team}</span>
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
                      <td style={{ fontWeight: 700, color: '#38bdf8' }}>{row.Pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Section 2: Live Scoreboard by Week */}
        <section>
          <h2 className="combined-section-title">ผลการแข่งขันทั้งหมด</h2>

          {Object.keys(groups).length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>ยังไม่มีข้อมูลการแข่งขัน</div>
          ) : (
            <div className="combined-results">
              {Object.keys(groups)
                .sort((a, b) => {
                  const weekA = parseInt(a.split('|||')[1]) || 0;
                  const weekB = parseInt(b.split('|||')[1]) || 0;
                  if (weekA !== weekB) return weekA - weekB;
                  return a.split('|||')[0].localeCompare(b.split('|||')[0]);
                })
                .map((key) => {
                  const [date, weekNum] = key.split('|||');
                  const sampleMatch = groups[key][0];
                  return (
                    <div key={key} className="combined-date-group">
                      <div className="combined-date-title">
                        {formatGroupTitle(date, weekNum, sampleMatch)}
                      </div>

                      {groups[key].map((m) => {
                        const scoreA = Number(m.scoreA) || 0;
                        const scoreB = Number(m.scoreB) || 0;
                        return (
                          <div key={m.id} className="combined-match-row">
                            <div className={`combined-team-side combined-side-a ${getResultClassColor(scoreA, scoreB)}`}>
                              <span>{m.teamA}</span>
                              {renderLogo(extractMatchLogo(m, 'A'), m.teamA)}
                            </div>
                            <div className="combined-score">
                              {scoreA} - {scoreB}
                            </div>
                            <div className={`combined-team-side combined-side-b ${getResultClassColor(scoreB, scoreA)}`}>
                              {renderLogo(extractMatchLogo(m, 'B'), m.teamB)}
                              <span>{m.teamB}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
