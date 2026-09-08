import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useScoreboardTeamPlayers } from './useScoreboardTeamPlayers';
import { dispatchLeagueChanged } from '../utils/leagueDataEvents';

afterEach(() => { cleanup(); vi.useRealTimers(); });

it('reloads a roster only for its player events, coalesces bursts and handles missing DELETE IDs', async () => {
  const fetchPlayers = vi.fn().mockResolvedValue([]);
  const { result } = renderHook(() => useScoreboardTeamPlayers('team-a', 'league-a', fetchPlayers));
  await waitFor(() => expect(result.current.loading).toBe(false));
  fetchPlayers.mockClear();
  vi.useFakeTimers();
  await act(async () => {
    dispatchLeagueChanged('league-a', 'player_match_stats', 'team-a');
    dispatchLeagueChanged('league-b', 'players', 'team-a');
    dispatchLeagueChanged('league-a', 'players', 'team-b');
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(fetchPlayers).not.toHaveBeenCalled();
  await act(async () => {
    for (let i = 0; i < 4; i++) dispatchLeagueChanged('league-a', 'players', 'team-a');
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(fetchPlayers).toHaveBeenCalledTimes(1);
  await act(async () => {
    dispatchLeagueChanged(undefined, 'players');
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(fetchPlayers).toHaveBeenCalledTimes(2);
});
