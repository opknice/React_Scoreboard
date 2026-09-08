import { memo, useSyncExternalStore, type MouseEvent } from 'react';
import { formatTime } from '../utils/replayFormatters';
import type { ReplayClock } from '../utils/replayClock';

interface Props {
  clock: ReplayClock;
  duration: number;
  trimStart: number | null;
  onSeek: (seconds: number) => void;
}

function ReplayTimeline({ clock, duration, trimStart, onSeek }: Props) {
  const currentTime = useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getSnapshot);
  const handleTimelineClick = (event: MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    onSeek(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * duration);
  };
  return (
    <div className="timeline-container">
      <div className="timeline-labels">
        <span>00:00</span>
        <span className="current-time-label">{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      <div className="timeline-track" onClick={handleTimelineClick}>
        <div className="timeline-progress" style={{ width: `${(currentTime / duration) * 100}%` }} />
        {trimStart !== null && (
          <div
            className="timeline-trim-region"
            style={{
              left: `${(trimStart / duration) * 100}%`,
              width: `${((duration - trimStart) / duration) * 100}%`,
            }}
          />
        )}
        {trimStart !== null && (
          <div className="timeline-marker timeline-marker-trim" style={{ left: `${(trimStart / duration) * 100}%` }}>
            <span>ตัด</span>
          </div>
        )}
        <div className="timeline-playhead" style={{ left: `${(currentTime / duration) * 100}%` }} />
      </div>
    </div>
  );
}

export default memo(ReplayTimeline);
