import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { League, Match, Team } from '../config/supabaseClient';
import { leagueMemoryCache } from '../utils/memoryCache';
import { useSupabaseLeague } from './useSupabaseLeague';
import { dispatchLeagueChanged } from '../utils/leagueDataEvents';

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
  createTeam: vi.fn<() => Promise<Team>>(),
  deleteTeam: vi.fn<() => Promise<void>>(),
  createMatch: vi.fn<() => Promise<Match>>(),
  deleteMatchesByLeague: vi.fn<() => Promise<void>>(),
  createLeague: vi.fn<() => Promise<League>>(),
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
    ...serviceMocks,
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


describe('league mutation context and targeted refresh', () => {
  beforeEach(() => {
    leagueMemoryCache.clear();
    serviceMocks.getLeagues.mockReset().mockResolvedValue([league, otherLeague]);
    serviceMocks.getTeamsByLeague.mockReset().mockImplementation(async id => id === league.id ? teams : otherTeams);
    serviceMocks.getMatchesByLeague.mockReset().mockImplementation(async id => id === league.id ? matches : otherMatches);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); leagueMemoryCache.clear(); });

  async function setup() {
    const hook = renderHook(({ email }) => useSupabaseLeague(undefined, email), {
      initialProps: { email: 'owner@example.com' },
    });
    await waitFor(() => expect(hook.result.current.leagues).toHaveLength(2));
    act(() => hook.result.current.selectLeague(league.id));
    await waitFor(() => expect(hook.result.current.detailsLoadedLeagueId).toBe(league.id));
    return hook;
  }

  it.each(['other-league', 'return-to-league', 'other-user', 'unmount', 'same-context'] as const)(
    'handles a delayed team creation in %s', async scenario => {
      const { result, rerender, unmount } = await setup();
      const pending = createDeferred<Team>();
      const created = { ...teams[0], id: 'new-team' };
      serviceMocks.createTeam.mockReturnValueOnce(pending.promise);
      let operation!: Promise<Team>;
      act(() => { operation = result.current.createTeam(created); });
      if (scenario === 'other-league' || scenario === 'return-to-league') {
        act(() => result.current.selectLeague(otherLeague.id));
        await waitFor(() => expect(result.current.detailsLoadedLeagueId).toBe(otherLeague.id));
        if (scenario === 'return-to-league') {
          act(() => result.current.selectLeague(league.id));
          await waitFor(() => expect(result.current.detailsLoadedLeagueId).toBe(league.id));
        }
      } else if (scenario === 'other-user') {
        rerender({ email: 'different@example.com' });
        await waitFor(() => expect(result.current.activeLeagueId).toBe(''));
      } else if (scenario === 'unmount') unmount();
      await act(async () => { pending.resolve(created); expect(await operation).toEqual(created); });
      if (scenario === 'same-context') expect(result.current.teams).toContainEqual(created);
      else expect(result.current.teams).not.toContainEqual(created);
    },
  );

  it('does not clear the new league when a previous clear completes', async () => {
    const { result } = await setup();
    const pending = createDeferred<void>();
    serviceMocks.deleteMatchesByLeague.mockReturnValueOnce(pending.promise);
    let operation!: Promise<void>;
    act(() => { operation = result.current.clearMatches(); result.current.selectLeague(otherLeague.id); });
    await waitFor(() => expect(result.current.matches).toEqual(otherMatches));
    await act(async () => { pending.resolve(); await operation; });
    expect(result.current.matches).toEqual(otherMatches);
  });

  it('does not append a delayed match to another league', async () => {
    const { result } = await setup();
    const pending = createDeferred<Match>();
    serviceMocks.createMatch.mockReturnValueOnce(pending.promise);
    let operation!: Promise<Match>;
    act(() => { operation = result.current.createMatch(matches[0]); result.current.selectLeague(otherLeague.id); });
    await waitFor(() => expect(result.current.matches).toEqual(otherMatches));
    await act(async () => { pending.resolve(matches[0]); await operation; });
    expect(result.current.matches).toEqual(otherMatches);
  });

  it('does not select a newly created league after the user has selected another one', async () => {
    const { result } = await setup();
    const pending = createDeferred<League>();
    serviceMocks.createLeague.mockReturnValueOnce(pending.promise);
    let operation!: Promise<League>;
    act(() => { operation = result.current.createLeague({ name: 'New', is_active: true }); result.current.selectLeague(otherLeague.id); });
    await act(async () => { pending.resolve({ id: 'new-league', name: 'New', is_active: true }); await operation; });
    expect(result.current.activeLeagueId).toBe(otherLeague.id);
  });

  it('refreshes only changed rows and coalesces bursts', async () => {
    const { result } = await setup();
    vi.useFakeTimers();
    const originalMatches = result.current.matches;
    serviceMocks.getLeagues.mockClear(); serviceMocks.getTeamsByLeague.mockClear(); serviceMocks.getMatchesByLeague.mockClear();
    await act(async () => {
      for (let i = 0; i < 5; i++) dispatchLeagueChanged(league.id, 'teams');
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(serviceMocks.getTeamsByLeague).toHaveBeenCalledTimes(1);
    expect(serviceMocks.getMatchesByLeague).not.toHaveBeenCalled();
    expect(serviceMocks.getLeagues).not.toHaveBeenCalled();
    expect(result.current.matches).toBe(originalMatches);
    serviceMocks.getTeamsByLeague.mockClear();
    await act(async () => {
      dispatchLeagueChanged(league.id, 'players', 'team-a');
      dispatchLeagueChanged(league.id, 'player_match_stats', 'team-a');
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(serviceMocks.getTeamsByLeague).not.toHaveBeenCalled();
    expect(serviceMocks.getMatchesByLeague).not.toHaveBeenCalled();
    expect(serviceMocks.getLeagues).not.toHaveBeenCalled();
  });
  it('invalidates match references and player data after deleting a team', async () => {
    const { result } = await setup();
    vi.useFakeTimers();
    serviceMocks.deleteTeam.mockResolvedValueOnce();
    serviceMocks.getMatchesByLeague.mockClear();
    const events: string[] = [];
    const listener = (event: Event) => { events.push((event as CustomEvent).detail.table); };
    window.addEventListener('supabase_league_changed', listener);
    try {
      await act(async () => { await result.current.deleteTeam('team-a'); await vi.advanceTimersByTimeAsync(250); });
      expect(events).toEqual(['teams', 'matches', 'players', 'player_match_stats']);
      expect(serviceMocks.getMatchesByLeague).toHaveBeenCalledTimes(1);
    } finally { window.removeEventListener('supabase_league_changed', listener); }
  });

  it('commits independently overlapping team and match refreshes', async () => {
    const { result } = await setup();
    vi.useFakeTimers();
    const nextTeams = [{ ...teams[0], name: 'Updated' }];
    const nextMatches = [{ ...matches[0], score_a: 3 }];
    const pendingTeams = createDeferred<Team[]>();
    const pendingMatches = createDeferred<Match[]>();
    serviceMocks.getTeamsByLeague.mockReturnValueOnce(pendingTeams.promise);
    serviceMocks.getMatchesByLeague.mockReturnValueOnce(pendingMatches.promise);
    await act(async () => { dispatchLeagueChanged(league.id, 'teams'); await vi.advanceTimersByTimeAsync(250); });
    await act(async () => { dispatchLeagueChanged(league.id, 'matches'); await vi.advanceTimersByTimeAsync(250); });
    await act(async () => { pendingMatches.resolve(nextMatches); });
    await act(async () => { pendingTeams.resolve(nextTeams); });
    expect(result.current.teams).toEqual(nextTeams);
    expect(result.current.matches).toEqual(nextMatches);
  });

  it('preserves current rows when a mutation fails', async () => {
    const { result } = await setup();
    serviceMocks.createTeam.mockRejectedValueOnce(new Error('save failed'));
    await act(async () => { await expect(result.current.createTeam(teams[0])).rejects.toThrow('save failed'); });
    expect(result.current.teams).toEqual(teams);
    expect(result.current.matches).toEqual(matches);
  });

});
