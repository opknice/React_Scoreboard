import { useState } from 'react';
import { useTimerSnapshot, type TimerStore } from '../hooks/useTimer';
import ModalBackdrop from './ModalBackdrop';
import type {
  LeagueDetailLabelKey,
  LeagueDetailLabels,
} from '../types/leagueDetailLabels';

interface ScoreboardSettingsTranslations {
  settings: string;
  detailsDesc: string;
  save: string;
  close: string;
}

interface ScoreboardSettingsModalProps {
  isOpen: boolean;
  trans: ScoreboardSettingsTranslations;
  detailsTemplate: string;
  nameA: string;
  nameB: string;
  scoreA: number;
  scoreB: number;
  timer: TimerStore;
  label1: string;
  label2: string;
  label3: string;
  detailLabels: LeagueDetailLabels;
  onTemplateChange: (value: string) => void;
  onOpenDetailLabels: () => void;
  onPreview: (template: string) => string;
  onSave: () => void | Promise<void>;
  onClose: () => void;
}

const TAGS = [
  ['<TeamA>', 'ชื่อทีม A'], ['<TeamB>', 'ชื่อทีม B'], ['<score_team_a>', 'คะแนน A'], ['<score_team_b>', 'คะแนน B'],
  ['<thai_date>', 'วันที่'], ['<time_counter>', 'เวลา'], ['<half_text>', 'ครึ่งเวลา'],
  ['<label1>', 'Label 1'], ['<label2>', 'Label 2'], ['<label3>', 'Label 3'],
  ['<label4>', 'Label 4'], ['<label5>', 'Label 5'], ['<label6>', 'Label 6'], ['<label7>', 'Label 7'],
  ['<label8>', 'Label 8'], ['<label9>', 'Label 9'], ['<label10>', 'Label 10'],
] as const;

const DETAIL_LABEL_FIELDS: ReadonlyArray<readonly [LeagueDetailLabelKey, string]> = [
  ['label4', 'Label 4'],
  ['label5', 'Label 5'],
  ['label6', 'Label 6'],
  ['label7', 'Label 7'],
  ['label8', 'Label 8'],
  ['label9', 'Label 9'],
  ['label10', 'Label 10'],
];

export default function ScoreboardSettingsModal({ isOpen, trans, detailsTemplate, nameA, nameB, scoreA, scoreB, timer, label1, label2, label3, detailLabels, onTemplateChange, onOpenDetailLabels, onPreview, onSave, onClose }: ScoreboardSettingsModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const { formattedTime, half } = useTimerSnapshot(timer);
  if (!isOpen) return null;

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSave();
    } catch {
      // The parent reports persistence errors; keep the modal open for retry.
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = () => {
    setPreviewText(onPreview(detailsTemplate));
    setIsPreviewOpen(true);
  };

  return (
    <>
      <ModalBackdrop className="modal-overlay" onEscape={onClose}>
        <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '620px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}><i className="fas fa-cog"></i> {trans.settings}</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap', marginLeft: 'auto' }}>
            <button type="button" className="btn-primary" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? 'กำลังบันทึก...' : trans.save}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSaving}>
              {trans.close}
            </button>
          </div>
        </div>
        <p style={{ color: 'var(--text-muted-color)', marginBottom: '12px' }}>{trans.detailsDesc}</p>
        <div style={{ marginBottom: '12px' }}><div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-color)', marginBottom: '6px' }}><i className="fas fa-tags"></i> คลิก Tag ด้านล่างเพื่อแทรกในข้อความอัตโนมัติ:</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{TAGS.map(([tag, label]) => <button key={tag} type="button" style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid var(--accent-color)', color: '#60a5fa', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => onTemplateChange(detailsTemplate + tag)} title={`คลิกเพื่อแทรก ${tag} (${label})`}><code style={{ fontWeight: 'bold' }}>{tag}</code><span style={{ fontSize: '0.75rem', opacity: 0.85 }}>({label})</span></button>)}</div></div>
        <textarea style={{ width: '100%', minHeight: '110px', resize: 'vertical', fontFamily: 'sans-serif', padding: '10px' }} value={detailsTemplate} onChange={(event) => onTemplateChange(event.target.value)} placeholder="ตัวอย่าง: 🔴 <thai_date> | <TeamA> <score_team_a> - <score_team_b> <TeamB>" />
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn-secondary" onClick={handlePreview} disabled={isSaving}>
            <i className="fas fa-eye" aria-hidden="true"></i> แสดง Preview
          </button>
          <button type="button" className="btn-secondary" onClick={onOpenDetailLabels} disabled={isSaving}>
            <i className="fas fa-tags" aria-hidden="true"></i> เพิ่มข้อความ Label 4-10
          </button>
        </div>
        <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#f3f4f6' }}><i className="fas fa-info-circle"></i> คำอธิบาย Tags & ตัวอย่าง:</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', color: 'var(--text-muted-color)', marginBottom: '10px' }}><div><code>&lt;TeamA&gt;</code> : ชื่อทีม A ({nameA})</div><div><code>&lt;TeamB&gt;</code> : ชื่อทีม B ({nameB})</div><div><code>&lt;score_team_a&gt;</code> : คะแนนทีม A ({scoreA})</div><div><code>&lt;score_team_b&gt;</code> : คะแนนทีม B ({scoreB})</div><div><code>&lt;thai_date&gt;</code> : วันที่ปัจจุบันรูปแบบไทย</div><div><code>&lt;time_counter&gt;</code> : เวลาแข่งขัน ({formattedTime})</div><div><code>&lt;half_text&gt;</code> : ครึ่งเวลา ({half})</div><div><code>&lt;label1&gt;</code> : ข้อความ Label 1 ({label1 || '-'})</div><div><code>&lt;label2&gt;</code> : ข้อความ Label 2 ({label2 || '-'})</div><div><code>&lt;label3&gt;</code> : ข้อความ Label 3 ({label3 || '-'})</div>{DETAIL_LABEL_FIELDS.map(([key, label]) => <div key={key}><code>&lt;{key}&gt;</code> : ข้อความ {label} ({detailLabels[key] || '-'})</div>)}</div>
        </div>
        </div>
      </ModalBackdrop>
      {isPreviewOpen && (
        <ModalBackdrop
          className="modal-overlay"
          style={{ zIndex: 1100 }}
          onEscape={() => setIsPreviewOpen(false)}
          role="presentation"
        >
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="details-preview-title"
            onClick={(event) => event.stopPropagation()}
            style={{ maxWidth: '620px' }}
          >
            <h3 id="details-preview-title">
              <i className="fas fa-eye" aria-hidden="true"></i> Preview ข้อความ
            </h3>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'sans-serif', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.25)' }}>
              {previewText || 'ยังไม่มีข้อความสำหรับ Preview'}
            </pre>
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setIsPreviewOpen(false)}>ปิด</button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </>
  );
}
