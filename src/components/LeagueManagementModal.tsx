import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSupabaseLeague } from '../hooks/useSupabaseLeague';
import { useAuthAccess } from '../hooks/useAuthAccess';
import { useImageUploadQuota } from '../hooks/useImageUploadQuota';
import type { Team, Match } from '../config/supabaseClient';
import './LeagueManagementModal.css';

interface LeagueManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMatchToScoreboard?: (match: Match) => void;
  currentUserEmail?: string;
  initialTab?: 'league' | 'teams' | 'matches';
}

export default function LeagueManagementModal({
  isOpen,
  onClose,
  onSelectMatchToScoreboard,
  currentUserEmail,
  initialTab = 'matches',
}: LeagueManagementModalProps) {
  const authAccess = useAuthAccess();
  const effectiveEmail = currentUserEmail || authAccess?.email || '';
  const { isQuotaExceeded, incrementUploadCount, loading: quotaLoading } = useImageUploadQuota();

  const {
    isConfigured,
    leagues,
    activeLeagueId,
    activeLeague,
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
    createMatchesBatch,
    updateMatch,
    deleteMatch,
    clearMatches,
  } = useSupabaseLeague(undefined, effectiveEmail);

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

  // Handle ESC key and prevent body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Robust Click-Outside handling (prevents text-drag outside from accidentally closing modal)
  const overlayMouseDownRef = useRef(false);

  const handleOverlayMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      overlayMouseDownRef.current = true;
    } else {
      overlayMouseDownRef.current = false;
    }
  }, []);

  const handleOverlayMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (overlayMouseDownRef.current && e.target === e.currentTarget) {
      onClose();
    }
    overlayMouseDownRef.current = false;
  }, [onClose]);

  // --- League Form State ---
  const [isEditingLeague, setIsEditingLeague] = useState(false);
  const [leagueName, setLeagueName] = useState('');
  const [leagueSeason, setLeagueSeason] = useState('');
  const [leagueDesc, setLeagueDesc] = useState('');

  // --- Team Form State ---
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamShortName, setTeamShortName] = useState('');
  const [teamColor1, setTeamColor1] = useState('#ffffff');
  const [teamColor2, setTeamColor2] = useState('#000000');
  const [teamLogoUrl, setTeamLogoUrl] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // --- Match Form State ---
  const [showMatchForm, setShowMatchForm] = useState<boolean>(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [matchNumber, setMatchNumber] = useState<number>(matches.length + 1);
  const [matchTeamAId, setMatchTeamAId] = useState<string>('');
  const [matchTeamBId, setMatchTeamBId] = useState<string>('');
  const [matchLabel1, setMatchLabel1] = useState<string>('รอบแรก');
  const [matchLabel2, setMatchLabel2] = useState<string>('สัปดาห์ที่ 1');
  const [matchLabel3, setMatchLabel3] = useState<string>('สนาม 1');
  const [matchDate, setMatchDate] = useState<string>('');
  const [matchStatus, setMatchStatus] = useState<'scheduled' | 'in_progress' | 'finished' | 'postponed'>('scheduled');
  const [matchScoreA, setMatchScoreA] = useState<number>(0);
  const [matchScoreB, setMatchScoreB] = useState<number>(0);

  // ==========================================
  // HANDLERS: LEAGUE
  // ==========================================
  const handleSaveLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leagueName.trim()) return;

    if (isEditingLeague && activeLeagueId) {
      await updateLeague(activeLeagueId, {
        name: leagueName.trim(),
        season: leagueSeason.trim(),
        description: leagueDesc.trim(),
      });
      setIsEditingLeague(false);
    } else {
      await createLeague({
        name: leagueName.trim(),
        season: leagueSeason.trim(),
        description: leagueDesc.trim(),
        is_active: true,
        created_by: effectiveEmail ? effectiveEmail.trim().toLowerCase() : undefined,
      });
      setLeagueName('');
      setLeagueSeason('');
      setLeagueDesc('');
    }
  };

  const handleStartEditLeague = () => {
    if (!activeLeague) return;
    setLeagueName(activeLeague.name);
    setLeagueSeason(activeLeague.season || '');
    setLeagueDesc(activeLeague.description || '');
    setIsEditingLeague(true);
  };

  // ==========================================
  // HANDLERS: TEAMS
  // ==========================================
  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (quotaLoading) {
      alert('กำลังตรวจสอบโควต้า กรุณารอสักครู่');
      return;
    }

    if (isQuotaExceeded) {
      alert('คุณใช้โควต้าอัปโหลดรูปภาพครบ 10 รูปแล้ว');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const publicUrl = await uploadTeamLogo(file, file.name);
      await incrementUploadCount();
      setTeamLogoUrl(publicUrl);
    } catch (err: any) {
      alert(`ไม่สามารถอัปโหลดโลโก้ได้: ${err.message || 'โปรดตรวจสอบ Storage Bucket "team-logos" ใน Supabase'}`);
    } finally {
      setIsUploadingLogo(false);
      if (logoFileInputRef.current) logoFileInputRef.current.value = '';
    }
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !activeLeagueId) return;

    if (editingTeamId) {
      await updateTeam(editingTeamId, {
        name: teamName.trim(),
        short_name: teamShortName.trim() || teamName.slice(0, 3).toUpperCase(),
        color_primary: teamColor1,
        color_secondary: teamColor2,
        logo_url: teamLogoUrl.trim(),
      });
      setEditingTeamId(null);
    } else {
      await createTeam({
        league_id: activeLeagueId,
        name: teamName.trim(),
        short_name: teamShortName.trim() || teamName.slice(0, 3).toUpperCase(),
        color_primary: teamColor1,
        color_secondary: teamColor2,
        logo_url: teamLogoUrl.trim(),
      });
    }

    setTeamName('');
    setTeamShortName('');
    setTeamColor1('#ffffff');
    setTeamColor2('#000000');
    setTeamLogoUrl('');
  };

  const handleStartEditTeam = (team: Team) => {
    setEditingTeamId(team.id);
    setTeamName(team.name);
    setTeamShortName(team.short_name || '');
    setTeamColor1(team.color_primary || '#ffffff');
    setTeamColor2(team.color_secondary || '#000000');
    setTeamLogoUrl(team.logo_url || '');
  };

  const handleCancelEditTeam = () => {
    setEditingTeamId(null);
    setTeamName('');
    setTeamShortName('');
    setTeamColor1('#ffffff');
    setTeamColor2('#000000');
    setTeamLogoUrl('');
  };

