export function buildPlayerBrowserUrl(appBaseUrl: string, leagueId?: string | null): string {
  const params = new URLSearchParams();
  const normalizedLeagueId = leagueId?.trim();
  if (normalizedLeagueId) params.set('league', normalizedLeagueId);

  const query = params.toString();
  return `${appBaseUrl.replace(/\/$/, '')}/player${query ? `?${query}` : ''}`;
}
