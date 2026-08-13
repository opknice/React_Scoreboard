import { describe, expect, it } from 'vitest';
import { checkKeyboardFilter } from './macroSubscriptions';

describe('macroSubscriptions', () => {
  it('matches an unfiltered keyboard trigger', () => {
    expect(checkKeyboardFilter({ event: 'KeyPressed' }, { code: 'Space' })).toBe(true);
  });

  it('matches key and required modifiers', () => {
    expect(checkKeyboardFilter(
      { event: 'KeyPressed', filterKey: 'code', filterValue: 'KeyG', filterModifiers: 'ctrl,shift' },
      { code: 'keyg', ctrlKey: true, shiftKey: true },
    )).toBe(true);
  });

  it('rejects a key or modifier mismatch', () => {
    expect(checkKeyboardFilter(
      { event: 'KeyPressed', filterKey: 'key', filterValue: 'g', filterModifiers: 'ctrl' },
      { key: 'x', ctrlKey: true },
    )).toBe(false);

    expect(checkKeyboardFilter(
      { event: 'KeyPressed', filterKey: 'key', filterValue: 'g', filterModifiers: 'ctrl' },
      { key: 'g', ctrlKey: false },
    )).toBe(false);
  });
});
