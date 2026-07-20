// Macro Engine for OBS Automation
// Similar to Advanced Scene Switcher but runs in web app

export type MacroConditionType = 
  | 'manual' // User clicks button
  | 'scene_active' // Scene is active
  | 'source_visible' // Source is visible
  | 'timer' // Timer/delay based
  | 'scene_duration' // Scene active for X seconds
  | 'audio' // Audio level threshold
  | 'video' // Video playing state
  | 'streaming' // Streaming status
  | 'recording' // Recording status
  | 'replay_buffer' // Replay buffer status
  | 'time' // Specific time of day
  | 'date' // Specific date
  | 'idle' // System idle time
  | 'filter_active' // Filter is active
  | 'media_ended'; // Media input playback ended

export type MacroActionType =
  | 'wait' // Wait X seconds
  | 'scene_switch' // Switch to scene
  | 'source_show' // Show source
  | 'source_hide' // Hide source
  | 'hotkey' // Trigger OBS hotkey
  | 'run_macro' // Run another macro
  | 'start_streaming' // Start streaming
  | 'stop_streaming' // Stop streaming
  | 'start_recording' // Start recording
  | 'stop_recording' // Stop recording
  | 'pause_recording' // Pause recording
  | 'resume_recording' // Resume recording
  | 'start_replay_buffer' // Start replay buffer
  | 'stop_replay_buffer' // Stop replay buffer
  | 'save_replay_buffer' // Save replay buffer
  | 'screenshot' // Take screenshot
  | 'source_mute' // Mute audio source
  | 'source_unmute' // Unmute audio source
  | 'source_volume' // Set source volume
  | 'filter_enable' // Enable filter
  | 'filter_disable' // Disable filter
  | 'transition_override' // Override transition
  | 'studio_mode' // Toggle studio mode
  | 'virtual_cam' // Control virtual camera
  | 'projector' // Open projector
  | 'source_transform' // Transform source (position, scale, rotation)
  | 'run_command'; // Run external command

export interface MacroCondition {
  type: MacroConditionType;
  // For scene_active, scene_duration
  sceneName?: string;
  duration?: number; // seconds
  // For source_visible, filter_active, media_ended
  sourceName?: string;
  sourceVisible?: boolean;
  filterName?: string;
  // For audio
  audioSource?: string;
  audioThreshold?: number; // Volume threshold (0-100)
  audioCondition?: 'above' | 'below'; // Above or below threshold
  // For video
  mediaSource?: string;
  mediaState?: 'playing' | 'paused' | 'ended' | 'stopped';
  // For media_ended
  mediaInputName?: string; // Media input name for playback ended event
  // For streaming/recording
  streamingState?: 'active' | 'inactive';
  recordingState?: 'active' | 'inactive' | 'paused';
  replayBufferState?: 'active' | 'inactive' | 'saved'; // Replay buffer status
  // For time/date
  timeHour?: number;
  timeMinute?: number;
  dateYear?: number;
  dateMonth?: number;
  dateDay?: number;
  // For idle
  idleTime?: number; // seconds
}

export interface MacroAction {
  type: MacroActionType;
  // For wait
  duration?: number; // seconds
  // For scene_switch
  sceneName?: string;
  transitionName?: string;
  transitionDuration?: number; // milliseconds
  // For source_show/hide/mute/unmute
  sourceName?: string;
  sceneItemId?: number;
  // For source_volume
  volume?: number; // 0-100
  volumeFade?: boolean; // Fade volume change
  volumeFadeDuration?: number; // Fade duration in seconds
  // For filter_enable/disable
  filterName?: string;
  // For hotkey
  hotkeyName?: string;
  // For run_macro
  macroId?: string;
  // For screenshot
  screenshotPath?: string;
  screenshotSource?: string; // Specific source or empty for entire output
  // For source_transform
  transformX?: number; // X position
  transformY?: number; // Y position
  transformScaleX?: number; // X scale (1.0 = 100%)
  transformScaleY?: number; // Y scale
  transformRotation?: number; // Rotation in degrees
  transformAlignment?: number; // OBS alignment enum
  // For run_command
  command?: string; // Shell command to execute
  commandWorkingDir?: string; // Working directory
  commandWaitForCompletion?: boolean; // Wait for command to finish
}

