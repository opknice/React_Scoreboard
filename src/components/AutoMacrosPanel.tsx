import { useState } from 'react';
import CustomMacroCard from './CustomMacroCard';
import MacroEditorModal from './MacroEditorModal';
import type { CustomMacro } from '../types/macro';

interface AutoMacrosPanelProps {
  obs: any;
  onClose: () => void;
  customMacrosHook?: {
    customMacros: CustomMacro[];
    addMacro: (macroData?: Partial<CustomMacro>) => string;
    updateMacro: (id: string, updated: Partial<CustomMacro>) => void;
    deleteMacro: (id: string) => void;
    toggleMacro: (id: string, isEnabled: boolean) => void;
    clearMacroLogs: (id: string) => void;
  };
}

export default function AutoMacrosPanel({
  obs,
  onClose,
  customMacrosHook
}: AutoMacrosPanelProps) {
  const [editingMacro, setEditingMacro] = useState<CustomMacro | null | undefined>(undefined);

  const handleOpenNewModal = () => {
    setEditingMacro(null); // null means creating new
  };

  const handleSaveMacro = (macroData: Partial<CustomMacro>) => {
    if (!customMacrosHook) return;
    if (editingMacro) {
      customMacrosHook.updateMacro(editingMacro.id, macroData);
    } else {
      customMacrosHook.addMacro(macroData);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal-content"
        style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto', padding: '0' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            background: '#1e293b',
            borderBottom: '2px solid #334155',
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10
          }}
        >
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-magic"></i> ระบบควบคุม Macro อัตโนมัติ (Auto Macros)
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#334155';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Info Box */}
          <div
            style={{
              padding: '12px 16px',
              background: '#064e3b',
              borderRadius: '8px',
              marginBottom: '20px',
              borderLeft: '4px solid #10b981'
            }}
          >
            <div style={{ fontSize: '0.9rem', color: '#6ee7b7', marginBottom: '6px' }}>
              <i className="fas fa-info-circle"></i> <strong>คำแนะนำระบบ Auto Macros System</strong>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#a7f3d0', lineHeight: '1.5' }}>
              ระบบการทำงานอัตโนมัติที่จะตรวจสอบเหตุการณ์จาก OBS แบบเรียลไทม์ คุณสามารถเปิด/ปิด แก้ไข หรือสร้าง Macro ใหม่ได้ตามต้องการ
            </div>
          </div>

          {/* Custom User-Defined Macros */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, color: '#38bdf8', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-list-check"></i> รายการ Macro อัตโนมัติ (Macro Triggers)
              </h4>
              <button
                onClick={handleOpenNewModal}
                style={{
                  background: '#0284c7',
                  border: 'none',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fas fa-plus"></i> + สร้าง Macro ใหม่
              </button>
            </div>

            {!customMacrosHook || customMacrosHook.customMacros.length === 0 ? (
              <div
                style={{
                  padding: '32px',
                  background: '#0f172a',
                  borderRadius: '8px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '0.85rem'
                }}
              >
                ยังไม่มี Macro ในระบบ คลิก <strong>"+ สร้าง Macro ใหม่"</strong> เพื่อเริ่มสร้างระบบอัตโนมัติของคุณ!
              </div>
            ) : (
              customMacrosHook.customMacros.map((macro) => (
                <CustomMacroCard
                  key={macro.id}
                  obs={obs}
                  macro={macro}
                  onToggle={(enabled) => customMacrosHook.toggleMacro(macro.id, enabled)}
                  onEdit={() => setEditingMacro(macro)}
                  onDelete={() => customMacrosHook.deleteMacro(macro.id)}
                  onClearLogs={() => customMacrosHook.clearMacroLogs(macro.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Editor Modal */}
      {editingMacro !== undefined && (
        <MacroEditorModal
          obs={obs}
          macro={editingMacro}
          onSave={handleSaveMacro}
          onClose={() => setEditingMacro(undefined)}
        />
      )}
    </div>
  );
}
