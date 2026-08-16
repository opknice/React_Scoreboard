// OBS Setup Service
// Handles automatic creation of OBS scenes and sources via WebSocket

import { BROWSER_SOURCES, getOrigin, MAIN_SCENE_CONFIG, DEFAULT_VISIBILITY, type SourceConfig } from '../config/obsSetupConfig';
import type { TeamNameBrowserSettings } from '../types/teamNameBrowserSettings';
import { buildTeamNameBrowserUrl } from '../utils/teamNameBrowserUrl';
import type { ScoreBrowserSettings } from '../types/scoreBrowserSettings';
import { buildScoreBrowserUrl } from '../utils/scoreBrowserUrl';
import type { LogoBrowserSettings } from '../types/logoBrowserSettings';
import { buildLogoBrowserUrl } from '../utils/logoBrowserUrl';

export interface SetupProgress {
  step: string;
  current: number;
  total: number;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
}

export type ProgressCallback = (progress: SetupProgress) => void;

export interface TeamNameBrowserSetupResult {
  success: boolean;
  message: string;
  updatedSources: string[];
}

export class OBSSetupService {
  private obsRef: any;

  constructor(obsRef: any) {
    this.obsRef = obsRef;
  }

  /**
   * Check if OBS is connected
   */
  isConnected(): boolean {
    return !!this.obsRef;
  }

  /**
   * Check if a scene exists
   */
  async sceneExists(sceneName: string): Promise<boolean> {
    try {
      const response = await this.obsRef.call('GetSceneList');
      return response.scenes.some((scene: any) => scene.sceneName === sceneName);
    } catch (err) {
      console.error('[OBS Setup] Error checking scene:', err);
      return false;
    }
  }

