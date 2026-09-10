import { useEffect, useRef, useState, type ReactNode } from 'react';
import ModalBackdrop from './ModalBackdrop';
import './BrowserSourceWorkspace.css';

const BROWSER_SOURCE_SECTIONS = [
  { id: 'player', label: 'Player', icon: 'fa-user-shield', description: 'รูปนักเตะ หมายเลข และชื่อ' },
  { id: 'team-name', label: 'Team Name', icon: 'fa-font', description: 'ชื่อทีม A และ B' },
  { id: 'team-color', label: 'Team Color', icon: 'fa-palette', description: 'สีหลักและสีรองของทีม' },
  { id: 'logo', label: 'Logo', icon: 'fa-shield-halved', description: 'โลโก้และการครอบตัด' },
  { id: 'score', label: 'Score', icon: 'fa-hashtag', description: 'คะแนนทีม A และ B' },
] as const;
export type BrowserSourceKind = typeof BROWSER_SOURCE_SECTIONS[number]['id'];

interface Props {
  selected: BrowserSourceKind;
  onSelect: (kind: BrowserSourceKind) => void;
  onBack: () => void;
  onClose: () => void;
  children: ReactNode;
  preview: ReactNode;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  obs: {
    connected: boolean;
    busy: boolean;
    message: string;
    add: () => void;
    urls: Array<{ label: string; url: string; copy: () => void }>;
  };
}

export default function BrowserSourceWorkspace({ selected, onSelect, onBack, onClose, children, preview, saveStatus, obs }: Props) {
  const [view, setView] = useState<'settings' | 'obs'>('settings');
  const dialog = useRef<HTMLDivElement>(null);
  const active = BROWSER_SOURCE_SECTIONS.find(section => section.id === selected)!;
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <ModalBackdrop className="modal-overlay browser-source-backdrop" onEscape={onBack}>
      <div className="browser-source-workspace" role="dialog" aria-modal="true" aria-labelledby="browser-source-title" ref={dialog} tabIndex={-1}
        onKeyDown={event => {
          if (event.key !== 'Tab') return;
          const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex="0"]') ?? []).filter(element => !element.hasAttribute('disabled') && element.getClientRects().length > 0);
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}>
        <header className="browser-source-header">
          <button type="button" className="btn-secondary" onClick={onBack}>← Quick Setup</button>
          <div><h2 id="browser-source-title">Custom Browser Source</h2><p>เลือกประเภท ดูตัวอย่าง และปรับการแสดงผล</p></div>
          <button type="button" className="btn-secondary" onClick={onClose} aria-label="ปิดตัวแก้ไข Browser Source">✕</button>
        </header>
        <div className="browser-source-body">
          <nav className="browser-source-nav" aria-label="ประเภท Browser Source">
            {BROWSER_SOURCE_SECTIONS.map(section => (
              <button type="button" key={section.id} aria-current={selected === section.id ? 'page' : undefined}
                onClick={() => { onSelect(section.id); setView('settings'); }}>
                <i className={`fas ${section.icon}`} aria-hidden="true" /><span>{section.label}<small>{section.description}</small></span>
              </button>
            ))}
          </nav>
          <section className="browser-source-preview-area" aria-label={`ตัวอย่าง ${active.label}`}>
            <div className="browser-source-section-heading"><h3>{active.label} Preview</h3><span>1920 × 1080</span></div>
            {preview}
            <p className="browser-source-hint">ตัวอย่างตำแหน่งและรูปแบบ · ปรับค่าจากแผงตั้งค่าเพื่อดูผลทันที</p>
          </section>
          <section className="browser-source-inspector" aria-label={`ตั้งค่า ${active.label}`}>
            <div className="browser-source-inspector-tabs" role="tablist" aria-label="แผงตั้งค่า">
              {(['settings', 'obs'] as const).map(tab => <button key={tab} type="button" role="tab" id={`source-tab-${tab}`} aria-controls={`source-panel-${tab}`} aria-selected={view === tab} tabIndex={view === tab ? 0 : -1}
                onKeyDown={event => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  const next = event.key === 'Home' ? 'settings' : event.key === 'End' ? 'obs' : view === 'settings' ? 'obs' : 'settings';
                  setView(next);
                  dialog.current?.querySelector<HTMLElement>(`#source-tab-${next}`)?.focus();
                }} onClick={() => setView(tab)}>{tab === 'settings' ? 'ตั้งค่าการแสดงผล' : 'OBS / URL'}</button>)}
            </div>
            <div className="browser-source-inspector-content" key={selected}>
              <div role="tabpanel" id="source-panel-settings" aria-labelledby="source-tab-settings" hidden={view !== 'settings'}>{children}</div>
              {view === 'obs' && <div role="tabpanel" id="source-panel-obs" aria-labelledby="source-tab-obs" className="browser-source-urls">
                <h3>{active.label} Browser Source</h3>
                <p>คัดลอก URL ไปวางใน OBS หรือเชื่อมต่อ OBS แล้วใช้ปุ่มเพิ่ม / อัปเดตด้านล่าง</p>
                {obs.urls.map(item => <div key={item.label}><label>{item.label}<input aria-label={`URL ${item.label}`} value={item.url} readOnly onFocus={event => event.target.select()} /></label><button type="button" className="btn-secondary" onClick={item.copy}>Copy {item.label}</button></div>)}
              </div>}
            </div>
          </section>
        </div>
        <footer className="browser-source-footer">
          <div role="status"><span className={obs.connected ? 'source-connected' : 'source-disconnected'}>● OBS {obs.connected ? 'เชื่อมต่อแล้ว' : 'ยังไม่เชื่อมต่อ'}</span><small>{saveStatus === 'saving' ? 'กำลังบันทึก…' : saveStatus === 'saved' ? 'บันทึกแล้ว' : saveStatus === 'error' ? 'บันทึกไม่สำเร็จ กรุณาลองใหม่' : 'ใช้ระบบบันทึกอัตโนมัติของรายการนี้'}{obs.message ? ` · ${obs.message}` : ''}</small></div>
          <button type="button" className="btn-success" disabled={!obs.connected || obs.busy} onClick={obs.add}>{obs.busy ? 'กำลังอัปเดต…' : `เพิ่ม / อัปเดต ${active.label} ใน OBS`}</button>
        </footer>
      </div>
    </ModalBackdrop>
  );
}
