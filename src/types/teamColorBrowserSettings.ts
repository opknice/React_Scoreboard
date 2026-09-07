/**
 * Presentation settings for the static Team Color Browser Sources.
 *
 * Team colors themselves remain owned by the `teams` table. This type only
 * describes how those colors are rendered and where each color slot is placed on
 * the 1920x1080 design canvas.
 */

export type TeamColorShapePreset = 'circle' | 'square' | 'custom';
export type TeamColorReference = 'primary' | 'secondary' | 'custom';
export type TeamColorSlot = 'A1' | 'A2' | 'B1' | 'B2';

export interface TeamColorPosition {
  /** Top-left position in design-canvas pixels. */
  x: number;
  y: number;
}

export interface TeamColorAppearance {
  preset: TeamColorShapePreset;
  width: number;
  height: number;
  borderRadius: number;

  fillColorSource: TeamColorReference;
  customFillColor: string;
  fillOpacity: number;

  borderEnabled: boolean;
  borderColorSource: TeamColorReference;
  customBorderColor: string;
  borderWidth: number;
  borderOpacity: number;

  shadowEnabled: boolean;
  shadowColor: string;
  shadowOpacity: number;
  shadowBlur: number;
  shadowSpread: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}

export interface TeamColorBrowserSettings {
  version: 2;
  canvasWidth: number;
  canvasHeight: number;
  appearance: TeamColorAppearance;
  positions: {
    A1: TeamColorPosition;
    A2: TeamColorPosition;
    B1: TeamColorPosition;
    B2: TeamColorPosition;
  };
}

/** Partial update accepted by settings editors; nested groups are patchable. */
export type TeamColorBrowserSettingsPatch = Partial<
  Omit<TeamColorBrowserSettings, 'appearance' | 'positions'>
> & {
  appearance?: Partial<TeamColorAppearance>;
  positions?: {
    A1?: Partial<TeamColorPosition>;
    A2?: Partial<TeamColorPosition>;
    B1?: Partial<TeamColorPosition>;
    B2?: Partial<TeamColorPosition>;
  };
};

export const TEAM_COLOR_CANVAS_WIDTH = 1920;
export const TEAM_COLOR_CANVAS_HEIGHT = 1080;

export const TEAM_COLOR_MIN_WIDTH = 1;
export const TEAM_COLOR_MAX_WIDTH = TEAM_COLOR_CANVAS_WIDTH;
export const TEAM_COLOR_MIN_HEIGHT = 1;
export const TEAM_COLOR_MAX_HEIGHT = TEAM_COLOR_CANVAS_HEIGHT;
export const TEAM_COLOR_MAX_BORDER_RADIUS = 960;
export const TEAM_COLOR_MAX_BORDER_WIDTH = 100;
export const TEAM_COLOR_MAX_SHADOW_BLUR = 300;
export const TEAM_COLOR_MAX_SHADOW_SPREAD = 200;
export const TEAM_COLOR_MAX_SHADOW_OFFSET = 1000;

export const TEAM_COLOR_SETTINGS_STORAGE_KEY = 'teamColorBrowserSettings';

