export interface BrowserPosition { x: number; y: number }
export interface BrowserPositions { A: BrowserPosition; B: BrowserPosition }
export const BROWSER_CANVAS_WIDTH = 1920;
export const BROWSER_CANVAS_HEIGHT = 1080;
// Preserve the existing percentage anchors, including fractional pixels.
export const TEAM_NAME_POSITIONS: BrowserPositions = { A: { x: 399.99936, y: 39.96 }, B: { x: 1500, y: 39.96 } };
export const LOGO_POSITIONS: BrowserPositions = { A: { x: 199.68, y: 540 }, B: { x: 1720.32, y: 540 } };
export const SCORE_POSITIONS: BrowserPositions = { A: { x: 800.00064, y: 50.004 }, B: { x: 1100.00064, y: 50.004 } };

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function coordinate(value: unknown, fallback: number, max: number): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(0, number)) : fallback;
}
export function normalizeBrowserPositions(value: unknown, fallback: BrowserPositions): BrowserPositions {
  const source = record(value);
  const side = (key: 'A' | 'B'): BrowserPosition => {
    const position = record(source[key]);
    return { x: coordinate(position.x, fallback[key].x, BROWSER_CANVAS_WIDTH), y: coordinate(position.y, fallback[key].y, BROWSER_CANVAS_HEIGHT) };
  };
  return { A: side('A'), B: side('B') };
}
export function readBrowserPosition(search: string | URLSearchParams, side: 'A' | 'B', fallback: BrowserPositions): BrowserPosition {
  const params = typeof search === 'string' ? new URLSearchParams(search.includes('?') ? search.slice(search.indexOf('?') + 1) : search) : search;
  return normalizeBrowserPositions({ [side]: { x: params.get(`x${side}`) ?? params.get('x'), y: params.get(`y${side}`) ?? params.get('y') } }, fallback)[side];
}
export function browserPositionParams(positions: BrowserPositions): Record<string, string> {
  return { xA: String(positions.A.x), yA: String(positions.A.y), xB: String(positions.B.x), yB: String(positions.B.y) };
}
