import React from 'react';
import { broadcastScoreboardButton } from '../hooks/useScoreboardChannels';
import { useTimerSnapshot, type TimerStore } from '../hooks/useTimer';
import UiIcon from './UiIcon';

interface ScoreboardTimerPanelProps {
  embedded?: boolean;
  timer: TimerStore;
  onOpenPresetTime: () => void;
  onHideTime: () => void;
  onPenaltyShootout: () => void;
  onOpenVarReplay: () => void;
  onOpenInstantReplay: () => void;
}

function ScoreboardTimerPanel({
  embedded = false,
  timer,
  onOpenPresetTime,
  onHideTime,
  onPenaltyShootout,
  onOpenVarReplay,
  onOpenInstantReplay,
}: ScoreboardTimerPanelProps) {
  const timerState = useTimerSnapshot(timer);

  return (
    <div className={embedded ? 'scoreboard-timer-panel-section' : 'card'} style={embedded ? undefined : { padding: '12px 16px' }}>
      <div className="row timer-area-container" style={{ marginBottom: 0 }}>
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="btn-secondary btn-sm" onClick={onOpenPresetTime}>
            <UiIcon name="clock" /> ปรับเวลา
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
            ปัจจุบัน: {Math.floor(timerState.countdownStartTime / 60)} นาที
          </div>
        </div>

        <div className="timer-display-area">
          <div className="timer-display">
            <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>{timerState.customText || timerState.half || '1st'}</span>{' '}
            {timerState.formattedTime}
          </div>
          <div className="row center" style={{ marginTop: '4px', gap: '6px', marginBottom: 0 }}>
            <button className="btn-success btn-sm" onClick={() => { timer.start1(); broadcastScoreboardButton('start_timer'); }}>
              <UiIcon name="play" /> เริ่มครึ่งแรก
            </button>
            <button className="btn-danger btn-sm" onClick={() => { timer.halfpause(); broadcastScoreboardButton('half_time'); }}>
              <UiIcon name="pause" /> พักครึ่งแรก
            </button>
            <button className="btn-success btn-sm" onClick={() => { timer.start2(); broadcastScoreboardButton('start_timer'); }}>
              <UiIcon name="play" /> เริ่มครึ่งหลัง
            </button>
            <button className="btn-danger btn-sm" onClick={() => { timer.fulltime(); broadcastScoreboardButton('full_time'); }}>
              <UiIcon name="pause" /> จบเกมส์
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
            <UiIcon name="expand" style={{ fontSize: '0.9rem' }} />
            <span>VAR Controller</span>
          </button>
          <button
            className="btn-warning btn-sm"
            onClick={onOpenInstantReplay}
            title="เปิด Instant Replay Control"
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <UiIcon name="playCircle" style={{ fontSize: '0.9rem' }} />
            <span>Replay Control</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ScoreboardTimerPanel);