export const DEFAULT_TEAM_COLOR_BROWSER_SETTINGS: TeamColorBrowserSettings = {
  version: 2,
  canvasWidth: TEAM_COLOR_CANVAS_WIDTH,
  canvasHeight: TEAM_COLOR_CANVAS_HEIGHT,
  appearance: {
    preset: 'square',
    width: 50,
    height: 50,
    borderRadius: 12,
    fillColorSource: 'primary',
    customFillColor: '#ffffff',
    fillOpacity: 1,
    borderEnabled: false,
    borderColorSource: 'custom',
    customBorderColor: '#000000',
    borderWidth: 4,
    borderOpacity: 1,
    shadowEnabled: false,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowBlur: 12,
    shadowSpread: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 4,
  },
  positions: {
    A1: { x: 180, y: 24 },
    A2: { x: 180, y: 124 },
    B1: { x: 1460, y: 24 },
    B2: { x: 1460, y: 124 },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Merge a league override on top of the global settings without dropping
 * unrelated nested appearance or position fields.
 */
export function mergeTeamColorBrowserSettings(
  base: TeamColorBrowserSettings,
  override: unknown,
): TeamColorBrowserSettings {
  if (!isRecord(override)) return normalizeTeamColorBrowserSettings(base);

  const overrideAppearance = isRecord(override.appearance) ? override.appearance : {};
  const overridePositions = isRecord(override.positions) ? override.positions : {};
  const overridePositionA1 = isRecord(overridePositions.A1)
    ? overridePositions.A1
    : isRecord(overridePositions.A) ? overridePositions.A : {};
  const overridePositionB1 = isRecord(overridePositions.B1)
    ? overridePositions.B1
    : isRecord(overridePositions.B) ? overridePositions.B : {};

  return normalizeTeamColorBrowserSettings({
    ...base,
    ...override,
    appearance: {
      ...base.appearance,
      ...overrideAppearance,
    },
    positions: {
      ...base.positions,
      ...overridePositions,
      A1: { ...base.positions.A1, ...overridePositionA1 },
      A2: { ...base.positions.A2, ...(isRecord(overridePositions.A2) ? overridePositions.A2 : {}) },
      B1: { ...base.positions.B1, ...overridePositionB1 },
      B2: { ...base.positions.B2, ...(isRecord(overridePositions.B2) ? overridePositions.B2 : {}) },
    },
  });
}

function readRecordValue(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  round = true,
): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const bounded = clamp(parsed, min, max);
  return round ? Math.round(bounded) : bounded;
}

function normalizeHex(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeShapePreset(value: unknown): TeamColorShapePreset {
  return value === 'circle' || value === 'square' || value === 'custom'
    ? value
    : DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.preset;
}

function normalizeColorReference(
  value: unknown,
  fallback: TeamColorReference = 'primary',
): TeamColorReference {
  return value === 'primary' || value === 'secondary' || value === 'custom' ? value : fallback;
}

function normalizePosition(
  value: unknown,
  fallback: TeamColorPosition,
  width: number,
  height: number,
): TeamColorPosition {
  const candidate = isRecord(value) ? value : {};
  return {
    x: normalizeNumber(readRecordValue(candidate, 'x'), fallback.x, 0, TEAM_COLOR_CANVAS_WIDTH - width),
    y: normalizeNumber(readRecordValue(candidate, 'y'), fallback.y, 0, TEAM_COLOR_CANVAS_HEIGHT - height),
  };
}

function readPositionCandidate(positions: Record<string, unknown>, slot: TeamColorSlot): unknown {
  if (positions[slot] !== undefined) return positions[slot];
  // Migrate the Phase 1 A/B positions to the first slot of each team.
  if (slot === 'A1') return positions.A;
  if (slot === 'B1') return positions.B;
  return undefined;
}

/** Converts untrusted localStorage/Supabase JSON into safe render settings. */
export function normalizeTeamColorBrowserSettings(value: unknown): TeamColorBrowserSettings {
  const candidate = isRecord(value) ? value : {};
  const rawAppearance = readRecordValue(candidate, 'appearance');
  const appearance = isRecord(rawAppearance) ? rawAppearance : {};

  const width = normalizeNumber(
    readRecordValue(appearance, 'width'),
    DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.width,
    TEAM_COLOR_MIN_WIDTH,
    TEAM_COLOR_MAX_WIDTH,
  );
  const height = normalizeNumber(
    readRecordValue(appearance, 'height'),
    DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.height,
    TEAM_COLOR_MIN_HEIGHT,
    TEAM_COLOR_MAX_HEIGHT,
  );
  const maxRadius = Math.min(TEAM_COLOR_MAX_BORDER_RADIUS, Math.floor(Math.min(width, height) / 2));

  const rawPositions = readRecordValue(candidate, 'positions');
  const positions = isRecord(rawPositions) ? rawPositions : {};

  return {
    version: 2,
    canvasWidth: TEAM_COLOR_CANVAS_WIDTH,
    canvasHeight: TEAM_COLOR_CANVAS_HEIGHT,
    appearance: {
      preset: normalizeShapePreset(readRecordValue(appearance, 'preset')),
      width,
      height,
      borderRadius: normalizeNumber(
        readRecordValue(appearance, 'borderRadius'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.borderRadius,
        0,
        maxRadius,
      ),
      fillColorSource: normalizeColorReference(readRecordValue(appearance, 'fillColorSource')),
      customFillColor: normalizeHex(
        readRecordValue(appearance, 'customFillColor'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.customFillColor,
      ),
      fillOpacity: normalizeNumber(
        readRecordValue(appearance, 'fillOpacity'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.fillOpacity,
        0,
        1,
        false,
      ),
      borderEnabled: normalizeBoolean(
        readRecordValue(appearance, 'borderEnabled'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.borderEnabled,
      ),
      borderColorSource: normalizeColorReference(
        readRecordValue(appearance, 'borderColorSource'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.borderColorSource,
      ),
      customBorderColor: normalizeHex(
        readRecordValue(appearance, 'customBorderColor'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.customBorderColor,
      ),
      borderWidth: normalizeNumber(
        readRecordValue(appearance, 'borderWidth'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.borderWidth,
        0,
        TEAM_COLOR_MAX_BORDER_WIDTH,
      ),
      borderOpacity: normalizeNumber(
        readRecordValue(appearance, 'borderOpacity'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.borderOpacity,
        0,
        1,
        false,
      ),
      shadowEnabled: normalizeBoolean(
        readRecordValue(appearance, 'shadowEnabled'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.shadowEnabled,
      ),
      shadowColor: normalizeHex(
        readRecordValue(appearance, 'shadowColor'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.shadowColor,
      ),
      shadowOpacity: normalizeNumber(
        readRecordValue(appearance, 'shadowOpacity'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.shadowOpacity,
        0,
        1,
        false,
      ),
      shadowBlur: normalizeNumber(
        readRecordValue(appearance, 'shadowBlur'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.shadowBlur,
        0,
        TEAM_COLOR_MAX_SHADOW_BLUR,
      ),
      shadowSpread: normalizeNumber(
        readRecordValue(appearance, 'shadowSpread'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.shadowSpread,
        0,
        TEAM_COLOR_MAX_SHADOW_SPREAD,
      ),
      shadowOffsetX: normalizeNumber(
        readRecordValue(appearance, 'shadowOffsetX'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.shadowOffsetX,
        -TEAM_COLOR_MAX_SHADOW_OFFSET,
        TEAM_COLOR_MAX_SHADOW_OFFSET,
      ),
      shadowOffsetY: normalizeNumber(
        readRecordValue(appearance, 'shadowOffsetY'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance.shadowOffsetY,
        -TEAM_COLOR_MAX_SHADOW_OFFSET,
        TEAM_COLOR_MAX_SHADOW_OFFSET,
      ),
    },
    positions: {
      A1: normalizePosition(
        readPositionCandidate(positions, 'A1'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.positions.A1,
        width,
        height,
      ),
      A2: normalizePosition(
        readPositionCandidate(positions, 'A2'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.positions.A2,
        width,
        height,
      ),
      B1: normalizePosition(
        readPositionCandidate(positions, 'B1'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.positions.B1,
        width,
        height,
      ),
      B2: normalizePosition(
        readPositionCandidate(positions, 'B2'),
        DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.positions.B2,
        width,
        height,
      ),
    },
  };
}
