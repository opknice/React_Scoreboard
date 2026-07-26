import { ref, onValue, update } from 'firebase/database';
import type { Database } from 'firebase/database';

// Global cache for team logos loaded from Firebase Realtime DB (teams/ node)
const globalTeamsCache: Record<string, string> = {};

/**
 * Normalizes team name to a clean lookup key
 */
export function normalizeTeamKey(teamName: string): string {
  return String(teamName || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-.()[\]/\\]+/g, '');
}

/**
 * Updates the global teams cache with logo URLs
 */
export function updateGlobalTeamsCache(teamsData: Record<string, any>) {
  if (!teamsData) return;
  Object.keys(teamsData).forEach((key) => {
    const item = teamsData[key];
    const teamName = typeof item === 'object' ? item.name || key : key;
    const logoUrl = typeof item === 'object' ? item.logo || item.url || '' : String(item);
    if (logoUrl) {
      const cleanKey = normalizeTeamKey(teamName);
      globalTeamsCache[cleanKey] = logoUrl;
    }
  });
}

/**
 * Utility function to resolve team logo URLs consistently across all components.
 * 
 * Fallback priority:
 * 1. Full Cloud URL (http:// or https://)
 * 2. Lookup in Global Teams Cache (loaded from Firebase Realtime DB `teams/` node)
 * 3. Custom local folder path (Development mode with logoFolderPath)
 * 4. Deployed public logos folder (/logos/${fileName})
 */
export function getLogoSrc(
  logoIdentifier?: string | null,
  teamName?: string | null,
  logoFolderPath?: string | null
): string {
  const primary = (logoIdentifier || '').trim();
  const secondary = (teamName || '').trim();

  // 1. Check if primary is already a full HTTP/HTTPS URL
  if (primary.startsWith('http://') || primary.startsWith('https://')) {
    return primary;
  }

  // 2. Check if secondary is a full HTTP/HTTPS URL
  if (secondary.startsWith('http://') || secondary.startsWith('https://')) {
    return secondary;
  }

  // 3. Lookup in global Firebase teams cache
  if (secondary) {
    const cachedByTeam = globalTeamsCache[normalizeTeamKey(secondary)];
    if (cachedByTeam) return cachedByTeam;
  }
  if (primary) {
    const cachedByPrimary = globalTeamsCache[normalizeTeamKey(primary)];
    if (cachedByPrimary) return cachedByPrimary;
  }

  // 4. Ensure filename extension for static/local resolving
  const targetName = primary || secondary;
  if (!targetName) return '';

  let fileName = targetName;
  if (!fileName.match(/\.(png|jpe?g|gif|webp|svg)$/i)) {
    fileName = `${fileName}.png`;
  }

  // 5. Development mode with custom local folder
  const isDev = import.meta.env?.DEV;
  if (isDev && logoFolderPath) {
    return `/api/logo?path=${encodeURIComponent(logoFolderPath)}&file=${encodeURIComponent(fileName)}`;
  }

  // 6. Default public logos folder
  return `/logos/${encodeURIComponent(fileName)}`;
}

/**
 * Helper to extract team logo URL or filename from a Firebase match object,
 * checking multiple common field names (logoA, logo_a, logoUrlA, logo1, urlA, etc.)
 * and falling back to global teams cache if empty.
 */
export function extractMatchLogo(match: any, teamSide: 'A' | 'B'): string {
  if (!match) return '';
  const teamName = teamSide === 'A' ? match.teamA : match.teamB;

  let logo = '';
  if (teamSide === 'A') {
    logo = (
      match.logoA ||
      match.logo_a ||
      match.logoUrlA ||
      match.logo_url_a ||
      match.logo1 ||
      match.urlA ||
      match.url_a ||
      ''
    ).toString().trim();
  } else {
    logo = (
      match.logoB ||
      match.logo_b ||
      match.logoUrlB ||
      match.logo_url_b ||
      match.logo2 ||
      match.urlB ||
      match.url_b ||
      ''
    ).toString().trim();
  }

  if (logo && (logo.startsWith('http://') || logo.startsWith('https://'))) {
    return logo;
  }

  if (teamName) {
    const cached = globalTeamsCache[normalizeTeamKey(teamName)];
    if (cached) return cached;
  }

  return logo;
}

/**
 * Listens to Firebase Realtime Database `teams` node and updates cache
 */
export function listenToFirebaseTeams(
  db: Database,
  onUpdate?: (teamsMap: Record<string, { name: string; logo: string }>) => void
) {
  try {
    const teamsRef = ref(db, 'teams');
    return onValue(teamsRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        updateGlobalTeamsCache(val);
        if (onUpdate) {
          const parsedMap: Record<string, { name: string; logo: string }> = {};
          Object.keys(val).forEach((k) => {
            const item = val[k];
            if (typeof item === 'object') {
              parsedMap[k] = { name: item.name || k, logo: item.logo || item.url || '' };
            } else {
              parsedMap[k] = { name: k, logo: String(item) };
            }
          });
          onUpdate(parsedMap);
        }
      }
    });
  } catch (err) {
    console.error('Failed to listen to Firebase teams:', err);
    return () => { };
  }
}

/**
 * Batch saves team logo mappings to Firebase Realtime Database under `teams/`
 */
export async function saveTeamsToFirebase(
  db: Database,
  teamsMap: Record<string, { name: string; logo: string }>
) {
  const teamsRef = ref(db, 'teams');
  const updates: Record<string, any> = {};

  Object.values(teamsMap).forEach(({ name, logo }) => {
    if (!name) return;
    const key = normalizeTeamKey(name);
    updates[key] = {
      name: name.trim(),
      logo: (logo || '').trim(),
      updatedAt: new Date().toISOString()
    };
  });

  if (Object.keys(updates).length > 0) {
    await update(teamsRef, updates);
    updateGlobalTeamsCache(updates);
  }
}

/**
 * Extracts clean team initials for text fallback
 */
export function getTeamInitials(teamName?: string | null): string {
  if (!teamName) return '';
  const clean = teamName.replace(/<br\s*\/?>/gi, ' ').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.slice(0, 3).toUpperCase();
}
