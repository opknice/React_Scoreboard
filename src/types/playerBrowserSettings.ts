export const PLAYER_BROWSER_CANVAS_WIDTH = 1920;
export const PLAYER_BROWSER_CANVAS_HEIGHT = 1080;
export const PLAYER_BROWSER_SETTINGS_STORAGE_KEY = 'player_browser_settings_v1';

export interface PlayerBrowserElementSettings {
  x: number;
  y: number;
  size: number;
}

export interface PlayerBrowserSettings {
  image: PlayerBrowserElementSettings;
  jersey: PlayerBrowserElementSettings;
  name: PlayerBrowserElementSettings;
}

export interface PlayerBrowserSettingsUpdatedEvent {
  type: 'PlayerBrowserSettingsUpdated';
  settings: PlayerBrowserSettings;
  timestamp: number;
}

export const DEFAULT_PLAYER_BROWSER_SETTINGS: PlayerBrowserSettings = {
  image: { x: 960, y: 400, size: 220 },
  jersey: { x: 820, y: 390, size: 72 },
  name: { x: 960, y: 570, size: 48 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeElement(
  value: unknown,
  fallback: PlayerBrowserElementSettings,
  maxSize: number,
): PlayerBrowserElementSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const source = value as Partial<PlayerBrowserElementSettings>;
  return {
    x: clamp(Number.isFinite(source.x) ? Number(source.x) : fallback.x, 0, PLAYER_BROWSER_CANVAS_WIDTH),
    y: clamp(Number.isFinite(source.y) ? Number(source.y) : fallback.y, 0, PLAYER_BROWSER_CANVAS_HEIGHT),
    size: clamp(Number.isFinite(source.size) ? Number(source.size) : fallback.size, 8, maxSize),
  };
}

export function normalizePlayerBrowserSettings(value: unknown): PlayerBrowserSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_PLAYER_BROWSER_SETTINGS;
  const source = value as Partial<PlayerBrowserSettings>;
  return {
    image: normalizeElement(source.image, DEFAULT_PLAYER_BROWSER_SETTINGS.image, 720),
    jersey: normalizeElement(source.jersey, DEFAULT_PLAYER_BROWSER_SETTINGS.jersey, 240),
    name: normalizeElement(source.name, DEFAULT_PLAYER_BROWSER_SETTINGS.name, 180),
  };
}

export function isPlayerBrowserSettingsUpdatedEvent(value: unknown): value is PlayerBrowserSettingsUpdatedEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<PlayerBrowserSettingsUpdatedEvent>;
  return event.type === 'PlayerBrowserSettingsUpdated'
    && typeof event.timestamp === 'number'
    && JSON.stringify(normalizePlayerBrowserSettings(event.settings)) === JSON.stringify(event.settings);
}
