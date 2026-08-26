import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getLogoSrc, extractMatchLogo, replaceGlobalTeamsCacheFromSupabase } from '../utils/logoResolver';
import { useDisableZoom } from '../hooks/useDisableZoom';
import { readSupabaseOverlaySnapshot, readSupabasePublicOverlaySnapshot } from '../services/supabaseLeagueService';

export default function AllScoresStandalone() {
  useDisableZoom();
  const [searchParams] = useSearchParams();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const leagueId = searchParams.get('league') || '';
  const title = searchParams.get('title') || 'Match Results';
  const defaultLogo = searchParams.get('defaultLogo') || 'images/logo.png';
  const dateParam = searchParams.get('date');
  const showHeader = searchParams.get('header') !== '0';
  const logoParam = searchParams.get('logo') || '';
  const backgroundParam = searchParams.get('background') || '';

  useEffect(() => {
    const isPublicOverlay = searchParams.get('public') === '1';
    const accessToken = searchParams.get('token');
    if ((!accessToken && !isPublicOverlay) || (isPublicOverlay && !leagueId)) {
      setErrorMsg(isPublicOverlay ? 'ไม่พบ league id สำหรับ Public Overlay' : 'ไม่พบ Supabase Overlay token');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const loadSnapshot = async () => {
      try {
        const snapshot = isPublicOverlay
          ? await readSupabasePublicOverlaySnapshot(leagueId)
          : await readSupabaseOverlaySnapshot(accessToken || '');
        if (cancelled) return;
        setMatches(snapshot.matches);
        replaceGlobalTeamsCacheFromSupabase(snapshot.teams);
        setLoading(false);
        setErrorMsg('');
      } catch (error: unknown) {
        if (cancelled) return;
        setErrorMsg(`โหลด Supabase Overlay ล้มเหลว: ${error instanceof Error ? error.message : 'Token ไม่ถูกต้องหรือหมดอายุ'}`);
        setLoading(false);
      }
    };
    void loadSnapshot();
    const refreshTimer = window.setInterval(() => void loadSnapshot(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [leagueId, searchParams]);

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
                          {renderLogo(extractMatchLogo(m, 'A'), m.teamA)}
                        </div>
                        <div className="overlay-score">
                          {scoreA} - {scoreB}
                        </div>
                        <div className={`overlay-team-side overlay-side-b ${getResultClassColor(scoreB, scoreA)}`}>
                          {renderLogo(extractMatchLogo(m, 'B'), m.teamB)}
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
