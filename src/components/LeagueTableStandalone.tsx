import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';
import { getLogoSrc, extractMatchLogo, listenToFirebaseTeams } from '../utils/logoResolver';
import { parseFirebaseConfigFromSearchParams } from '../utils/firebaseUrlConfig';
import { useDisableZoom } from '../hooks/useDisableZoom';

export default function LeagueTableStandalone() {
  useDisableZoom();
  const [searchParams] = useSearchParams();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const leagueId = searchParams.get('league') || 'excel';
  const title = searchParams.get('title') || 'League Table';
  const defaultLogo = searchParams.get('defaultLogo') || 'images/logo.png';
  const showHeader = searchParams.get('header') !== '0';
  const logoParam = searchParams.get('logo') || '';
  const backgroundParam = searchParams.get('background') || '';

  const firebaseConfig = useMemo(() => parseFirebaseConfigFromSearchParams(searchParams), [searchParams]);

  useEffect(() => {
    if (!firebaseConfig) {
      setErrorMsg('ไม่พบ Firebase Config');
      setLoading(false);
      return;
    }

    try {
      const appName = `standalone-table-${leagueId}-${Date.now()}`;
      const app = getApps().some(a => a.name === appName) ? getApp(appName) : initializeApp(firebaseConfig, appName);
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

  // Standings ranking calculation
  const calculateStandings = () => {
    const stats: Record<string, any> = {};
    matches.forEach((match) => {
      const teamA = (match.teamA || '').trim();
      const teamB = (match.teamB || '').trim();
      if (!teamA || !teamB) return;

      const scoreA = Number(match.scoreA);
      const scoreB = Number(match.scoreB);
      if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return;

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
