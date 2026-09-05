import { filterFinishedMatches } from './finishedMatch';
import type { OverlayMatch, OverlayTeam } from '../types/overlay';
import type { CropMetadata } from '../types/teamLogo';

export interface CalculatedStanding {
  teamId?: string | null;
  team: string;
  logo: string;
  crop?: CropMetadata | null;
  P: number;
  W: number;
  D: number;
  L: number;
  GF: number;
  GA: number;
  GD: number;
  Pts: number;
}

const createEmptyStanding = (team: OverlayTeam): CalculatedStanding => ({
  teamId: team.id,
  team: team.name,
  logo: team.logo || '',
  crop: team.crop || null,
  P: 0,
  W: 0,
  D: 0,
  L: 0,
  GF: 0,
  GA: 0,
  GD: 0,
  Pts: 0,
});

/**
 * Builds standings from finished matches only while retaining every
 * registered team as a zero-stat row when it has no finished match yet.
 */
export const calculateFinishedStandings = (
  matches: readonly OverlayMatch[],
  registeredTeams: readonly OverlayTeam[] = [],
): CalculatedStanding[] => {
  const stats: Record<string, CalculatedStanding> = {};

  registeredTeams.forEach((team) => {
    const teamName = team.name.trim();
    if (teamName) stats[teamName] = createEmptyStanding({ ...team, name: teamName });
  });

  filterFinishedMatches(matches).forEach((match) => {
    const teamA = (match.teamA || '').trim();
    const teamB = (match.teamB || '').trim();
    if (!teamA || !teamB) return;

    const scoreA = Number(match.scoreA);
    const scoreB = Number(match.scoreB);
    if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return;

    stats[teamA] ||= createEmptyStanding({ name: teamA, logo: match.logoA });
    stats[teamB] ||= createEmptyStanding({ name: teamB, logo: match.logoB });

    const a = stats[teamA];
    const b = stats[teamB];
    if (!a.logo && match.logoA) a.logo = match.logoA;
    if (!b.logo && match.logoB) b.logo = match.logoB;
    if (!a.crop && match.cropA) a.crop = match.cropA;
    if (!b.crop && match.cropB) b.crop = match.cropB;

    a.P += 1;
    b.P += 1;
    a.GF += scoreA;
    a.GA += scoreB;
    b.GF += scoreB;
    b.GA += scoreA;

    if (scoreA > scoreB) {
      a.W += 1;
      a.Pts += 3;
      b.L += 1;
    } else if (scoreA < scoreB) {
      b.W += 1;
      b.Pts += 3;
      a.L += 1;
    } else {
      a.D += 1;
      b.D += 1;
      a.Pts += 1;
      b.Pts += 1;
    }
  });

  return Object.values(stats)
    .map((row) => ({ ...row, GD: row.GF - row.GA }))
    .sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || a.team.localeCompare(b.team, 'th'));
};
