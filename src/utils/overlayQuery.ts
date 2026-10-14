/** Parses the optional overlay limit while ignoring invalid values. */
export function parseOverlayLimit(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Returns a positive whole-second ticker duration or a safe fallback. */
export function parseTickerDuration(
  value: string | null | undefined,
  fallback = 75,
): number {
  const parsedFallback = Number.isSafeInteger(fallback) && fallback > 0 ? fallback : 75;
  if (!value) return parsedFallback;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return parsedFallback;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : parsedFallback;
}

/** Keeps the latest N items, matching the old limit-to-last behavior. */
export function limitOverlayItems<T>(items: readonly T[], limit: number | null): T[] {
  return limit === null ? [...items] : items.slice(-limit);
}
