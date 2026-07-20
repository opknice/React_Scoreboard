import ReplayAutoSwitcher from './ReplayAutoSwitcher';
import MainStreamAutoSwitcher from './MainStreamAutoSwitcher';

interface AutoMacrosPanelProps {
  obs: any;
  onClose: () => void;
  replayMacro: {
    isEnabled: boolean;
    onToggle: (enabled: boolean) => void;
    logs: string[];
    lastTrigger: string;
    onClearLogs: () => void;
  };
  mainStreamMacro: {
    isEnabled: boolean;
    onToggle: (enabled: boolean) => void;
    logs: string[];
    lastTrigger: string;
    onClearLogs: () => void;
  };
}

export default function AutoMacrosPanel({ obs, onClose, replayMacro, mainStreamMacro }: AutoMacrosPanelProps) {
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
        <div style={{
          position: 'sticky',
          top: 0,
          background: '#1e293b',
          borderBottom: '2px solid #334155',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10
        }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-magic"></i> Auto Macros
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
          <div style={{
            padding: '12px 16px',
            background: '#064e3b',
            borderRadius: '8px',
            marginBottom: '20px',
            borderLeft: '4px solid #10b981'
          }}>
            <div style={{ fontSize: '0.9rem', color: '#6ee7b7', marginBottom: '6px' }}>
              <i className="fas fa-info-circle"></i> <strong>Auto Macros System</strong>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#a7f3d0', lineHeight: '1.5' }}>
              Automated workflows that trigger when specific OBS events occur.
              Enable/disable each macro with the toggle switch.
            </div>
          </div>

          {/* Macro #1: Switch to Replay */}
          <ReplayAutoSwitcher 
            obs={obs}
            isEnabled={replayMacro.isEnabled}
            onToggle={replayMacro.onToggle}
            logs={replayMacro.logs}
            lastTrigger={replayMacro.lastTrigger}
            onClearLogs={replayMacro.onClearLogs}
          />

          {/* Macro #2: Switch to Main Stream */}
          <MainStreamAutoSwitcher 
            obs={obs}
            isEnabled={mainStreamMacro.isEnabled}
            onToggle={mainStreamMacro.onToggle}
            logs={mainStreamMacro.logs}
            lastTrigger={mainStreamMacro.lastTrigger}
            onClearLogs={mainStreamMacro.onClearLogs}
          />

          {/* Instructions */}
          <div style={{
            marginTop: '20px',
            padding: '16px',
            background: '#1e293b',
            borderRadius: '8px',
            borderLeft: '4px solid #3b82f6'
          }}>
            <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '8px' }}>
              <i className="fas fa-lightbulb"></i> <strong>Workflow:</strong>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.8' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>1. Save Replay Buffer</strong> (Press hotkey in OBS)
                <div style={{ paddingLeft: '20px', color: '#64748b' }}>
                  → Macro #1 triggers: Wait 3.5s → Switch to "Replay" scene<br />
                  → Video starts playing
                </div>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>2. Video Finishes</strong> ("Source Replay" playback ends)
                <div style={{ paddingLeft: '20px', color: '#64748b' }}>
                  → Macro #2 triggers:<br />
                  → Switch to "Main Stream"<br />
                  → Show "Goal_Alert" for 3.5s<br />
                  → Show "Main_events"
                </div>
              </div>
              <div>
                <strong>3. Back to Normal</strong> - Continue broadcasting
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
