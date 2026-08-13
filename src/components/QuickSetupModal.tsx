import type { FirebaseSaveTarget } from '../utils/excelParser';

interface QuickSetupModalProps {
  isOpen: boolean;
  targets: FirebaseSaveTarget[];
  selectedTargetId: string;
  tickerSpeed: number;
  closeLabel: string;
  onTargetChange: (targetId: string) => void;
  onTickerSpeedChange: (speed: number) => void;
  onOpenObsSetup: () => void;
  onCopyOverlay: (viewType: string, standaloneFile?: string) => void;
  onOpenDatabase: () => void;
  onClose: () => void;
}

export default function QuickSetupModal({
  isOpen,
  targets,
  selectedTargetId,
  tickerSpeed,
  closeLabel,
  onTargetChange,
  onTickerSpeedChange,
  onOpenObsSetup,
  onCopyOverlay,
  onOpenDatabase,
  onClose,
}: QuickSetupModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <h3><i className="fas fa-sliders"></i> Quick Setup</h3>
        <p style={{ color: 'var(--text-muted-color)', marginBottom: '12px' }}>คัดลอก Overlay URL ไปใส่เป็น Browser Source ใน OBS Studio</p>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>เลือกลีกฟุตบอล:</label>
          <select style={{ width: '100%' }} value={selectedTargetId} onChange={(event) => onTargetChange(event.target.value)}>
            {targets.length === 0 ? <option value="">⚠️ โหลดไฟล์ Excel ก่อน</option> : targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="btn-primary" style={{ background: '#3b82f6', borderColor: '#3b82f6', fontWeight: 'bold' }} onClick={onOpenObsSetup}><i className="fas fa-download"></i> 📦 ดาวน์โหลด OBS Scene Collection</button>
          <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 0' }}></div>
          <button className="btn-primary" onClick={() => onCopyOverlay('table')}><i className="fas fa-table"></i> Copy League Table URL</button>
          <button className="btn-success" onClick={() => onCopyOverlay('results')}><i className="fas fa-list"></i> Copy Match Results URL</button>
          <button className="btn-primary" style={{ background: '#0ea5e9', borderColor: '#0ea5e9', fontWeight: 'bold' }} onClick={() => onCopyOverlay('combined', 'all-score-combined')}><i className="fas fa-trophy"></i> Copy Combined All Score & Table URL</button>
          <div style={{ padding: '10px 12px', backgroundColor: '#262626', borderRadius: '6px', border: '1px solid #ffb74d' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#ffb74d', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}><i className="fas fa-gauge-high"></i> ตั้งค่าความเร็วการวิ่งของตัวหนังสือ (Live Ticker):</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              <select style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', backgroundColor: '#1e1e1e', color: '#fff', border: '1px solid #555', fontSize: '13px' }} value={tickerSpeed} onChange={(event) => onTickerSpeedChange(parseInt(event.target.value, 10) || 75)}>
                <option value={150}>🐢 ช้ามากพิเศษ (Ultra Slow - 150s)</option><option value={120}>🐢 ช้ามาก (Very Slow - 120s)</option><option value={90}>🚶 ช้า / อ่านง่าย (Slow - 90s)</option><option value={75}>✨ ปานกลาง (Normal - 75s) [แนะนำ]</option><option value={50}>🏃 ค่อนข้างเร็ว (Medium - 50s)</option><option value={35}>⚡ เร็ว (Fast - 35s)</option>
              </select>
              <span style={{ fontSize: '12px', color: '#aaa', whiteSpace: 'nowrap' }}>{tickerSpeed} วินาที/รอบ</span>
            </div>
            <button className="btn-warning" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onCopyOverlay('ticker')}><i className="fas fa-tv"></i> Copy Live Ticker URL (ความเร็ว {tickerSpeed}s)</button>
          </div>
          <button className="btn-secondary" style={{ background: '#8b5cf6', borderColor: '#8b5cf6' }} onClick={onOpenDatabase}><i className="fas fa-database"></i> จัดการฐานข้อมูล (Firebase)</button>
        </div>
        <div style={{ marginTop: '16px', textAlign: 'right' }}><button className="btn-secondary" onClick={onClose}>{closeLabel}</button></div>
      </div>
    </div>
  );
}