export interface Macro {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  conditions: MacroCondition[];
  actions: MacroAction[]; // Actions to run IF conditions are met
  elseActions?: MacroAction[]; // Actions to run IF conditions are NOT met
  // Execution settings
  runOnce?: boolean; // Run only once when conditions met
  parallel?: boolean; // Can run in parallel with other macros
  conditionLogic?: 'AND' | 'OR'; // How to combine multiple conditions (default: AND)
}

export interface MacroExecutionContext {
  startTime: number;
  currentActionIndex: number;
  isRunning: boolean;
  isPaused: boolean;
}

export class MacroEngine {
  private macros: Map<string, Macro> = new Map();
  private executionContexts: Map<string, MacroExecutionContext> = new Map();
  private obsRef: any; // OBS WebSocket reference
  private intervalId: number | null = null;
  
  // Callbacks
  private onLog?: (message: string, level: 'info' | 'warn' | 'error') => void;
  
  constructor(obsRef: any, onLog?: (message: string, level: 'info' | 'warn' | 'error') => void) {
    this.obsRef = obsRef;
    this.onLog = onLog;
  }

  /**
   * Add or update a macro
   */
  addMacro(macro: Macro) {
    this.macros.set(macro.id, macro);
    this.log(`Macro added: ${macro.name}`, 'info');
  }

  /**
   * Remove a macro
   */
  removeMacro(macroId: string) {
    this.macros.delete(macroId);
    this.executionContexts.delete(macroId);
    this.log(`Macro removed: ${macroId}`, 'info');
  }

  /**
   * Get all macros
   */
  getMacros(): Macro[] {
    return Array.from(this.macros.values());
  }

  /**
   * Get macro by ID
   */
  getMacro(macroId: string): Macro | undefined {
    return this.macros.get(macroId);
  }

  /**
   * Get available scenes from OBS
   */
  async getAvailableScenes(): Promise<string[]> {
    try {
      const response = await this.obsRef.call('GetSceneList');
      return response.scenes.map((scene: any) => scene.sceneName || scene.name);
    } catch (error) {
      this.log('Failed to get scenes from OBS', 'error');
      return [];
    }
  }

  /**
   * Get available sources/inputs from OBS (includes both inputs and scenes)
   */
  async getAvailableSources(): Promise<string[]> {
    try {
      // Get regular inputs
      const inputsResponse = await this.obsRef.call('GetInputList');
      const inputs = inputsResponse.inputs.map((input: any) => input.inputName);
      
      // Get scenes (scenes can also be used as sources)
      const scenesResponse = await this.obsRef.call('GetSceneList');
      const scenes = scenesResponse.scenes.map((scene: any) => scene.sceneName || scene.name);
      
      // Combine both (scenes first, then inputs)
      return [...scenes, ...inputs];
    } catch (error) {
      this.log('Failed to get sources from OBS', 'error');
      return [];
    }
  }

  /**
   * Get available sources with grouping info
   */
  async getAvailableSourcesGrouped(): Promise<{ scenes: string[]; inputs: string[] }> {
    try {
      // Get regular inputs
      const inputsResponse = await this.obsRef.call('GetInputList');
      const inputs = inputsResponse.inputs.map((input: any) => input.inputName);
      
      // Get scenes
      const scenesResponse = await this.obsRef.call('GetSceneList');
      const scenes = scenesResponse.scenes.map((scene: any) => scene.sceneName || scene.name);
      
      return { scenes, inputs };
    } catch (error) {
      this.log('Failed to get grouped sources from OBS', 'error');
      return { scenes: [], inputs: [] };
    }
  }

