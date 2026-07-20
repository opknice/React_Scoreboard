// Advanced Scene Switcher to Macro Engine Converter
import type { Macro, MacroAction } from './macroEngine';

interface AdvSSMacro {
  name: string;
  pause: boolean;
  parallel: boolean;
  conditions: any[];
  actions: any[];
}

interface AdvSSFile {
  macros: AdvSSMacro[];
  version: string;
}

/**
 * Convert Advanced Scene Switcher JSON to our Macro format
 */
export function convertAdvSceneSwitcherFile(jsonContent: string): Macro[] {
  try {
    const advSSData: AdvSSFile = JSON.parse(jsonContent);
    
    if (!advSSData.macros || !Array.isArray(advSSData.macros)) {
      throw new Error('Invalid Advanced Scene Switcher format: missing macros array');
    }

    const convertedMacros: Macro[] = [];

    for (const assMacro of advSSData.macros) {
      const converted = convertSingleMacro(assMacro);
      if (converted) {
        convertedMacros.push(converted);
      }
    }

    return convertedMacros;
  } catch (error: any) {
    console.error('Error converting Advanced Scene Switcher file:', error);
    throw new Error(`Conversion failed: ${error.message}`);
  }
}

/**
 * Convert a single Advanced Scene Switcher macro
 */
function convertSingleMacro(assMacro: AdvSSMacro): Macro | null {
  try {
    const actions: MacroAction[] = [];

    // Convert each action
    for (const assAction of assMacro.actions || []) {
      const converted = convertAction(assAction);
      if (converted) {
        actions.push(converted);
      }
    }

    const macro: Macro = {
      id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `📥 ${assMacro.name}`,
      description: `Imported from Advanced Scene Switcher${getConditionDescription(assMacro.conditions)}`,
      enabled: !assMacro.pause,
      runOnce: !assMacro.parallel,
      parallel: assMacro.parallel,
      conditions: [{ type: 'manual' }], // Default to manual trigger
      actions
    };

    return macro;
  } catch (error) {
    console.error(`Error converting macro "${assMacro.name}":`, error);
    return null;
  }
}

/**
 * Convert a single action
 */
function convertAction(assAction: any): MacroAction | null {
  try {
    // Check if action is disabled
    if (assAction.segmentSettings?.enabled === false) {
      return null;
    }

    switch (assAction.id) {
      case 'wait':
        return {
          type: 'wait',
          duration: assAction.duration?.value?.value || 0
        };

      case 'scene_switch':
        return {
          type: 'scene_switch',
          sceneName: assAction.sceneSelection?.name || ''
        };

      case 'hotkey':
        // Parse hotkey name to extract scene and action
        const hotkeyName = assAction.hotkeyName || '';
        const parsed = parseHotkeyName(hotkeyName);
        
        if (parsed) {
          // If it's a show/hide action, convert to source_show/hide
          if (parsed.action === 'show') {
            return {
              type: 'source_show',
              sceneName: parsed.sceneName,
              sourceName: parsed.sourceName || 'Unknown'
            };
          } else if (parsed.action === 'hide') {
            return {
              type: 'source_hide',
              sceneName: parsed.sceneName,
              sourceName: parsed.sourceName || 'Unknown'
            };
          }
        }
        
        // Otherwise keep as hotkey
        return {
          type: 'hotkey',
          hotkeyName: hotkeyName
        };

      default:
        console.warn(`Unknown action type: ${assAction.id}`);
        return null;
    }
  } catch (error) {
    console.error('Error converting action:', error);
    return null;
  }
}

/**
 * Parse OBS hotkey name to extract scene and source info
 * Example: "[Main Stream] libobs.show_scene_item.219"
 */
function parseHotkeyName(hotkeyName: string): { sceneName: string; action: 'show' | 'hide'; sourceName?: string } | null {
  try {
    // Extract scene name from brackets
    const sceneMatch = hotkeyName.match(/\[([^\]]+)\]/);
    const sceneName = sceneMatch ? sceneMatch[1] : '';

    // Determine show or hide
    let action: 'show' | 'hide' | null = null;
    if (hotkeyName.includes('libobs.show_scene_item')) {
      action = 'show';
    } else if (hotkeyName.includes('libobs.hide_scene_item')) {
      action = 'hide';
    }

    if (sceneName && action) {
      return { sceneName, action };
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get condition description for macro
 */
function getConditionDescription(conditions: any[]): string {
  if (!conditions || conditions.length === 0) {
    return '';
  }

  const conditionNames = conditions
    .filter(c => c.segmentSettings?.enabled !== false)
    .map(c => {
      switch (c.id) {
        case 'replay_buffer':
          return 'Replay Buffer';
        case 'media':
          return `Media (${c.source?.name || 'Unknown'})`;
        case 'scene_active':
          return `Scene Active (${c.sceneSelection?.name || 'Unknown'})`;
        default:
          return c.id;
      }
    })
    .filter(Boolean);

  if (conditionNames.length === 0) {
    return '';
  }

  return `\nConditions: ${conditionNames.join(', ')}`;
}

/**
 * Validate Advanced Scene Switcher JSON format
 */
export function isValidAdvSceneSwitcherFile(jsonContent: string): boolean {
  try {
    const data = JSON.parse(jsonContent);
    return data.macros && Array.isArray(data.macros) && typeof data.version === 'string';
  } catch {
    return false;
  }
}
