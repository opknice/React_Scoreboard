interface ObsSetupModalProps {
  isOpen: boolean;
  closeLabel: string;
  onDownload: () => void;
  onClose: () => void;
}

export default function ObsSetupModal({ isOpen, closeLabel, onDownload, onClose }: ObsSetupModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '600px' }} onClick={(event) => event.stopPropagation()}>
        <h3><i className="fas fa-download"></i> ดาวน์โหลด OBS Scene Collection</h3>
        <div style={{ marginBottom: '20px', padding: '20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '12px' }}>📦</div>
          <button className="btn-primary" onClick={onDownload} style={{ fontSize: '1.1rem', padding: '14px 32px', background: '#fff', color: '#667eea', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}><i className="fas fa-download"></i> ดาวน์โหลด React.json</button>
          <p style={{ margin: '12px 0 0 0', fontSize: '0.85rem', color: '#e0e7ff' }}>ขนาดไฟล์: ~318KB | รองรับ OBS Studio 28+<br /><small style={{ fontSize: '0.75rem', opacity: 0.8 }}>คลิกเพื่อคัดลอก URL → เปิด Chrome → Paste (Ctrl+V)</small></p>
        </div>
        <div style={{ padding: '16px', background: '#0f172a', borderRadius: '8px', fontSize: '0.9rem' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '8px' }}><i className="fas fa-list-ol"></i> ขั้นตอนการติดตั้ง</h4>
          <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8', color: '#cbd5e1' }}><li>คลิกปุ่ม <strong>"ดาวน์โหลด React.json"</strong> ด้านบน</li><li>เปิด <strong>OBS Studio</strong></li><li>ไปที่เมนู <strong>Scene Collection → Import</strong></li><li>เลือกไฟล์ <strong>React.json</strong> ที่ดาวน์โหลดมา</li><li>OBS จะสร้าง Scene Collection ใหม่ชื่อ <strong>"React"</strong></li><li>เปลี่ยนไปใช้ Scene Collection <strong>"React"</strong></li><li>เสร็จสิ้น! สามารถใช้งานได้ทันที 🎉</li></ol>
        </div>
        <div style={{ marginTop: '16px', padding: '12px', background: '#064e3b', borderRadius: '6px', borderLeft: '4px solid #10b981', fontSize: '0.85rem', color: '#a7f3d0' }}><strong style={{ color: '#6ee7b7' }}>เคล็ดลับ:</strong> หลัง Import แล้ว Sources ทั้งหมดจะเชื่อมต่อกับ Controller นี้อัตโนมัติผ่าน OBS WebSocket คุณสามารถปรับตำแหน่ง ขนาด หรือสีของ Sources ใน OBS ได้ตามต้องการ<br /><br /><strong style={{ color: '#fbbf24' }}>วิธีดาวน์โหลด:</strong> คลิกปุ่มดาวน์โหลด → เปิด Chrome → วาง URL ที่ Address Bar → กด Enter</div>
        <div style={{ marginTop: '20px', textAlign: 'right' }}><button className="btn-secondary" onClick={onClose}>{closeLabel}</button></div>
      </div>
    </div>
  );
}
