import { broadcastScoreboardButton } from '../hooks/useScoreboardChannels';

interface ScoreboardTimerControls {
  countdownStartTime: number;
  customText: string;
  half: string;
  formattedTime: string;
  start1: () => void;
  halfpause: () => void;
  start2: () => void;
  fulltime: () => void;
}

interface ScoreboardTimerPanelProps {
  timer: ScoreboardTimerControls;
  onOpenPresetTime: () => void;
  onHideTime: () => void;
  onPenaltyShootout: () => void;
  onOpenVarReplay: () => void;
  onOpenInstantReplay: () => void;
}

export default function ScoreboardTimerPanel({
  timer,
  onOpenPresetTime,
  onHideTime,
  onPenaltyShootout,
  onOpenVarReplay,
  onOpenInstantReplay,
}: ScoreboardTimerPanelProps) {
  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      <div className="row timer-area-container" style={{ marginBottom: 0 }}>
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="btn-secondary btn-sm" onClick={onOpenPresetTime}>
            <i className="fas fa-clock"></i> ปรับเวลา
          </button>
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 'bold',
              color: '#10b981',
              padding: '4px 8px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            ปัจจุบัน: {Math.floor(timer.countdownStartTime / 60)} นาที
          </div>
        </div>

        <div className="timer-display-area">
          <div className="timer-display">
            <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>{timer.customText || timer.half || '1st'}</span>{' '}
            {timer.formattedTime}
          </div>
          <div className="row center" style={{ marginTop: '4px', gap: '6px', marginBottom: 0 }}>
            <button className="btn-success btn-sm" onClick={() => { timer.start1(); broadcastScoreboardButton('start_timer'); }}>
              <i className="fas fa-play"></i> เริ่มครึ่งแรก
            </button>
            <button className="btn-danger btn-sm" onClick={() => { timer.halfpause(); broadcastScoreboardButton('half_time'); }}>
              <i className="fas fa-pause"></i> พักครึ่งแรก
            </button>
            <button className="btn-success btn-sm" onClick={() => { timer.start2(); broadcastScoreboardButton('start_timer'); }}>
              <i className="fas fa-play"></i> เริ่มครึ่งหลัง
            </button>
            <button className="btn-danger btn-sm" onClick={() => { timer.fulltime(); broadcastScoreboardButton('full_time'); }}>
              <i className="fas fa-pause"></i> จบเกมส์
            </button>
            <button className="btn-warning btn-sm" onClick={onHideTime}>
              ซ่อนเวลา
            </button>
          </div>
        </div>

        <div className="timer-right-controls">
          <button className="btn-primary btn-sm" onClick={onPenaltyShootout}>
            ยิงจุดโทษ
          </button>
          <button
            className="btn-primary btn-sm"
            onClick={onOpenVarReplay}
            title="เปิด VAR Controller V2"
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <i className="fas fa-expand-arrows-alt" style={{ fontSize: '0.9rem' }}></i>
            <span>VAR Controller</span>
          </button>
          <button
            className="btn-warning btn-sm"
            onClick={onOpenInstantReplay}
            title="เปิด Instant Replay Control"
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <i className="fas fa-play-circle" style={{ fontSize: '0.9rem' }}></i>
            <span>Replay Control</span>
          </button>
        </div>
      </div>
    </div>
  );
}
