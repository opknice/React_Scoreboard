import { useState, useEffect, useMemo } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useSearchParams } from 'react-router-dom';
import { findTeamLogoRecord, getLogoSrc } from '../utils/logoResolver';
import { useDisableZoom } from '../hooks/useDisableZoom';
import { filterFinishedMatches } from '../utils/finishedMatch';
import { calculateFinishedStandings } from '../utils/standingsCalculator';
import type { OverlayMatch, OverlayTeam } from '../types/overlay';
import { parseCropMetadata } from '../types/teamLogo';
import OverlayLogo from './OverlayLogo';
import { useCropPreviewOverrides } from '../hooks/useLogoCropPreviewSync';
import { useLeagueLogoSizingForObs } from '../hooks/useLeagueLogoSizingForObs';
import { getEffectiveLogoScalePercent } from '../types/leagueLogoSizing';

export default function AllScoreCombinedStandalone() {
  useDisableZoom();
  const [searchParams] = useSearchParams();
  const [matches, setMatches] = useState<OverlayMatch[]>([]);
  const [registeredTeams, setRegisteredTeams] = useState<OverlayTeam[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const leagueId = searchParams.get('league') || 'excel';
  const title = searchParams.get('title') || 'League Scoreboard & Standings';
  const defaultLogo = searchParams.get('defaultLogo') || 'images/logo.png';
  const dateParam = searchParams.get('date');
  const showHeader = searchParams.get('header') !== '0';
  const logoParam = searchParams.get('logo') || '';
  const backgroundParam = searchParams.get('background') || '';
  const syncSessionId = searchParams.get('sync') || 'default';
  const { resolveCrop } = useCropPreviewOverrides({ sessionId: syncSessionId, context: 'overlay' });
  const leagueLogoSizing = useLeagueLogoSizingForObs({ leagueId, sessionId: syncSessionId });

  const finishedMatches = useMemo(() => filterFinishedMatches(matches), [matches]);
  const standingsRows = useMemo(
    () => calculateFinishedStandings(matches, registeredTeams),
    [matches, registeredTeams],
  );

  useEffect(() => {
    let isCancelled = false;
    let supabaseChannel: RealtimeChannel | null = null;

    const loadFromSupabase = async () => {
      try {
        const { LeagueService } = await import('../services/leagueService');
        const { isSupabaseConfigured, supabase } = await import('../config/supabaseClient');
        if (!isSupabaseConfigured() || !leagueId || leagueId === 'excel') {
          throw new Error('ไม่พบ League ID หรือการตั้งค่า Supabase');
        }

        const [supabaseMatches, supabaseTeams] = await Promise.all([
          LeagueService.getMatchesByLeague(leagueId),
          LeagueService.getTeamsByLeague(leagueId),
        ]);
        if (isCancelled) return;
        const formatted = supabaseMatches.map((m) => {
          const teamA = findTeamLogoRecord(supabaseTeams, m.team_a_id, m.team_a_name);
          const teamB = findTeamLogoRecord(supabaseTeams, m.team_b_id, m.team_b_name);
          return {
            id: m.id,
            teamIdA: teamA?.id ?? m.team_a_id ?? null,
            teamIdB: teamB?.id ?? m.team_b_id ?? null,
            teamA: m.team_a_name,
            teamB: m.team_b_name,
            scoreA: m.score_a,
            scoreB: m.score_b,
            status: m.status,
            logoA: teamA?.logo_url || '',
            logoB: teamB?.logo_url || '',
            cropA: parseCropMetadata(teamA?.overlay_crop_metadata),
            cropB: parseCropMetadata(teamB?.overlay_crop_metadata),
            round: m.label1 || '',
            week: m.label2 || '',
            date: m.match_date ? (m.match_date.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || '') : '',
          };
        });
        setRegisteredTeams(supabaseTeams.map((team) => ({
          id: team.id,
          name: team.name,
          logo: team.logo_url || '',
          crop: parseCropMetadata(team.overlay_crop_metadata),
        })));
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
      } catch (err: unknown) {
        if (isCancelled) return;
        setErrorMsg(`โหลดข้อมูลจาก Supabase ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
    };

    void loadFromSupabase();

    return () => {
      isCancelled = true;
      if (supabaseChannel) {
        void import('../config/supabaseClient').then(({ supabase }) => {
          if (supabase && supabaseChannel) void supabase.removeChannel(supabaseChannel);
        });
      }
    };
  }, [leagueId]);

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

  // --- 2. Group matches by Date & Week ---
  const selectedDate = dateParam === 'today' ? new Date().toISOString().slice(0, 10) : dateParam && dateParam !== 'all' ? dateParam : '';
  const filteredMatches = selectedDate ? finishedMatches.filter((m) => m.date === selectedDate) : finishedMatches;

  const groups: Record<string, any[]> = {};
  filteredMatches.forEach((match) => {
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
    const hasDate = date && date !== 'ไม่ระบุวันที่' && date.trim() !== '';
    const roundLabel = sampleMatch?.round || '';
    const weekLabel = sampleMatch?.week || (weekNum ? `สัปดาห์ที่ ${weekNum}` : '');

    if (hasDate) {
      return `📅 วันที่ ${date}`;
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

  const renderLogo = (
    logoIdentifier: string | undefined,
    teamName: string,
    crop?: OverlayMatch['cropA'],
    teamId?: string | null,
  ) => {
    const logoSrc = getLogoSrc(logoIdentifier, teamName);
    const resolvedCrop = resolveCrop(teamId, teamName, crop);
    const scalePercent = getEffectiveLogoScalePercent(resolvedCrop, leagueLogoSizing.overlayScalePercent);
    return <OverlayLogo key={`${logoSrc}-${teamName}`} src={logoSrc} fallbackSrc={defaultLogo} alt={teamName} className="combined-logo" crop={resolvedCrop} scalePercent={scalePercent} />;
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
                        <div className="combined-team-content">
                          {renderLogo(row.logo, row.team, row.crop, row.teamId)}
                          {/* Tooltip for truncated team names on mobile */}
                          <span title={row.team}>{row.team}</span>
                        </div>
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
                              {renderLogo(m.logoA || '', m.teamA, m.cropA, m.teamIdA)}
                            </div>
                            <div className="combined-score">
                              {scoreA} - {scoreB}
                            </div>
                            <div className={`combined-team-side combined-side-b ${getResultClassColor(scoreB, scoreA)}`}>
                              {renderLogo(m.logoB || '', m.teamB, m.cropB, m.teamIdB)}
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
