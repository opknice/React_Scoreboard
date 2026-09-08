import { memo } from 'react';
import type { League, Match } from '../../config/supabaseClient';
import UiIcon from '../UiIcon';

interface ScoreboardControlsBarProps {
  embedded?: boolean;
  leagues: League[];
  activeLeagueId: string;
  selectedLeagueId: string;
  loading: boolean;
  detailsLoading: boolean;
  refreshing: boolean;
  matches: Match[];
  pendingMatches: Match[];
  matchIdInput: number;
  onOpenLeagueManagement: () => void;
  onPrefetchLeagueManagement: () => void;
  onSelectLeague: (leagueId: string) => void;
  onRefreshLeague: () => void;
  onNavigateMatch: (direction: 'prev' | 'next') => void;
  onSelectMatch: (match: Match) => void;
}

function ScoreboardControlsBar({
  embedded = false,
  leagues,
  activeLeagueId,
  selectedLeagueId,
  loading,
  detailsLoading,
  refreshing,
  matches,
  pendingMatches,
  matchIdInput,
  onOpenLeagueManagement,
  onPrefetchLeagueManagement,
  onSelectLeague,
  onRefreshLeague,
  onNavigateMatch,
  onSelectMatch,
}: ScoreboardControlsBarProps) {
  const isRefreshing = loading || detailsLoading || refreshing;

  return (
    <div className={embedded ? 'scoreboard-controls-row' : 'card'} style={embedded ? undefined : { padding: '8px 12px' }}>
      <div className="row space-between" style={{ gap: '8px', marginBottom: 0 }}>
        <div className="row" style={{ marginBottom: 0, gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="btn-primary btn-sm"
            onClick={onOpenLeagueManagement}
            onFocus={onPrefetchLeagueManagement}
            onPointerEnter={onPrefetchLeagueManagement}
            title="จัดการข้อมูลลีก รายชื่อทีม และตารางการแข่งขันผ่าน Supabase"
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', border: 'none', fontWeight: 600 }}
          >
            <UiIcon name="trophy" style={{ fontSize: '0.9rem', color: '#f59e0b' }} />
            <span>จัดการลีก</span>
          </button>
        </div>

        <div className="row" style={{ marginBottom: 0, gap: '4px', alignItems: 'center' }}>
          <select
            style={{ padding: '5px 8px', fontSize: '0.82rem', background: '#0f172a', color: '#38bdf8', border: '1px solid #334155', borderRadius: '4px', minWidth: '100px', maxWidth: '150px', fontWeight: 600 }}
            value={activeLeagueId || selectedLeagueId}
            onChange={(event) => onSelectLeague(event.target.value)}
            title="เลือกลีก"
          >
            <option value="">-- โปรดเลือกลีก --</option>
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name} {league.season ? `(${league.season})` : ''}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={onRefreshLeague}
            disabled={!activeLeagueId || isRefreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#059669', borderColor: '#059669', fontWeight: 600, cursor: activeLeagueId && !detailsLoading ? 'pointer' : 'not-allowed', padding: '5px 10px', fontSize: '0.8rem' }}
            title="Refresh.."
          >
            <UiIcon name={isRefreshing ? 'spinner' : 'sync'} />
          </button>

          <button onClick={() => onNavigateMatch('prev')} style={{ padding: '3px 8px', background: '#333', color: '#fff', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }} title="แมตช์ก่อนหน้า">
            &lt;
          </button>

          {matches.length > 0 && pendingMatches.length > 0 ? (
            <select
              style={{ padding: '5px 8px', fontSize: '0.82rem', background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: '4px', minWidth: '100px', maxWidth: '150px', flex: '1' }}
              value={pendingMatches.some((match) => match.match_number === matchIdInput) ? matchIdInput : ''}
              onChange={(event) => {
                const matchNumber = Number.parseInt(event.target.value, 10);
                const match = pendingMatches.find((item) => item.match_number === matchNumber);
                if (match) onSelectMatch(match);
              }}
              title="เลือกคู่แข่งขัน"
            >
              <option value="" disabled>-- เลือกคู่แข่งขัน --</option>
              {pendingMatches.map((match) => (
                <option key={match.id} value={match.match_number}>
                  {match.team_a_name} vs {match.team_b_name}
                </option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', padding: '5px 8px' }}>
              {matches.length > 0 ? 'บันทึกผลครบทุกคู่แล้ว ✓' : 'ไม่มีคู่แข่งขัน'}
            </span>
          )}

          <button onClick={() => onNavigateMatch('next')} style={{ padding: '3px 8px', background: '#333', color: '#fff', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }} title="แมตช์ถัดไป">
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
}

ScoreboardControlsBar.displayName = 'ScoreboardControlsBar';

export default memo(ScoreboardControlsBar);
