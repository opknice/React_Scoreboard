import { useState, type CSSProperties } from 'react';
import CustomMacroCard from './CustomMacroCard';
import MacroEditorModal from './MacroEditorModal';
import type { CustomMacro, MacroRuntimeStatus } from '../types/macro';
import { MACRO_PRESETS } from '../macros/macroPresets';

interface AutoMacrosPanelProps {
  obs: any;
  onClose: () => void;
  customMacrosHook?: {
    customMacros: CustomMacro[];
    runtimeStatus: Record<string, MacroRuntimeStatus>;
    addMacro: (macroData?: Partial<CustomMacro>) => string;
    updateMacro: (id: string, updated: Partial<CustomMacro>) => void;
    deleteMacro: (id: string) => void;
    toggleMacro: (id: string, isEnabled: boolean) => void;
    clearMacroLogs: (id: string) => void;
    runMacro: (id: string) => void;
  };
}

export default function AutoMacrosPanel({ obs, onClose, customMacrosHook }: AutoMacrosPanelProps) {
  const [editingMacro, setEditingMacro] = useState<CustomMacro | null | undefined>(undefined);
  const [showPresets, setShowPresets] = useState(false);

  const createFromPreset = (preset: typeof MACRO_PRESETS[number]) => {
    customMacrosHook?.addMacro({ ...preset.macro, actions: preset.macro.actions.map((action) => ({ ...action, id: `step_${Date.now()}_${action.id}` })) });
    setShowPresets(false);
  };

  const handleSaveMacro = (macroData: Partial<CustomMacro>) => {
    if (!customMacrosHook) return;
    if (editingMacro) customMacrosHook.updateMacro(editingMacro.id, macroData);
    else customMacrosHook.addMacro(macroData);
  };

  const deleteMacro = (macro: CustomMacro) => {
    if (window.confirm(`ต้องการลบ “${macro.name}” ใช่หรือไม่?`)) customMacrosHook?.deleteMacro(macro.id);
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, maxHeight: '90vh', overflow: 'auto', padding: 0 }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 3, background: '#1e293b', borderBottom: '1px solid #334155', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><h3 style={{ margin: 0 }}>Automation</h3><div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 4 }}>ตั้งค่าให้ Scoreboard และ OBS ทำงานแทนคุณ</div></div>
          <button type="button" onClick={onClose} style={iconButton()}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ padding: '12px 15px', borderRadius: 8, background: obs.isConnected ? '#064e3b' : '#451a03', color: obs.isConnected ? '#a7f3d0' : '#fed7aa', fontSize: '0.82rem', marginBottom: 18 }}>
            {obs.isConnected ? '● OBS เชื่อมต่อแล้ว Automation พร้อมทำงาน' : '● OBS ยังไม่เชื่อมต่อ คุณสามารถแก้ไขรายการได้ แต่ต้องเชื่อมต่อ OBS ก่อนเปิดใช้งาน'}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div><h4 style={{ margin: 0, color: '#e2e8f0' }}>รายการ Automation</h4><div style={{ color: '#64748b', fontSize: '0.76rem', marginTop: 3 }}>เปิดใช้งานเฉพาะรายการที่ต้องการ</div></div>
            <div style={{ display: 'flex', gap: 7 }}><button type="button" style={secondaryButton()} onClick={() => setShowPresets((value) => !value)}>เริ่มจาก Template</button><button type="button" style={primaryButton()} onClick={() => setEditingMacro(null)}>+ สร้างเอง</button></div>
          </div>
          {showPresets && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 9, padding: 12, background: '#0f172a', borderRadius: 8, marginBottom: 14 }}>{MACRO_PRESETS.map((preset) => <button key={preset.id} type="button" onClick={() => createFromPreset(preset)} style={{ textAlign: 'left', padding: 12, borderRadius: 7, border: `1px solid ${preset.color}`, background: '#1e293b', color: '#e2e8f0', cursor: 'pointer' }}><strong style={{ display: 'block', fontSize: '0.82rem' }}>{preset.name}</strong><span style={{ display: 'block', color: '#94a3b8', fontSize: '0.73rem', marginTop: 5 }}>{preset.description}</span></button>)}</div>}
          {!customMacrosHook || customMacrosHook.customMacros.length === 0 ? <div style={{ padding: '42px 24px', border: '1px dashed #475569', borderRadius: 8, textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>ยังไม่มี Automation<br /><span style={{ display: 'inline-block', marginTop: 7, color: '#64748b' }}>เริ่มจาก Template หรือสร้างรายการของคุณเอง</span></div> : customMacrosHook.customMacros.map((macro) => <CustomMacroCard key={macro.id} isObsConnected={obs.isConnected} macro={macro} runtimeStatus={customMacrosHook.runtimeStatus[macro.id]} onToggle={(enabled) => customMacrosHook.toggleMacro(macro.id, enabled)} onRun={() => customMacrosHook.runMacro(macro.id)} onEdit={() => setEditingMacro(macro)} onDelete={() => deleteMacro(macro)} onClearLogs={() => customMacrosHook.clearMacroLogs(macro.id)} />)}
        </div>
      </div>
      {editingMacro !== undefined && <MacroEditorModal obs={obs} macro={editingMacro} onSave={handleSaveMacro} onClose={() => setEditingMacro(undefined)} />}
    </div>
  );
}

function primaryButton(): CSSProperties { return { border: 0, borderRadius: 7, padding: '8px 12px', background: '#0284c7', color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }; }
function secondaryButton(): CSSProperties { return { border: 0, borderRadius: 7, padding: '8px 12px', background: '#334155', color: '#cbd5e1', cursor: 'pointer', fontSize: '0.78rem' }; }
function iconButton(): CSSProperties { return { border: 0, borderRadius: 6, padding: '2px 9px', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '1.5rem' }; }
