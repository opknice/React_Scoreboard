// Preset Macros for Football Scoreboard
// Ready-to-use macros based on common workflows

import type { Macro } from './macroEngine';

export const PRESET_MACROS: Macro[] = [
  // Empty - Users will create their own custom macros
];

/**
 * Convert Advanced Scene Switcher macro to our format
 */
export function convertAdvSceneSwitcherMacro(assMacro: any): Macro | null {
  try {
    // Basic conversion - expand this based on needs
    return {
      id: `imported-${Date.now()}`,
      name: assMacro.name || 'Imported Macro',
      description: 'Imported from Advanced Scene Switcher',
      enabled: !assMacro.pause,
      runOnce: false,
      parallel: assMacro.parallel || false,
      conditions: [
        {
          type: 'manual' // Default to manual trigger
        }
      ],
      actions: assMacro.actions?.map((action: any) => {
        // Convert action based on type
        if (action.id === 'wait') {
          return {
            type: 'wait',
            duration: action.duration?.value?.value || 0
          };
        }
        if (action.id === 'scene_switch') {
          return {
            type: 'scene_switch',
            sceneName: action.sceneSelection?.name
          };
        }
        if (action.id === 'hotkey') {
          return {
            type: 'hotkey',
            hotkeyName: action.hotkeyName
          };
        }
        return null;
      }).filter(Boolean) || []
    };
  } catch (error) {
    console.error('Error converting macro:', error);
    return null;
  }
}
