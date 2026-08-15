export type TeamNameFontMode = 'auto' | 'manual';
export type TeamNameFontFamily = string;
export type FontWeight = 300 | 400 | 500 | 600 | 700 | 800 | 900;

export interface TeamNameBrowserSettings {
  fontFamily: TeamNameFontFamily;
  fontWeightA: FontWeight;
  fontWeightB: FontWeight;
  fontModeA: TeamNameFontMode;
  fontModeB: TeamNameFontMode;
  fontSizeA: number;
  fontSizeB: number;
}

export const TEAM_NAME_SETTINGS_STORAGE_KEY = 'teamNameBrowserSettings';
export const TEAM_NAME_MIN_FONT_SIZE = 16;
export const TEAM_NAME_MAX_FONT_SIZE = 120;
export const TEAM_NAME_DEFAULT_FONT_SIZE = 48;
export const DEFAULT_FONT_WEIGHT: FontWeight = 700;
export const FONT_WEIGHT_OPTIONS: { value: FontWeight; label: string }[] = [
  { value: 300, label: 'บาง (Light)' },
  { value: 400, label: 'ปกติ (Regular)' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'กึ่งหนา (Semi Bold)' },
  { value: 700, label: 'หนา (Bold)' },
  { value: 800, label: 'หนามาก (Extra Bold)' },
  { value: 900, label: 'ดำ (Black)' },
];

export const TEAM_NAME_FONT_OPTIONS: { value: TeamNameFontFamily; label: string }[] = [
  { value: 'Inter', label: 'Inter (แนะนำ)' },
  { value: 'Kanit', label: 'Kanit' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Impact', label: 'Impact' },
  { value: 'Srinakharinwirot', label: 'Srinakharinwirot-Regular' },
];

export const DEFAULT_TEAM_NAME_BROWSER_SETTINGS: TeamNameBrowserSettings = {
  fontFamily: 'Inter',
  fontWeightA: DEFAULT_FONT_WEIGHT,
  fontWeightB: DEFAULT_FONT_WEIGHT,
  fontModeA: 'auto',
  fontModeB: 'auto',
  fontSizeA: TEAM_NAME_DEFAULT_FONT_SIZE,
  fontSizeB: TEAM_NAME_DEFAULT_FONT_SIZE,
};

export function normalizeTeamNameFontSize(value: unknown, fallback = TEAM_NAME_DEFAULT_FONT_SIZE): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(TEAM_NAME_MAX_FONT_SIZE, Math.max(TEAM_NAME_MIN_FONT_SIZE, Math.round(parsed)));
}

export function normalizeTeamNameFontMode(value: unknown): TeamNameFontMode {
  return value === 'manual' ? 'manual' : 'auto';
}

export function normalizeTeamNameFontFamily(value: unknown): TeamNameFontFamily {
  if (typeof value !== 'string') return DEFAULT_TEAM_NAME_BROWSER_SETTINGS.fontFamily;
  const family = value.trim();
  // Keep the value safe for a CSS custom property while allowing local font names.
  if (!family || family.length > 100 || /["'<>;{}]/.test(family)) {
    return DEFAULT_TEAM_NAME_BROWSER_SETTINGS.fontFamily;
  }
  return family;
}

export function normalizeFontWeight(value: unknown): FontWeight {
  const weight = Number(value);
  return FONT_WEIGHT_OPTIONS.some((option) => option.value === weight)
    ? weight as FontWeight
    : DEFAULT_FONT_WEIGHT;
}

export function normalizeTeamNameBrowserSettings(value: unknown): TeamNameBrowserSettings {
  const candidate = value && typeof value === 'object' ? value as Partial<TeamNameBrowserSettings> : {};
  return {
    fontFamily: normalizeTeamNameFontFamily(candidate.fontFamily),
    fontWeightA: normalizeFontWeight(candidate.fontWeightA),
    fontWeightB: normalizeFontWeight(candidate.fontWeightB),
    fontModeA: normalizeTeamNameFontMode(candidate.fontModeA),
    fontModeB: normalizeTeamNameFontMode(candidate.fontModeB),
    fontSizeA: normalizeTeamNameFontSize(candidate.fontSizeA),
    fontSizeB: normalizeTeamNameFontSize(candidate.fontSizeB),
  };
}
