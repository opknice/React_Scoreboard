import { isFinishedMatch } from './finishedMatch';
import { parseMatchScore } from './matchScore';
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

const normalizeTeamName = (name: string): string => name
  .trim()
  .toLocaleLowerCase('th')
  .replace(/\s+/g, ' ');

interface StandingIdentityIndex {
  rows: Map<string, CalculatedStanding>;
  keysByName: Map<string, Set<string>>;
}

function registerName(index: StandingIdentityIndex, name: string, key: string): void {
  const normalized = normalizeTeamName(name);
  if (!normalized) return;
  const keys = index.keysByName.get(normalized) ?? new Set<string>();
  keys.add(key);
  index.keysByName.set(normalized, keys);
}

function resolveStandingKey(
  index: StandingIdentityIndex,
  id: string | null | undefined,
  name: string,
): string | null {
  const cleanId = id?.trim();
  if (cleanId) return `id:${cleanId}`;

  const normalizedName = normalizeTeamName(name);
  if (!normalizedName) return null;
  const registeredKeys = index.keysByName.get(normalizedName);
  if (registeredKeys?.size === 1) return [...registeredKeys][0];
  if (registeredKeys && registeredKeys.size > 1) return null;
  return `legacy:${normalizedName}`;
}

function ensureMatchTeam(
  index: StandingIdentityIndex,
  key: string,
  team: OverlayTeam,
): CalculatedStanding {
  const existing = index.rows.get(key);
  if (existing) return existing;

  const created = createEmptyStanding(team);
  index.rows.set(key, created);
  registerName(index, team.name, key);
  return created;
}

/**
 * Builds standings from finished matches only while retaining every
 * registered team as a zero-stat row when it has no finished match yet.
 */
export const calculateFinishedStandings = (
  matches: readonly OverlayMatch[],
  registeredTeams: readonly OverlayTeam[] = [],
): CalculatedStanding[] => {
  const index: StandingIdentityIndex = {
    rows: new Map<string, CalculatedStanding>(),
    keysByName: new Map<string, Set<string>>(),
  };

  registeredTeams.forEach((team) => {
    const teamName = team.name.trim();
    if (!teamName) return;
    const cleanId = team.id?.trim();
    const key = cleanId ? `id:${cleanId}` : `legacy:${normalizeTeamName(teamName)}`;
    if (!index.rows.has(key)) {
      index.rows.set(key, createEmptyStanding({ ...team, id: cleanId || null, name: teamName }));
    }
    registerName(index, teamName, key);
  });

  matches.forEach((match) => {
    if (!isFinishedMatch(match)) return;
    const teamA = (match.teamA || '').trim();
    const teamB = (match.teamB || '').trim();
    if (!teamA || !teamB) return;

    const scoreA = parseMatchScore(match.scoreA);
    const scoreB = parseMatchScore(match.scoreB);
    if (scoreA === null || scoreB === null) return;

    const keyA = resolveStandingKey(index, match.teamIdA, teamA);
    const keyB = resolveStandingKey(index, match.teamIdB, teamB);
    if (!keyA || !keyB || keyA === keyB) return;

    const a = ensureMatchTeam(index, keyA, {
      id: match.teamIdA,
      name: teamA,
      logo: match.logoA,
      crop: match.cropA,
    });
    const b = ensureMatchTeam(index, keyB, {
      id: match.teamIdB,
      name: teamB,
      logo: match.logoB,
      crop: match.cropB,
    });
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

  return [...index.rows.values()]
    .map((row) => ({ ...row, GD: row.GF - row.GA }))
    .sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || a.team.localeCompare(b.team, 'th'));
};
