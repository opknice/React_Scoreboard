import type { Match } from '../config/supabaseClient';

export interface ScoreboardMatchResult {
  teamIdA: string | null;
  teamIdB: string | null;
  teamNameA: string;
  teamNameB: string;
  scoreA: number;
  scoreB: number;
}

export type CanonicalMatchResult =
  | {
      ok: true;
      orientation: 'direct' | 'swapped';
      score_a: number;
      score_b: number;
    }
  | {
      ok: false;
      reason: 'missing-team-identity' | 'team-mismatch';
    };

function normalizeTeamName(name: string): string {
  return name.trim().toLowerCase();
}

function matchesCanonicalTeam(
  canonicalId: string | null | undefined,
  canonicalName: string,
  scoreboardId: string | null,
  scoreboardName: string,
): boolean {
  if (canonicalId) return scoreboardId === canonicalId;

  const normalizedCanonicalName = normalizeTeamName(canonicalName);
  const normalizedScoreboardName = normalizeTeamName(scoreboardName);
  return Boolean(normalizedCanonicalName && normalizedScoreboardName)
    && normalizedCanonicalName === normalizedScoreboardName;
}

/**
 * Maps the scoreboard's visual A/B positions back to the match's canonical
 * team_a/team_b columns. Team IDs are authoritative when the match has them;
 * normalized names are only a compatibility fallback for legacy match rows.
 */
export function resolveCanonicalMatchResult(
  match: Pick<Match, 'team_a_id' | 'team_b_id' | 'team_a_name' | 'team_b_name'>,
  scoreboard: ScoreboardMatchResult,
): CanonicalMatchResult {
  const scoreboardHasTeamAIdentity = Boolean(scoreboard.teamIdA || normalizeTeamName(scoreboard.teamNameA));
  const scoreboardHasTeamBIdentity = Boolean(scoreboard.teamIdB || normalizeTeamName(scoreboard.teamNameB));
  const matchHasTeamAIdentity = Boolean(match.team_a_id || normalizeTeamName(match.team_a_name));
  const matchHasTeamBIdentity = Boolean(match.team_b_id || normalizeTeamName(match.team_b_name));
  if (!scoreboardHasTeamAIdentity || !scoreboardHasTeamBIdentity || !matchHasTeamAIdentity || !matchHasTeamBIdentity) {
    return { ok: false, reason: 'missing-team-identity' };
  }
  if (match.team_a_id && match.team_b_id && (!scoreboard.teamIdA || !scoreboard.teamIdB)) {
    return { ok: false, reason: 'missing-team-identity' };
  }

  const isDirect = matchesCanonicalTeam(
    match.team_a_id,
    match.team_a_name,
    scoreboard.teamIdA,
    scoreboard.teamNameA,
  ) && matchesCanonicalTeam(
    match.team_b_id,
    match.team_b_name,
    scoreboard.teamIdB,
    scoreboard.teamNameB,
  );
  const isSwapped = matchesCanonicalTeam(
    match.team_a_id,
    match.team_a_name,
    scoreboard.teamIdB,
    scoreboard.teamNameB,
  ) && matchesCanonicalTeam(
    match.team_b_id,
    match.team_b_name,
    scoreboard.teamIdA,
    scoreboard.teamNameA,
  );

  if (!isDirect && !isSwapped) {
    return { ok: false, reason: 'team-mismatch' };
  }

  return isDirect
    ? {
        ok: true,
        orientation: 'direct',
        score_a: scoreboard.scoreA,
        score_b: scoreboard.scoreB,
      }
    : {
        ok: true,
        orientation: 'swapped',
        score_a: scoreboard.scoreB,
        score_b: scoreboard.scoreA,
      };
}
