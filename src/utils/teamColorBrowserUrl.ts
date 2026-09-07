export function buildTeamColorBrowserUrl(
  appBaseUrl: string,
  side: 'A' | 'B',
  leagueId?: string | null,
): string {
  const params = new URLSearchParams({ side });
  const normalizedLeagueId = leagueId?.trim();
  if (normalizedLeagueId) params.set('league', normalizedLeagueId);

  return `${appBaseUrl.replace(/\/$/, '')}/team-color?${params.toString()}`;
}