  /**
   * Get scene items (sources in scenes) with show/hide actions
   */
  async getSceneItemsDetailed(): Promise<{ sceneItems: Array<{ label: string; sceneName: string; sourceName: string; sceneItemId: number; visible: boolean }> }> {
    try {
      const scenesResponse = await this.obsRef.call('GetSceneList');
      const scenes = scenesResponse.scenes;
      
      const sceneItems: Array<{ label: string; sceneName: string; sourceName: string; sceneItemId: number; visible: boolean }> = [];
      
      // Get items for each scene
      for (const scene of scenes) {
        const sceneName = scene.sceneName || scene.name;
        
        try {
          const itemsResponse = await this.obsRef.call('GetSceneItemList', { sceneName });
          const items = itemsResponse.sceneItems || [];
          
          for (const item of items) {
            const sourceName = item.sourceName;
            const sceneItemId = item.sceneItemId;
            
            // Add "Show" option
            sceneItems.push({
              label: `[${sceneName}] Show '${sourceName}'`,
              sceneName,
              sourceName,
              sceneItemId,
              visible: true
            });
            
            // Add "Hide" option
            sceneItems.push({
              label: `[${sceneName}] Hide '${sourceName}'`,
              sceneName,
              sourceName,
              sceneItemId,
              visible: false
            });
          }
        } catch (err) {
          // Skip if scene has no items or error
        }
      }
      
      return { sceneItems };
    } catch (error) {
      this.log('Failed to get scene items from OBS', 'error');
      return { sceneItems: [] };
    }
  }

  /**
   * Start the macro engine
   */
  start() {
    if (this.intervalId) {
      this.log('Macro engine already running', 'warn');
      return;
    }

    this.log('Macro engine started', 'info');
    
    // Check conditions every 100ms
    this.intervalId = setInterval(() => {
      this.checkAndExecuteMacros();
    }, 100);
  }

  /**
   * Stop the macro engine
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.log('Macro engine stopped', 'info');
    }
  }

  /**
   * Manually trigger a macro (for manual condition type)
   */
  async triggerMacro(macroId: string) {
    const macro = this.macros.get(macroId);
    if (!macro) {
      this.log(`Macro not found: ${macroId}`, 'error');
      return;
    }

    if (!macro.enabled) {
      this.log(`Macro disabled: ${macro.name}`, 'warn');
      return;
    }

    this.log(`Manually triggering macro: ${macro.name}`, 'info');
    
    // Check conditions
    const conditionsMet = await this.checkConditions(macro);
    
    // Execute appropriate actions based on condition result
    if (conditionsMet) {
      await this.executeMacro(macro, false); // Execute normal actions
    } else if (macro.elseActions && macro.elseActions.length > 0) {
      await this.executeMacro(macro, true); // Execute else actions
    } else {
      this.log(`Conditions not met for macro: ${macro.name}`, 'warn');
    }
  }

  /**
   * Handle OBS event and trigger matching macros
   */
  async handleOBSEvent(eventType: string, eventData: any) {
    // Check all enabled macros for matching event triggers
    for (const macro of this.macros.values()) {
      if (!macro.enabled) continue;

      // Check if any condition matches this event
      const shouldTrigger = await this.checkEventConditions(macro, eventType, eventData);
      
      if (shouldTrigger) {
        this.log(`Auto-triggering macro "${macro.name}" from event: ${eventType}`, 'info');
        
        // Skip if already running and not parallel
        const context = this.executionContexts.get(macro.id);
        if (context?.isRunning && !macro.parallel) {
          this.log(`Macro "${macro.name}" already running, skipping`, 'warn');
          continue;
        }

        // Execute the macro
        await this.executeMacro(macro, false);
      }
    }
  }

