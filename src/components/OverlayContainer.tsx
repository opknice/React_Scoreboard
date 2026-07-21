import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, query, orderByChild, equalTo, limitToLast } from 'firebase/database';

export default function OverlayContainer() {
  const [searchParams] = useSearchParams();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Extract search params
  const view = searchParams.get('view') || searchParams.get('type') || 'table';
  const leagueId = searchParams.get('league') || 'excel';
  const title = searchParams.get('title') || 'Excel League';
  const dateParam = searchParams.get('date');
  const limitParam = searchParams.get('limit');
  const showHeader = searchParams.get('header') !== '0';
  const defaultLogo = searchParams.get('defaultLogo') || 'images/logo.png';
  const speed = searchParams.get('speed') || '42';
  const logoParam = searchParams.get('logo') || '';
  const backgroundParam = searchParams.get('background') || '';

  // Decode Firebase configuration
  const decodeUrlSafeBase64 = (val: string) => {
    try {
      const normalized = val.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
      return atob(padded);
    } catch (e) {
      return '';
    }
  };

  const getFirebaseConfig = () => {
    const encoded = searchParams.get('fb') || searchParams.get('firebaseConfig');
    if (!encoded) return null;
    try {
      return JSON.parse(decodeUrlSafeBase64(encoded));
    } catch (e) {
      try {
        return JSON.parse(decodeURIComponent(encoded));
      } catch (err) {
        return null;
      }
    }
  };

  const firebaseConfig = getFirebaseConfig();

  // Initialize and load data
  useEffect(() => {
    if (!firebaseConfig) {
      setErrorMsg('ไม่พบ Firebase Config (กรุณาใช้ URL ที่สร้างจาก Control Panel)');
      setLoading(false);
      return;
    }

    try {
      const appName = `overlay-${leagueId.replace(/[^A-Za-z0-9_-]/g, '_')}-${Date.now()}`;
      const app = getApps().some(a => a.name === appName) ? getApp(appName) : initializeApp(firebaseConfig, appName);
      const db = getDatabase(app);
      const baseRef = ref(db, 'matches');

      // Build Query
      const selectedDate = dateParam === 'today' ? new Date().toISOString().slice(0, 10) : dateParam && dateParam !== 'all' ? dateParam : '';
      let q: any = baseRef;

      if (view === 'ticker' && selectedDate) {
        q = query(baseRef, orderByChild('date'), equalTo(selectedDate));
      } else if (view === 'results' && limitParam) {
        const limitVal = parseInt(limitParam, 10);
        if (Number.isFinite(limitVal) && limitVal > 0) {
          q = query(baseRef, limitToLast(limitVal));
        }
      }

      const unsubscribe = onValue(
        q,
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

      return () => unsubscribe();
    } catch (err: any) {
      setErrorMsg(`เกิดข้อผิดพลาดในการโหลด: ${err.message}`);
      setLoading(false);
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontSize: '1.5rem', color: '#9ca3af' }}>
        กำลังโหลดข้อมูล...
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

  // --- Calculations for Standings Table ---
  const calculateStandings = () => {
    const stats: Record<string, any> = {};
    matches.forEach((match) => {
      const teamA = (match.teamA || '').trim();
      const teamB = (match.teamB || '').trim();
      if (!teamA || !teamB) return;

      const scoreA = Number(match.scoreA);
      const scoreB = Number(match.scoreB);
      if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return;

      stats[teamA] ||= { team: teamA, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
      stats[teamB] ||= { team: teamB, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };

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

  // Helper for rendering logos
  const renderLogo = (teamName: string, className = 'overlay-logo') => {
    // Auto-append .png if not present
    let logoFileName = teamName || '';
    if (logoFileName && !logoFileName.match(/\.(png|jpe?g|gif|webp|svg)$/i)) {
      logoFileName = `${logoFileName}.png`;
    }
    
    return (
      <img
        className={className}
        src={`/logos/${encodeURIComponent(logoFileName)}`}
        alt=""
        onError={(e) => {
          (e.target as HTMLImageElement).src = defaultLogo;
        }}
      />
    );
  };

  const resultClass = (self: number, opponent: number) => {
    if (self > opponent) return 'overlay-win';
    if (self < opponent) return 'overlay-lose';
    return 'overlay-draw';
  };

  // --- RENDER VIEWS ---

  // 1. League Table View
  const renderTableView = () => {
    if (standingsRows.length === 0) {
      return <div className="overlay-status">ยังไม่มีข้อมูลการแข่งขัน</div>;
    }

    return (
      <div className="overlay-app">
        {showHeader && (
          <header className="overlay-header">
            {logoParam && <img src={logoParam} alt="" />}
            <h1 className="overlay-title">{title}</h1>
          </header>
        )}
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
              <th>ได้-เสีย</th>
              <th>คะแนน</th>
            </tr>
          </thead>
          <tbody>
            {standingsRows.map((row, index) => (
              <tr key={row.team}>
                <td>{index + 1}</td>
                <td className="overlay-team-cell">
                  {renderLogo(row.team, 'overlay-logo')}
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
                <td style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>{row.Pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // 2. Results List View
  const renderResultsView = () => {
    const selectedDate = dateParam === 'today' ? new Date().toISOString().slice(0, 10) : dateParam && dateParam !== 'all' ? dateParam : '';
    const filtered = selectedDate ? matches.filter((m) => m.date === selectedDate) : matches;

    if (filtered.length === 0) {
      return <div className="overlay-status">ยังไม่มีข้อมูลการแข่งขัน</div>;
    }

    // Group by Date and Week
    const groups: Record<string, any[]> = {};
    filtered.forEach((match) => {
      const date = match.date || 'ไม่ระบุวันที่';
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

    return (
      <div className="overlay-app">
        {showHeader && (
          <header className="overlay-header" style={{ marginBottom: '32px' }}>
            {logoParam && <img src={logoParam} alt="" />}
            <h1 className="overlay-title">{title}</h1>
          </header>
        )}
        <div className="overlay-results">
          {Object.keys(groups)
            .sort((a, b) => {
              const weekA = parseInt(a.split('|||')[1]) || 0;
              const weekB = parseInt(b.split('|||')[1]) || 0;
              if (weekA !== weekB) return weekA - weekB;
              return a.split('|||')[0].localeCompare(b.split('|||')[0]);
            })
            .map((key) => {
              const [date, weekNum] = key.split('|||');
              return (
                <div key={key} className="overlay-date-group">
                  <div className="overlay-date-title">
                    วันที่ {date} (WEEK #{weekNum})
                  </div>
                  {groups[key].map((m) => {
                    const scoreA = Number(m.scoreA) || 0;
                    const scoreB = Number(m.scoreB) || 0;
                    return (
                      <div key={m.id} className="overlay-match-row">
                        <div className={`overlay-team-side overlay-side-a ${resultClass(scoreA, scoreB)}`}>
                          <span>{m.teamA}</span>
                          {renderLogo(m.teamA, 'overlay-logo')}
                        </div>
                        <div className="overlay-score">
                          {scoreA} - {scoreB}
                        </div>
                        <div className={`overlay-team-side overlay-side-b ${resultClass(scoreB, scoreA)}`}>
                          {renderLogo(m.teamB, 'overlay-logo')}
                          <span>{m.teamB}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
        </div>
      </div>
    );
  };

  // 3. Ticker View (Bottom scrolling list)
  const renderTickerView = () => {
    const selectedDate = dateParam === 'today' ? new Date().toISOString().slice(0, 10) : dateParam && dateParam !== 'all' ? dateParam : '';
    const filtered = selectedDate ? matches.filter((m) => m.date === selectedDate) : matches;

    if (filtered.length === 0) {
      return <div className="overlay-status">ยังไม่มีคะแนนสำหรับวันนี้</div>;
    }

    const duration = parseInt(speed, 10) || 42;

    return (
      <div className="overlay-ticker-shell">
        <div
          className="overlay-ticker"
          style={{
            animation: `scroll-left-overlay ${duration}s linear infinite`,
            paddingLeft: '100%'
          } as any}
        >
          {filtered.map((m) => (
            <React.Fragment key={m.id}>
              {renderLogo(m.teamA, 'overlay-logo-small')}
              <span>{m.teamA}</span>
              <span className="overlay-ticker-score">
                {m.scoreA} - {m.scoreB}
              </span>
              <span>{m.teamB}</span>
              {renderLogo(m.teamB, 'overlay-logo-small')}
              <span style={{ fontSize: '1.5rem', color: '#9ca3af' }}>&nbsp;&nbsp;&nbsp;&nbsp;&bull;&nbsp;&nbsp;&nbsp;&nbsp;</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  // 4. Stadium View (Standings ranking + Week match list)
  const renderStadiumView = () => {
    // Standings calculation
    const rows = standingsRows;

    // Group matches by week
    const groupByWeek: Record<string, any[]> = {};
    matches.forEach((match) => {
      let week = match.week || match.matchday || match.round;
      if (!week && match.date) {
        const uniqueDates = [...new Set(matches.map((m) => m.date).filter(Boolean))].sort();
        const idx = uniqueDates.indexOf(match.date);
        week = idx >= 0 ? `สัปดาห์ ${idx + 1}` : 'สัปดาห์ 1';
      } else if (!week) {
        week = 'สัปดาห์ 1';
      }
      groupByWeek[week] ||= [];
      groupByWeek[week].push(match);
    });

    const sortedWeeks = Object.keys(groupByWeek).sort((a, b) => {
      const numA = parseInt(String(a).match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(String(b).match(/\d+/)?.[0] || '0', 10);
      return numB - numA; // Latest week first
    });

    const weekParam = searchParams.get('week');
    let filteredMatches: any[] = [];
    let displayWeek = '';

    if (weekParam && groupByWeek[weekParam]) {
      filteredMatches = groupByWeek[weekParam];
      displayWeek = weekParam;
    } else if (sortedWeeks.length > 0) {
      displayWeek = sortedWeeks[0];
      filteredMatches = groupByWeek[displayWeek];
    }

    const containerStyle: React.CSSProperties = {
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
    };

    const bgStyle: React.CSSProperties = backgroundParam ? {
      position: 'absolute',
      inset: 0,
      backgroundImage: `url("${backgroundParam}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    } : {
      position: 'absolute',
      inset: 0,
      background: '#0e1117',
    };

    return (
      <div style={containerStyle}>
        <div style={bgStyle} />
        <div className="stadium-bg-blur" />
        <div className="stadium-content">
          <header className="stadium-league-title">
            <h1 style={{ textShadow: '0 4px 20px rgba(0,0,0,0.9)' }}>{title}</h1>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start', width: 'min(1500px, 94vw)', margin: '0 auto' }}>
            {/* Standings table */}
            {rows.length > 0 && (
              <div className="stadium-table">
                <table style={{ width: '100%' }}>
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
                    {rows.slice(0, 6).map((row, index) => (
                      <tr key={row.team}>
                        <td style={{ textAlign: 'center' }}>{index + 1}</td>
                        <td className="team-cell">
                          {renderLogo(row.team, 'logo')}
                          <span>{row.team}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>{row.P}</td>
                        <td style={{ textAlign: 'center' }}>{row.W}</td>
                        <td style={{ textAlign: 'center' }}>{row.D}</td>
                        <td style={{ textAlign: 'center' }}>{row.L}</td>
                        <td style={{ textAlign: 'center' }}>{row.GF}</td>
                        <td style={{ textAlign: 'center' }}>{row.GA}</td>
                        <td style={{ textAlign: 'center', color: row.GD > 0 ? '#10b981' : row.GD < 0 ? '#ef4444' : '#cbd5e1' }}>
                          {row.GD > 0 ? `+${row.GD}` : row.GD}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{row.Pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Matches list */}
            {filteredMatches.length > 0 && (
              <div className="matches-card">
                <div className="matches-header">
                  <h2 className="matches-date">{displayWeek}</h2>
                </div>
                <div className="matches-list">
                  {filteredMatches.slice(0, 3).map((match) => {
                    const scoreA = Number(match.scoreA) || 0;
                    const scoreB = Number(match.scoreB) || 0;
                    return (
                      <div key={match.id} className="match-card">
                        <div className={`match-team left ${resultClass(scoreA, scoreB).replace('overlay-', '')}`}>
                          <span>{match.teamA}</span>
                          {renderLogo(match.teamA, 'logo')}
                        </div>
                        <div className="match-score">
                          {scoreA} - {scoreB}
                        </div>
                        <div className={`match-team right ${resultClass(scoreB, scoreA).replace('overlay-', '')}`}>
                          {renderLogo(match.teamB, 'logo')}
                          <span>{match.teamB}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const mainStyle: React.CSSProperties = backgroundParam && view !== 'ticker' && view !== 'stadium' ? {
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
      {view === 'stadium' && renderStadiumView()}
      {(view === 'results' || view === 'allscore') && renderResultsView()}
      {(view === 'ticker' || view === 'live') && renderTickerView()}
      {view !== 'stadium' && view !== 'results' && view !== 'allscore' && view !== 'ticker' && view !== 'live' && renderTableView()}
    </div>
  );
}
