import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';

export default function AllScoresStandalone() {
  const [searchParams] = useSearchParams();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const leagueId = searchParams.get('league') || 'excel';
  const title = searchParams.get('title') || 'Match Results';
  const defaultLogo = searchParams.get('defaultLogo') || 'images/logo.png';
  const dateParam = searchParams.get('date');
  const showHeader = searchParams.get('header') !== '0';
  const logoParam = searchParams.get('logo') || '';
  const backgroundParam = searchParams.get('background') || '';

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

  useEffect(() => {
    if (!firebaseConfig) {
      setErrorMsg('ไม่พบ Firebase Config');
      setLoading(false);
      return;
    }

    try {
      const appName = `standalone-scores-${leagueId}-${Date.now()}`;
      const app = getApps().some(a => a.name === appName) ? getApp(appName) : initializeApp(firebaseConfig, appName);
      const db = getDatabase(app);
      const matchesRef = ref(db, 'matches');

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

      return () => unsubscribe();
    } catch (err: any) {
      setErrorMsg(`เกิดข้อผิดพลาด: ${err.message}`);
      setLoading(false);
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div className="overlay-status" style={{ minHeight: '100vh' }}>
        กำลังโหลดข้อมูลผลการแข่งขัน...
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

  const selectedDate = dateParam === 'today' ? new Date().toISOString().slice(0, 10) : dateParam && dateParam !== 'all' ? dateParam : '';
  const filtered = selectedDate ? matches.filter((m) => m.date === selectedDate) : matches;

  if (filtered.length === 0) {
    return (
      <div className="overlay-status" style={{ minHeight: '100vh' }}>
        ยังไม่มีข้อมูลการแข่งขัน
      </div>
    );
  }

  // Group by date & week
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

  const renderLogo = (teamName: string) => {
    // Auto-append .png if not present
    let logoFileName = teamName || '';
    if (logoFileName && !logoFileName.match(/\.(png|jpe?g|gif|webp|svg)$/i)) {
      logoFileName = `${logoFileName}.png`;
    }
    
    return (
      <img
        className="overlay-logo"
        src={`/logos/${encodeURIComponent(logoFileName)}`}
        alt=""
        onError={(e) => {
          (e.target as HTMLImageElement).src = defaultLogo;
        }}
      />
    );
  };

  const getResultClassColor = (score1: number, score2: number) => {
    if (score1 > score2) return 'overlay-win';
    if (score1 < score2) return 'overlay-lose';
    return 'overlay-draw';
  };

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

        <section className="overlay-results">
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
                        <div className={`overlay-team-side overlay-side-a ${getResultClassColor(scoreA, scoreB)}`}>
                          <span>{m.teamA}</span>
                          {renderLogo(m.teamA)}
                        </div>
                        <div className="overlay-score">
                          {scoreA} - {scoreB}
                        </div>
                        <div className={`overlay-team-side overlay-side-b ${getResultClassColor(scoreB, scoreA)}`}>
                          {renderLogo(m.teamB)}
                          <span>{m.teamB}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
        </section>
      </div>
    </div>
  );
}
