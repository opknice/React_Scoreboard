import { useState, useEffect, useMemo } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useSearchParams } from 'react-router-dom';
import { findTeamLogoRecord, getLogoSrc } from '../utils/logoResolver';
import { useDisableZoom } from '../hooks/useDisableZoom';
import { filterDisplayableFinishedMatches } from '../utils/finishedMatch';
import type { OverlayMatch } from '../types/overlay';
import { parseCropMetadata } from '../types/teamLogo';
import OverlayLogo from './OverlayLogo';
import { useCropPreviewOverrides } from '../hooks/useLogoCropPreviewSync';
import { useLeagueLogoSizingForObs } from '../hooks/useLeagueLogoSizingForObs';
import { getEffectiveLogoScalePercent } from '../types/leagueLogoSizing';
import { getTodayDateString } from './league-management/leagueDateUtils';

export default function AllScoresStandalone() {
  useDisableZoom();
  const [searchParams] = useSearchParams();
  const [matches, setMatches] = useState<OverlayMatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const leagueId = searchParams.get('league') || 'excel';
  const title = searchParams.get('title') || 'Match Results';
  const defaultLogo = searchParams.get('defaultLogo') || 'images/logo.png';
  const dateParam = searchParams.get('date');
  const showHeader = searchParams.get('header') !== '0';
  const logoParam = searchParams.get('logo') || '';
  const backgroundParam = searchParams.get('background') || '';
  const syncSessionId = searchParams.get('sync') || 'default';
  const { resolveCrop } = useCropPreviewOverrides({ sessionId: syncSessionId, context: 'overlay' });
  const leagueLogoSizing = useLeagueLogoSizingForObs({ leagueId, sessionId: syncSessionId });

  const finishedMatches = useMemo(() => filterDisplayableFinishedMatches(matches), [matches]);

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
        if (!isSupabaseConfigured() || !leagueId || leagueId === 'excel') {
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
        setMatches(formatted);
        setErrorMsg('');
        setLoading(false);
        if (!supabaseChannel && supabase) {
          supabaseChannel = supabase
            .channel(`public:all_scores_${leagueId}`)
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
      } catch (err: unknown) {
        if (isCancelled || requestId !== latestRequestId) return;
        setErrorMsg(`โหลดข้อมูลจาก Supabase ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
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
  }, [leagueId]);

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

  const selectedDate = dateParam === 'today' ? getTodayDateString() : dateParam && dateParam !== 'all' ? dateParam : '';
  const filtered = selectedDate ? finishedMatches.filter((m) => m.date === selectedDate) : finishedMatches;

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
    return <OverlayLogo key={`${logoSrc}-${teamName}`} src={logoSrc} fallbackSrc={defaultLogo} alt={teamName} className="overlay-logo" crop={resolvedCrop} scalePercent={scalePercent} />;
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
                        <div className={`overlay-team-side overlay-side-a ${getResultClassColor(scoreA, scoreB)}`}>
                          <span>{m.teamA}</span>
                          {renderLogo(m.logoA || '', m.teamA, m.cropA, m.teamIdA)}
                        </div>
                        <div className="overlay-score">
                          {scoreA} - {scoreB}
                        </div>
                        <div className={`overlay-team-side overlay-side-b ${getResultClassColor(scoreB, scoreA)}`}>
                          {renderLogo(m.logoB || '', m.teamB, m.cropB, m.teamIdB)}
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
