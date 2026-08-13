import { useState, type CSSProperties } from 'react';
import type { CustomMacro, MacroRuntimeStatus } from '../types/macro';
import { describeMacroActions, describeMacroTrigger } from '../macros/macroSummary';

interface CustomMacroCardProps {
  isObsConnected: boolean;
  macro: CustomMacro;
  runtimeStatus?: MacroRuntimeStatus;
  onToggle: (enabled: boolean) => void;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClearLogs: () => void;
}

const STATUS_LABELS: Record<MacroRuntimeStatus, { label: string; color: string }> = {
  idle: { label: 'พร้อมทำงาน', color: '#94a3b8' },
  running: { label: 'กำลังทำงาน', color: '#fbbf24' },
  success: { label: 'สำเร็จล่าสุด', color: '#6ee7b7' },
  error: { label: 'ทำงานไม่สำเร็จ', color: '#fca5a5' },
  offline: { label: 'รอ OBS เชื่อมต่อ', color: '#fca5a5' },
};

export default function CustomMacroCard({
  isObsConnected,
  macro,
  runtimeStatus = 'idle',
  onToggle,
  onRun,
  onEdit,
  onDelete,
  onClearLogs,
}: CustomMacroCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const status = STATUS_LABELS[runtimeStatus];

  return (
    <article style={{ border: '1px solid #334155', borderLeft: `4px solid ${macro.color}`, borderRadius: 9, background: '#1e293b', padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={() => onToggle(!macro.isEnabled)}
          disabled={!isObsConnected}
          aria-label={macro.isEnabled ? 'ปิด Automation' : 'เปิด Automation'}
          style={{ width: 42, height: 24, border: 0, borderRadius: 20, padding: 3, cursor: isObsConnected ? 'pointer' : 'not-allowed', background: macro.isEnabled ? macro.color : '#475569', opacity: isObsConnected ? 1 : 0.55 }}
        >
          <span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: macro.isEnabled ? 'translateX(18px)' : 'translateX(0)', transition: 'transform .2s' }} />
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ color: '#f8fafc', fontSize: '0.95rem' }}>{macro.name}</strong>
            <span style={{ color: status.color, fontSize: '0.72rem' }}>● {status.label}</span>
          </div>
          <div style={{ color: '#7dd3fc', fontSize: '0.8rem', marginTop: 5 }}>{describeMacroTrigger(macro)}</div>
          <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 3 }}>{describeMacroActions(macro.actions)}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button type="button" title="ทดสอบ Automation" onClick={onRun} disabled={runtimeStatus === 'running'} style={{ ...smallButton('#0f766e'), opacity: runtimeStatus === 'running' ? 0.5 : 1 }}>▶</button>
          <button type="button" title="แก้ไข Automation" onClick={onEdit} style={smallButton('#334155')}>แก้ไข</button>
          <button type="button" title="แสดงรายละเอียด" onClick={() => setShowDetails((value) => !value)} style={smallButton('#334155')}>{showDetails ? 'ซ่อน' : 'รายละเอียด'}</button>
        </div>
      </div>
      {showDetails && (
        <div style={{ borderTop: '1px solid #334155', marginTop: 12, paddingTop: 12 }}>
          <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginBottom: 8 }}>ขั้นตอนการทำงาน</div>
          {macro.actions.map((action, index) => <div key={action.id} style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 4 }}>{index + 1}. {describeMacroActions([action])}</div>)}
          {macro.lastTrigger && <div style={{ color: '#6ee7b7', fontSize: '0.76rem', marginTop: 10 }}>ทำงานล่าสุด: {macro.lastTrigger}</div>}
          {macro.logs?.length > 0 && <details style={{ marginTop: 10 }}><summary style={{ cursor: 'pointer', color: '#cbd5e1', fontSize: '0.78rem' }}>Activity Logs ({macro.logs.length})</summary><div style={{ maxHeight: 150, overflow: 'auto', marginTop: 7, padding: 8, background: '#0f172a', borderRadius: 6, fontFamily: 'monospace', fontSize: '0.7rem' }}>{macro.logs.map((log, index) => <div key={`${log}-${index}`} style={{ marginBottom: 3 }}>{log}</div>)}</div><button type="button" onClick={onClearLogs} style={{ ...smallButton('#475569'), marginTop: 7 }}>ล้างประวัติ</button></details>}
          <button type="button" onClick={onDelete} style={{ ...smallButton('#7f1d1d'), color: '#fecaca', marginTop: 12 }}>ลบ Automation</button>
        </div>
      )}
    </article>
  );
}

function smallButton(background: string): CSSProperties {
  return { border: 0, borderRadius: 6, padding: '6px 9px', background, color: '#e2e8f0', cursor: 'pointer', fontSize: '0.72rem', whiteSpace: 'nowrap' };
}
