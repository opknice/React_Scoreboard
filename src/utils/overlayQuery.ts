/** Parses the optional overlay limit while ignoring invalid values. */
export function parseOverlayLimit(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Keeps the latest N items, matching the old limit-to-last behavior. */
export function limitOverlayItems<T>(items: readonly T[], limit: number | null): T[] {
  return limit === null ? [...items] : items.slice(-limit);
}
