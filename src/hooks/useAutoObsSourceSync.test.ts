import { act, renderHook } from '@testing-library/react';
import type OBSWebSocket from 'obs-websocket-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LOGO_BROWSER_SETTINGS } from '../types/logoBrowserSettings';
import { DEFAULT_SCORE_BROWSER_SETTINGS } from '../types/scoreBrowserSettings';
import { DEFAULT_TEAM_NAME_BROWSER_SETTINGS } from '../types/teamNameBrowserSettings';
import { DEFAULT_TEAM_COLOR_BROWSER_SETTINGS } from '../types/teamColorBrowserSettings';
import { useAutoObsSourceSync } from './useAutoObsSourceSync';

const serviceMocks = vi.hoisted(() => ({
  updateLogo: vi.fn<() => Promise<void>>(),
  updateScore: vi.fn<() => Promise<void>>(),
  updateTeamName: vi.fn<() => Promise<void>>(),
  updateTeamColor: vi.fn<() => Promise<void>>(),
}));

vi.mock('../services/obsSetupService', () => ({
  OBSSetupService: class {
    updateTeamNameBrowserSources = serviceMocks.updateTeamName;
    updateLogoBrowserSources = serviceMocks.updateLogo;
    updateScoreBrowserSources = serviceMocks.updateScore;
    updateTeamColorBrowserSources = serviceMocks.updateTeamColor;
  },
}));

describe('useAutoObsSourceSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    serviceMocks.updateLogo.mockReset().mockResolvedValue(undefined);
    serviceMocks.updateScore.mockReset().mockResolvedValue(undefined);
    serviceMocks.updateTeamName.mockReset().mockResolvedValue(undefined);
    serviceMocks.updateTeamColor.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not sync settings when only the obs wrapper object changes', () => {
    const obsRef = {} as OBSWebSocket;
    const getObsRef = vi.fn(() => obsRef);
    const initialProps = {
      obs: { isConnected: true, getObsRef },
      teamNameSettings: DEFAULT_TEAM_NAME_BROWSER_SETTINGS,
      logoSettings: DEFAULT_LOGO_BROWSER_SETTINGS,
      scoreSettings: DEFAULT_SCORE_BROWSER_SETTINGS,
    };

    const { rerender } = renderHook(
      (props: typeof initialProps) => useAutoObsSourceSync(props),
      { initialProps },
    );

    // Simulates an unrelated parent render such as the one-second timer tick.
    rerender({ ...initialProps, obs: { ...initialProps.obs } });
    act(() => vi.advanceTimersByTime(1_000));

    expect(serviceMocks.updateTeamName).not.toHaveBeenCalled();
    expect(serviceMocks.updateLogo).not.toHaveBeenCalled();
    expect(serviceMocks.updateScore).not.toHaveBeenCalled();
  });

  it('debounces and syncs only the settings group that changed', () => {
    const obsRef = {} as OBSWebSocket;
    const getObsRef = vi.fn(() => obsRef);
    const initialProps = {
      obs: { isConnected: true, getObsRef },
      teamNameSettings: DEFAULT_TEAM_NAME_BROWSER_SETTINGS,
      logoSettings: DEFAULT_LOGO_BROWSER_SETTINGS,
      scoreSettings: DEFAULT_SCORE_BROWSER_SETTINGS,
    };
    const { rerender } = renderHook(
      (props: typeof initialProps) => useAutoObsSourceSync(props),
      { initialProps },
    );

    rerender({
      ...initialProps,
      teamNameSettings: {
        ...DEFAULT_TEAM_NAME_BROWSER_SETTINGS,
        fontSizeA: DEFAULT_TEAM_NAME_BROWSER_SETTINGS.fontSizeA + 1,
      },
    });

    act(() => vi.advanceTimersByTime(299));
    expect(serviceMocks.updateTeamName).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(serviceMocks.updateTeamName).toHaveBeenCalledTimes(1);
    expect(serviceMocks.updateLogo).not.toHaveBeenCalled();
    expect(serviceMocks.updateScore).not.toHaveBeenCalled();
  });

  it('syncs Team Color sources with the selected league URL', () => {
    const obsRef = {} as OBSWebSocket;
    const getObsRef = vi.fn(() => obsRef);
    const initialProps = {
      obs: { isConnected: true, getObsRef },
      teamNameSettings: DEFAULT_TEAM_NAME_BROWSER_SETTINGS,
      logoSettings: DEFAULT_LOGO_BROWSER_SETTINGS,
      scoreSettings: DEFAULT_SCORE_BROWSER_SETTINGS,
      teamColorSettings: DEFAULT_TEAM_COLOR_BROWSER_SETTINGS,
      activeLeagueId: 'league-1',
    };
    const { rerender } = renderHook(
      (props: typeof initialProps) => useAutoObsSourceSync(props),
      { initialProps },
    );

    rerender({
      ...initialProps,
      teamColorSettings: {
        ...DEFAULT_TEAM_COLOR_BROWSER_SETTINGS,
        appearance: { ...DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.appearance, width: 360 },
      },
    });
    act(() => vi.advanceTimersByTime(300));

    expect(serviceMocks.updateTeamColor).toHaveBeenCalledTimes(1);
    expect(serviceMocks.updateTeamColor).toHaveBeenCalledWith(expect.objectContaining({
      appearance: expect.objectContaining({ width: 360 }),
    }), 'league-1');
  });
});
