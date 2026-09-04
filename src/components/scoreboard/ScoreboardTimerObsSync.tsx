import { memo, useEffect } from 'react';
import type { OBSWebSocketApi } from '../../hooks/useOBSWebSocket';
import { useTimerSnapshot, type TimerStore } from '../../hooks/useTimer';

interface ScoreboardTimerObsSyncProps {
  obs: Pick<OBSWebSocketApi, 'isConnected' | 'setText'>;
  timer: TimerStore;
}

/** Keeps timer ticks out of ScoreboardController's render path. */
function ScoreboardTimerObsSync({ obs, timer }: ScoreboardTimerObsSyncProps) {
  const { formattedTime, half } = useTimerSnapshot(timer);
  const { isConnected, setText } = obs;

  useEffect(() => {
    void setText('time_counter', formattedTime);
  }, [formattedTime, isConnected, setText]);

  useEffect(() => {
    void setText('half_text', half);
  }, [half, isConnected, setText]);

  return null;
}

export default memo(ScoreboardTimerObsSync);
