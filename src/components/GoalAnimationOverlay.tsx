import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  isGoalScoredEvent,
  isScoreboardStateEvent,
  isTeamNameAnimationCompletedEvent,
  SCOREBOARD_EVENT_CHANNEL,
  SCOREBOARD_STATE_STORAGE_KEY,
  type GoalScoredEvent,
  type ScoreboardStateEvent,
} from '../types/scoreboardEvent';
import ScoreOnlyAnimation, { type ScoreOnlyDisplay } from './ScoreOnlyAnimation';
import TeamNamesAnimation from './TeamNamesAnimation';
import { requestScoreboardState } from '../hooks/useScoreboardChannels';
import {
  resolveGoalAnimationSide,
  resolveGoalAnimationTemplate,
  resolveScoreAnimationMode,
} from './goalAnimationTemplates';
import './GoalAnimationOverlay.css';

const DISPLAY_DURATION_MS = 5000;
const TEAM_NAME_GOAL_DURATION_MS = 4000;
const SCORE_ANIMATION_FALLBACK_DELAY_MS = TEAM_NAME_GOAL_DURATION_MS + 500;
const SCORE_NUMBER_ANIMATION_DURATION_MS = 2000;
const SCORE_HANDOFF_FADE_DURATION_MS = 350;
const SCORE_REVEAL_PHASE_DURATION_MS = SCORE_NUMBER_ANIMATION_DURATION_MS + SCORE_HANDOFF_FADE_DURATION_MS;

function displayFromGoalEvent(event: GoalScoredEvent): ScoreOnlyDisplay {
  return {
    team: event.team,
    score: event.team === 'A' ? event.scoreA : event.scoreB,
    teamName: event.teamName,
  };
}

function displaysFromGoalEvent(
  event: GoalScoredEvent,
  side: 'A' | 'B' | 'both',
): ScoreOnlyDisplay[] {
  const displays: ScoreOnlyDisplay[] = [];
  if (side === 'A' || side === 'both') {
    displays.push({ team: 'A', score: event.scoreA });
  }
  if (side === 'B' || side === 'both') {
    displays.push({ team: 'B', score: event.scoreB });
  }
  return displays;
}

function displaysFromStateEvent(
  event: ScoreboardStateEvent,
  side: 'A' | 'B' | 'both',
): ScoreOnlyDisplay[] {
  const displays: ScoreOnlyDisplay[] = [];
  if (side === 'A' || side === 'both') {
    displays.push({ team: 'A', score: event.scoreA, teamName: event.nameA });
  }
  if (side === 'B' || side === 'both') {
    displays.push({ team: 'B', score: event.scoreB, teamName: event.nameB });
  }
  return displays;
}

function teamsForScoreSide(side: 'A' | 'B' | 'both'): Array<'A' | 'B'> {
  if (side === 'both') return ['A', 'B'];
  return [side];
}

