/**
 * Utility functions to resolve team logo URLs consistently across all components.
 * 
 * Fallback priority:
 * 1. Full Cloud URL (http:// or https:// - e.g. Cloudinary, Firebase Storage)
 * 2. Custom local folder path (Development mode with logoFolderPath)
 * 3. Deployed public logos folder (/logos/${fileName})
 */

export function getLogoSrc(
  logoIdentifier?: string | null,
  teamName?: string | null,
  logoFolderPath?: string | null
): string {
  const targetName = (logoIdentifier || teamName || '').trim();
  if (!targetName) return '';

  // 1. Check if it's already a full HTTP/HTTPS URL
  if (targetName.startsWith('http://') || targetName.startsWith('https://')) {
    return targetName;
  }

  // 2. Ensure filename extension
  let fileName = targetName;
  if (!fileName.match(/\.(png|jpe?g|gif|webp|svg)$/i)) {
    fileName = `${fileName}.png`;
  }

  // 3. Development mode with custom local folder
  const isDev = import.meta.env?.DEV;
  if (isDev && logoFolderPath) {
    return `/api/logo?path=${encodeURIComponent(logoFolderPath)}&file=${encodeURIComponent(fileName)}`;
  }

  // 4. Default public logos folder
  return `/logos/${encodeURIComponent(fileName)}`;
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
