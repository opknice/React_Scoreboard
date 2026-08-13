import type { CSSProperties } from 'react';

interface ExcelUrlPreset { id: string; name: string; url: string; }

interface ExcelUrlModalProps {
  isOpen: boolean;
  url: string;
  name: string;
  presets: ExcelUrlPreset[];
  isLoading: boolean;
  onUrlChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onLoad: () => void;
  onSavePreset: () => void;
  onSelectPreset: (preset: ExcelUrlPreset) => void;
  onDeletePreset: (id: string) => void;
  onClose: () => void;
}

export default function ExcelUrlModal({ isOpen, url, name, presets, isLoading, onUrlChange, onNameChange, onLoad, onSavePreset, onSelectPreset, onDeletePreset, onClose }: ExcelUrlModalProps) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '540px' }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-color)' }}><i className="fas fa-link"></i> นำเข้าไฟล์ Excel จาก URL / Google Sheets</h3>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '16px', lineHeight: 1.5 }}>กรอกลิงก์ตรงไปยังไฟล์ <code>.xlsx</code> หรือวางลิงก์แชร์ของ <strong>Google Sheets</strong> (ที่เปิดสิทธิ์เป็นสากล/ทุกคนที่มีลิงก์ดูได้)</p>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '12px' }}>ตั้งชื่อบันทึก / ชื่อลีก (อุปกรณ์เสริม):<input type="text" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="เช่น พรีเมียร์ลีก 2026, ฟุตบอล อบต." style={inputStyle()} /></label>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '16px' }}>URL ลิงก์ไฟล์ Excel / Google Sheets:<div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}><input type="text" value={url} onChange={(event) => onUrlChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onLoad(); }} placeholder="https://docs.google.com/spreadsheets/d/... หรือ https://.../data.xlsx" style={{ ...inputStyle(), flex: 1 }} /><button type="button" className="btn-secondary" onClick={onSavePreset} title="บันทึก URL นี้ไว้ใช้ครั้งต่อไป" style={{ whiteSpace: 'nowrap', padding: '8px 12px', fontSize: '0.8rem' }}><i className="fas fa-bookmark"></i> บันทึก</button></div></label>
        {presets.length > 0 && <div style={{ marginBottom: '16px', background: 'rgba(15, 23, 42, 0.6)', padding: '10px 12px', borderRadius: '8px', border: '1px solid #1e293b' }}><div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}><i className="fas fa-star" style={{ color: '#f59e0b' }}></i> รายการที่บันทึกไว้ (คลิกเพื่อดึงข้อมูลทันที):</div><div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>{presets.map((preset) => <div key={preset.id} onClick={() => onSelectPreset(preset)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1e293b', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', border: '1px solid #334155' }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}><span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#38bdf8', marginRight: '8px' }}>📌 {preset.name}</span><span style={{ fontSize: '0.72rem', color: '#64748b' }}>{preset.url}</span></div><button type="button" onClick={(event) => { event.stopPropagation(); onDeletePreset(preset.id); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px 6px' }} title="ลบออกจากรายการบันทึก"><i className="fas fa-trash"></i></button></div>)}</div></div>}
        <div style={{ background: 'rgba(51, 65, 85, 0.3)', padding: '10px', borderRadius: '6px', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '20px' }}><strong>💡 คำแนะนำ Google Sheets:</strong><ul style={{ margin: '4px 0 0 0', paddingLeft: '18px' }}><li>กดปุ่ม <strong>แชร์ (Share)</strong> ➡️ เลือก <strong>"ทุกคนที่มีลิงก์ (Anyone with the link)"</strong></li><li>ก๊อปปี้ URL บนแถบเบราว์เซอร์มาวางได้ทันที ระบบจะแปลงเป็นไฟล์ Excel ให้อัตโนมัติ</li></ul></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><button className="btn-secondary" onClick={onClose} disabled={isLoading}>ยกเลิก</button><button className="btn-primary" onClick={onLoad} disabled={isLoading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{isLoading ? <><i className="fas fa-spinner fa-spin"></i><span>กำลังโหลด...</span></> : <><i className="fas fa-download"></i><span>ดึงข้อมูล</span></>}</button></div>
      </div>
    </div>
  );
}

function inputStyle(): CSSProperties { return { width: '100%', padding: '8px 12px', marginTop: '4px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: '0.85rem', boxSizing: 'border-box' }; }