export default function GoalAnimationOverlay() {
  const [searchParams] = useSearchParams();
  const template = resolveGoalAnimationTemplate(searchParams.get('template'));
  const scoreSide = resolveGoalAnimationSide(searchParams.get('side'));
  const scoreMode = resolveScoreAnimationMode(searchParams.get('mode'));
  const [goalEvent, setGoalEvent] = useState<GoalScoredEvent | null>(null);
  const [scoreDisplays, setScoreDisplays] = useState<ScoreOnlyDisplay[]>([]);
  const [animatedScoreTeams, setAnimatedScoreTeams] = useState<Array<'A' | 'B'>>([]);
  const [isScorePreparing, setIsScorePreparing] = useState(false);
  const [isScoreRevealing, setIsScoreRevealing] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const hideTimerRef = useRef<number | null>(null);
  const pendingScoreGoalRef = useRef<GoalScoredEvent | null>(null);
  const pendingScoreStateRef = useRef<ScoreboardStateEvent | null>(null);
  const scoreReleaseTimerRef = useRef<number | null>(null);
  const scoreRevealTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;

    if (template === 'team-names') return;

    const releasePendingScoreAnimation = (eventId: string) => {
      const pendingGoal = pendingScoreGoalRef.current;
      if (!pendingGoal || pendingGoal.eventId !== eventId) return;

      const pendingState = pendingScoreStateRef.current;
      pendingScoreGoalRef.current = null;
      pendingScoreStateRef.current = null;
      setIsScorePreparing(false);
      setIsScoreRevealing(true);
      if (scoreReleaseTimerRef.current !== null) {
        window.clearTimeout(scoreReleaseTimerRef.current);
        scoreReleaseTimerRef.current = null;
      }
      if (scoreRevealTimerRef.current !== null) {
        window.clearTimeout(scoreRevealTimerRef.current);
      }
      scoreRevealTimerRef.current = window.setTimeout(() => {
        setIsScoreRevealing(false);
        scoreRevealTimerRef.current = null;
      }, SCORE_REVEAL_PHASE_DURATION_MS);

      setScoreDisplays(
        pendingState
          ? displaysFromStateEvent(pendingState, scoreSide)
          : displaysFromGoalEvent(pendingGoal, scoreSide),
      );
      setAnimatedScoreTeams(
        scoreSide === 'both' || scoreSide === pendingGoal.team
          ? [pendingGoal.team]
          : [],
      );
      setAnimationKey((previous) => previous + 1);
    };

    if (template === 'score-only' && scoreMode === 'number') {
      try {
        const savedState = localStorage.getItem(SCOREBOARD_STATE_STORAGE_KEY);
        if (savedState) {
          const parsedState: unknown = JSON.parse(savedState);
          if (isScoreboardStateEvent(parsedState)) {
            setScoreDisplays(displaysFromStateEvent(parsedState, scoreSide));
            setAnimatedScoreTeams([]);
          }
        }
      } catch {
        // Ignore malformed or unavailable persisted state.
      }
    }

    const handleGoal = (event: MessageEvent<unknown>) => {
      const goalEvent = event.data;
      if (!isGoalScoredEvent(goalEvent)) return;
      if (template === 'score-only' && scoreMode === 'number') {
        const isScoringSide = scoreSide === 'both' || scoreSide === goalEvent.team;

        setIsScoreRevealing(false);
        if (scoreRevealTimerRef.current !== null) {
          window.clearTimeout(scoreRevealTimerRef.current);
          scoreRevealTimerRef.current = null;
        }
        setAnimationKey((previous) => previous + 1);
        setAnimatedScoreTeams(isScoringSide ? [goalEvent.team] : []);
        pendingScoreGoalRef.current = goalEvent;
        pendingScoreStateRef.current = null;
        setIsScorePreparing(true);
        if (scoreReleaseTimerRef.current !== null) {
          window.clearTimeout(scoreReleaseTimerRef.current);
        }
        scoreReleaseTimerRef.current = window.setTimeout(() => {
          releasePendingScoreAnimation(goalEvent.eventId);
        }, SCORE_ANIMATION_FALLBACK_DELAY_MS);
        return;
      }

      if (
        template === 'score-only'
        && scoreSide !== 'both'
        && goalEvent.team !== scoreSide
      ) return;

      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }

      setGoalEvent(goalEvent);
      setAnimationKey((previous) => previous + 1);
      hideTimerRef.current = window.setTimeout(() => {
        setGoalEvent(null);
        hideTimerRef.current = null;
      }, DISPLAY_DURATION_MS);
    };

    const handleScoreboardState = (event: MessageEvent<unknown>) => {
      if (template !== 'score-only' || scoreMode !== 'number') return;
      if (!isScoreboardStateEvent(event.data)) return;

      if (pendingScoreGoalRef.current) {
        pendingScoreStateRef.current = event.data;
        return;
      }

      setScoreDisplays(displaysFromStateEvent(event.data, scoreSide));
    };

    const handleTeamNameAnimationCompleted = (event: MessageEvent<unknown>) => {
      const completionEvent = event.data;
      if (template !== 'score-only' || scoreMode !== 'number') return;
      if (!isTeamNameAnimationCompletedEvent(completionEvent)) return;

      releasePendingScoreAnimation(completionEvent.eventId);
    };

    try {
      channel = new BroadcastChannel(SCOREBOARD_EVENT_CHANNEL);
      channel.addEventListener('message', handleGoal);
      channel.addEventListener('message', handleScoreboardState);
      channel.addEventListener('message', handleTeamNameAnimationCompleted);
      if (template === 'score-only' && scoreMode === 'number') {
        requestScoreboardState();
      }
    } catch (error) {
      console.error('[GoalAnimation] Failed to create BroadcastChannel:', error);
    }

    return () => {
      channel?.removeEventListener('message', handleGoal);
      channel?.removeEventListener('message', handleScoreboardState);
      channel?.removeEventListener('message', handleTeamNameAnimationCompleted);
      channel?.close();
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
      if (scoreReleaseTimerRef.current !== null) {
        window.clearTimeout(scoreReleaseTimerRef.current);
      }
      if (scoreRevealTimerRef.current !== null) {
        window.clearTimeout(scoreRevealTimerRef.current);
      }
    };
  }, [scoreMode, scoreSide, template]);

  if (template === 'team-names') {
    return <TeamNamesAnimation side={scoreSide} />;
  }

  if (!goalEvent) {
    if (template === 'score-only' && scoreMode === 'number') {
      return (
        <ScoreOnlyAnimation
          displays={scoreDisplays}
          animationKey={animationKey}
          mode="number"
          animatedTeams={animatedScoreTeams}
          preparing={isScorePreparing}
          revealing={isScoreRevealing}
          preparingTeams={isScorePreparing ? teamsForScoreSide(scoreSide) : []}
          revealingTeams={isScoreRevealing ? animatedScoreTeams : []}
          revealingDelayTeams={isScoreRevealing
            ? teamsForScoreSide(scoreSide).filter((team) => !animatedScoreTeams.includes(team))
            : []}
        />
      );
    }
    return <div className="goal-animation-overlay" aria-hidden="true" />;
  }

  if (template === 'score-only') {
    return (
      <ScoreOnlyAnimation
        displays={[displayFromGoalEvent(goalEvent)]}
        animationKey={animationKey}
        mode={scoreMode}
        animatedTeams={[goalEvent.team]}
      />
    );
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
