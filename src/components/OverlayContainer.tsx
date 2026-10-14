import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { findTeamLogoRecord, getLogoSrc } from '../utils/logoResolver';
import { useDisableZoom } from '../hooks/useDisableZoom';
import { filterDisplayableFinishedMatches } from '../utils/finishedMatch';
import { calculateFinishedStandings } from '../utils/standingsCalculator';
import type { OverlayMatch, OverlayTeam } from '../types/overlay';
import { parseCropMetadata } from '../types/teamLogo';
import OverlayLogo from './OverlayLogo';
import { limitOverlayItems, parseOverlayLimit, parseTickerDuration } from '../utils/overlayQuery';
import { useCropPreviewOverrides } from '../hooks/useLogoCropPreviewSync';
import { useLeagueLogoSizingForObs } from '../hooks/useLeagueLogoSizingForObs';
import { getEffectiveLogoScalePercent } from '../types/leagueLogoSizing';
import { getTodayDateString } from './league-management/leagueDateUtils';

const getErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : String(error)
);

export default function OverlayContainer() {
  useDisableZoom();
  const [searchParams] = useSearchParams();
  const [matches, setMatches] = useState<OverlayMatch[]>([]);
  const [registeredTeams, setRegisteredTeams] = useState<OverlayTeam[]>([]);
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
  const speed = searchParams.get('speed') || '75';
  const logoParam = searchParams.get('logo') || '';
  const backgroundParam = searchParams.get('background') || '';
  const resultLimit = parseOverlayLimit(limitParam);
  const syncSessionId = searchParams.get('sync') || 'default';
  const { resolveCrop } = useCropPreviewOverrides({ sessionId: syncSessionId, context: 'overlay' });
  const leagueLogoSizing = useLeagueLogoSizingForObs({ leagueId, sessionId: syncSessionId });

  const finishedMatches = useMemo(() => filterDisplayableFinishedMatches(matches), [matches]);
  const standingsRows = useMemo(
    () => calculateFinishedStandings(matches, registeredTeams),
    [matches, registeredTeams],
  );

  // Initialize and load data
  useEffect(() => {
    let isCancelled = false;
    let latestRequestId = 0;
    let refreshTimer: number | null = null;
    let supabaseChannel: RealtimeChannel | null = null;

    const scheduleRealtimeRefresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void loadFromSupabase();
      }, 150);
    };

    const loadFromSupabase = async () => {
      const requestId = ++latestRequestId;
      try {
        const { LeagueService } = await import('../services/leagueService');
        const { isSupabaseConfigured, supabase } = await import('../config/supabaseClient');
        if (!isSupabaseConfigured() || !supabase || !leagueId || leagueId === 'excel') {
          throw new Error('ไม่พบ League ID หรือการตั้งค่า Supabase');
        }

        const [supabaseMatches, supabaseTeams] = await Promise.all([
          LeagueService.getMatchesByLeague(leagueId),
          LeagueService.getTeamsByLeague(leagueId),
        ]);
        if (isCancelled || requestId !== latestRequestId) return;

        const formatted = supabaseMatches.map((m) => {
          const teamA = findTeamLogoRecord(supabaseTeams, m.team_a_id, m.team_a_name);
          const teamB = findTeamLogoRecord(supabaseTeams, m.team_b_id, m.team_b_name);
          const dateStr = m.match_date
            ? (m.match_date.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || '')
            : '';
          return {
            id: m.id,
            teamIdA: teamA?.id ?? m.team_a_id ?? null,
            teamIdB: teamB?.id ?? m.team_b_id ?? null,
            teamA: m.team_a_name,
            teamB: m.team_b_name,
            scoreA: m.score_a,
            scoreB: m.score_b,
            logoA: teamA?.logo_url || '',
            logoB: teamB?.logo_url || '',
            cropA: parseCropMetadata(teamA?.overlay_crop_metadata),
            cropB: parseCropMetadata(teamB?.overlay_crop_metadata),
            roundLabel: m.label1 || m.label2 || '',
            round: m.label1 || '',
            week: m.label2 || '',
            date: dateStr,
            status: m.status,
          };
        });
        setRegisteredTeams(supabaseTeams.map((team) => ({
          id: team.id,
          name: team.name,
          logo: team.logo_url || '',
          crop: parseCropMetadata(team.overlay_crop_metadata),
        })));
        setMatches(formatted);
        setErrorMsg('');
        setLoading(false);

        if (!supabaseChannel) {
          supabaseChannel = supabase
            .channel(`public:overlay_${leagueId}`)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'matches', filter: `league_id=eq.${leagueId}` },
              scheduleRealtimeRefresh,
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'teams', filter: `league_id=eq.${leagueId}` },
              scheduleRealtimeRefresh,
            )
            .subscribe();
        }
      } catch (error: unknown) {
        if (isCancelled || requestId !== latestRequestId) return;
        setErrorMsg(`โหลดข้อมูลจาก Supabase ไม่สำเร็จ: ${getErrorMessage(error)}`);
        setLoading(false);
      }
    };

    void loadFromSupabase();

    return () => {
      isCancelled = true;
      latestRequestId += 1;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      if (supabaseChannel) {
        void import('../config/supabaseClient').then(({ supabase }) => {
          if (supabase && supabaseChannel) void supabase.removeChannel(supabaseChannel);
        });
      }
    };
  }, [dateParam, leagueId, limitParam, view]);

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

  // Finished matches drive both the table and every result-based view.
  // Helper for rendering logos
  const renderLogo = (
    logoIdentifier: string | undefined,
    teamName: string,
    className = 'overlay-logo',
    crop?: OverlayMatch['cropA'],
    teamId?: string | null,
  ) => {
    const logoSrc = getLogoSrc(logoIdentifier, teamName);
    const resolvedCrop = resolveCrop(teamId, teamName, crop);
    const scalePercent = getEffectiveLogoScalePercent(resolvedCrop, leagueLogoSizing.overlayScalePercent);
    return <OverlayLogo key={`${logoSrc}-${teamName}`} src={logoSrc} fallbackSrc={defaultLogo} alt={teamName} className={className} crop={resolvedCrop} scalePercent={scalePercent} />;
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
              <tr key={row.teamId ?? `legacy:${row.team}:${index}`}>
                <td>{index + 1}</td>
                <td className="overlay-team-cell">
                  {renderLogo(row.logo, row.team, 'overlay-logo', row.crop, row.teamId)}
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
    const todayStr = getTodayDateString();
    const selectedDate = dateParam === 'today' ? todayStr : dateParam && dateParam !== 'all' ? dateParam : '';
    const filtered = selectedDate ? finishedMatches.filter((m) => m.date === selectedDate) : finishedMatches;
    const limited = limitOverlayItems(filtered, resultLimit);

    if (limited.length === 0) {
      return (
        <div className="overlay-status">
          {selectedDate ? `ยังไม่มีข้อมูลการแข่งขันสำหรับวันที่ ${selectedDate}` : 'ยังไม่มีข้อมูลการแข่งขัน'}
        </div>
      );
    }

    // Group by Date and Week
    const groups: Record<string, any[]> = {};
    limited.forEach((match) => {
      const date = match.date || '';
      let week = match.week || match.matchday || match.round || '1';

      if (!match.week && !match.matchday && !match.round && match.date) {
        const uniqueDates = [...new Set(finishedMatches.map((m) => m.date).filter(Boolean))].sort();
        const idx = uniqueDates.indexOf(match.date);
        week = idx >= 0 ? `${idx + 1}` : '1';
      }
      const weekNum = String(week).match(/\d+/)?.[0] || week;
      const key = `${date}|||${weekNum}`;

      groups[key] ||= [];
      groups[key].push(match);
    });

    const formatGroupTitle = (date: string, weekNum: string, sampleMatch?: any) => {
      const hasDate = date && date.trim() !== '';
      const roundLabel = sampleMatch?.round || '';
      const weekLabel = sampleMatch?.week || (weekNum ? `สัปดาห์ที่ ${weekNum}` : '');

      if (hasDate) {
        return `📅 วันที่ ${date}`;
      }

      if (roundLabel && weekLabel) return `🏆 ${roundLabel} • ${weekLabel}`;
      if (roundLabel) return `🏆 ${roundLabel} (WEEK #${weekNum})`;
      if (weekLabel) return `🏆 ${weekLabel}`;
      return `🏆 ตารางการแข่งขัน (WEEK #${weekNum || '1'})`;
    };

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
              const sampleMatch = groups[key][0];
              return (
                <div key={key} className="overlay-date-group">
                  <div className="overlay-date-title">
                    {formatGroupTitle(date, weekNum, sampleMatch)}
                  </div>
                  {groups[key].map((m) => {
                    const scoreA = Number(m.scoreA) || 0;
                    const scoreB = Number(m.scoreB) || 0;
                    return (
                      <div key={m.id} className="overlay-match-row">
                        <div className={`overlay-team-side overlay-side-a ${resultClass(scoreA, scoreB)}`}>
                          <span>{m.teamA}</span>
                          {renderLogo(m.logoA || '', m.teamA, 'overlay-logo', m.cropA, m.teamIdA)}
                        </div>
                        <div className="overlay-score">
                          {scoreA} - {scoreB}
                        </div>
                        <div className={`overlay-team-side overlay-side-b ${resultClass(scoreB, scoreA)}`}>
                          {renderLogo(m.logoB || '', m.teamB, 'overlay-logo', m.cropB, m.teamIdB)}
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
    const todayStr = getTodayDateString();
    const selectedDate = dateParam === 'today' ? todayStr : dateParam && dateParam !== 'all' ? dateParam : '';
    const filtered = selectedDate ? finishedMatches.filter((m) => m.date === selectedDate) : finishedMatches;
    const limited = limitOverlayItems(filtered, resultLimit);

    if (limited.length === 0) {
      return (
        <div className="overlay-status" style={{ padding: '8px 16px', fontSize: '0.9rem', color: '#94a3b8' }}>
          ยังไม่มีข้อมูลการแข่งขันสำหรับวันที่ {selectedDate || todayStr}
        </div>
      );
    }

    const duration = parseTickerDuration(speed);

    return (
      <div className="overlay-ticker-shell">
        <div
          className="overlay-ticker"
          style={{
            animation: `scroll-left-overlay ${duration}s linear infinite`,
            paddingLeft: '100%'
          } as any}
        >
          {limited.map((m) => (
            <React.Fragment key={m.id}>
              {renderLogo(m.logoA || '', m.teamA, 'overlay-logo-small', m.cropA, m.teamIdA)}
              <span>{m.teamA}</span>
              <span className="overlay-ticker-score">
                {m.scoreA} - {m.scoreB}
              </span>
              <span>{m.teamB}</span>
              {renderLogo(m.logoB || '', m.teamB, 'overlay-logo-small', m.cropB, m.teamIdB)}
              <span style={{ fontSize: '1.5rem', color: '#9ca3af' }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
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
    finishedMatches.forEach((match) => {
      let week = match.week || match.matchday || match.round;
      if (!week && match.date) {
        const uniqueDates = [...new Set(finishedMatches.map((m) => m.date).filter(Boolean))].sort();
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
                      <tr key={row.teamId ?? `legacy:${row.team}:${index}`}>
                        <td style={{ textAlign: 'center' }}>{index + 1}</td>
                        <td className="team-cell">
                          {renderLogo(row.logo, row.team, 'overlay-logo', row.crop, row.teamId)}
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
                          {renderLogo(match.logoA || '', match.teamA, 'overlay-logo', match.cropA, match.teamIdA)}
                        </div>
                        <div className="match-score">
                          {scoreA} - {scoreB}
                        </div>
                        <div className={`match-team right ${resultClass(scoreB, scoreA).replace('overlay-', '')}`}>
                          {renderLogo(match.logoB || '', match.teamB, 'overlay-logo', match.cropB, match.teamIdB)}
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
