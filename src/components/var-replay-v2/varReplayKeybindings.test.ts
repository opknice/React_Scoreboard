import { beforeEach, describe, expect, it } from 'vitest';
import {
  bindingsConflict,
  createReplayBindingFromEvent,
  findReplayBindingConflict,
  formatReplayBinding,
  getDefaultReplayKeybindings,
  loadReplayKeybindings,
  matchesReplayBinding,
  saveReplayKeybindings,
  VAR_REPLAY_KEYBINDINGS_STORAGE_KEY,
} from './varReplayKeybindings';

describe('varReplayKeybindings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides the expected default actions and labels', () => {
    const bindings = getDefaultReplayKeybindings();

    expect(bindings).toHaveLength(9);
    expect(formatReplayBinding(bindings.find((binding) => binding.action === 'playPause'))).toBe('Space');
    expect(formatReplayBinding(bindings.find((binding) => binding.action === 'zoomIn'))).toBe('+ / =');
  });

  it('creates and matches modifier-aware bindings from keyboard events', () => {
    const event = new KeyboardEvent('keydown', {
      code: 'KeyP',
      key: 'P',
      ctrlKey: true,
      shiftKey: true,
    });
    const binding = createReplayBindingFromEvent('playPause', event);

    expect(binding).not.toBeNull();
    expect(formatReplayBinding(binding || undefined)).toBe('Ctrl+Shift+P');
    expect(matchesReplayBinding(event, binding!)).toBe(true);
    expect(matchesReplayBinding(new KeyboardEvent('keydown', { code: 'KeyP', key: 'P', ctrlKey: true }), binding!)).toBe(false);
  });

  it('detects conflicts, including the default Equal binding accepting + and =', () => {
    const bindings = getDefaultReplayKeybindings();
    const zoomOut = bindings.find((binding) => binding.action === 'zoomOut')!;
    const equalWithShift = { ...zoomOut, action: 'zoomOut' as const, code: 'Equal', label: '+', shiftKey: true };
    const zoomIn = bindings.find((binding) => binding.action === 'zoomIn')!;

    expect(bindingsConflict(zoomIn, equalWithShift)).toBe(true);
    expect(findReplayBindingConflict(bindings, equalWithShift, 'zoomOut')).toBe('zoomIn');
  });

  it('persists valid bindings and ignores malformed stored values', () => {
    const custom = getDefaultReplayKeybindings().map((binding) => binding.action === 'stop'
      ? { ...binding, code: 'F2', label: 'F2' }
      : binding);

    saveReplayKeybindings(custom);
    expect(loadReplayKeybindings().find((binding) => binding.action === 'stop')?.code).toBe('F2');

    localStorage.setItem(VAR_REPLAY_KEYBINDINGS_STORAGE_KEY, JSON.stringify([
      { action: 'stop', code: 'KeyS', label: 'S', ctrlKey: 'invalid', altKey: false, metaKey: false },
      { action: 'not-an-action', code: 'KeyX', label: 'X', ctrlKey: false, altKey: false, metaKey: false },
    ]));
    expect(loadReplayKeybindings().find((binding) => binding.action === 'stop')?.code).toBe('KeyS');
  });
});
