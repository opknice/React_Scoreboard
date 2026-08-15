import type { CSSProperties } from 'react';
import type { ScoreAnimationMode } from './goalAnimationTemplates';
import { getScorePresentation } from '../utils/scoreBrowserUrl';
import './ScoreOnlyAnimation.css';

export interface ScoreOnlyDisplay {
  team: 'A' | 'B';
  score: number;
  teamName?: string;
}

interface ScoreOnlyAnimationProps {
  displays: ScoreOnlyDisplay[];
  animationKey: number;
  mode: ScoreAnimationMode;
  animatedTeams: Array<'A' | 'B'>;
  preparing?: boolean;
  revealing?: boolean;
  preparingTeams?: Array<'A' | 'B'>;
  revealingTeams?: Array<'A' | 'B'>;
  revealingDelayTeams?: Array<'A' | 'B'>;
}

function getScoreFontSize(score: number): string {
  const digits = Math.max(1, Math.abs(Math.trunc(score)).toString().length);
  if (digits <= 2) return 'clamp(3rem, 3.75vw, 4.5rem)';
  if (digits === 3) return 'clamp(2.7rem, 3.35vw, 4rem)';
  return 'clamp(2.35rem, 2.95vw, 3.5rem)';
}

/**
 * Animates the score area without drawing another full scoreboard over OBS's
 * The number mode renders the real score value for a Browser Source that
 * replaces the matching Native OBS score source. Effect mode leaves the
 * Native OBS score visible and only renders the impact layer.
 *
 * When a team scores, the old score slides out downward while the new score
 * drops in from above — like an odometer / slot machine flip.
 */
export default function ScoreOnlyAnimation({
  displays,
  animationKey,
  mode,
  animatedTeams,
  preparing = false,
  revealing = false,
  preparingTeams,
  revealingTeams,
  revealingDelayTeams,
}: ScoreOnlyAnimationProps) {
  return (
    <div
      key={animationKey}
      className="score-only-animation-overlay"
      role="status"
      aria-label="Scoreboard score display"
    >
      {displays.map((display) => {
        const presentation = getScorePresentation(window.location.search, display.team);
        const style = {
          '--score-only-x': display.team === 'A' ? '41.6667%' : '57.2917%',
          '--score-only-font-family': presentation.fontFamily,
          '--score-only-font-weight': presentation.fontWeight,
          '--score-only-font-size': presentation.fontMode === 'manual'
            ? `${presentation.fontSize}px`
            : getScoreFontSize(display.score),
        } as CSSProperties;

        const isPreparing = preparingTeams
          ? preparingTeams.includes(display.team)
          : preparing;
        const isRevealing = revealingTeams
          ? revealingTeams.includes(display.team)
          : revealing;
        const isRevealingDelayed = revealingDelayTeams?.includes(display.team) ?? false;
        const isAnimating = !isPreparing && (mode === 'effect' || animatedTeams.includes(display.team));
        const oldScore = display.score - 1;

        return (
          <div
            key={display.team}
            className={`score-only-instance ${isAnimating ? 'score-only-instance--animate' : 'score-only-instance--persistent'}`}
            style={style}
          >

            {mode === 'number' ? (
              <div
                className={`score-only-score-wrap ${isPreparing ? 'score-only-score-wrap--preparing' : ''} ${isRevealing ? 'score-only-score-wrap--revealing' : ''} ${isRevealingDelayed ? 'score-only-score-wrap--revealing-delayed' : ''}`}
                aria-label={`Score ${display.team} ${display.score}`}
              >
                {/* เลขเก่า — เลื่อนลงหาย (เฉพาะตอน animate) */}
                {isAnimating && (
                  <span className="score-only-score score-only-score--out">
                    {oldScore}
                  </span>
                )}
                {/* เลขใหม่ — ตกลงมาจากบน */}
                <span className={`score-only-score ${isAnimating ? 'score-only-score--in' : 'score-only-score--static'}`}>
                  {display.score}
                </span>
              </div>
            ) : (
              <div className="score-only-delta">+1</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
