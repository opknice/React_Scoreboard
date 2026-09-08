import { describe, expect, it, vi } from 'vitest';
import { OBSSetupService } from './obsSetupService';
import { DEFAULT_TEAM_COLOR_BROWSER_SETTINGS } from '../types/teamColorBrowserSettings';

describe('OBSSetupService Team Color sources', () => {
  it('reuses a source already nested in an OBS group instead of creating a duplicate item', async () => {
    const calls: Array<{ method: string; params?: Record<string, unknown> }> = [];
    const obs = {
      call: vi.fn(async (method: string, params?: Record<string, unknown>) => {
        calls.push({ method, params });
        switch (method) {
          case 'GetSceneList':
            return { scenes: [{ sceneName: 'Main Stream' }] };
          case 'GetInputSettings':
            return { inputSettings: {} };
          case 'GetSceneItemId':
            throw new Error('source is nested');
          case 'GetSceneItemList':
            return { sceneItems: [{ sourceName: 'Main_events', sceneItemId: 10 }] };
          case 'GetGroupSceneItemList':
            return {
              sceneItems: [
                { sourceName: 'Color_Display_A', sceneItemId: 41 },
                { sourceName: 'Color_Display_B', sceneItemId: 42 },
              ],
            };
          case 'SetSceneItemEnabled':
          case 'PressInputPropertiesButton':
          case 'SetSceneItemTransform':
          case 'SetInputSettings':
            return {};
          default:
            throw new Error(`Unexpected OBS call: ${method}`);
        }
      }),
    };

    const result = await new OBSSetupService(obs).addOrUpdateTeamColorBrowserSources(
      DEFAULT_TEAM_COLOR_BROWSER_SETTINGS,
      'league-1',
    );

    expect(result.updatedSources).toEqual(['Color_Display_A', 'Color_Display_B']);
    expect(calls.some((call) => call.method === 'CreateSceneItem')).toBe(false);
    expect(calls.some((call) => call.method === 'SetSceneItemEnabled'
      && call.params?.sceneName === 'Main_events'
      && call.params?.sceneItemId === 41)).toBe(true);
    expect(calls.some((call) => call.method === 'SetSceneItemEnabled'
      && call.params?.sceneName === 'Main_events'
      && call.params?.sceneItemId === 42)).toBe(true);
    expect(calls.some((call) => call.method === 'SetSceneItemTransform'
      && call.params?.sceneName === 'Main_events'
      && call.params?.sceneItemId === 41)).toBe(true);
  });
});

describe('OBSSetupService Player source', () => {
  it('creates a persistent league-scoped Player Browser Source and refreshes it', async () => {
    const calls: Array<{ method: string; params?: Record<string, unknown> }> = [];
    const obs = {
      call: vi.fn(async (method: string, params?: Record<string, unknown>) => {
        calls.push({ method, params });
        switch (method) {
          case 'GetSceneList':
            return { scenes: [{ sceneName: 'Main Stream' }] };
          case 'GetInputSettings':
            throw new Error('source does not exist');
          case 'GetSceneItemId':
            return { sceneItemId: 55 };
          case 'SetSceneItemEnabled':
          case 'PressInputPropertiesButton':
          case 'SetSceneItemTransform':
          case 'CreateInput':
            return {};
          default:
            throw new Error(`Unexpected OBS call: ${method}`);
        }
      }),
    };

    const result = await new OBSSetupService(obs).addOrUpdatePlayerBrowserSource('league-1');
    const createCall = calls.find((call) => call.method === 'CreateInput');
    const createSettings = createCall?.params?.inputSettings as Record<string, unknown> | undefined;

    expect(result.updatedSources).toEqual(['Player_Display']);
    expect(createCall?.params?.inputName).toBe('Player_Display');
    expect(createSettings?.url).toBe(
      'http://localhost:3000/player?league=league-1',
    );
    expect(calls.some((call) => call.method === 'PressInputPropertiesButton'
      && call.params?.inputName === 'Player_Display')).toBe(true);
  });
});
