import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LEAGUE_DETAIL_LABELS,
  type LeagueDetailLabels,
} from '../types/leagueDetailLabels';
import { useLeagueDetailLabelsObsSync } from './useLeagueDetailLabelsObsSync';

describe('useLeagueDetailLabelsObsSync', () => {
  it('updates only the existing label_4 through label_10 sources', () => {
    const setText = vi.fn().mockResolvedValue(undefined);
    const labels: LeagueDetailLabels = {
      ...DEFAULT_LEAGUE_DETAIL_LABELS,
      label4: 'รอบชิง',
      label10: 'สนาม 1',
    };

    renderHook(() => useLeagueDetailLabelsObsSync({
      obs: { isConnected: true, setText },
      activeLeagueId: 'league-1',
      labels,
    }));

    expect(setText).toHaveBeenCalledTimes(7);
    expect(setText).toHaveBeenNthCalledWith(1, 'label_4', 'รอบชิง');
    expect(setText).toHaveBeenNthCalledWith(7, 'label_10', 'สนาม 1');
  });

  it('resends persisted values when the OBS connection changes', () => {
    const setText = vi.fn().mockResolvedValue(undefined);
    const labels: LeagueDetailLabels = {
      ...DEFAULT_LEAGUE_DETAIL_LABELS,
      label6: 'สัปดาห์ที่ 2',
    };
    const { rerender } = renderHook(
      ({ isConnected }: { isConnected: boolean }) => useLeagueDetailLabelsObsSync({
        obs: { isConnected, setText },
        activeLeagueId: 'league-1',
        labels,
      }),
      { initialProps: { isConnected: true } },
    );

    rerender({ isConnected: false });
    rerender({ isConnected: true });

    expect(setText).toHaveBeenCalledTimes(14);
    expect(setText).toHaveBeenCalledWith('label_6', 'สัปดาห์ที่ 2');
  });
});
