import type { MacroEvent, MacroFilter, CustomMacro } from '../types/macro';
import type { MacroEventData } from './macroChannels';

const EVENT_SET = new Set<MacroEvent>([
  'ReplayBufferSaved',
  'ReplayVideoEnded',
  'ButtonClicked',
  'KeyPressed',
  'CustomEvent',
  'StreamStateChanged',
  'RecordStateChanged',
  'ReplayBufferStateChanged',
  'MediaInputPlaybackStarted',
  'MediaInputPlaybackEnded',
  'CurrentProgramSceneChanged',
]);

export function isMacroEvent(value: unknown): value is MacroEvent {
  return typeof value === 'string' && EVENT_SET.has(value as MacroEvent);
}

export function normalizeMacroFilter(
  trigger: CustomMacro['trigger'],
): MacroFilter {
  if (trigger.filter) {
    return {
      kind: trigger.filter.kind || 'any',
      value: trigger.filter.value || '',
      modifiers: trigger.filter.modifiers || [],
      keyField: trigger.filter.keyField || 'code',
    };
  }

  if (!trigger.filterKey || !trigger.filterValue) {
    return { kind: 'any', value: '', modifiers: [] };
  }

  if (trigger.event === 'ButtonClicked') {
    return { kind: 'button', value: trigger.filterValue, modifiers: [] };
  }

  if (trigger.event === 'KeyPressed') {
    return {
      kind: 'key',
      value: trigger.filterValue,
      keyField: trigger.filterKey === 'key' ? 'key' : 'code',
      modifiers: (trigger.filterModifiers || '').split(',').map((item) => item.trim()).filter(Boolean),
    };
  }

  if (trigger.event === 'CustomEvent') {
    return { kind: 'hotkey', value: trigger.filterValue, modifiers: [] };
  }

  if (trigger.event === 'CurrentProgramSceneChanged') {
    return { kind: 'scene', value: trigger.filterValue, modifiers: [] };
  }

  return { kind: 'input', value: trigger.filterValue, modifiers: [] };
}

function nestedAction(data: MacroEventData): string {
  return String(data.action || (data.eventData as MacroEventData | undefined)?.action || '');
}

export function matchesMacroTrigger(
  trigger: CustomMacro['trigger'],
  eventName: string,
  eventData: MacroEventData = {},
): boolean {
  if (trigger.event !== eventName) return false;

  const filter = normalizeMacroFilter(trigger);
  if (filter.kind === 'any' || !filter.value) return true;

  if (filter.kind === 'button') return String(eventData.buttonId || '') === filter.value;
  if (filter.kind === 'hotkey') return nestedAction(eventData) === filter.value;
  if (filter.kind === 'scene') return String(eventData.sceneName || '') === filter.value;
  if (filter.kind === 'input') return String(eventData.inputName || '') === filter.value;

  if (filter.kind === 'key') {
    const keyField = filter.keyField || 'code';
    const actualValue = String(eventData[keyField] || '').toLowerCase();
    if (actualValue !== filter.value.toLowerCase()) return false;
    return (filter.modifiers || []).every((modifier) => Boolean(eventData[`${modifier}Key`]) || Boolean(eventData[modifier]));
  }

  return true;
}
