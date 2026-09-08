function buildScreenUrl(appBaseUrl: string, route: string): string {
  return `${appBaseUrl.replace(/\/$/, '')}/${route}`;
}

export function buildVarReplayBrowserUrl(appBaseUrl: string): string {
  return buildScreenUrl(appBaseUrl, 'var-replay-v2/screen');
}

export function buildInstantReplayBrowserUrl(appBaseUrl: string): string {
  return buildScreenUrl(appBaseUrl, 'replay/screen');
}
