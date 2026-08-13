interface PresetTimeModalProps {
  isOpen: boolean;
  minutes: number;
  seconds: number;
  title: string;
  closeLabel: string;
  onMinutesChange: (value: number) => void;
  onSecondsChange: (value: number) => void;
  onSetCountdown: (totalSeconds: number, applyNow: boolean) => void;
  onSetPreset: (minutes: number) => void;
  onClose: () => void;
}

export default function PresetTimeModal({ isOpen, minutes, seconds, title, closeLabel, onMinutesChange, onSecondsChange, onSetCountdown, onSetPreset, onClose }: PresetTimeModalProps) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <h3><i className="fas fa-clock"></i> {title}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[0, 15, 20, 25, 30, 35, 40, 45].map((value) => <button key={value} className="btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => onSetPreset(value)}><i className="fas fa-clock"></i> {value === 0 ? '0 นาที' : `${value} นาที`}</button>)}
        </div>
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <p style={{ color: 'var(--text-muted-color)', fontSize: '0.85rem', margin: '0 0 8px 0' }}>หรือกำหนดเวลาเอง (นาที : วินาที):</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="number" min="0" max="999" style={{ width: '80px', fontSize: '1.2rem', textAlign: 'center' }} value={minutes} onChange={(event) => onMinutesChange(Math.max(0, parseInt(event.target.value, 10) || 0))} />
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>:</span>
            <input type="number" min="0" max="59" style={{ width: '80px', fontSize: '1.2rem', textAlign: 'center' }} value={seconds} onChange={(event) => onSecondsChange(Math.min(59, Math.max(0, parseInt(event.target.value, 10) || 0)))} />
            <button className="btn-primary" onClick={() => onSetCountdown(minutes * 60 + seconds, false)}><i className="fas fa-save"></i> บันทึก</button>
          </div>
          <button className="btn-success" style={{ marginTop: '8px', width: '100%' }} onClick={() => onSetCountdown(minutes * 60 + seconds, true)}><i className="fas fa-sync-alt"></i> บันทึกและใช้งานทันที</button>
        </div>
        <div style={{ marginTop: '12px', textAlign: 'right' }}><button className="btn-secondary" onClick={onClose}>{closeLabel}</button></div>
      </div>
    </div>
  );
}
