import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  isGoalScoredEvent,
  SCOREBOARD_EVENT_CHANNEL,
  type GoalScoredEvent,
} from '../types/scoreboardEvent';
import './GoalAnimationOverlay.css';

const DISPLAY_DURATION_MS = 5000;

export default function GoalAnimationOverlay() {
  const [goalEvent, setGoalEvent] = useState<GoalScoredEvent | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;

    const handleGoal = (event: MessageEvent<unknown>) => {
      if (!isGoalScoredEvent(event.data)) return;

      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }

      setGoalEvent(event.data);
      setAnimationKey((previous) => previous + 1);
      hideTimerRef.current = window.setTimeout(() => {
        setGoalEvent(null);
        hideTimerRef.current = null;
      }, DISPLAY_DURATION_MS);
    };

    try {
      channel = new BroadcastChannel(SCOREBOARD_EVENT_CHANNEL);
      channel.addEventListener('message', handleGoal);
    } catch (error) {
      console.error('[GoalAnimation] Failed to create BroadcastChannel:', error);
    }

    return () => {
      channel?.removeEventListener('message', handleGoal);
      channel?.close();
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  if (!goalEvent) {
    return <div className="goal-animation-overlay" aria-hidden="true" />;
  }

  const colors = {
    '--goal-color-1': goalEvent.color1 || '#facc15',
    '--goal-color-2': goalEvent.color2 || '#ffffff',
  } as CSSProperties;

  return (
    <div
      key={animationKey}
      className="goal-animation-overlay"
      style={colors}
      role="status"
      aria-live="polite"
    >
      <div className="goal-animation-flash" />
      <div className="goal-animation-card">
        <div className="goal-animation-label">GOAL!</div>
        <div className="goal-animation-team-row">
          {goalEvent.logo ? (
            <img
              className="goal-animation-logo"
              src={goalEvent.logo}
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
          <div className="goal-animation-team-name">{goalEvent.teamName}</div>
        </div>
        <div className="goal-animation-score">
          {goalEvent.scoreA} <span>–</span> {goalEvent.scoreB}
        </div>
      </div>
    </div>
  );
}
