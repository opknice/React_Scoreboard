import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  isGoalScoredEvent,
  isScoreboardStateEvent,
  SCOREBOARD_EVENT_CHANNEL,
  SCOREBOARD_STATE_STORAGE_KEY,
  type GoalScoredEvent,
  type ScoreboardStateEvent,
} from '../types/scoreboardEvent';
import {
  broadcastTeamNameAnimationCompleted,
  requestScoreboardState,
} from '../hooks/useScoreboardChannels';
import { getTeamNamePresentation } from '../utils/teamNameBrowserUrl';
import type { GoalAnimationSide } from './goalAnimationTemplates';
import './TeamNamesAnimation.css';

interface TeamNameDisplay {
  team: 'A' | 'B';
  name: string;
}

interface TeamNamesAnimationProps {
  side: GoalAnimationSide;
}

const DEFAULT_NAMES = {
  A: 'Team A',
  B: 'Team B',
};

// Steps are checked in order; the first step whose `max` covers the name length wins.
// Each entry mirrors the original clamp(min, vw, max) shape so it still scales with.
// viewport width — just anchored to a smaller ceiling as the name gets longer.
const TEAM_NAME_FONT_SIZE_STEPS: { max: number; size: string }[] = [
  { max: 10, size: 'clamp(2rem, 2.5vw, 3rem)' },
  { max: 14, size: 'clamp(1.75rem, 2.2vw, 2.5rem)' },
  { max: 18, size: 'clamp(1.5rem, 1.9vw, 2.1rem)' },
  { max: 24, size: 'clamp(1.25rem, 1.6vw, 1.8rem)' },
  { max: Infinity, size: 'clamp(1.05rem, 1.35vw, 1.5rem)' },
];

const TEAM_NAME_ANIMATION_DURATION_MS = 4000;

function getTeamNameFontSize(name: string): string {
  const length = name.trim().length;
  const step =
    TEAM_NAME_FONT_SIZE_STEPS.find((entry) => length <= entry.max) ??
    TEAM_NAME_FONT_SIZE_STEPS[TEAM_NAME_FONT_SIZE_STEPS.length - 1];
  return step.size;
}

function namesFromState(event: ScoreboardStateEvent) {
  return {
    A: event.nameA || DEFAULT_NAMES.A,
    B: event.nameB || DEFAULT_NAMES.B,
  };
}

function namesFromGoal(event: GoalScoredEvent, currentNames: typeof DEFAULT_NAMES) {
  return {
    ...currentNames,
    [event.team]: event.teamName || currentNames[event.team],
  };
}

export default function TeamNamesAnimation({ side }: TeamNamesAnimationProps) {
  const [names, setNames] = useState(DEFAULT_NAMES);
  const [goalTeam, setGoalTeam] = useState<'A' | 'B' | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const goalTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;

    // Load persisted state from localStorage as initial values before live events arrive.
    try {
      const savedState = localStorage.getItem(SCOREBOARD_STATE_STORAGE_KEY);
      if (savedState) {
        const parsedState: unknown = JSON.parse(savedState);
        if (isScoreboardStateEvent(parsedState)) {
          setNames(namesFromState(parsedState));
        }
      }
    } catch {
      // Ignore unavailable or malformed persisted state.
    }

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (isScoreboardStateEvent(event.data)) {
        setNames(namesFromState(event.data));
        return;
      }

      const goalEvent = event.data;
      if (!isGoalScoredEvent(goalEvent)) return;

      setNames((currentNames) => namesFromGoal(goalEvent, currentNames));
      setGoalTeam(goalEvent.team);
      setAnimationKey((currentKey) => currentKey + 1);

      if (goalTimerRef.current !== null) {
        window.clearTimeout(goalTimerRef.current);
      }
      goalTimerRef.current = window.setTimeout(() => {
        // Restore the team name before notifying Score Browser Sources so the
        // handoff order matches the visual sequence.
        setGoalTeam(null);
        broadcastTeamNameAnimationCompleted(goalEvent.eventId, goalEvent.team);
        goalTimerRef.current = null;
      }, TEAM_NAME_ANIMATION_DURATION_MS);
    };

    try {
      channel = new BroadcastChannel(SCOREBOARD_EVENT_CHANNEL);
      // Fix #3: attach the listener BEFORE calling requestScoreboardState so the response
      // event is never missed even if it resolves synchronously or as a microtask.
      channel.addEventListener('message', handleMessage);
      requestScoreboardState();
    } catch (error) {
      // Fix #4: log the failure clearly; the component degrades gracefully to localStorage
      // state loaded above. No further action is needed because channel stays null and the
      // cleanup below handles that safely.
      console.error('[TeamNamesAnimation] Failed to create BroadcastChannel:', error);
    }

    return () => {
      channel?.removeEventListener('message', handleMessage);
      channel?.close();
      if (goalTimerRef.current !== null) {
        window.clearTimeout(goalTimerRef.current);
        goalTimerRef.current = null;
      }
    };
  }, [side]);

  const displays: TeamNameDisplay[] = [];
  if (side === 'A' || side === 'both') displays.push({ team: 'A', name: names.A });
  if (side === 'B' || side === 'both') displays.push({ team: 'B', name: names.B });

  return (
    <div
      key={animationKey}
      className="team-names-animation-overlay"
      role="status"
      aria-label="Team names display"
    >
      {displays.map((display) => {
        const isGoal = goalTeam === display.team;
        const presentation = getTeamNamePresentation(window.location.search, display.team);
        const style = {
          '--team-name-x': display.team === 'A' ? '20.8333%' : '78.125%',
          '--team-name-font-family': presentation.fontFamily,
          '--team-name-font-weight': presentation.fontWeight,
          '--team-name-font-size': presentation.fontMode === 'manual'
            ? `${presentation.fontSize}px`
            : getTeamNameFontSize(display.name),
        } as CSSProperties;

        return (
          <div
            key={display.team}
            className={`team-name-instance ${isGoal ? 'team-name-instance--goal' : ''}`}
            style={style}
          >
            {/* team-name-slot ใช้ CSS Grid ให้ GOAL!!! และชื่อทีม overlay กันตรงๆ */}
            <div className="team-name-slot">
              {isGoal ? (
                <div className="team-name-goal-label" aria-label={`Goal ${display.name}`}>
                  GOAL!!!
                </div>
              ) : null}
              <div className="team-name-value" aria-hidden={isGoal}>{display.name}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
