import type { CustomMacro } from '../types/macro';
import { isMacroEvent } from './macroTrigger';

export const CUSTOM_MACROS_STORAGE_KEY = 'customMacrosList';

const ACTION_TYPES = new Set([
  'switchScene', 'showSource', 'hideSource', 'wait',
  'openVarReplay', 'closeVarReplay', 'openReplayControl', 'closeReplayControl',
  'saveReplayBuffer', 'loadLatestReplay',
]);
const FILTER_KINDS = new Set(['any', 'button', 'key', 'hotkey', 'scene', 'input']);

function isCustomMacro(value: unknown): value is CustomMacro {
  if (!value || typeof value !== 'object') return false;
  const macro = value as Partial<CustomMacro>;
  return typeof macro.id === 'string'
    && typeof macro.name === 'string'
    && typeof macro.color === 'string'
    && typeof macro.isEnabled === 'boolean'
    && !!macro.trigger
    && isMacroEvent(macro.trigger.event)
    && Array.isArray(macro.actions)
    && macro.actions.every((action) => (
      !!action
      && typeof action.id === 'string'
      && typeof action.type === 'string'
      && ACTION_TYPES.has(action.type)
    ));
}

function normalizeMacro(macro: CustomMacro): CustomMacro {
  const filter = macro.trigger.filter;

  return {
    ...macro,
    logs: Array.isArray(macro.logs) ? macro.logs.filter((log): log is string => typeof log === 'string').slice(-15) : [],
    lastTrigger: typeof macro.lastTrigger === 'string' ? macro.lastTrigger : '',
    trigger: filter
      ? {
        ...macro.trigger,
        filter: {
          kind: FILTER_KINDS.has(filter.kind) ? filter.kind : 'any',
          value: typeof filter.value === 'string' ? filter.value : '',
          modifiers: Array.isArray(filter.modifiers)
            ? filter.modifiers.filter((modifier): modifier is string => typeof modifier === 'string')
            : [],
          keyField: filter.keyField === 'key' ? 'key' : 'code',
        },
      }
      : macro.trigger,
  };
}

export function loadCustomMacros(presets: CustomMacro[] = []): CustomMacro[] {
  try {
    const saved = localStorage.getItem(CUSTOM_MACROS_STORAGE_KEY);
    if (!saved) return presets;

    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return presets;

    const storedMacros = parsed.filter(isCustomMacro).map(normalizeMacro);
    const presetIds = new Set(presets.map((preset) => preset.id));
    const userMacros = storedMacros.filter((macro) => !presetIds.has(macro.id));
    const mergedPresets = presets.map((preset) => {
      const existing = storedMacros.find((macro) => macro.id === preset.id);
      return existing ? { ...preset, isEnabled: existing.isEnabled } : preset;
    });

    return [...mergedPresets, ...userMacros];
  } catch (error) {
    console.error('Failed to load custom macros from localStorage', error);
    return presets;
  }
}

export function saveCustomMacros(macros: CustomMacro[]): void {
  try {
    localStorage.setItem(CUSTOM_MACROS_STORAGE_KEY, JSON.stringify(macros));
  } catch (error) {
    console.error('Failed to save custom macros to localStorage', error);
  }
}
