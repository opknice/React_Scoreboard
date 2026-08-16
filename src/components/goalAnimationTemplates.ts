export type GoalAnimationTemplateId = 'classic' | 'score-only' | 'team-names' | 'team-logos';
export type GoalAnimationSide = 'A' | 'B' | 'both';
export type ScoreAnimationMode = 'number' | 'effect';

/** Keeps `/goal-animation` backwards compatible with the original Classic animation. */
export function resolveGoalAnimationTemplate(value: string | null): GoalAnimationTemplateId {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  return normalized === 'score-only' || normalized === 'score'
    ? 'score-only'
    : normalized === 'team-names' || normalized === 'team-name' || normalized === 'names'
      ? 'team-names'
      : normalized === 'team-logos' || normalized === 'team-logo' || normalized === 'logos' || normalized === 'logo'
        ? 'team-logos'
    : 'classic';
}

/** Missing or invalid side means animate whichever team scored. */
export function resolveGoalAnimationSide(value: string | null): GoalAnimationSide {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'a') return 'A';
  if (normalized === 'b') return 'B';
  return 'both';
}

/** Number mode is the default; effect mode keeps the Native OBS score visible. */
export function resolveScoreAnimationMode(value: string | null): ScoreAnimationMode {
  return String(value || '').trim().toLowerCase() === 'effect' ? 'effect' : 'number';
}
