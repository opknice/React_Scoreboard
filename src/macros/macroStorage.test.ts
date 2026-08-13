import { beforeEach, describe, expect, it } from 'vitest';
import type { CustomMacro } from '../types/macro';
import {
  CUSTOM_MACROS_STORAGE_KEY,
  loadCustomMacros,
  saveCustomMacros,
} from './macroStorage';

const makeMacro = (overrides: Partial<CustomMacro> = {}): CustomMacro => ({
  id: 'macro-1',
  name: 'Test macro',
  color: '#3b82f6',
  isEnabled: false,
  trigger: { event: 'ReplayVideoEnded' },
  actions: [],
  logs: [],
  lastTrigger: '',
  ...overrides,
});

describe('macroStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists and restores custom macros using the existing storage key', () => {
    const macro = makeMacro({ id: 'stored', isEnabled: true });

    saveCustomMacros([macro]);

    expect(localStorage.getItem(CUSTOM_MACROS_STORAGE_KEY)).toContain('stored');
    expect(loadCustomMacros()).toEqual([macro]);
  });

  it('keeps preset definitions while restoring only their enabled state', () => {
    const preset = makeMacro({ id: 'preset', name: 'Preset', isEnabled: false });
    saveCustomMacros([makeMacro({ id: 'preset', name: 'Old name', isEnabled: true })]);

    expect(loadCustomMacros([preset])).toEqual([
      { ...preset, isEnabled: true },
    ]);
  });

  it('ignores malformed persisted values', () => {
    localStorage.setItem(CUSTOM_MACROS_STORAGE_KEY, JSON.stringify({ invalid: true }));
    const fallback = makeMacro({ id: 'fallback' });

    expect(loadCustomMacros([fallback])).toEqual([fallback]);
  });
});
