import type { CustomMacro } from '../types/macro';

interface CustomMacroCardProps {
  obs: any;
  macro: CustomMacro;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onClearLogs: () => void;
}

export default function CustomMacroCard({
  obs,
  macro,
  onToggle,
  onEdit,
  onDelete,
  onClearLogs
}: CustomMacroCardProps) {
  const { name, color, isEnabled, trigger, actions, logs, lastTrigger } = macro;

  const renderActionSummary = (step: any) => {
    switch (step.type) {
      case 'wait':
        return `⏳ หน่วงเวลา ${(step.delayMs / 1000).toFixed(1)} วินาที`;
      case 'switchScene':
        return `🔄 สลับ Scene ไปที่ "${step.sceneName || '?'}"`;
      case 'showSource':
        return `👁️ แสดง Source "${step.sourceName || '?'}" ใน Scene "${step.sourceScene || 'Main Stream'}"`;
      case 'hideSource':
        return `🙈 ซ่อน Source "${step.sourceName || '?'}" ใน Scene "${step.sourceScene || 'Main Stream'}"`;
      default:
        return step.type;
    }
  };

  return (
    <div className="card" style={{ marginTop: '16px', borderTop: `4px solid ${color}` }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-bolt" style={{ color }}></i>
          <span>{name}</span>
          {isEnabled && (
            <span
              style={{
                fontSize: '0.7rem',
                background: '#10b981',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: 'normal'
              }}
            >
              ทำงานอยู่ (ACTIVE)
            </span>
          )}
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Edit & Delete Buttons */}
          <button
            onClick={onEdit}
            title="แก้ไข Macro"
            style={{
              background: '#334155',
              border: 'none',
              color: '#cbd5e1',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <i className="fas fa-edit"></i> แก้ไข
          </button>
          <button
            onClick={onDelete}
            title="ลบ Macro"
            style={{
              background: '#7f1d1d',
              border: 'none',
              color: '#fca5a5',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            <i className="fas fa-trash"></i>
          </button>

          {/* Toggle Switch */}
          <label
            style={{
              position: 'relative',
              display: 'inline-block',
              width: '50px',
              height: '26px',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => onToggle(e.target.checked)}
              disabled={!obs.isConnected}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: obs.isConnected ? 'pointer' : 'not-allowed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: isEnabled ? color : '#4b5563',
                borderRadius: '26px',
                transition: '0.3s',
                opacity: obs.isConnected ? 1 : 0.5
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: '18px',
                  width: '18px',
                  left: isEnabled ? '28px' : '4px',
                  bottom: '4px',
                  background: '#fff',
                  borderRadius: '50%',
                  transition: '0.3s'
                }}
              ></span>
            </span>
          </label>
        </div>
      </div>

      {/* Description & Steps */}
      <div
        style={{
          padding: '12px',
          background: '#1e293b',
          borderRadius: '6px',
          marginBottom: '12px',
          borderLeft: `4px solid ${color}`
        }}
      >
        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '8px' }}>
          <strong>🎯 รายละเอียดการทำงาน:</strong>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.6' }}>
          <div>
            <strong>เหตุการณ์จุดชนวน:</strong> {trigger.event}
            {trigger.filterKey && (
              <span style={{ color: '#38bdf8', marginLeft: '6px' }}>
                (กรองข้อมูล: {trigger.filterKey} = "{trigger.filterValue}")
              </span>
            )}
          </div>
          <div style={{ marginTop: '4px' }}>
            <strong>ลำดับขั้นตอนการทำงาน:</strong>
          </div>
          <div style={{ paddingLeft: '16px' }}>
            {actions.map((act, idx) => (
              <div key={act.id || idx}>
                {idx + 1}. {renderActionSummary(act)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Last triggered */}
      {lastTrigger && (
        <div
          style={{
            padding: '8px 12px',
            background: '#064e3b',
            borderRadius: '6px',
            fontSize: '0.8rem',
            color: '#6ee7b7',
            marginBottom: '12px'
          }}
        >
          <i className="fas fa-check-circle"></i> ทำงานล่าสุดเมื่อ: {lastTrigger}
        </div>
      )}

      {/* Activity Logs */}
      {logs && logs.length > 0 && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            background: '#0f172a',
            borderRadius: '6px',
            maxHeight: '200px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ color: '#cbd5e1' }}>ประวัติการทำงาน (Activity Logs)</strong>
            <button
              onClick={onClearLogs}
              style={{
                background: '#374151',
                border: 'none',
                color: '#9ca3af',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.7rem',
                cursor: 'pointer'
              }}
            >
              <i className="fas fa-trash"></i> ล้างประวัติ
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column-reverse' }}>
            {logs.map((log, idx) => (
              <div
                key={idx}
                style={{
                  padding: '4px 6px',
                  marginBottom: '2px',
                  background: '#1e293b',
                  borderLeft: `3px solid ${color}`,
                  borderRadius: '3px',
                  color: '#cbd5e1'
                }}
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