// Helper to safely format dates into YYYY-MM-DD for HTML5 date input without timezone shift
const formatToDateInput = (val?: string | null): string => {
  if (!val) return '';
  const trimmed = val.trim();
  const matched = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (matched) return matched[1];
  try {
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
};

  // ==========================================
  // HANDLERS: MATCHES
  // ==========================================
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
    setMatchDate('');
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
      await updateMatch(editingMatchId, {
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
      await createMatch({
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

  // Round-Robin Fixture Generator
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

    await createMatchesBatch(newMatches);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="league-modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
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
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} {l.season ? `(${l.season})` : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            className={`league-tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveTab('matches')}
          >
            <i className="fas fa-calendar-alt"></i> ตารางแข่งขัน ({matches.length})
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
          {/* ==========================================
              TAB 1: LEAGUES MANAGEMENT
             ========================================== */}
          {activeTab === 'league' && (
            <div>
              <div className="league-card">
                <h3 className="league-card-title">
                  <i className="fas fa-plus-circle" style={{ color: '#38bdf8' }}></i>
                  <span>{isEditingLeague ? 'แก้ไขข้อมูลลีก' : 'สร้างลีกการแข่งขันใหม่'}</span>
                </h3>
                <form onSubmit={handleSaveLeague}>
                  <div className="league-form-grid">
                    <div className="league-form-group">
                      <label>ชื่อลีก (League Name) *</label>
                      <input
                        type="text"
                        className="league-form-input"
                        placeholder="เช่น พรีเมียร์ลีก อบต. 2026"
                        value={leagueName}
                        onChange={(e) => setLeagueName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="league-form-group">
                      <label>ฤดูกาล / ปี (Season)</label>
                      <input
                        type="text"
                        className="league-form-input"
                        placeholder="เช่น 2026, Season 1"
                        value={leagueSeason}
                        onChange={(e) => setLeagueSeason(e.target.value)}
                      />
                    </div>
                    <div className="league-form-group">
                      <label>รายละเอียดเพิ่มเติม (Description)</label>
                      <input
                        type="text"
                        className="league-form-input"
                        placeholder="คำอธิบายสั้นๆ"
                        value={leagueDesc}
                        onChange={(e) => setLeagueDesc(e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" className="league-btn-primary" disabled={loading}>
                      <i className="fas fa-save"></i>
                      <span>{isEditingLeague ? 'บันทึกการแก้ไข' : 'สร้างลีก'}</span>
                    </button>
                    {isEditingLeague && (
                      <button
                        type="button"
                        className="league-btn-secondary"
                        onClick={() => {
                          setIsEditingLeague(false);
                          setLeagueName('');
                          setLeagueSeason('');
                          setLeagueDesc('');
                        }}
                      >
                        ยกเลิก
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* List of Leagues */}
              <div className="league-card">
                <h3 className="league-card-title">
                  <i className="fas fa-trophy" style={{ color: '#f59e0b' }}></i>
                  <span>รายการลีกทั้งหมดในระบบ</span>
                </h3>
                <div className="league-table-responsive">
                  <table className="league-data-table">
                    <thead>
                      <tr>
                        <th>ชื่อลีก</th>
                        <th>ฤดูกาล</th>
                        <th>รายละเอียด</th>
                        <th style={{ textAlign: 'center' }}>สถานะ</th>
                        <th style={{ textAlign: 'center' }}>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leagues.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                            ยังไม่มีข้อมูลลีก กรุณาสร้างลีกแรกของคุณด้านบน
                          </td>
                        </tr>
                      ) : (
                        leagues.map((l) => (
                          <tr key={l.id}>
                            <td style={{ fontWeight: 600, color: l.id === activeLeagueId ? '#38bdf8' : '#fff' }}>
                              {l.id === activeLeagueId && '⭐ '}
                              {l.name}
                            </td>
                            <td>{l.season || '-'}</td>
                            <td>{l.description || '-'}</td>
                            <td style={{ textAlign: 'center' }}>
                              {l.id === activeLeagueId ? (
                                <span className="status-badge finished">ใช้งานอยู่</span>
                              ) : (
                                <button
                                  type="button"
                                  className="league-btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                  onClick={() => selectLeague(l.id)}
                                >
                                  เลือกใช้งาน
                                </button>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="league-btn-icon"
                                onClick={() => {
                                  selectLeague(l.id);
                                  handleStartEditLeague();
                                }}
                                title="แก้ไข"
                              >
                                <i className="fas fa-edit" style={{ color: '#38bdf8' }}></i>
                              </button>
                              <button
                                type="button"
                                className="league-btn-icon"
                                onClick={() => {
                                  if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบลีก "${l.name}"? ข้อมูลทีมและแมตช์ทั้งหมดจะถูกลบไปด้วย!`)) {
                                    deleteLeague(l.id);
                                  }
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
          )}

          {/* ==========================================
              TAB 2: TEAMS MANAGEMENT
             ========================================== */}
          {activeTab === 'teams' && (
            <div>
              <div className="league-card">
                <h3 className="league-card-title">
                  <i className="fas fa-user-plus" style={{ color: '#38bdf8' }}></i>
                  <span>{editingTeamId ? 'แก้ไขข้อมูลทีม' : 'เพิ่มทีมใหม่ในลีกนี้'}</span>
                </h3>
                <form onSubmit={handleSaveTeam}>
                  <div className="league-form-grid">
                    <div className="league-form-group">
                      <label>ชื่อทีม (Team Name) *</label>
                      <input
                        type="text"
                        className="league-form-input"
                        placeholder="เช่น แมนเชสเตอร์ ยูไนเต็ด"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="league-form-group">
                      <label>ชื่อย่อ (Short Name)</label>
                      <input
                        type="text"
                        className="league-form-input"
                        placeholder="เช่น MUN"
                        maxLength={5}
                        value={teamShortName}
                        onChange={(e) => setTeamShortName(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="league-form-group">
                      <label>สีหลัก (Primary Color)</label>
                      <div className="league-color-picker-wrapper">
                        <div className="league-color-circle" style={{ background: teamColor1 }}>
                          <input type="color" value={teamColor1} onChange={(e) => setTeamColor1(e.target.value)} />
                        </div>
                        <input
                          type="text"
                          className="league-form-input"
                          value={teamColor1}
                          onChange={(e) => setTeamColor1(e.target.value)}
                          style={{ width: '100px' }}
                        />
                      </div>
                    </div>
                    <div className="league-form-group">
                      <label>สีรอง (Secondary Color)</label>
                      <div className="league-color-picker-wrapper">
                        <div className="league-color-circle" style={{ background: teamColor2 }}>
                          <input type="color" value={teamColor2} onChange={(e) => setTeamColor2(e.target.value)} />
                        </div>
                        <input
                          type="text"
                          className="league-form-input"
                          value={teamColor2}
                          onChange={(e) => setTeamColor2(e.target.value)}
                          style={{ width: '100px' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Logo Upload / URL */}
                  <div className="league-form-grid" style={{ alignItems: 'center' }}>
                    <div className="league-form-group" style={{ gridColumn: 'span 2' }}>
                      <label>โลโก้ทีม (URL ภาพ หรืออัปโหลดไฟล์ตรงเข้า Supabase Storage)</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          className="league-form-input"
                          placeholder="https://.../logo.png หรืออัปโหลดไฟล์ด้านขวา"
                          value={teamLogoUrl}
                          onChange={(e) => setTeamLogoUrl(e.target.value)}
                        />
                        <button
                          type="button"
                          className="league-btn-secondary"
                          onClick={() => logoFileInputRef.current?.click()}
                          disabled={isUploadingLogo}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          <i className={`fas ${isUploadingLogo ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                          <span>{isUploadingLogo ? 'กำลังอัปโหลด...' : 'อัปโหลดภาพ'}</span>
                        </button>
                        <input
                          ref={logoFileInputRef}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleLogoFileUpload}
                        />
                      </div>
                    </div>

                    {teamLogoUrl && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="league-team-logo" style={{ background: teamColor1 }}>
                          <img src={teamLogoUrl} alt="" onError={(e) => ((e.target as HTMLElement).style.display = 'none')} />
                        </div>
                        <span style={{ fontSize: '0.8rem', color: '#4ade80' }}>✓ โลโก้พร้อมใช้งาน</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button type="submit" className="league-btn-primary" disabled={loading}>
                      <i className="fas fa-save"></i>
                      <span>{editingTeamId ? 'บันทึกการแก้ไข' : 'เพิ่มทีม'}</span>
                    </button>
                    {editingTeamId && (
                      <button type="button" className="league-btn-secondary" onClick={handleCancelEditTeam}>
                        ยกเลิก
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Teams Cards Grid */}
              <div className="league-card">
                <h3 className="league-card-title">
                  <i className="fas fa-shield-alt" style={{ color: '#10b981' }}></i>
                  <span>รายชื่อทีมในลีกนี้ ({teams.length} ทีม)</span>
                </h3>
                {teams.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '0.88rem' }}>ยังไม่มีทีมในลีกนี้ เพิ่มทีมแรกของคุณด้านบน</p>
                ) : (
                  <div className="league-teams-grid">
                    {teams.map((t) => (
                      <div key={t.id} className="league-team-card">
                        <div className="league-team-logo" style={{ background: t.color_primary || '#1e293b' }}>
                          {t.logo_url ? (
                            <img src={t.logo_url} alt="" onError={(e) => ((e.target as HTMLElement).style.display = 'none')} />
                          ) : (
                            t.short_name || t.name.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="league-team-info">
                          <div className="league-team-name">{t.name}</div>
                          <div className="league-team-colors">
                            <span className="league-color-dot" style={{ background: t.color_primary }} title="สีหลัก" />
                            <span className="league-color-dot" style={{ background: t.color_secondary }} title="สีรอง" />
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '4px' }}>{t.short_name}</span>
                          </div>
                        </div>
                        <button type="button" className="league-btn-icon" onClick={() => handleStartEditTeam(t)} title="แก้ไข">
                          <i className="fas fa-edit" style={{ color: '#38bdf8' }}></i>
                        </button>
                        <button
                          type="button"
                          className="league-btn-icon"
                          onClick={() => {
                            if (window.confirm(`ลบทีม "${t.name}"?`)) deleteTeam(t.id);
                          }}
                          title="ลบ"
                        >
                          <i className="fas fa-trash" style={{ color: '#ef4444' }}></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==========================================
              TAB 3: MATCH SCHEDULE & FIXTURES
             ========================================== */}
          {activeTab === 'matches' && (
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
                            clearMatches();
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
                                    onClose();
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
                                  if (window.confirm(`ลบแมตช์ที่ ${m.match_number}?`)) deleteMatch(m.id);
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
          )}
        </div>

        {/* Footer */}
        <div className="league-modal-footer">
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
            ⚡ ข้อมูลทั้งหมดจะถูกซิงค์และบันทึกลง Supabase แบบ Real-time ทันที
          </span>
          <button className="league-btn-secondary" onClick={onClose}>
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
