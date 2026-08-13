interface ScoreboardSettingsModalProps {
  isOpen: boolean;
  trans: any;
  detailsTemplate: string;
  nameA: string;
  nameB: string;
  scoreA: number;
  scoreB: number;
  formattedTime: string;
  half: string;
  label1: string;
  label2: string;
  label3: string;
  onTemplateChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

const TAGS = [
  ['<TeamA>', 'ชื่อทีม A'], ['<TeamB>', 'ชื่อทีม B'], ['<score_team_a>', 'คะแนน A'], ['<score_team_b>', 'คะแนน B'],
  ['<thai_date>', 'วันที่'], ['<time_counter>', 'เวลา'], ['<half_text>', 'ครึ่งเวลา'], ['<label1>', 'Label 1'], ['<label2>', 'Label 2'], ['<label3>', 'Label 3'],
];

export default function ScoreboardSettingsModal({ isOpen, trans, detailsTemplate, nameA, nameB, scoreA, scoreB, formattedTime, half, label1, label2, label3, onTemplateChange, onSave, onClose }: ScoreboardSettingsModalProps) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '620px' }}>
        <h3><i className="fas fa-cog"></i> {trans.settings}</h3>
        <p style={{ color: 'var(--text-muted-color)', marginBottom: '12px' }}>{trans.detailsDesc}</p>
        <div style={{ marginBottom: '12px' }}><div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-color)', marginBottom: '6px' }}><i className="fas fa-tags"></i> คลิก Tag ด้านล่างเพื่อแทรกในข้อความอัตโนมัติ:</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{TAGS.map(([tag, label]) => <button key={tag} type="button" style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid var(--accent-color)', color: '#60a5fa', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => onTemplateChange(detailsTemplate + tag)} title={`คลิกเพื่อแทรก ${tag} (${label})`}><code style={{ fontWeight: 'bold' }}>{tag}</code><span style={{ fontSize: '0.75rem', opacity: 0.85 }}>({label})</span></button>)}</div></div>
        <textarea style={{ width: '100%', minHeight: '110px', resize: 'vertical', fontFamily: 'sans-serif', padding: '10px' }} value={detailsTemplate} onChange={(event) => onTemplateChange(event.target.value)} placeholder="ตัวอย่าง: 🔴 <thai_date> | <TeamA> <score_team_a> - <score_team_b> <TeamB>" />
        <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#f3f4f6' }}><i className="fas fa-info-circle"></i> คำอธิบาย Tags & ตัวอย่าง:</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', color: 'var(--text-muted-color)', marginBottom: '10px' }}><div><code>&lt;TeamA&gt;</code> : ชื่อทีม A ({nameA})</div><div><code>&lt;TeamB&gt;</code> : ชื่อทีม B ({nameB})</div><div><code>&lt;score_team_a&gt;</code> : คะแนนทีม A ({scoreA})</div><div><code>&lt;score_team_b&gt;</code> : คะแนนทีม B ({scoreB})</div><div><code>&lt;thai_date&gt;</code> : วันที่ปัจจุบันรูปแบบไทย</div><div><code>&lt;time_counter&gt;</code> : เวลาแข่งขัน ({formattedTime})</div><div><code>&lt;half_text&gt;</code> : ครึ่งเวลา ({half})</div><div><code>&lt;label1&gt;</code> : ข้อความ Label 1 ({label1 || '-'})</div><div><code>&lt;label2&gt;</code> : ข้อความ Label 2 ({label2 || '-'})</div><div><code>&lt;label3&gt;</code> : ข้อความ Label 3 ({label3 || '-'})</div></div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(0,0,0,0.25)', padding: '8px 10px', borderRadius: '6px', flexWrap: 'wrap' }}><span style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: 600 }}>ตัวอย่าง:</span><code style={{ color: '#34d399', flex: 1, fontSize: '0.78rem' }}>⚽ &lt;TeamA&gt; &lt;score_team_a&gt; - &lt;score_team_b&gt; &lt;TeamB&gt; (เวลา &lt;time_counter&gt;)</code><button type="button" style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }} onClick={() => onTemplateChange('🔴 ผลการแข่งขัน <thai_date>\n⚽ <TeamA> <score_team_a> - <score_team_b> <TeamB>\n⏱ เวลา: <time_counter> (<half_text>)')}><i className="fas fa-magic"></i> ใส่ตัวอย่างนี้</button></div>
        </div>
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}><button className="btn-primary" onClick={onSave}>{trans.save}</button><button className="btn-secondary" onClick={onClose}>{trans.close}</button></div>
      </div>
    </div>
  );
}
