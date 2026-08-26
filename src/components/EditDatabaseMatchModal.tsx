import { useEffect, useState } from 'react';
import type { DatabaseMatch } from '../hooks/useScoreboardDatabase';

interface EditDatabaseMatchModalProps {
  match: DatabaseMatch | null;
  onSave: (match: DatabaseMatch) => void;
  onClose: () => void;
  saveLabel: string;
}

export default function EditDatabaseMatchModal({ match, onSave, onClose, saveLabel }: EditDatabaseMatchModalProps) {
  const [draft, setDraft] = useState<DatabaseMatch | null>(match);

  useEffect(() => setDraft(match), [match]);

  if (!draft) return null;

  const updateDraft = (updates: Partial<DatabaseMatch>) => {
    setDraft((previous) => previous ? { ...previous, ...updates } : previous);
  };

  const isNewMatch = !draft.id;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <h3><i className="fas fa-edit"></i> {isNewMatch ? 'เพิ่ม' : 'แก้ไข'}ข้อมูลแมตช์ในฐานข้อมูล</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ display: 'block' }}>
            วันที่:
            <input type="date" value={draft.date || ''} onChange={(event) => updateDraft({ date: event.target.value })} style={{ width: '100%' }} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <label>
              ทีม A:
              <input type="text" value={draft.teamA || ''} onChange={(event) => updateDraft({ teamA: event.target.value })} style={{ width: '100%' }} />
            </label>
            <label>
              คะแนน A:
              <input type="number" min="0" value={draft.scoreA ?? 0} onChange={(event) => updateDraft({ scoreA: event.target.value })} style={{ width: '100%' }} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <label>
              ทีม B:
              <input type="text" value={draft.teamB || ''} onChange={(event) => updateDraft({ teamB: event.target.value })} style={{ width: '100%' }} />
            </label>
            <label>
              คะแนน B:
              <input type="number" min="0" value={draft.scoreB ?? 0} onChange={(event) => updateDraft({ scoreB: event.target.value })} style={{ width: '100%' }} />
            </label>
          </div>

          <label>
            รอบ (Round Label):
            <input type="text" value={draft.roundLabel || ''} onChange={(event) => updateDraft({ roundLabel: event.target.value })} style={{ width: '100%' }} />
          </label>

          <label>
            Match URL:
            <input type="url" value={draft.url || ''} onChange={(event) => updateDraft({ url: event.target.value })} style={{ width: '100%' }} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <label>
              Logo ทีม A:
              <input type="url" value={draft.logoA || ''} onChange={(event) => updateDraft({ logoA: event.target.value })} style={{ width: '100%' }} />
            </label>
            <label>
              Logo ทีม B:
              <input type="url" value={draft.logoB || ''} onChange={(event) => updateDraft({ logoB: event.target.value })} style={{ width: '100%' }} />
            </label>
          </div>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={() => onSave(draft)}>{isNewMatch ? 'เพิ่มข้อมูล' : saveLabel}</button>
          <button className="btn-secondary" onClick={onClose}>ยกเลิก</button>
        </div>
      </div>
    </div>
  );
}
