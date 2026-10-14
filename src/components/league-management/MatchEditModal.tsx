import React, { useEffect, useMemo, useState } from 'react';
import type { Match, Team } from '../../config/supabaseClient';
import { getTodayDateString } from './leagueDateUtils';
import { getScheduledTeamIdsForDate } from './leagueMatchUtils';
import LeagueDatePicker from './LeagueDatePicker';
import ModalBackdrop from '../ModalBackdrop';
import { MAX_MATCH_SCORE, parseMatchScore } from '../../utils/matchScore';

type MatchStatus = 'scheduled' | 'in_progress' | 'finished' | 'postponed';

interface MatchEditFormData {
  teamAId: string;
  teamBId: string;
  scoreA: string;
  scoreB: string;
  status: MatchStatus;
  matchDate: string;
  label1: string;
  label2: string;
  label3: string;
}

const normalizeStatus = (status: string): MatchStatus => {
  if (status === 'in_progress' || status === 'finished' || status === 'postponed') {
    return status;
  }
  return 'scheduled';
};

const toFormData = (match: Match): MatchEditFormData => ({
  teamAId: match.team_a_id || '',
  teamBId: match.team_b_id || '',
  scoreA: String(match.score_a ?? 0),
  scoreB: String(match.score_b ?? 0),
  status: normalizeStatus(match.status),
  matchDate: match.match_date ? match.match_date.slice(0, 10) : getTodayDateString(),
  label1: match.label1 || '',
  label2: match.label2 || '',
  label3: match.label3 || '',
});

export interface MatchEditModalProps {
  isOpen: boolean;
  match: Match | null;
  teams: Team[];
  matches: Match[];
  loading: boolean;
  onSave: (matchId: string, updates: Partial<Match>) => Promise<Match | null>;
  onClose: () => void;
}

