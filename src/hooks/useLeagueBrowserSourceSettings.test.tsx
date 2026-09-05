import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { League } from '../config/supabaseClient';
import {
  TEAM_NAME_SETTINGS_STORAGE_KEY,
  type TeamNameBrowserSettings,
} from '../types/teamNameBrowserSettings';
import { SCORE_SETTINGS_STORAGE_KEY } from '../types/scoreBrowserSettings';
import { useLeagueBrowserSourceSettings } from './useLeagueBrowserSourceSettings';

function createLeague(id: string, settings: League['settings'] = {}): League {
  return {
    id,
    name: `League ${id}`,
    is_active: true,
    settings,
  };
}

describe('useLeagueBrowserSourceSettings', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists global settings only to localStorage when no league is selected', () => {
    const updateLeague = vi.fn();
    const { result } = renderHook(() => useLeagueBrowserSourceSettings({
      activeLeague: null,
      updateLeague,
    }));

    act(() => result.current.updateTeamNameSettings({ fontFamily: 'Kanit' }));

    const saved = JSON.parse(window.localStorage.getItem(TEAM_NAME_SETTINGS_STORAGE_KEY) ?? '{}') as TeamNameBrowserSettings;
    expect(saved.fontFamily).toBe('Kanit');
    expect(window.localStorage.getItem(SCORE_SETTINGS_STORAGE_KEY)).toBeNull();
    expect(result.current.scope).toBe('global');
    expect(updateLeague).not.toHaveBeenCalled();
  });

  it('uses global fallback then saves both normalized groups to the selected league', async () => {
    window.localStorage.setItem(TEAM_NAME_SETTINGS_STORAGE_KEY, JSON.stringify({ fontFamily: 'Kanit' }));
    const league = createLeague('a', { detailLabels: { label4: 'Round' } });
    const updateLeague = vi.fn(async (id: string, updates: Partial<League>) => ({
      ...league,
      id,
      ...updates,
    }));

    const { result } = renderHook(() => useLeagueBrowserSourceSettings({
      activeLeague: league,
      updateLeague,
      debounceMs: 500,
    }));

    expect(result.current.teamNameSettings.fontFamily).toBe('Kanit');
    expect(result.current.scope).toBe('global');

    act(() => result.current.updateScoreSettings({ fontSizeA: 96 }));
    expect(window.localStorage.getItem(SCORE_SETTINGS_STORAGE_KEY)).toBeNull();
    expect(result.current.saveStatus).toBe('saving');

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(updateLeague).toHaveBeenCalledTimes(1);
    expect(updateLeague).toHaveBeenCalledWith(
      'a',
      {
        settings: expect.objectContaining({
          detailLabels: { label4: 'Round' },
          browserSources: expect.objectContaining({
            teamName: expect.objectContaining({ fontFamily: 'Kanit' }),
            score: expect.objectContaining({ fontSizeA: 96 }),
          }),
        }),
      },
      { silent: true },
    );
    expect(result.current.saveStatus).toBe('saved');
  });

  it('flushes the old league before switching and hydrates the new league', async () => {
    const leagueA = createLeague('a');
    const leagueB = createLeague('b', {
      browserSources: {
        teamName: { fontFamily: 'Arial' },
        score: { fontFamily: 'Arial' },
      },
    });
    const updateLeague = vi.fn(async (id: string, updates: Partial<League>) => ({
      ...createLeague(id),
      ...updates,
    }));

    const { result, rerender } = renderHook(
      ({ league }: { league: League }) => useLeagueBrowserSourceSettings({
        activeLeague: league,
        updateLeague,
        debounceMs: 500,
      }),
      { initialProps: { league: leagueA } },
    );

    act(() => result.current.updateTeamNameSettings({ fontSizeA: 64 }));
    await act(async () => {
      rerender({ league: leagueB });
      await Promise.resolve();
    });

    expect(updateLeague).toHaveBeenCalledTimes(1);
    expect(updateLeague.mock.calls[0]?.[0]).toBe('a');
    expect(result.current.teamNameSettings.fontFamily).toBe('Arial');
    expect(result.current.scoreSettings.fontFamily).toBe('Arial');
    expect(result.current.scope).toBe('league');
  });
});
