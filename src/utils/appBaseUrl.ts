export function getAppBaseUrl(): string {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${basePath}`;
  }
  return `http://localhost:5173${basePath}`;
}
