import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { League, Match, Team } from '../config/supabaseClient';
import { leagueMemoryCache } from '../utils/memoryCache';
import { useSupabaseLeague } from './useSupabaseLeague';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: (value) => resolvePromise?.(value),
  };
}

const serviceMocks = vi.hoisted(() => ({
  getLeagues: vi.fn<() => Promise<League[]>>(),
  getTeamsByLeague: vi.fn<(leagueId: string) => Promise<Team[]>>(),
  getMatchesByLeague: vi.fn<(leagueId: string) => Promise<Match[]>>(),
  calculateStandings: vi.fn(() => []),
}));

const realtimeMocks = vi.hoisted(() => {
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);

  return {
    channel,
    createChannel: vi.fn(() => channel),
    removeChannel: vi.fn(() => Promise.resolve()),
  };
});

vi.mock('../config/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    channel: realtimeMocks.createChannel,
    removeChannel: realtimeMocks.removeChannel,
  },
}));

vi.mock('../services/leagueService', () => ({
  LeagueService: {
    getLeagues: serviceMocks.getLeagues,
    getTeamsByLeague: serviceMocks.getTeamsByLeague,
    getMatchesByLeague: serviceMocks.getMatchesByLeague,
    calculateStandings: serviceMocks.calculateStandings,
  },
}));

const league: League = {
  id: 'league-1',
  name: 'Performance League',
  is_active: true,
};

const otherLeague: League = {
  id: 'league-2',
  name: 'Other League',
  is_active: true,
};

const teams: Team[] = [
  {
    id: 'team-a',
    league_id: league.id,
    name: 'Alpha',
    color_primary: '#ffffff',
    color_secondary: '#000000',
  },
  {
    id: 'team-b',
    league_id: league.id,
    name: 'Beta',
    color_primary: '#ffffff',
    color_secondary: '#000000',
  },
];

const matches: Match[] = [
  {
    id: 'match-2',
    league_id: league.id,
    match_number: 2,
    team_a_id: 'team-a',
    team_b_id: 'team-b',
    team_a_name: 'Alpha',
    team_b_name: 'Beta',
    score_a: 0,
    score_b: 0,
    status: 'scheduled',
  },
];

const otherTeams: Team[] = [
  {
    id: 'team-c',
    league_id: otherLeague.id,
    name: 'Gamma',
    color_primary: '#ffffff',
    color_secondary: '#000000',
  },
];

const otherMatches: Match[] = [
  {
    id: 'match-other',
    league_id: otherLeague.id,
    match_number: 1,
    team_a_name: 'Gamma',
    team_b_name: 'Delta',
    score_a: 0,
    score_b: 0,
    status: 'scheduled',
  },
];

describe('useSupabaseLeague concurrent details refresh', () => {
  beforeEach(() => {
    leagueMemoryCache.clear();
    serviceMocks.getLeagues.mockReset().mockResolvedValue([league]);
    serviceMocks.getTeamsByLeague.mockReset().mockResolvedValue(teams);
    serviceMocks.getMatchesByLeague.mockReset().mockResolvedValue(matches);
    serviceMocks.calculateStandings.mockClear();
  });

  afterEach(() => {
    leagueMemoryCache.clear();
  });

  it('returns valid data to a manual refresh superseded by another refresh for the same league', async () => {
    const { result, unmount } = renderHook(() => useSupabaseLeague(undefined, 'owner@example.com'));

    await waitFor(() => expect(result.current.leagues).toEqual([league]));
    act(() => result.current.selectLeague(league.id));
    await waitFor(() => expect(result.current.detailsLoadedLeagueId).toBe(league.id));

    const teamsDeferred = createDeferred<Team[]>();
    const matchesDeferred = createDeferred<Match[]>();
    serviceMocks.getTeamsByLeague.mockReturnValue(teamsDeferred.promise);
    serviceMocks.getMatchesByLeague.mockReturnValue(matchesDeferred.promise);

    let manualRefresh!: ReturnType<typeof result.current.refreshLeagueDetails>;
    let competingRefresh!: ReturnType<typeof result.current.refreshLeagueDetails>;
    act(() => {
      manualRefresh = result.current.refreshLeagueDetails();
      // Models the debounced realtime refresh that previously invalidated the
      // direct result awaited by the next-match flow.
      competingRefresh = result.current.refreshLeagueDetails();
    });

    teamsDeferred.resolve(teams);
    matchesDeferred.resolve(matches);

    let manualResult: Awaited<typeof manualRefresh> = null;
    await act(async () => {
      [manualResult] = await Promise.all([manualRefresh, competingRefresh]);
    });

    expect(manualResult).toEqual({ teams, matches });
    expect(result.current.matches).toEqual(matches);
    expect(serviceMocks.getTeamsByLeague).toHaveBeenCalledTimes(2);
    expect(serviceMocks.getMatchesByLeague).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('rejects an old response after the active league changes', async () => {
    serviceMocks.getLeagues.mockResolvedValue([league, otherLeague]);
    const { result, unmount } = renderHook(() => useSupabaseLeague(undefined, 'owner@example.com'));

    await waitFor(() => expect(result.current.leagues).toHaveLength(2));
    act(() => result.current.selectLeague(league.id));
    await waitFor(() => expect(result.current.detailsLoadedLeagueId).toBe(league.id));

    const oldTeamsDeferred = createDeferred<Team[]>();
    const oldMatchesDeferred = createDeferred<Match[]>();
    serviceMocks.getTeamsByLeague.mockImplementation((leagueId) => (
      leagueId === league.id ? oldTeamsDeferred.promise : Promise.resolve(otherTeams)
    ));
    serviceMocks.getMatchesByLeague.mockImplementation((leagueId) => (
      leagueId === league.id ? oldMatchesDeferred.promise : Promise.resolve(otherMatches)
    ));

    let oldLeagueRefresh!: ReturnType<typeof result.current.refreshLeagueDetails>;
    act(() => {
      oldLeagueRefresh = result.current.refreshLeagueDetails();
      result.current.selectLeague(otherLeague.id);
    });

    let oldResult: Awaited<typeof oldLeagueRefresh> = { teams, matches };
    await act(async () => {
      oldTeamsDeferred.resolve(teams);
      oldMatchesDeferred.resolve(matches);
      oldResult = await oldLeagueRefresh;
    });

    expect(oldResult).toBeNull();
    await waitFor(() => expect(result.current.detailsLoadedLeagueId).toBe(otherLeague.id));
    expect(result.current.teams).toEqual(otherTeams);
    expect(result.current.matches).toEqual(otherMatches);
    unmount();
  });
});
