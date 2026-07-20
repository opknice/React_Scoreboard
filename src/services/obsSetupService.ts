// OBS Setup Service
// Handles automatic creation of OBS scenes and sources via WebSocket

import { MAIN_SCENE_CONFIG, DEFAULT_VISIBILITY, type SourceConfig } from '../config/obsSetupConfig';

export interface SetupProgress {
  step: string;
  current: number;
  total: number;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
}

export type ProgressCallback = (progress: SetupProgress) => void;

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
    } catch (err) {
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
