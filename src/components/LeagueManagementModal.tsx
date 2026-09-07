import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { UseSupabaseLeagueResult } from '../hooks/useSupabaseLeague';
import { useAuthAccess } from '../hooks/useAuthAccess';
import { useImageUploadQuota } from '../hooks/useImageUploadQuota';
import type { Match } from '../config/supabaseClient';
import LeagueTab from './league-management/LeagueTab';
import TeamsTab from './league-management/TeamsTab';
import MatchesTab from './league-management/MatchesTab';
import ModalBackdrop from './ModalBackdrop';
import './LeagueManagementModal.css';


export interface LeagueManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMatchToScoreboard?: (match: Match) => void;
  currentUserEmail?: string;
  initialTab?: 'league' | 'teams' | 'matches';
  leagueState: UseSupabaseLeagueResult;
}

export default function LeagueManagementModal({
  isOpen,
  onClose,
  onSelectMatchToScoreboard,
  currentUserEmail,
  initialTab = 'matches',
  leagueState,
}: LeagueManagementModalProps) {
  const authAccess = useAuthAccess();
  const effectiveEmail = currentUserEmail || authAccess?.email || '';
  const { isQuotaExceeded, incrementUploadCount, loading: quotaLoading } = useImageUploadQuota();

  const {
    isConfigured,
    leagues,
    activeLeague,
    activeLeagueId,
    teams,
    matches,
    loading,
    selectLeague,
    createLeague,
    updateLeague,
    deleteLeague,
    createTeam,
    updateTeam,
    deleteTeam,
    uploadTeamLogo,
    createMatch,
    updateMatch,
    deleteMatch,
  } = leagueState;

  const [activeTab, setActiveTab] = useState<'league' | 'teams' | 'matches'>(() => {
    return initialTab || (leagues.length === 0 ? 'league' : 'matches');
  });

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      } else if (leagues.length === 0) {
        setActiveTab('league');
      }
    }
  }, [isOpen, initialTab, leagues.length]);

  // Prevent body scroll while the modal is open. Escape is handled by the
  // shared ModalBackdrop so nested modals close one layer at a time.
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <ModalBackdrop
      className="league-modal-overlay"
      onEscape={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="league-modal-title"
    >
      <div className="league-modal-container">
        {/* Header */}
        <div className="league-modal-header">
          <h2 id="league-modal-title" className="league-modal-title">
            <i className="fas fa-trophy"></i>
            <span>จัดการข้อมูลลีก & ตารางการแข่งขัน (Supabase)</span>
            {effectiveEmail && (
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 500, marginLeft: '8px' }}>
                <i className="fas fa-user" style={{ marginRight: '4px' }}></i>
                {effectiveEmail}
              </span>
            )}
          </h2>
          <button className="league-modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Warning if Supabase is not configured */}
        {!isConfigured && (
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', borderLeft: '4px solid #ef4444', padding: '12px 20px', fontSize: '0.88rem', color: '#fca5a5' }}>
            <strong>⚠️ ยังไม่ได้เชื่อมต่อ Supabase:</strong> กรุณากรอก <code>VITE_SUPABASE_URL</code> และ <code>VITE_SUPABASE_ANON_KEY</code> ในไฟล์ <code>.env</code> และรัน SQL Script ใน Supabase SQL Editor
          </div>
        )}

        {/* Active League Quick Selector & Tabs Navigation */}
        <div className="league-modal-tabs">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8' }}>ลีกปัจจุบัน:</span>
            <select
              className="league-form-select"
              style={{ width: 'auto', padding: '4px 10px', fontSize: '0.82rem', background: '#1e293b' }}
              value={activeLeagueId}
              onChange={(e) => selectLeague(e.target.value)}
            >
              {leagues.length === 0 && <option value="">(ยังไม่มีลีกในระบบ)</option>}
              {leagues.length > 0 && (
                <>
                  <option value="" disabled>-- กรุณาเลือกลีก --</option>
                  {leagues.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.season ? `(${l.season})` : ''}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <button
            className={`league-tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveTab('matches')}
          >
            <i className="fas fa-calendar-alt"></i> ตารางแข่งขัน
          </button>
          <button
            className={`league-tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
            onClick={() => setActiveTab('teams')}
          >
            <i className="fas fa-users"></i> ทีม ({teams.length})
          </button>
          <button
            className={`league-tab-btn ${activeTab === 'league' ? 'active' : ''}`}
            onClick={() => setActiveTab('league')}
          >
            <i className="fas fa-cog"></i> จัดการลีก
          </button>
        </div>

        {/* Body Content */}
        <div className="league-modal-body">
          {activeTab === 'league' && (
            <LeagueTab
              leagues={leagues}
              activeLeagueId={activeLeagueId}
              loading={loading}
              effectiveEmail={effectiveEmail}
              onSelectLeague={selectLeague}
              onCreateLeague={createLeague}
              onUpdateLeague={updateLeague}
              onDeleteLeague={deleteLeague}
            />
          )}

          {activeTab === 'teams' && (
            <TeamsTab
              activeLeagueId={activeLeagueId}
              activeLeague={activeLeague}
              teams={teams}
              loading={loading}
              isQuotaExceeded={isQuotaExceeded}
              quotaLoading={quotaLoading}
              onCreateTeam={createTeam}
              onUpdateTeam={updateTeam}
              onUpdateLeague={updateLeague}
              onDeleteTeam={deleteTeam}
              onUploadTeamLogo={uploadTeamLogo}
              onIncrementUploadCount={incrementUploadCount}
            />
          )}

          {activeTab === 'matches' && (
            <MatchesTab
              activeLeagueId={activeLeagueId}
              activeLeague={activeLeague}
              teams={teams}
              matches={matches}
              loading={loading}
              onCreateMatch={createMatch}
              onUpdateMatch={updateMatch}
              onDeleteMatch={deleteMatch}
              onSelectMatchToScoreboard={onSelectMatchToScoreboard}
              onCloseModal={onClose}
            />
          )}
        </div>

        {/* Footer */}
        <div className="league-modal-footer">
          <button className="league-btn-secondary" onClick={onClose}>
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </ModalBackdrop>,
    document.body
  );
}
