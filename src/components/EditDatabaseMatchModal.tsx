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
  const updateDraft = (updates: Partial<DatabaseMatch>) => setDraft((previous) => previous ? { ...previous, ...updates } : previous);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <h3><i className="fas fa-edit"></i> แก้ไขผลการแข่งขันในฐานข้อมูล</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ display: 'block' }}>วันที่:<input type="text" value={draft.date || ''} onChange={(event) => updateDraft({ date: event.target.value })} style={{ width: '100%' }} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}><label>ทีม A:<input type="text" value={draft.teamA || ''} onChange={(event) => updateDraft({ teamA: event.target.value })} style={{ width: '100%' }} /></label><label>คะแนน A:<input type="number" value={draft.scoreA ?? 0} onChange={(event) => updateDraft({ scoreA: parseInt(event.target.value, 10) || 0 })} style={{ width: '100%' }} /></label></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}><label>ทีม B:<input type="text" value={draft.teamB || ''} onChange={(event) => updateDraft({ teamB: event.target.value })} style={{ width: '100%' }} /></label><label>คะแนน B:<input type="number" value={draft.scoreB ?? 0} onChange={(event) => updateDraft({ scoreB: parseInt(event.target.value, 10) || 0 })} style={{ width: '100%' }} /></label></div>
          <label>รอบ (Round Label):<input type="text" value={draft.roundLabel || ''} onChange={(event) => updateDraft({ roundLabel: event.target.value })} style={{ width: '100%' }} /></label>
        </div>
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}><button className="btn-primary" onClick={() => onSave(draft)}>{saveLabel}</button><button className="btn-secondary" onClick={onClose}>ยกเลิก</button></div>
      </div>
    </div>
  );
}
