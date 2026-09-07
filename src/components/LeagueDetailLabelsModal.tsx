import { useEffect, useState } from 'react';
import type {
  LeagueDetailLabelKey,
  LeagueDetailLabels,
} from '../types/leagueDetailLabels';
import ModalBackdrop from './ModalBackdrop';

interface LeagueDetailLabelsModalProps {
  isOpen: boolean;
  activeLeagueId: string;
  initialLabels: LeagueDetailLabels;
  onSave: (labels: LeagueDetailLabels) => Promise<void>;
  onClose: () => void;
}

const DETAIL_LABEL_FIELDS: ReadonlyArray<readonly [LeagueDetailLabelKey, string]> = [
  ['label4', 'Label 4'],
  ['label5', 'Label 5'],
  ['label6', 'Label 6'],
  ['label7', 'Label 7'],
  ['label8', 'Label 8'],
  ['label9', 'Label 9'],
  ['label10', 'Label 10'],
];

export default function LeagueDetailLabelsModal({
  isOpen,
  activeLeagueId,
  initialLabels,
  onSave,
  onClose,
}: LeagueDetailLabelsModalProps) {
  const [draftLabels, setDraftLabels] = useState<LeagueDetailLabels>(initialLabels);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setDraftLabels(initialLabels);
  }, [activeLeagueId, initialLabels, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!activeLeagueId || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(draftLabels);
      onClose();
    } catch {
      // The parent reports the persistence error and keeps this modal open for retry.
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalBackdrop
      className="modal-overlay"
      style={{ zIndex: 1100 }}
      onEscape={isSaving ? undefined : onClose}
      role="presentation"
    >
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="league-detail-labels-modal-title"
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: '620px' }}
      >
        <h3 id="league-detail-labels-modal-title">
          <i className="fas fa-tags" aria-hidden="true"></i>
          ข้อความ Label ระดับ League
        </h3>
        <p style={{ color: 'var(--text-muted-color)', marginBottom: '12px' }}>
          ข้อความเหล่านี้จะถูกบันทึกแยกตาม League และส่งไปยัง OBS Sources ที่มีอยู่แล้ว
        </p>

        <div style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
            {DETAIL_LABEL_FIELDS.map(([key, label]) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem' }}>
                <span>{label}</span>
                <input
                  type="text"
                  value={draftLabels[key]}
                  disabled={!activeLeagueId || isSaving}
                  onChange={(event) => setDraftLabels((current) => ({ ...current, [key]: event.target.value }))}
                  placeholder={`ข้อความ ${label}`}
                  style={{ width: '100%', padding: '7px 8px' }}
                />
              </label>
            ))}
          </div>
          {!activeLeagueId && (
            <div style={{ marginTop: '8px', color: 'var(--text-muted-color)', fontSize: '0.8rem' }}>
              กรุณาเลือก League ก่อนบันทึก Label 4–10
            </div>
          )}
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void handleSave()}
            disabled={!activeLeagueId || isSaving}
          >
            {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isSaving}>
            ยกเลิก
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