export const MatchEditModal: React.FC<MatchEditModalProps> = ({
  isOpen,
  match,
  teams,
  matches,
  loading,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState<MatchEditFormData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && match) {
      setFormData(toFormData(match));
      setErrorMessage('');
      setIsSaving(false);
    }
  }, [isOpen, match]);

  const scheduledTeamIdsForDate = useMemo(
    () => getScheduledTeamIdsForDate(matches, formData?.matchDate ?? '', match?.id),
    [formData?.matchDate, match?.id, matches],
  );

  const isScheduledDuplicate = (teamId: string): boolean => scheduledTeamIdsForDate.has(teamId);

  if (!isOpen || !match || !formData) return null;

  const isSubmitting = loading || isSaving;

  const updateField = <K extends keyof MatchEditFormData>(field: K, value: MatchEditFormData[K]) => {
    setFormData((current) => current ? { ...current, [field]: value } : current);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const scoreA = parseMatchScore(formData.scoreA);
    const scoreB = parseMatchScore(formData.scoreB);

    if (!formData.teamAId || !formData.teamBId) {
      setErrorMessage('กรุณาเลือกทีม A และทีม B');
      return;
    }
    if (formData.teamAId === formData.teamBId) {
      setErrorMessage('ทีม A และทีม B ต้องไม่เป็นทีมเดียวกัน');
      return;
    }
    if (scoreA === null || scoreB === null) {
      setErrorMessage(`สกอร์ต้องเป็นจำนวนเต็มระหว่าง 0 ถึง ${MAX_MATCH_SCORE.toLocaleString()}`);
      return;
    }

    const teamA = teams.find((team) => team.id === formData.teamAId);
    const teamB = teams.find((team) => team.id === formData.teamBId);

    setIsSaving(true);
    try {
      await onSave(match.id, {
        team_a_id: formData.teamAId,
        team_b_id: formData.teamBId,
        team_a_name: teamA?.name || match.team_a_name,
        team_b_name: teamB?.name || match.team_b_name,
        score_a: scoreA,
        score_b: scoreB,
        status: formData.status,
        match_date: formData.matchDate.trim() || null,
        label1: formData.label1.trim(),
        label2: formData.label2.trim(),
        label3: formData.label3.trim(),
      });
      setIsSaving(false);
      onClose();
    } catch (error: unknown) {
      setIsSaving(false);
      setErrorMessage(error instanceof Error ? error.message : 'ไม่สามารถบันทึกข้อมูลการแข่งขันได้');
    }
  };

  return (
    <ModalBackdrop
      className="league-match-edit-modal-overlay"
      onEscape={isSubmitting ? undefined : onClose}
      role="presentation"
    >
      <div
        className="league-card league-match-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="league-match-edit-modal-title"
      >
        <div className="league-match-edit-modal-header">
          <div>
            <h3 id="league-match-edit-modal-title" className="league-card-title">
              <i className="fas fa-edit" style={{ color: '#38bdf8' }}></i>
              <span>แก้ไขข้อมูลการแข่งขัน</span>
            </h3>
            <p className="league-database-modal-subtitle">แก้ไขข้อมูลการแข่งขันที่เลือก</p>
          </div>
          <button type="button" className="league-btn-secondary modal-header-close" onClick={onClose} autoFocus aria-label="ปิดฟอร์มแก้ไข">
            <i className="fas fa-times"></i> ปิด
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="league-form-grid">
            <div className="league-form-group">
              <label htmlFor="edit-match-team-a">ทีม A *</label>
              <select
                id="edit-match-team-a"
                className={`league-form-select${isScheduledDuplicate(formData.teamAId) ? ' league-form-select--duplicate' : ''}`}
                value={formData.teamAId}
                onChange={(e) => updateField('teamAId', e.target.value)}
                required
              >
                <option value="">-- เลือกทีม A --</option>
                {teams.map((team) => (
                  <option
                    key={team.id}
                    value={team.id}
                    className={isScheduledDuplicate(team.id) ? 'league-team-duplicate-option' : undefined}
                  >
                    {team.name}{isScheduledDuplicate(team.id) ? ' (มีแข่งในวันที่เลือกแล้ว)' : ''}
                  </option>
                ))}
              </select>
              {isScheduledDuplicate(formData.teamAId) ? (
                <small className="league-form-help-text league-form-help-text--warning" role="status">
                  ทีมนี้มีแมตช์สถานะ scheduled ในวันที่เลือกแล้ว
                </small>
              ) : null}
            </div>
            <div className="league-form-group">
              <label htmlFor="edit-match-team-b">ทีม B *</label>
              <select
                id="edit-match-team-b"
                className={`league-form-select${isScheduledDuplicate(formData.teamBId) ? ' league-form-select--duplicate' : ''}`}
                value={formData.teamBId}
                onChange={(e) => updateField('teamBId', e.target.value)}
                required
              >
                <option value="">-- เลือกทีม B --</option>
                {teams.map((team) => (
                  <option
                    key={team.id}
                    value={team.id}
                    disabled={team.id === formData.teamAId}
                    className={isScheduledDuplicate(team.id) ? 'league-team-duplicate-option' : undefined}
                  >
                    {team.name}{team.id === formData.teamAId ? ' (เลือกเป็นทีมเหย้าแล้ว)' : ''}{isScheduledDuplicate(team.id) ? ' (มีแข่งในวันที่เลือกแล้ว)' : ''}
                  </option>
                ))}
              </select>
              {isScheduledDuplicate(formData.teamBId) ? (
                <small className="league-form-help-text league-form-help-text--warning" role="status">
                  ทีมนี้มีแมตช์สถานะ scheduled ในวันที่เลือกแล้ว
                </small>
              ) : null}
            </div>
            <div className="league-form-group">
              <label htmlFor="edit-match-status">สถานะการแข่งขัน</label>
              <select
                id="edit-match-status"
                className="league-form-select"
                value={formData.status}
                onChange={(e) => updateField('status', e.target.value as MatchStatus)}
              >
                <option value="scheduled">รอแข่งขัน</option>
                <option value="in_progress">กำลังแข่งขัน</option>
                <option value="finished">จบการแข่งขัน</option>
                <option value="postponed">เลื่อนการแข่งขัน</option>
              </select>
            </div>
          </div>

          <div className="league-form-grid">
            <div className="league-form-group">
              <LeagueDatePicker
                value={formData.matchDate}
                onChange={(value) => updateField('matchDate', value)}
                label="วันที่แข่งขัน (Match Date)"
                helperText="ใช้จัดกลุ่มแมตช์ตามวันที่ในหน้า Overlay / OBS"
              />
            </div>
            <div className="league-form-group">
              <label>สกอร์</label>
              <div className="league-match-edit-score-inputs">
                <input
                  type="number"
                  min="0"
                  max={MAX_MATCH_SCORE}
                  step="1"
                  className="league-form-input"
                  aria-label="สกอร์ทีม A"
                  value={formData.scoreA}
                  onChange={(e) => updateField('scoreA', e.target.value)}
                />
                <span>-</span>
                <input
                  type="number"
                  min="0"
                  max={MAX_MATCH_SCORE}
                  step="1"
                  className="league-form-input"
                  aria-label="สกอร์ทีม B"
                  value={formData.scoreB}
                  onChange={(e) => updateField('scoreB', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="league-form-grid">
            <div className="league-form-group">
              <label htmlFor="edit-match-label1">รอบการแข่งขัน</label>
              <input id="edit-match-label1" className="league-form-input" value={formData.label1} onChange={(e) => updateField('label1', e.target.value)} />
            </div>
            <div className="league-form-group">
              <label htmlFor="edit-match-label2">สัปดาห์ / วันแข่ง</label>
              <input id="edit-match-label2" className="league-form-input" value={formData.label2} onChange={(e) => updateField('label2', e.target.value)} />
            </div>
            <div className="league-form-group">
              <label htmlFor="edit-match-label3">สนามแข่งขัน</label>
              <input id="edit-match-label3" className="league-form-input" value={formData.label3} onChange={(e) => updateField('label3', e.target.value)} />
            </div>
          </div>

          {errorMessage && <p className="league-form-error" role="alert">{errorMessage}</p>}

          <div className="league-match-edit-actions">
            <button type="submit" className="league-btn-primary" disabled={isSubmitting}>
              <i className={`fas ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
              <span>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</span>
            </button>
            <button type="button" className="league-btn-secondary" onClick={onClose} disabled={isSubmitting}>
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
    </ModalBackdrop>
  );
};

export default MatchEditModal;
