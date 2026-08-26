export function decodeUrlSafeBase64(value: string): string {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return atob(padded);
  } catch {
    return '';
  }
}

export function parseFirebaseConfigFromSearchParams(searchParams: URLSearchParams): Record<string, unknown> | null {
  const encoded = searchParams.get('fb') || searchParams.get('firebaseConfig');
  if (!encoded) return null;

  try {
    return JSON.parse(decodeUrlSafeBase64(encoded)) as Record<string, unknown>;
  } catch {
    try {
      return JSON.parse(decodeURIComponent(encoded)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
