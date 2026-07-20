interface ReplayAutoSwitcherProps {
  obs: any;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  logs: string[];
  lastTrigger: string;
  onClearLogs: () => void;
}

export default function ReplayAutoSwitcher({ obs, isEnabled, onToggle, logs, lastTrigger, onClearLogs }: ReplayAutoSwitcherProps) {

  return (
    <div className="card" style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-magic"></i>
          <span>Switch to Replay (Auto)</span>
          {isEnabled && (
            <span style={{
              fontSize: '0.7rem',
              background: '#10b981',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 'normal'
            }}>
              ACTIVE
            </span>
          )}
        </h3>
        
        <label style={{ 
          position: 'relative', 
          display: 'inline-block', 
          width: '50px', 
          height: '26px', 
          cursor: 'pointer',
          userSelect: 'none'
        }}>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => onToggle(e.target.checked)}
            disabled={!obs.isConnected}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <span style={{
            position: 'absolute',
            cursor: obs.isConnected ? 'pointer' : 'not-allowed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: isEnabled ? '#10b981' : '#4b5563',
            borderRadius: '26px',
            transition: '0.3s',
            opacity: obs.isConnected ? 1 : 0.5
          }}>
            <span style={{
              position: 'absolute',
              content: '""',
              height: '18px',
              width: '18px',
              left: isEnabled ? '28px' : '4px',
              bottom: '4px',
              background: '#fff',
              borderRadius: '50%',
              transition: '0.3s'
            }}></span>
          </span>
        </label>
      </div>

      {/* Description */}
      <div style={{
        padding: '12px',
        background: '#1e293b',
        borderRadius: '6px',
        marginBottom: '12px',
        borderLeft: '4px solid #3b82f6'
      }}>
        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '8px' }}>
          <strong>🎯 Macro Details:</strong>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.6' }}>
          <div><strong>Condition:</strong> Replay Buffer = Saved</div>
          <div><strong>Actions:</strong></div>
          <div style={{ paddingLeft: '16px' }}>
            1. Wait 3.5 seconds<br />
            2. Switch scene to "Replay"
          </div>
        </div>
      </div>

      {/* Status */}
      {!obs.isConnected && (
        <div style={{
          padding: '12px',
          background: '#7c2d12',
          borderRadius: '6px',
          borderLeft: '4px solid #f97316',
          color: '#fbbf24',
          fontSize: '0.85rem',
          marginBottom: '12px'
        }}>
          <i className="fas fa-exclamation-triangle"></i> <strong>OBS not connected</strong><br />
          <span style={{ fontSize: '0.8rem' }}>Connect to OBS WebSocket first</span>
        </div>
      )}

      {lastTrigger && (
        <div style={{
          padding: '8px 12px',
          background: '#064e3b',
          borderRadius: '6px',
          fontSize: '0.8rem',
          color: '#6ee7b7',
          marginBottom: '12px'
        }}>
          <i className="fas fa-check-circle"></i> Last triggered: {lastTrigger}
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: '#0f172a',
          borderRadius: '6px',
          maxHeight: '200px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.75rem'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '8px' 
          }}>
            <strong style={{ color: '#cbd5e1' }}>Activity Logs</strong>
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
              <i className="fas fa-trash"></i> Clear
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
                  borderLeft: '3px solid #3b82f6',
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

      {/* Info */}
      <div style={{
        marginTop: '12px',
        padding: '10px',
        background: '#064e3b',
        borderRadius: '6px',
        fontSize: '0.8rem',
        color: '#a7f3d0',
        borderLeft: '4px solid #10b981'
      }}>
        <div style={{ marginBottom: '4px' }}>
          <strong>💡 How to use:</strong>
        </div>
        <div style={{ fontSize: '0.75rem', lineHeight: '1.5' }}>
          1. Make sure scene "Replay" exists in OBS<br />
          2. Enable this macro with the toggle switch<br />
          3. When you save Replay Buffer in OBS:<br />
          <span style={{ paddingLeft: '12px' }}>→ Wait 3.5s → Auto switch to Replay scene</span>
        </div>
      </div>
    </div>
  );
}