  /**
   * Check if macro should be triggered by an OBS event
   */
  private async checkEventConditions(macro: Macro, eventType: string, eventData: any): Promise<boolean> {
    if (macro.conditions.length === 0) return false;

    // Check if any condition matches this event
    for (const condition of macro.conditions) {
      if (this.conditionMatchesEvent(condition, eventType, eventData)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a condition matches an OBS event
   */
  private conditionMatchesEvent(condition: MacroCondition, eventType: string, eventData: any): boolean {
    switch (condition.type) {
      case 'media_ended':
        if (eventType === 'MediaInputPlaybackEnded') {
          // If mediaInputName is specified, check if it matches
          if (condition.mediaInputName) {
            return eventData.inputName === condition.mediaInputName;
          }
          // If no specific input name, trigger for any media ended
          return true;
        }
        return false;

      case 'replay_buffer':
        if (eventType === 'ReplayBufferSaved' && condition.replayBufferState === 'saved') {
          return true;
        }
        if (eventType === 'ReplayBufferStateChanged') {
          if (condition.replayBufferState === 'active' && eventData.outputActive === true) {
            return true;
          }
          if (condition.replayBufferState === 'inactive' && eventData.outputActive === false) {
            return true;
          }
        }
        return false;

      case 'streaming':
        if (eventType === 'StreamStateChanged') {
          if (condition.streamingState === 'active' && eventData.outputActive === true) {
            return true;
          }
          if (condition.streamingState === 'inactive' && eventData.outputActive === false) {
            return true;
          }
        }
        return false;

      case 'recording':
        if (eventType === 'RecordStateChanged') {
          if (condition.recordingState === 'active' && eventData.outputActive === true) {
            return true;
          }
          if (condition.recordingState === 'inactive' && eventData.outputActive === false) {
            return true;
          }
          if (condition.recordingState === 'paused' && eventData.outputState === 'OBS_WEBSOCKET_OUTPUT_PAUSED') {
            return true;
          }
        }
        return false;

      case 'scene_active':
        if (eventType === 'CurrentProgramSceneChanged' || eventType === 'CurrentPreviewSceneChanged') {
          if (eventData.sceneName === condition.sceneName) {
            return true;
          }
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Check all macros and execute if conditions are met
   */
  private async checkAndExecuteMacros() {
    for (const macro of this.macros.values()) {
      if (!macro.enabled) continue;

      // Skip if already running and not parallel
      const context = this.executionContexts.get(macro.id);
      if (context?.isRunning && !macro.parallel) continue;

      // Check if conditions are met
      const conditionsMet = await this.checkConditions(macro);
      
      if (conditionsMet) {
        // Check if runOnce
        if (macro.runOnce && context?.isRunning) continue;
        
        // Execute normal actions
        await this.executeMacro(macro, false);
      } else if (macro.elseActions && macro.elseActions.length > 0) {
        // Execute else actions if conditions not met
        await this.executeMacro(macro, true);
      }
    }
  }

  /**
   * Check if macro conditions are met
   */
  private async checkConditions(macro: Macro): Promise<boolean> {
    // If no conditions, always return false (except manual trigger)
    if (macro.conditions.length === 0) return false;

    const logic = macro.conditionLogic || 'AND';

    if (logic === 'OR') {
      // OR logic: at least one condition must be met
      for (const condition of macro.conditions) {
        const met = await this.checkCondition(condition);
        if (met) return true; // Return true as soon as one is met
      }
      return false; // None were met
    } else {
      // AND logic: all conditions must be met (default)
      for (const condition of macro.conditions) {
        const met = await this.checkCondition(condition);
        if (!met) return false; // Return false as soon as one fails
      }
      return true; // All were met
    }
  }

  /**
   * Check a single condition
   */
  private async checkCondition(condition: MacroCondition): Promise<boolean> {
    try {
      switch (condition.type) {
        case 'manual':
          // Manual conditions are triggered explicitly
          return false;

        case 'scene_active':
          if (!condition.sceneName) return false;
          const currentScene = await this.getCurrentScene();
          return currentScene === condition.sceneName;

        case 'timer':
          // Timer conditions need to be handled differently
          // For now, return false
          return false;

        default:
          return false;
      }
    } catch (error) {
      this.log(`Error checking condition: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Execute a macro's actions
   */
  private async executeMacro(macro: Macro, executeElseActions = false) {
    // Create execution context
    const context: MacroExecutionContext = {
      startTime: Date.now(),
      currentActionIndex: 0,
      isRunning: true,
      isPaused: false
    };
    this.executionContexts.set(macro.id, context);

    const actionType = executeElseActions ? 'ELSE actions' : 'actions';
    const actionsToExecute = executeElseActions ? (macro.elseActions || []) : macro.actions;

    this.log(`Executing macro: ${macro.name} (${actionType})`, 'info');

    try {
      for (let i = 0; i < actionsToExecute.length; i++) {
        context.currentActionIndex = i;
        const action = actionsToExecute[i];
        
        await this.executeAction(action, macro.name);
      }

      this.log(`Macro completed: ${macro.name} (${actionType})`, 'info');
    } catch (error: any) {
      this.log(`Macro error: ${macro.name} - ${error.message}`, 'error');
    } finally {
      context.isRunning = false;
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(action: MacroAction, macroName: string) {
    try {
      switch (action.type) {
        case 'wait':
          if (action.duration) {
            this.log(`[${macroName}] Wait ${action.duration}s`, 'info');
            await this.sleep(action.duration * 1000);
          }
          break;

        case 'scene_switch':
          if (action.sceneName) {
            this.log(`[${macroName}] Switch to scene: ${action.sceneName}`, 'info');
            await this.obsRef.call('SetCurrentProgramScene', {
              sceneName: action.sceneName
            });
          }
          break;

        case 'source_show':
          if (action.sceneName && action.sourceName) {
            this.log(`[${macroName}] Show source: ${action.sourceName}`, 'info');
            const itemId = await this.getSceneItemId(action.sceneName, action.sourceName);
            if (itemId !== null) {
              await this.obsRef.call('SetSceneItemEnabled', {
                sceneName: action.sceneName,
                sceneItemId: itemId,
                sceneItemEnabled: true
              });
            }
          }
          break;

        case 'source_hide':
          if (action.sceneName && action.sourceName) {
            this.log(`[${macroName}] Hide source: ${action.sourceName}`, 'info');
            const itemId = await this.getSceneItemId(action.sceneName, action.sourceName);
            if (itemId !== null) {
              await this.obsRef.call('SetSceneItemEnabled', {
                sceneName: action.sceneName,
                sceneItemId: itemId,
                sceneItemEnabled: false
              });
            }
          }
          break;

        case 'hotkey':
          if (action.hotkeyName) {
            this.log(`[${macroName}] Trigger hotkey: ${action.hotkeyName}`, 'info');
            await this.obsRef.call('TriggerHotkeyByName', {
              hotkeyName: action.hotkeyName
            });
          }
          break;

        case 'run_macro':
          if (action.macroId) {
            this.log(`[${macroName}] Run macro: ${action.macroId}`, 'info');
            await this.triggerMacro(action.macroId);
          }
          break;

        case 'start_streaming':
          this.log(`[${macroName}] Start streaming`, 'info');
          await this.obsRef.call('StartStream');
          break;

        case 'stop_streaming':
          this.log(`[${macroName}] Stop streaming`, 'info');
          await this.obsRef.call('StopStream');
          break;

        case 'start_recording':
          this.log(`[${macroName}] Start recording`, 'info');
          await this.obsRef.call('StartRecord');
          break;

        case 'stop_recording':
          this.log(`[${macroName}] Stop recording`, 'info');
          await this.obsRef.call('StopRecord');
          break;

        case 'pause_recording':
          this.log(`[${macroName}] Pause recording`, 'info');
          await this.obsRef.call('PauseRecord');
          break;

        case 'resume_recording':
          this.log(`[${macroName}] Resume recording`, 'info');
          await this.obsRef.call('ResumeRecord');
          break;

        case 'start_replay_buffer':
          this.log(`[${macroName}] Start replay buffer`, 'info');
          await this.obsRef.call('StartReplayBuffer');
          break;

        case 'stop_replay_buffer':
          this.log(`[${macroName}] Stop replay buffer`, 'info');
          await this.obsRef.call('StopReplayBuffer');
          break;

        case 'save_replay_buffer':
          this.log(`[${macroName}] Save replay buffer`, 'info');
          await this.obsRef.call('SaveReplayBuffer');
          break;

        case 'screenshot':
          this.log(`[${macroName}] Take screenshot`, 'info');
          const imagePath = action.screenshotPath || `screenshot-${Date.now()}.png`;
          if (action.screenshotSource) {
            await this.obsRef.call('SaveSourceScreenshot', {
              sourceName: action.screenshotSource,
              imageFormat: 'png',
              imageFilePath: imagePath
            });
          } else {
            await this.obsRef.call('TriggerStudioModeTransition');
          }
          break;

        case 'source_mute':
          if (action.sourceName) {
            this.log(`[${macroName}] Mute source: ${action.sourceName}`, 'info');
            await this.obsRef.call('SetInputMute', {
              inputName: action.sourceName,
              inputMuted: true
            });
          }
          break;

        case 'source_unmute':
          if (action.sourceName) {
            this.log(`[${macroName}] Unmute source: ${action.sourceName}`, 'info');
            await this.obsRef.call('SetInputMute', {
              inputName: action.sourceName,
              inputMuted: false
            });
          }
          break;

        case 'source_volume':
          if (action.sourceName && action.volume !== undefined) {
            this.log(`[${macroName}] Set volume ${action.sourceName}: ${action.volume}%`, 'info');
            // Convert percentage to decibel (OBS uses dB)
            const db = action.volume === 0 ? -100 : 20 * Math.log10(action.volume / 100);
            await this.obsRef.call('SetInputVolume', {
              inputName: action.sourceName,
              inputVolumeDb: db
            });
          }
          break;

        case 'filter_enable':
          if (action.sourceName && action.filterName) {
            this.log(`[${macroName}] Enable filter: ${action.filterName}`, 'info');
            await this.obsRef.call('SetSourceFilterEnabled', {
              sourceName: action.sourceName,
              filterName: action.filterName,
              filterEnabled: true
            });
          }
          break;

        case 'filter_disable':
          if (action.sourceName && action.filterName) {
            this.log(`[${macroName}] Disable filter: ${action.filterName}`, 'info');
            await this.obsRef.call('SetSourceFilterEnabled', {
              sourceName: action.sourceName,
              filterName: action.filterName,
              filterEnabled: false
            });
          }
          break;

        case 'studio_mode':
          this.log(`[${macroName}] Toggle studio mode`, 'info');
          await this.obsRef.call('SetStudioModeEnabled', {
            studioModeEnabled: true
          });
          break;

        case 'virtual_cam':
          this.log(`[${macroName}] Toggle virtual camera`, 'info');
          await this.obsRef.call('ToggleVirtualCam');
          break;

        case 'source_transform':
          if (action.sceneName && action.sourceName) {
            this.log(`[${macroName}] Transform source: ${action.sourceName}`, 'info');
            const itemId = await this.getSceneItemId(action.sceneName, action.sourceName);
            if (itemId !== null) {
              const transform: any = {};
              if (action.transformX !== undefined) transform.positionX = action.transformX;
              if (action.transformY !== undefined) transform.positionY = action.transformY;
              if (action.transformScaleX !== undefined) transform.scaleX = action.transformScaleX;
              if (action.transformScaleY !== undefined) transform.scaleY = action.transformScaleY;
              if (action.transformRotation !== undefined) transform.rotation = action.transformRotation;
              
              await this.obsRef.call('SetSceneItemTransform', {
                sceneName: action.sceneName,
                sceneItemId: itemId,
                sceneItemTransform: transform
              });
            }
          }
          break;

        default:
          this.log(`Unknown action type: ${action.type}`, 'warn');
      }
    } catch (error: any) {
      this.log(`Action error: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Helper: Get current scene name
   */
  private async getCurrentScene(): Promise<string | null> {
    try {
      const response = await this.obsRef.call('GetCurrentProgramScene');
      return response.currentProgramSceneName;
    } catch (error) {
      return null;
    }
  }

  /**
   * Helper: Get scene item ID
   */
  private async getSceneItemId(sceneName: string, sourceName: string): Promise<number | null> {
    try {
      const response = await this.obsRef.call('GetSceneItemId', {
        sceneName,
        sourceName
      });
      return response.sceneItemId;
    } catch (error) {
      return null;
    }
  }

  /**
   * Helper: Sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper: Log
   */
  private log(message: string, level: 'info' | 'warn' | 'error') {
    const timestamp = new Date().toISOString();
    console.log(`[MacroEngine ${level.toUpperCase()}] ${timestamp} - ${message}`);
    
    if (this.onLog) {
      this.onLog(message, level);
    }
  }

  /**
   * Export macros to JSON
   */
  exportMacros(): string {
    const data = {
      version: '1.0.0',
      macros: Array.from(this.macros.values())
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import macros from JSON
   */
  importMacros(json: string): number {
    try {
      const data = JSON.parse(json);
      let count = 0;
      
      if (data.macros && Array.isArray(data.macros)) {
        for (const macro of data.macros) {
          this.addMacro(macro);
          count++;
        }
      }
      
      this.log(`Imported ${count} macros`, 'info');
      return count;
    } catch (error: any) {
      this.log(`Import error: ${error.message}`, 'error');
      return 0;
    }
  }
}