  /**
   * Check if a source exists
   */
  async sourceExists(sourceName: string): Promise<boolean> {
    try {
      await this.obsRef.call('GetInputSettings', { inputName: sourceName });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a new scene
   */
  async createScene(sceneName: string): Promise<boolean> {
    try {
      console.log(`[OBS Setup] Creating scene: ${sceneName}`);
      await this.obsRef.call('CreateScene', { sceneName });
      return true;
    } catch (err: any) {
      // Scene might already exist
      if (err?.message?.includes('already exists')) {
        console.log(`[OBS Setup] Scene ${sceneName} already exists`);
        return true;
      }
      console.error('[OBS Setup] Error creating scene:', err);
      throw err;
    }
  }

  /**
   * Create a browser source
   */
  async createBrowserSource(sceneName: string, config: SourceConfig): Promise<void> {
    try {
      console.log(`[OBS Setup] Creating browser source: ${config.name}`);
      
      // Create input
      await this.obsRef.call('CreateInput', {
        sceneName,
        inputName: config.name,
        inputKind: 'browser_source',
        inputSettings: config.settings,
        sceneItemEnabled: DEFAULT_VISIBILITY[config.name] ?? true
      });

      // Set transform if provided
      if (config.transform) {
        await this.setSourceTransform(sceneName, config.name, config.transform);
      }
    } catch (err: any) {
      if (err?.message?.includes('already exists')) {
        console.log(`[OBS Setup] Source ${config.name} already exists, updating...`);
        await this.updateSourceSettings(config.name, config.settings);
      } else {
        throw err;
      }
    }
  }

  /**
   * Create a text source
   */
  async createTextSource(sceneName: string, config: SourceConfig): Promise<void> {
    try {
      console.log(`[OBS Setup] Creating text source: ${config.name}`);
      
      await this.obsRef.call('CreateInput', {
        sceneName,
        inputName: config.name,
        inputKind: 'text_gdiplus_v2', // OBS uses v2 for the API
        inputSettings: config.settings,
        sceneItemEnabled: DEFAULT_VISIBILITY[config.name] ?? true
      });

      if (config.transform) {
        await this.setSourceTransform(sceneName, config.name, config.transform);
      }
    } catch (err: any) {
      if (err?.message?.includes('already exists')) {
        console.log(`[OBS Setup] Source ${config.name} already exists, updating...`);
        await this.updateSourceSettings(config.name, config.settings);
      } else {
        throw err;
      }
    }
  }

  /**
   * Create an image source
   */
  async createImageSource(sceneName: string, config: SourceConfig): Promise<void> {
    try {
      console.log(`[OBS Setup] Creating image source: ${config.name}`);
      
      await this.obsRef.call('CreateInput', {
        sceneName,
        inputName: config.name,
        inputKind: 'image_source',
        inputSettings: config.settings,
        sceneItemEnabled: DEFAULT_VISIBILITY[config.name] ?? true
      });

      if (config.transform) {
        await this.setSourceTransform(sceneName, config.name, config.transform);
      }
    } catch (err: any) {
      if (err?.message?.includes('already exists')) {
        console.log(`[OBS Setup] Source ${config.name} already exists`);
      } else {
        throw err;
      }
    }
  }

  /**
   * Create a color source
   */
  async createColorSource(sceneName: string, config: SourceConfig): Promise<void> {
    try {
      console.log(`[OBS Setup] Creating color source: ${config.name}`);
      
      await this.obsRef.call('CreateInput', {
        sceneName,
        inputName: config.name,
        inputKind: 'color_source_v3',
        inputSettings: config.settings,
        sceneItemEnabled: DEFAULT_VISIBILITY[config.name] ?? true
      });

      if (config.transform) {
        await this.setSourceTransform(sceneName, config.name, config.transform);
      }
    } catch (err: any) {
      if (err?.message?.includes('already exists')) {
        console.log(`[OBS Setup] Source ${config.name} already exists, updating...`);
        await this.updateSourceSettings(config.name, config.settings);
      } else {
        throw err;
      }
    }
  }

  /**
   * Update source settings
   */
  async updateSourceSettings(sourceName: string, settings: Record<string, any>): Promise<void> {
    try {
      await this.obsRef.call('SetInputSettings', {
        inputName: sourceName,
        inputSettings: settings
      });
    } catch (err) {
      console.error(`[OBS Setup] Error updating source ${sourceName}:`, err);
    }
  }

  /**
   * Ensure a source has a scene item in the target scene. Inputs can exist in
   * OBS without being present in the scene, especially after a partial setup.
   */
  private async ensureSceneItem(sceneName: string, sourceName: string, enabled: boolean): Promise<number> {
    try {
      const response = await this.obsRef.call('GetSceneItemId', { sceneName, sourceName });
      await this.setSourceVisibility(sceneName, sourceName, enabled);
      return response.sceneItemId;
    } catch {
      const response = await this.obsRef.call('CreateSceneItem', {
        sceneName,
        sourceName,
        sceneItemEnabled: enabled,
      });
      return response.sceneItemId;
    }
  }

  private async setSourceVisibility(sceneName: string, sourceName: string, enabled: boolean): Promise<void> {
    const response = await this.obsRef.call('GetSceneItemId', { sceneName, sourceName });
    await this.obsRef.call('SetSceneItemEnabled', {
      sceneName,
      sceneItemId: response.sceneItemId,
      sceneItemEnabled: enabled,
    });
  }

  private getTeamNameBrowserConfig(sourceName: 'Team_Name_A' | 'Team_Name_B', settings: TeamNameBrowserSettings): SourceConfig {
    const baseConfig = BROWSER_SOURCES.find((source) => source.name === sourceName);
    if (!baseConfig) throw new Error(`Missing OBS configuration for ${sourceName}`);
    const side = sourceName.endsWith('_A') ? 'A' : 'B';
    return {
      ...baseConfig,
      settings: {
        ...baseConfig.settings,
        url: buildTeamNameBrowserUrl(getOrigin(), side, settings),
      },
    };
  }

  private getScoreBrowserConfig(
    sourceName: 'Score_Display_A' | 'Score_Display_B',
    side: 'A' | 'B',
    settings: ScoreBrowserSettings,
  ): SourceConfig {
    const baseConfig = BROWSER_SOURCES.find((source) => source.name === 'Score_Display');
    if (!baseConfig) throw new Error('Missing OBS configuration for Score_Display');
    return {
      ...baseConfig,
      name: sourceName,
      settings: {
        ...baseConfig.settings,
        url: buildScoreBrowserUrl(getOrigin(), side, settings),
      },
    };
  }

  private getLogoBrowserConfig(
    sourceName: string,
    settings?: LogoBrowserSettings,
  ): SourceConfig {
    const baseConfig = BROWSER_SOURCES.find((source) => source.name === sourceName) || {
      name: sourceName,
      type: 'browser_source' as const,
      settings: {
        width: 1920,
        height: 1080,
        fps: 30,
        shutdown: false,
        restart_when_active: false,
        css: 'body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }'
      }
    };
    const side = sourceName.endsWith('_A') ? 'A' : sourceName.endsWith('_B') ? 'B' : 'both';
    return {
      ...baseConfig,
      name: sourceName,
      settings: {
        ...baseConfig.settings,
        url: buildLogoBrowserUrl(getOrigin(), side, settings),
      },
    };
  }

  /**
   * Add or update the two persistent Team Name Browser Sources. Existing GDI
   * sources are kept intact and simply hidden so the migration is reversible.
   */
  async addOrUpdateTeamNameBrowserSources(
    settings: TeamNameBrowserSettings,
    sceneName = MAIN_SCENE_CONFIG.name,
  ): Promise<TeamNameBrowserSetupResult> {
    if (!this.isConnected()) throw new Error('OBS is not connected');
    if (!(await this.sceneExists(sceneName))) await this.createScene(sceneName);

    const updatedSources: string[] = [];
    for (const sourceName of ['Team_Name_A', 'Team_Name_B'] as const) {
      const config = this.getTeamNameBrowserConfig(sourceName, settings);
      const exists = await this.sourceExists(sourceName);
      if (!exists) {
        await this.obsRef.call('CreateInput', {
          sceneName,
          inputName: config.name,
          inputKind: 'browser_source',
          inputSettings: config.settings,
          sceneItemEnabled: true,
        });
      } else {
        await this.updateSourceSettings(config.name, config.settings);
      }
      await this.ensureSceneItem(sceneName, config.name, true);
      if (config.transform) await this.setSourceTransform(sceneName, config.name, config.transform);
      updatedSources.push(sourceName);
    }

    for (const sourceName of ['name_team_a', 'name_team_b']) {
      await this.setSourceVisibility(sceneName, sourceName, false).catch(() => undefined);
    }

    return {
      success: true,
      message: 'เพิ่ม/อัปเดต Team Name Browser Sources และซ่อน Text GDI เดิมแล้ว',
      updatedSources,
    };
  }

  /** Update only existing Team Name inputs. Never creates inputs or scene items. */
  async updateTeamNameBrowserSources(
    settings: TeamNameBrowserSettings,
  ): Promise<TeamNameBrowserSetupResult> {
    if (!this.isConnected()) throw new Error('OBS is not connected');

    const updatedSources: string[] = [];
    const missingSources: string[] = [];
    for (const sourceName of ['Team_Name_A', 'Team_Name_B'] as const) {
      if (!(await this.sourceExists(sourceName))) {
        missingSources.push(sourceName);
        continue;
      }
      const side = sourceName.endsWith('_A') ? 'A' : 'B';
      const config = this.getTeamNameBrowserConfig(sourceName, settings);
      await this.updateSourceSettings(config.name, config.settings);
      updatedSources.push(`${sourceName} (${side})`);
    }

    return {
      success: true,
      message: updatedSources.length > 0
        ? `อัปเดต Team Name Sources แล้ว: ${updatedSources.join(', ')}${missingSources.length ? `; ไม่พบและข้าม: ${missingSources.join(', ')}` : ''}`
        : 'ไม่พบ Team Name Browser Source ที่มีอยู่ จึงไม่ได้เพิ่ม Source ใหม่',
      updatedSources,
    };
  }

  /** Add or update separate Score A/B Browser Sources while preserving Both. */
  async addOrUpdateScoreBrowserSources(
    settings: ScoreBrowserSettings,
    sceneName = MAIN_SCENE_CONFIG.name,
  ): Promise<TeamNameBrowserSetupResult> {
    if (!this.isConnected()) throw new Error('OBS is not connected');
    if (!(await this.sceneExists(sceneName))) await this.createScene(sceneName);

    const updatedSources: string[] = [];
    for (const definition of [
      { name: 'Score_Display_A', side: 'A' },
      { name: 'Score_Display_B', side: 'B' },
    ] as const) {
      const config = this.getScoreBrowserConfig(definition.name, definition.side, settings);
      if (!(await this.sourceExists(config.name))) {
        await this.obsRef.call('CreateInput', {
          sceneName,
          inputName: config.name,
          inputKind: 'browser_source',
          inputSettings: config.settings,
          sceneItemEnabled: true,
        });
      } else {
        await this.updateSourceSettings(config.name, config.settings);
      }
      await this.ensureSceneItem(sceneName, config.name, true);
      if (config.transform) await this.setSourceTransform(sceneName, config.name, config.transform);
      updatedSources.push(config.name);
    }

    // Keep the legacy Both source available, but hide it while A/B are active
    // to prevent duplicate score numbers in OBS.
    await this.setSourceVisibility(sceneName, 'Score_Display', false).catch(() => undefined);
    return {
      success: true,
      message: 'เพิ่ม/อัปเดต Score A/B Browser Sources และซ่อน Score แบบ Both เดิมแล้ว',
      updatedSources,
    };
  }

  /** Update only existing Score A/B inputs. Never creates inputs or scene items. */
  async updateScoreBrowserSources(
    settings: ScoreBrowserSettings,
  ): Promise<TeamNameBrowserSetupResult> {
    if (!this.isConnected()) throw new Error('OBS is not connected');

    const updatedSources: string[] = [];
    const missingSources: string[] = [];
    for (const definition of [
      { name: 'Score_Display_A', side: 'A' },
      { name: 'Score_Display_B', side: 'B' },
    ] as const) {
      if (!(await this.sourceExists(definition.name))) {
        missingSources.push(definition.name);
        continue;
      }
      const config = this.getScoreBrowserConfig(definition.name, definition.side, settings);
      await this.updateSourceSettings(config.name, config.settings);
      updatedSources.push(config.name);
    }

    return {
      success: true,
      message: updatedSources.length > 0
        ? `อัปเดต Score Sources แล้ว: ${updatedSources.join(', ')}${missingSources.length ? `; ไม่พบและข้าม: ${missingSources.join(', ')}` : ''}`
        : 'ไม่พบ Score A/B Browser Source ที่มีอยู่ จึงไม่ได้เพิ่ม Source ใหม่',
      updatedSources,
    };
  }

  /** Refresh a browser source in OBS Studio to force page reload immediately. */
  async refreshBrowserSource(sourceName: string): Promise<void> {
    try {
      await this.obsRef.call('PressInputPropertiesButton', {
        inputName: sourceName,
        propertyName: 'refresh',
      });
    } catch (err) {
      console.warn(`[OBS Setup] Could not refresh browser source ${sourceName}:`, err);
    }
  }

  /** Add or update persistent Logo Browser Sources and hide legacy image sources. */
  async addOrUpdateLogoBrowserSources(
    settings?: LogoBrowserSettings,
    sceneName = MAIN_SCENE_CONFIG.name,
  ): Promise<TeamNameBrowserSetupResult> {
    if (!this.isConnected()) throw new Error('OBS is not connected');
    if (!(await this.sceneExists(sceneName))) await this.createScene(sceneName);

    const updatedSources: string[] = [];
    for (const sourceName of ['Logo_Display_A', 'Logo_Display_B'] as const) {
      const config = this.getLogoBrowserConfig(sourceName, settings);
      if (!(await this.sourceExists(config.name))) {
        await this.obsRef.call('CreateInput', {
          sceneName,
          inputName: config.name,
          inputKind: 'browser_source',
          inputSettings: config.settings,
          sceneItemEnabled: true,
        });
      } else {
        await this.updateSourceSettings(config.name, config.settings);
      }
      await this.refreshBrowserSource(config.name);
      await this.ensureSceneItem(sceneName, config.name, true);
      if (config.transform) await this.setSourceTransform(sceneName, config.name, config.transform);
      updatedSources.push(sourceName);
    }

    for (const sourceName of ['logo_team_a', 'logo_team_b']) {
      await this.setSourceVisibility(sceneName, sourceName, false).catch(() => undefined);
    }

    return {
      success: true,
      message: 'เพิ่ม/อัปเดต Logo Browser Sources และสั่งรีเฟรช OBS เรียบร้อยแล้ว',
      updatedSources,
    };
  }

  /** Update only existing Logo Browser Sources without creating missing inputs. */
  async updateLogoBrowserSources(
    settings?: LogoBrowserSettings,
  ): Promise<TeamNameBrowserSetupResult> {
    if (!this.isConnected()) throw new Error('OBS is not connected');

    const updatedSources: string[] = [];
    const missingSources: string[] = [];
    const targetSources = ['Logo_Display_A', 'Logo_Display_B', 'Logo_Display', 'Logo_Display_Both', 'Goal_Alert'];

    for (const sourceName of targetSources) {
      if (!(await this.sourceExists(sourceName))) {
        missingSources.push(sourceName);
        continue;
      }
      const config = this.getLogoBrowserConfig(sourceName, settings);
      await this.updateSourceSettings(config.name, config.settings);
      await this.refreshBrowserSource(config.name);
      updatedSources.push(sourceName);
    }

    return {
      success: true,
      message: updatedSources.length > 0
        ? `อัปเดตและสั่งรีเฟรช Logo Sources ใน OBS เรียบร้อยแล้ว: ${updatedSources.join(', ')}`
        : 'ไม่พบ Logo Browser Source ที่มีอยู่ใน OBS (กรุณากด Quick Add Logo A/B to OBS ก่อน)',
      updatedSources,
    };
  }

  /**
   * Set source transform (position, scale, rotation)
   */
  async setSourceTransform(sceneName: string, sourceName: string, transform: any): Promise<void> {
    try {
      // Get scene item ID
      const response = await this.obsRef.call('GetSceneItemId', {
        sceneName,
        sourceName
      });

      const sceneItemId = response.sceneItemId;

      // Set transform
      await this.obsRef.call('SetSceneItemTransform', {
        sceneName,
        sceneItemId,
        sceneItemTransform: {
          positionX: transform.position.x,
          positionY: transform.position.y,
          scaleX: transform.scale.x,
          scaleY: transform.scale.y,
          rotation: transform.rotation || 0,
          alignment: transform.alignment || 5,
          boundsType: transform.boundsType || 0,
          boundsAlignment: transform.boundsAlignment || 0,
          boundsWidth: transform.bounds?.x || 0,
          boundsHeight: transform.bounds?.y || 0
        }
      });
    } catch (err) {
      console.error(`[OBS Setup] Error setting transform for ${sourceName}:`, err);
    }
  }

  /**
   * Create a source based on its type
   */
  async createSource(sceneName: string, config: SourceConfig): Promise<void> {
    switch (config.type) {
      case 'browser_source':
        await this.createBrowserSource(sceneName, config);
        break;
      case 'text_gdiplus_v3':
        await this.createTextSource(sceneName, config);
        break;
      case 'image_source':
        await this.createImageSource(sceneName, config);
        break;
      case 'color_source_v3':
        await this.createColorSource(sceneName, config);
        break;
      default:
        console.warn(`[OBS Setup] Unknown source type: ${config.type}`);
    }
  }

  /**
   * Delete a scene
   */
  async deleteScene(sceneName: string): Promise<void> {
    try {
      console.log(`[OBS Setup] Deleting scene: ${sceneName}`);
      await this.obsRef.call('RemoveScene', { sceneName });
    } catch (err) {
      console.error('[OBS Setup] Error deleting scene:', err);
      throw err;
    }
  }

  /**
   * Main setup function - creates complete OBS scene
   */
  async setupCompleteScene(
    onProgress?: ProgressCallback,
    resetExisting: boolean = false
  ): Promise<{ success: boolean; message: string; errors: string[] }> {
    const errors: string[] = [];
    const sceneName = MAIN_SCENE_CONFIG.name;
    const totalSteps = MAIN_SCENE_CONFIG.sources.length + 2; // +2 for scene creation and finalization
    let currentStep = 0;

    const updateProgress = (step: string, status: 'pending' | 'running' | 'success' | 'error', message: string) => {
      if (onProgress) {
        onProgress({
          step,
          current: currentStep,
          total: totalSteps,
          status,
          message
        });
      }
    };

    try {
      // Check connection
      if (!this.isConnected()) {
        throw new Error('OBS is not connected');
      }

      // Step 1: Check and create/reset scene
      currentStep++;
      updateProgress('scene', 'running', `Setting up scene: ${sceneName}`);
      
      const exists = await this.sceneExists(sceneName);
      
      if (exists && resetExisting) {
        updateProgress('scene', 'running', `Resetting existing scene: ${sceneName}`);
        await this.deleteScene(sceneName);
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for deletion
      }

      if (!exists || resetExisting) {
        await this.createScene(sceneName);
        updateProgress('scene', 'success', `Scene ${sceneName} created`);
      } else {
        updateProgress('scene', 'success', `Scene ${sceneName} already exists`);
      }

      // Step 2: Create all sources
      for (const sourceConfig of MAIN_SCENE_CONFIG.sources) {
        currentStep++;
        updateProgress(
          sourceConfig.name,
          'running',
          `Creating ${sourceConfig.type}: ${sourceConfig.name}`
        );

        try {
          await this.createSource(sceneName, sourceConfig);
          updateProgress(
            sourceConfig.name,
            'success',
            `✓ ${sourceConfig.name} created`
          );
        } catch (err: any) {
          const errorMsg = `Failed to create ${sourceConfig.name}: ${err.message}`;
          errors.push(errorMsg);
          updateProgress(
            sourceConfig.name,
            'error',
            `✗ ${errorMsg}`
          );
        }

        // Small delay to avoid overwhelming OBS
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Step 3: Finalize
      currentStep++;
      updateProgress('finalize', 'running', 'Finalizing setup...');

      // Set the scene as current
      try {
        await this.obsRef.call('SetCurrentProgramScene', { sceneName });
      } catch (err) {
        console.warn('[OBS Setup] Could not set as current scene:', err);
      }

      updateProgress('finalize', 'success', 'Setup complete!');

      return {
        success: errors.length === 0,
        message: errors.length === 0 
          ? `Successfully created scene "${sceneName}" with ${MAIN_SCENE_CONFIG.sources.length} sources!`
          : `Setup completed with ${errors.length} error(s)`,
        errors
      };

    } catch (err: any) {
      const errorMsg = `Setup failed: ${err.message}`;
      errors.push(errorMsg);
      updateProgress('error', 'error', errorMsg);
      
      return {
        success: false,
        message: errorMsg,
        errors
      };
    }
  }

  /**
   * Check setup status - returns which sources are missing
   */
  async checkSetupStatus(): Promise<{
    sceneExists: boolean;
    missingSources: string[];
    existingSources: string[];
  }> {
    const sceneName = MAIN_SCENE_CONFIG.name;
    const sceneExists = await this.sceneExists(sceneName);
    const missingSources: string[] = [];
    const existingSources: string[] = [];

    if (sceneExists) {
      for (const source of MAIN_SCENE_CONFIG.sources) {
        const exists = await this.sourceExists(source.name);
        if (exists) {
          existingSources.push(source.name);
        } else {
          missingSources.push(source.name);
        }
      }
    } else {
      // If scene doesn't exist, all sources are missing
      missingSources.push(...MAIN_SCENE_CONFIG.sources.map(s => s.name));
    }

    return {
      sceneExists,
      missingSources,
      existingSources
    };
  }
}
