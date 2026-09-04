import type { CropMetadata } from '../types/teamLogo';
import type { Json } from '../types/supabase';

/**
 * Utility function to resolve team logo URLs consistently across all components.
 *
 * Fallback priority:
 * 1. Full Cloud URL (http:// or https://)
 * 2. Custom local folder path (Development mode with logoFolderPath)
 * 3. Deployed public logos folder (/logos/${fileName})
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

  // 3. Ensure filename extension for static/local resolving
  const targetName = primary || secondary;
  if (!targetName) return '';

  let fileName = targetName;
  if (!fileName.match(/\.(png|jpe?g|gif|webp|svg)$/i)) {
    fileName = `${fileName}.png`;
  }

  // 4. Development mode with custom local folder
  const isDev = import.meta.env?.DEV;
  if (isDev && logoFolderPath) {
    return `/api/logo?path=${encodeURIComponent(logoFolderPath)}&file=${encodeURIComponent(fileName)}`;
  }

  // 5. Default public logos folder
  return `/logos/${encodeURIComponent(fileName)}`;
}

export interface TeamLogoRecord {
  id: string;
  name: string;
  logo_url?: string | null;
  overlay_crop_metadata?: Json | null;
  logo_browser_crop_metadata?: Json | null;
  crop?: CropMetadata | null;
}

function normalizeTeamName(teamName: string): string {
  return teamName.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

/** Resolves a Supabase team logo by stable ID first, then normalized name. */
export function findTeamLogoRecord(
  teams: readonly TeamLogoRecord[],
  teamId?: string | null,
  teamName?: string | null,
): TeamLogoRecord | undefined {
  const byId = teamId ? teams.find((team) => team.id === teamId) : undefined;
  if (byId) return byId;

  const normalizedName = teamName ? normalizeTeamName(teamName) : '';
  if (!normalizedName) return undefined;

  return teams.find((team) => normalizeTeamName(team.name) === normalizedName);
}

export function resolveTeamLogo(
  teams: readonly TeamLogoRecord[],
  teamId?: string | null,
  teamName?: string | null,
): string {
  return findTeamLogoRecord(teams, teamId, teamName)?.logo_url || '';
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
