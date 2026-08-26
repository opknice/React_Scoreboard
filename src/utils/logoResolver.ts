// Shared in-memory cache for the owner-scoped Supabase team logos.
const globalTeamsCache: Record<string, string> = {};

/** Normalizes a team name to a stable lookup key. */
export function normalizeTeamKey(teamName: string): string {
  return String(teamName || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-.()[\]/\\]+/g, '');
}

/** Replaces the shared cache with teams from the selected league. */
export function replaceGlobalTeamsCacheFromSupabase(
  teams: ReadonlyArray<{ name: string; logoUrl: string }>,
): void {
  Object.keys(globalTeamsCache).forEach((key) => delete globalTeamsCache[key]);
  teams.forEach((team) => {
    const key = normalizeTeamKey(team.name);
    const logoUrl = team.logoUrl.trim();
    if (key && logoUrl) globalTeamsCache[key] = logoUrl;
  });
}

/**
 * Resolves a team logo from a URL, the selected league cache, or a local asset.
 */
export function getLogoSrc(
  logoIdentifier?: string | null,
  teamName?: string | null,
  logoFolderPath?: string | null,
): string {
  const primary = (logoIdentifier || '').trim();
  const secondary = (teamName || '').trim();

  if (primary.startsWith('http://') || primary.startsWith('https://')) return primary;
  if (secondary.startsWith('http://') || secondary.startsWith('https://')) return secondary;

  if (secondary) {
    const cachedByTeam = globalTeamsCache[normalizeTeamKey(secondary)];
    if (cachedByTeam) return cachedByTeam;
  }
  if (primary) {
    const cachedByPrimary = globalTeamsCache[normalizeTeamKey(primary)];
    if (cachedByPrimary) return cachedByPrimary;
  }

  const targetName = primary || secondary;
  if (!targetName) return '';

  let fileName = targetName;
  if (!fileName.match(/\.(png|jpe?g|gif|webp|svg)$/i)) fileName = `${fileName}.png`;

  if (import.meta.env?.DEV && logoFolderPath) {
    return `/api/logo?path=${encodeURIComponent(logoFolderPath)}&file=${encodeURIComponent(fileName)}`;
  }

  return `/logos/${encodeURIComponent(fileName)}`;
}

/** Extracts a logo identifier from a normalized or legacy-shaped match object. */
export function extractMatchLogo(match: Record<string, unknown>, teamSide: 'A' | 'B'): string {
  const teamName = teamSide === 'A' ? match.teamA : match.teamB;
  const candidateKeys = teamSide === 'A'
    ? ['logoA', 'logo_a', 'logoUrlA', 'logo_url_a', 'logo1', 'urlA', 'url_a']
    : ['logoB', 'logo_b', 'logoUrlB', 'logo_url_b', 'logo2', 'urlB', 'url_b'];
  const logo = candidateKeys
    .map((key) => match[key])
    .find((value) => value !== undefined && value !== null && String(value).trim() !== '');
  const normalizedLogo = String(logo || '').trim();

  if (normalizedLogo.startsWith('http://') || normalizedLogo.startsWith('https://')) return normalizedLogo;

  if (teamName) {
    const cached = globalTeamsCache[normalizeTeamKey(String(teamName))];
    if (cached) return cached;
  }

  return normalizedLogo;
}

/** Returns a short text fallback for a team logo. */
export function getTeamInitials(teamName?: string | null): string {
  if (!teamName) return '';
  const clean = teamName.replace(/<br\s*\/?>(?:\s*)/gi, ' ').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return clean.slice(0, 3).toUpperCase();
}
