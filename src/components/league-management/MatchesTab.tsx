import React, { useState } from 'react';
import type { Team, Match } from '../../config/supabaseClient';
import { getTodayDateString, formatToDateInput } from './leagueDateUtils';

export interface MatchesTabProps {
  activeLeagueId: string;
  teams: Team[];
  matches: Match[];
  loading: boolean;
  onCreateMatch: (data: Omit<Match, 'id' | 'created_at' | 'updated_at'>) => Promise<Match | null>;
  onCreateMatchesBatch: (matchesData: Omit<Match, 'id' | 'created_at' | 'updated_at'>[]) => Promise<Match[]>;
  onUpdateMatch: (matchId: string, updates: Partial<Match>) => Promise<Match | null>;
  onDeleteMatch: (matchId: string) => Promise<void> | void;
  onClearMatches: () => Promise<void> | void;
  onSelectMatchToScoreboard?: (match: Match) => void;
  onCloseModal: () => void;
}

export const MatchesTab: React.FC<MatchesTabProps> = ({
  activeLeagueId,
  teams,
  matches,
  loading,
  onCreateMatch,
  onCreateMatchesBatch,
  onUpdateMatch,
  onDeleteMatch,
  onClearMatches,
  onSelectMatchToScoreboard,
  onCloseModal,
}) => {
  const [showMatchForm, setShowMatchForm] = useState<boolean>(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [matchNumber, setMatchNumber] = useState<number>(matches.length + 1);
  const [matchTeamAId, setMatchTeamAId] = useState<string>('');
  const [matchTeamBId, setMatchTeamBId] = useState<string>('');
  const [matchLabel1, setMatchLabel1] = useState<string>('รอบแรก');
  const [matchLabel2, setMatchLabel2] = useState<string>('สัปดาห์ที่ 1');
  const [matchLabel3, setMatchLabel3] = useState<string>('สนาม 1');
  const [matchDate, setMatchDate] = useState<string>(() => getTodayDateString());
  const [matchStatus, setMatchStatus] = useState<'scheduled' | 'in_progress' | 'finished' | 'postponed'>('scheduled');
  const [matchScoreA, setMatchScoreA] = useState<number>(0);
  const [matchScoreB, setMatchScoreB] = useState<number>(0);

  const resetMatchForm = () => {
    setEditingMatchId(null);
    setShowMatchForm(false);
    const nextNum = matches.length > 0 ? Math.max(...matches.map((m) => m.match_number)) + 1 : 1;
    setMatchNumber(nextNum);
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

    const defaultNextNum = matches.length > 0 ? Math.max(...matches.map((m) => m.match_number)) + 1 : 1;
    const finalDate = matchDate.trim() ? matchDate.trim() : null;

    if (editingMatchId) {
      await onUpdateMatch(editingMatchId, {
        match_number: matchNumber,
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
        match_number: matchNumber || defaultNextNum,
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
    setMatchNumber(match.match_number);
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

  const handleGenerateRoundRobin = async () => {
    if (teams.length < 2) {
      alert('ต้องมีอย่างน้อย 2 ทีมเพื่อสร้างตารางแข่งขัน');
      return;
    }

    const confirmGen = window.confirm(`คุณต้องการสร้างตารางการแข่งขันพบกันหมดจาก ${teams.length} ทีมใช่หรือไม่?`);
    if (!confirmGen) return;

    const newMatches: Omit<Match, 'id' | 'created_at' | 'updated_at'>[] = [];
    let matchCounter = matches.length > 0 ? Math.max(...matches.map((m) => m.match_number)) + 1 : 1;

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        newMatches.push({
          league_id: activeLeagueId,
          match_number: matchCounter++,
          team_a_id: teams[i].id,
          team_b_id: teams[j].id,
          team_a_name: teams[i].name,
          team_b_name: teams[j].name,
          score_a: 0,
          score_b: 0,
          status: 'scheduled',
          label1: 'รอบแรก',
          label2: `คู่ที่ ${newMatches.length + 1}`,
          label3: 'สนาม 1',
          match_date: null,
        });
      }
    }

    await onCreateMatchesBatch(newMatches);
  };

  return (
    <div>
      {/* Form for Adding / Editing Match (Collapsible) */}
      {(showMatchForm || editingMatchId) && (
        <div
          className="league-card league-form-slide-down"
          style={{ border: '1px solid rgba(56, 189, 248, 0.3)', background: 'rgba(15, 23, 42, 0.85)', marginBottom: '20px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 className="league-card-title" style={{ margin: 0 }}>
              <i className="fas fa-futbol" style={{ color: '#38bdf8' }}></i>
              <span>{editingMatchId ? 'แก้ไขแมตช์การแข่งขัน' : 'เพิ่มคู่การแข่งขันใหม่'}</span>
            </h3>
            <button
              type="button"
              className="league-btn-secondary"
              onClick={handleCancelEditMatch}
              style={{ padding: '4px 10px', fontSize: '0.78rem' }}
            >
              <i className="fas fa-times"></i> ปิดฟอร์ม
            </button>
          </div>

          <form onSubmit={handleSaveMatch}>
            <div className="league-form-grid">
              <div className="league-form-group">
                <label>ลำดับแมตช์ (Match No.) *</label>
                <input
                  type="number"
                  className="league-form-input"
                  value={matchNumber}
                  onChange={(e) => setMatchNumber(parseInt(e.target.value, 10) || 1)}
                  required
                />
              </div>
              <div className="league-form-group">
                <label>ทีม A (เหย้า) *</label>
                <select
                  className="league-form-select"
                  value={matchTeamAId}
                  onChange={(e) => setMatchTeamAId(e.target.value)}
                  required
                >
                  <option value="">-- เลือกทีม A --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="league-form-group">
                <label>ทีม B (เยือน) *</label>
                <select
                  className="league-form-select"
                  value={matchTeamBId}
                  onChange={(e) => setMatchTeamBId(e.target.value)}
                  required
                >
                  <option value="">-- เลือกทีม B --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id} disabled={t.id === matchTeamAId}>
                      {t.name} {t.id === matchTeamAId ? '(เลือกเป็นทีมเหย้าแล้ว)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="league-form-group">
                <label>สถานะแมตช์</label>
                <select
                  className="league-form-select"
                  value={matchStatus}
                  onChange={(e) => setMatchStatus(e.target.value as 'scheduled' | 'in_progress' | 'finished' | 'postponed')}
                >
                  <option value="scheduled">รอแข่งขัน (Scheduled)</option>
                  <option value="in_progress">กำลังแข่งขัน (Live)</option>
                  <option value="finished">จบการแข่งขัน (Finished)</option>
                </select>
              </div>
            </div>

            <div className="league-form-grid">
              <div className="league-form-group">
                <label>ป้าย 1: รอบการแข่งขัน (Round)</label>
                <input
                  type="text"
                  className="league-form-input"
                  placeholder="เช่น รอบแรก, รอบ 8 ทีม, ชิงชนะเลิศ"
                  value={matchLabel1}
                  onChange={(e) => setMatchLabel1(e.target.value)}
                />
              </div>
              <div className="league-form-group">
                <label>ป้าย 2: สัปดาห์ / วันแข่ง (Week/Day)</label>
                <input
                  type="text"
                  className="league-form-input"
                  placeholder="เช่น Matchweek 1, Day 1"
                  value={matchLabel2}
                  onChange={(e) => setMatchLabel2(e.target.value)}
                />
              </div>
              <div className="league-form-group">
                <label>ป้าย 3: สนามแข่งขัน (Field / Pitch)</label>
                <input
                  type="text"
                  className="league-form-input"
                  placeholder="เช่น สนาม 1, Main Stadium"
                  value={matchLabel3}
                  onChange={(e) => setMatchLabel3(e.target.value)}
                />
              </div>
              <div className="league-form-group">
                <label>📅 วันที่แข่งขัน (Match Date)</label>
                <input
                  type="date"
                  className="league-form-input"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                  ใช้จัดกลุ่มแมตช์ตามวันที่ในหน้า Overlay / OBS
                </span>
              </div>
              <div className="league-form-group">
                <label>ผลสกอร์ปัจจุบัน (Score A - Score B)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    className="league-form-input"
                    value={matchScoreA}
                    onChange={(e) => setMatchScoreA(parseInt(e.target.value, 10) || 0)}
                    style={{ textAlign: 'center' }}
                  />
                  <span style={{ fontWeight: 700 }}>-</span>
                  <input
                    type="number"
                    className="league-form-input"
                    value={matchScoreB}
                    onChange={(e) => setMatchScoreB(parseInt(e.target.value, 10) || 0)}
                    style={{ textAlign: 'center' }}
                  />
                </div>
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
      )}

      {/* Match Table List */}
      <div className="league-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 className="league-card-title" style={{ margin: 0 }}>
            <i className="fas fa-list" style={{ color: '#f59e0b' }}></i>
            <span>ตารางการแข่งขันทั้งหมด ({matches.length} แมตช์)</span>
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
              <span>{showMatchForm && !editingMatchId ? 'ปิดฟอร์ม' : '➕ เพิ่มคู่การแข่งขัน'}</span>
            </button>

            <button
              type="button"
              className="league-btn-secondary"
              onClick={handleGenerateRoundRobin}
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              title="สร้างตารางแข่งขันแบบพบกันหมดให้อัตโนมัติ"
            >
              <i className="fas fa-magic" style={{ color: '#f59e0b' }}></i>
              <span>สร้างตารางพบกันหมด</span>
            </button>

            {matches.length > 0 && (
              <button
                type="button"
                className="league-btn-danger"
                onClick={() => {
                  if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการล้างตารางการแข่งขันทั้งหมดในลีกนี้?')) {
                    onClearMatches();
                  }
                }}
              >
                <i className="fas fa-trash-alt"></i> ล้างตารางแข่ง
              </button>
            )}
          </div>
        </div>

        <div className="league-table-responsive">
          <table className="league-data-table">
            <thead>
              <tr>
                <th style={{ width: '60px', textAlign: 'center' }}>ลำดับ</th>
                <th>คู่แข่งขัน (ทีม A vs ทีม B)</th>
                <th style={{ textAlign: 'center' }}>สกอร์</th>
                <th>รอบ / สัปดาห์ / สนาม</th>
                <th style={{ textAlign: 'center' }}>สถานะ</th>
                <th style={{ textAlign: 'center' }}>การทำงาน</th>
              </tr>
            </thead>
            <tbody>
              {matches.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '28px', color: '#64748b' }}>
                    <div>ยังไม่มีตารางแข่งขันในลีกนี้</div>
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
                matches.map((m) => (
                  <tr key={m.id}>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#38bdf8' }}>
                      #{m.match_number}
                    </td>
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
                        {m.status === 'scheduled' ? 'รอแข่ง' : m.status === 'in_progress' ? 'กำลังแข่ง' : 'จบแล้ว'}
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
                          if (window.confirm(`ลบแมตช์ที่ ${m.match_number}?`)) onDeleteMatch(m.id);
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
    </div>
  );
};

export default MatchesTab;
