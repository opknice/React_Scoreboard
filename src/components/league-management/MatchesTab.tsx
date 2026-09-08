import React, { useMemo, useState } from 'react';
import type { League, Team, Match } from '../../config/supabaseClient';
import { getTodayDateString, formatToDateInput } from './leagueDateUtils';
import { getNextMatchNumber, getScheduledTeamIdsForDate, isUnplayedMatch } from './leagueMatchUtils';
import LeagueDatabaseModal from './LeagueDatabaseModal';
import LeagueDatePicker from './LeagueDatePicker';
import ModalBackdrop from '../ModalBackdrop';

export interface MatchesTabProps {
  activeLeagueId: string;
  activeLeague: League | null;
  teams: Team[];
  matches: Match[];
  loading: boolean;
  onCreateMatch: (data: Omit<Match, 'id' | 'created_at' | 'updated_at'>) => Promise<Match | null>;
  onUpdateMatch: (matchId: string, updates: Partial<Match>) => Promise<Match | null>;
  onDeleteMatch: (matchId: string) => Promise<void> | void;
  onSelectMatchToScoreboard?: (match: Match) => void;
  onCloseModal: () => void;
}

export const MatchesTab: React.FC<MatchesTabProps> = ({
  activeLeagueId,
  activeLeague,
  teams,
  matches,
  loading,
  onCreateMatch,
  onUpdateMatch,
  onDeleteMatch,
  onSelectMatchToScoreboard,
  onCloseModal,
}) => {
  const [showMatchForm, setShowMatchForm] = useState<boolean>(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [matchTeamAId, setMatchTeamAId] = useState<string>('');
  const [matchTeamBId, setMatchTeamBId] = useState<string>('');
  const [matchLabel1, setMatchLabel1] = useState<string>('รอบแรก');
  const [matchLabel2, setMatchLabel2] = useState<string>('สัปดาห์ที่ 1');
  const [matchLabel3, setMatchLabel3] = useState<string>('สนาม 1');
  const [matchDate, setMatchDate] = useState<string>(() => getTodayDateString());
  const [matchStatus, setMatchStatus] = useState<'scheduled' | 'in_progress' | 'finished' | 'postponed'>('scheduled');
  const [matchScoreA, setMatchScoreA] = useState<number>(0);
  const [matchScoreB, setMatchScoreB] = useState<number>(0);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);

  const unplayedMatches = useMemo(
    () => matches.filter(isUnplayedMatch),
    [matches]
  );

  const scheduledTeamIdsForDate = useMemo(
    () => getScheduledTeamIdsForDate(matches, matchDate, editingMatchId),
    [editingMatchId, matchDate, matches],
  );

  const isScheduledDuplicate = (teamId: string): boolean => scheduledTeamIdsForDate.has(teamId);

  const resetMatchForm = () => {
    setEditingMatchId(null);
    setShowMatchForm(false);
    setMatchTeamAId('');
    setMatchTeamBId('');
    setMatchLabel1('รอบแรก');
    setMatchLabel2('สัปดาห์ที่ 1');
    setMatchLabel3('สนาม 1');
    setMatchDate(getTodayDateString());
    setMatchStatus('scheduled');
    setMatchScoreA(0);
    setMatchScoreB(0);
  };

  const handleSaveMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLeagueId) return;

    if (matchTeamAId && matchTeamBId && matchTeamAId === matchTeamBId) {
      alert('ทีม A และ ทีม B ต้องไม่เป็นทีมเดียวกัน');
      return;
    }

    const teamA = teams.find((t) => t.id === matchTeamAId);
    const teamB = teams.find((t) => t.id === matchTeamBId);

    const teamAName = teamA ? teamA.name : 'Team A';
    const teamBName = teamB ? teamB.name : 'Team B';

    const nextMatchNumber = getNextMatchNumber(matches);
    const finalDate = matchDate.trim() ? matchDate.trim() : null;

    if (editingMatchId) {
      await onUpdateMatch(editingMatchId, {
        team_a_id: matchTeamAId || null,
        team_b_id: matchTeamBId || null,
        team_a_name: teamAName,
        team_b_name: teamBName,
        label1: matchLabel1,
        label2: matchLabel2,
        label3: matchLabel3,
        match_date: finalDate,
        status: matchStatus,
        score_a: matchScoreA,
        score_b: matchScoreB,
      });
      resetMatchForm();
    } else {
      await onCreateMatch({
        league_id: activeLeagueId,
        // Match numbers are generated internally and are not exposed in the UI.
        match_number: nextMatchNumber,
        team_a_id: matchTeamAId || null,
        team_b_id: matchTeamBId || null,
        team_a_name: teamAName,
        team_b_name: teamBName,
        label1: matchLabel1,
        label2: matchLabel2,
        label3: matchLabel3,
        match_date: finalDate,
        status: matchStatus,
        score_a: matchScoreA,
        score_b: matchScoreB,
      });
      resetMatchForm();
    }
  };

  const handleStartEditMatch = (match: Match) => {
    setEditingMatchId(match.id);
    setShowMatchForm(true);
    setMatchTeamAId(match.team_a_id || '');
    setMatchTeamBId(match.team_b_id || '');
    setMatchLabel1(match.label1 || '');
    setMatchLabel2(match.label2 || '');
    setMatchLabel3(match.label3 || '');
    setMatchDate(formatToDateInput(match.match_date));
    setMatchStatus((match.status as 'scheduled' | 'in_progress' | 'finished' | 'postponed') || 'scheduled');
    setMatchScoreA(match.score_a || 0);
    setMatchScoreB(match.score_b || 0);
  };

  const handleCancelEditMatch = () => {
    resetMatchForm();
  };

  return (
    <div>
      {/* Form for Adding / Editing Match */}
      {(showMatchForm || editingMatchId) && (
        <ModalBackdrop
          className="league-match-modal-overlay"
          onEscape={resetMatchForm}
          role="presentation"
        >
          <div
            className="league-card league-match-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="league-match-modal-title"
          >
            <div className="league-match-modal-header">
              <h3 id="league-match-modal-title" className="league-card-title" style={{ margin: 0 }}>
                <i className="fas fa-futbol" style={{ color: '#38bdf8' }}></i>
                <span>{editingMatchId ? 'แก้ไขแมตช์การแข่งขัน' : 'เพิ่มคู่การแข่งขันใหม่'}</span>
              </h3>
              <button
                type="button"
                className="league-btn-secondary modal-header-close"
                onClick={handleCancelEditMatch}
                autoFocus
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                aria-label="ปิดฟอร์มแมตช์"
              >
                <i className="fas fa-times"></i> ปิดฟอร์ม
              </button>
            </div>

            <form onSubmit={handleSaveMatch}>
            <div className="league-form-grid">
              <div className="league-form-group">
                <label>ทีม A (เหย้า) *</label>
                <select
                  className={`league-form-select${isScheduledDuplicate(matchTeamAId) ? ' league-form-select--duplicate' : ''}`}
                  value={matchTeamAId}
                  onChange={(e) => setMatchTeamAId(e.target.value)}
                  required
                >
                  <option value="">-- เลือกทีม A --</option>
                  {teams.map((t) => (
                    <option
                      key={t.id}
                      value={t.id}
                      className={isScheduledDuplicate(t.id) ? 'league-team-duplicate-option' : undefined}
                    >
                      {t.name}{isScheduledDuplicate(t.id) ? ' (มีแข่งในวันที่เลือกแล้ว)' : ''}
                    </option>
                  ))}
                </select>
                {isScheduledDuplicate(matchTeamAId) ? (
                  <small className="league-form-help-text league-form-help-text--warning" role="status">
                    ทีมนี้มีแมตช์สถานะ scheduled ในวันที่เลือกแล้ว
                  </small>
                ) : null}
              </div>
              <div className="league-form-group">
                <label>ทีม B (เยือน) *</label>
                <select
                  className={`league-form-select${isScheduledDuplicate(matchTeamBId) ? ' league-form-select--duplicate' : ''}`}
                  value={matchTeamBId}
                  onChange={(e) => setMatchTeamBId(e.target.value)}
                  required
                >
                  <option value="">-- เลือกทีม B --</option>
                  {teams.map((t) => (
                    <option
                      key={t.id}
                      value={t.id}
                      disabled={t.id === matchTeamAId}
                      className={isScheduledDuplicate(t.id) ? 'league-team-duplicate-option' : undefined}
                    >
                      {t.name}{t.id === matchTeamAId ? ' (เลือกเป็นทีมเหย้าแล้ว)' : ''}{isScheduledDuplicate(t.id) ? ' (มีแข่งในวันที่เลือกแล้ว)' : ''}
                    </option>
                  ))}
                </select>
                {isScheduledDuplicate(matchTeamBId) ? (
                  <small className="league-form-help-text league-form-help-text--warning" role="status">
                    ทีมนี้มีแมตช์สถานะ scheduled ในวันที่เลือกแล้ว
                  </small>
                ) : null}
              </div>
              <div className="league-form-group">
                <label>สถานะแมตช์</label>
                <select
                  className="league-form-select"
                  value={matchStatus}
                  onChange={(e) => setMatchStatus(e.target.value as 'scheduled' | 'in_progress' | 'finished' | 'postponed')}
                >
                  <option value="scheduled">รอแข่งขัน (Scheduled)</option>
                </select>
              </div>
            </div>

            <div className="league-form-grid">
              <div className="league-form-group">
                <label>ป้าย 1: </label>
                <input
                  type="text"
                  className="league-form-input"
                  placeholder="เช่น รอบแรก, รอบ 8 ทีม, ชิงชนะเลิศ"
                  value={matchLabel1}
                  onChange={(e) => setMatchLabel1(e.target.value)}
                />
              </div>
              <div className="league-form-group">
                <label>ป้าย 2: </label>
                <input
                  type="text"
                  className="league-form-input"
                  placeholder="เช่น Matchweek 1, Day 1"
                  value={matchLabel2}
                  onChange={(e) => setMatchLabel2(e.target.value)}
                />
              </div>
              <div className="league-form-group">
                <label>ป้าย 3: </label>
                <input
                  type="text"
                  className="league-form-input"
                  placeholder="เช่น สนาม 1, Main Stadium"
                  value={matchLabel3}
                  onChange={(e) => setMatchLabel3(e.target.value)}
                />
              </div>
              <div className="league-form-group">
                <LeagueDatePicker
                  value={matchDate}
                  onChange={setMatchDate}
                  label="วันที่แข่งขัน (Match Date)"
                  helperText="ใช้จัดกลุ่มแมตช์ตามวันที่ในหน้า Overlay / OBS"
                />
              </div>

            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button type="submit" className="league-btn-primary" disabled={loading}>
                <i className="fas fa-save"></i>
                <span>{editingMatchId ? 'บันทึกการแก้ไขแมตช์' : 'เพิ่มแมตช์'}</span>
              </button>
              <button type="button" className="league-btn-secondary" onClick={handleCancelEditMatch}>
                ยกเลิก
              </button>
            </div>
            </form>
          </div>
        </ModalBackdrop>
      )}

      {/* Match Table List */}
      <div className="league-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 className="league-card-title" style={{ margin: 0 }}>
            <i className="fas fa-list" style={{ color: '#f59e0b' }}></i>
            <span>คู่ที่ยังไม่ได้แข่งขัน ({unplayedMatches.length} คู่)</span>
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="league-btn-primary"
              onClick={() => {
                if (showMatchForm && !editingMatchId) {
                  handleCancelEditMatch();
                } else {
                  setShowMatchForm(true);
                  setEditingMatchId(null);
                }
              }}
              style={{ padding: '6px 12px', fontSize: '0.82rem' }}
            >
              <i className={`fas ${showMatchForm && !editingMatchId ? 'fa-times' : 'fa-plus'}`}></i>
              <span>{showMatchForm && !editingMatchId ? 'ปิดฟอร์ม' : ' เพิ่มคู่การแข่งขัน'}</span>
            </button>

            <button
              type="button"
              className="league-btn-secondary"
              onClick={() => setIsDatabaseModalOpen(true)}
              disabled={!activeLeague}
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              title="แสดงข้อมูลการแข่งขันทั้งหมดของลีกนี้"
            >
              <i className="fas fa-database" style={{ color: '#38bdf8' }}></i>
              <span>จัดการการแข่งขันทั้งหมด</span>
            </button>
          </div>
        </div>

        <div className="league-table-responsive">
          <table className="league-data-table">
            <thead>
              <tr>
                <th>คู่แข่งขัน (ทีม A vs ทีม B)</th>
                <th style={{ textAlign: 'center' }}>สกอร์</th>
                <th>รอบ / สัปดาห์ / สนาม</th>
                <th style={{ textAlign: 'center' }}>สถานะ</th>
                <th style={{ textAlign: 'center' }}>การทำงาน</th>
              </tr>
            </thead>
            <tbody>
              {unplayedMatches.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '28px', color: '#64748b' }}>
                    <div>ไม่มีคู่แข่งขันที่รอการแข่งขันในลีกนี้</div>
                    <button
                      type="button"
                      className="league-btn-primary"
                      style={{ marginTop: '12px', padding: '6px 14px', fontSize: '0.82rem' }}
                      onClick={() => {
                        setShowMatchForm(true);
                        setEditingMatchId(null);
                      }}
                    >
                      <i className="fas fa-plus"></i> เพิ่มคู่การแข่งขันแรก
                    </button>
                  </td>
                </tr>
              ) : (
                unplayedMatches.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: '#f8fafc' }}>{m.team_a_name}</span>
                      <span style={{ margin: '0 8px', color: '#64748b' }}>vs</span>
                      <span style={{ fontWeight: 600, color: '#f8fafc' }}>{m.team_b_name}</span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.95rem' }}>
                      {m.status === 'scheduled' ? (
                        <span style={{ color: '#64748b' }}>-</span>
                      ) : (
                        <span style={{ color: '#4ade80' }}>
                          {m.score_a} - {m.score_b}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      <div>{[m.label1, m.label2, m.label3].filter(Boolean).join(' • ') || '-'}</div>
                      {m.match_date && (
                        <div style={{ color: '#38bdf8', fontSize: '0.75rem', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <i className="fas fa-calendar-alt"></i> {formatToDateInput(m.match_date)}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`status-badge ${m.status}`}>
                        {m.status === 'scheduled'
                          ? 'รอแข่ง'
                          : m.status === 'in_progress'
                            ? 'กำลังแข่ง'
                            : m.status === 'postponed'
                              ? 'เลื่อนแข่ง'
                              : 'จบแล้ว'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {onSelectMatchToScoreboard && !(m.status === 'finished' || (typeof m.score_a === 'number' && typeof m.score_b === 'number' && (m.score_a > 0 || m.score_b > 0))) && (
                        <button
                          type="button"
                          className="league-btn-primary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', marginRight: '6px' }}
                          onClick={() => {
                            onSelectMatchToScoreboard(m);
                            onCloseModal();
                          }}
                          title="ส่งข้อมูลแมตช์นี้ขึ้นสกอร์บอร์ดทันที"
                        >
                          <i className="fas fa-play"></i> โหลดขึ้นบอร์ด
                        </button>
                      )}
                      <button
                        type="button"
                        className="league-btn-icon"
                        onClick={() => handleStartEditMatch(m)}
                        title="แก้ไข"
                      >
                        <i className="fas fa-edit" style={{ color: '#38bdf8' }}></i>
                      </button>
                      <button
                        type="button"
                        className="league-btn-icon"
                        onClick={() => {
                          if (window.confirm('ลบการแข่งขันนี้ใช่หรือไม่?')) onDeleteMatch(m.id);
                        }}
                        title="ลบ"
                      >
                        <i className="fas fa-trash" style={{ color: '#ef4444' }}></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LeagueDatabaseModal
        isOpen={isDatabaseModalOpen}
        league={activeLeague}
        teams={teams}
        matches={matches}
        loading={loading}
        onUpdateMatch={onUpdateMatch}
        onDeleteMatch={onDeleteMatch}
        onClose={() => setIsDatabaseModalOpen(false)}
      />
    </div>
  );
};

export default MatchesTab;
