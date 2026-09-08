import React, { useState } from 'react';
import type { League } from '../../config/supabaseClient';
import ModalBackdrop from '../ModalBackdrop';

export interface LeagueTabProps {
  leagues: League[];
  activeLeagueId: string;
  loading: boolean;
  effectiveEmail?: string;
  onSelectLeague: (leagueId: string) => void;
  onCreateLeague: (data: Omit<League, 'id' | 'created_at' | 'updated_at'>) => Promise<League | null>;
  onUpdateLeague: (leagueId: string, updates: Partial<League>) => Promise<League | null>;
  onDeleteLeague: (leagueId: string) => Promise<void> | void;
}

export const LeagueTab: React.FC<LeagueTabProps> = ({
  leagues,
  activeLeagueId,
  loading,
  effectiveEmail,
  onSelectLeague,
  onCreateLeague,
  onUpdateLeague,
  onDeleteLeague,
}) => {
  const [isEditingLeague, setIsEditingLeague] = useState(false);
  const [leagueName, setLeagueName] = useState('');
  const [leagueSeason, setLeagueSeason] = useState('');
  const [leagueDesc, setLeagueDesc] = useState('');
  const [isLeagueFormOpen, setIsLeagueFormOpen] = useState(false);

  const resetLeagueForm = () => {
    setIsEditingLeague(false);
    setLeagueName('');
    setLeagueSeason('');
    setLeagueDesc('');
  };

  const closeLeagueForm = () => {
    setIsLeagueFormOpen(false);
    resetLeagueForm();
  };

  const handleOpenCreateLeague = () => {
    resetLeagueForm();
    setIsLeagueFormOpen(true);
  };

  const handleSaveLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leagueName.trim() || (isEditingLeague && !activeLeagueId)) return;

    if (isEditingLeague) {
      await onUpdateLeague(activeLeagueId, {
        name: leagueName.trim(),
        season: leagueSeason.trim(),
        description: leagueDesc.trim(),
      });
    } else {
      await onCreateLeague({
        name: leagueName.trim(),
        season: leagueSeason.trim(),
        description: leagueDesc.trim(),
        is_active: true,
        created_by: effectiveEmail ? effectiveEmail.trim().toLowerCase() : undefined,
      });
    }

    // Close and clear the form only after the database operation succeeds.
    closeLeagueForm();
  };

  const handleStartEditLeague = (league: League) => {
    onSelectLeague(league.id);
    setLeagueName(league.name);
    setLeagueSeason(league.season || '');
    setLeagueDesc(league.description || '');
    setIsEditingLeague(true);
    setIsLeagueFormOpen(true);
  };

  const handleCancelEdit = () => {
    closeLeagueForm();
  };

  return (
    <div>
      {/* Create/Edit League Modal */}
      {isLeagueFormOpen && (
        <ModalBackdrop
          className="league-league-modal-overlay"
          onEscape={closeLeagueForm}
          role="presentation"
        >
          <div
            className="league-card league-league-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="league-form-modal-title"
          >
            <div className="league-league-modal-header">
              <h3 id="league-form-modal-title" className="league-card-title">
                <i className="fas fa-plus-circle" style={{ color: '#38bdf8' }}></i>
                <span>{isEditingLeague ? 'แก้ไขข้อมูลลีก' : 'สร้างลีกการแข่งขันใหม่'}</span>
              </h3>
              <button
                type="button"
                className="league-btn-secondary modal-header-close"
                onClick={closeLeagueForm}
                autoFocus
                aria-label="ปิดฟอร์มลีก"
              >
                <i className="fas fa-times"></i> ปิด
              </button>
            </div>

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
          <div className="league-league-modal-actions">
            <button type="submit" className="league-btn-primary" disabled={loading}>
              <i className="fas fa-save"></i>
              <span>{isEditingLeague ? 'บันทึกการแก้ไข' : 'สร้างลีก'}</span>
            </button>
            <button type="button" className="league-btn-secondary" onClick={handleCancelEdit}>
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
        </ModalBackdrop>
      )}

      {/* List of Leagues */}
      <div className="league-card">
        <div className="league-league-list-header">
          <h3 className="league-card-title">
            <i className="fas fa-trophy" style={{ color: '#f59e0b' }}></i>
            <span>รายการลีกทั้งหมดในระบบ</span>
          </h3>
          <button type="button" className="league-btn-primary" onClick={handleOpenCreateLeague}>
            <i className="fas fa-plus"></i>
            <span>สร้างลีก</span>
          </button>
        </div>
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
                          onClick={() => onSelectLeague(l.id)}
                        >
                          เลือกใช้งาน
                        </button>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="league-btn-icon"
                        onClick={() => handleStartEditLeague(l)}
                        title="แก้ไข"
                      >
                        <i className="fas fa-edit" style={{ color: '#38bdf8' }}></i>
                      </button>
                      <button
                        type="button"
                        className="league-btn-icon"
                        onClick={() => {
                          if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบลีก "${l.name}"? ข้อมูลทีมและแมตช์ทั้งหมดจะถูกลบไปด้วย!`)) {
                            onDeleteLeague(l.id);
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
  );
};

export default LeagueTab;
