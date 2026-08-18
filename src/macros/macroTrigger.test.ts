import { describe, expect, it } from 'vitest';
import { isMacroEvent, matchesMacroTrigger, normalizeMacroFilter } from './macroTrigger';

describe('macroTrigger', () => {
  it('matches semantic button filters', () => {
    const trigger = { event: 'ButtonClicked' as const, filter: { kind: 'button' as const, value: 'var_replay' } };
    expect(matchesMacroTrigger(trigger, 'ButtonClicked', { buttonId: 'var_replay' })).toBe(true);
    expect(matchesMacroTrigger(trigger, 'ButtonClicked', { buttonId: 'goal_A' })).toBe(false);
  });

  it('matches legacy keyboard filters after normalization', () => {
    const trigger = { event: 'KeyPressed' as const, filterKey: 'code', filterValue: 'KeyG', filterModifiers: 'ctrl,shift' };
    expect(normalizeMacroFilter(trigger)).toEqual({
      kind: 'key', value: 'KeyG', keyField: 'code', modifiers: ['ctrl', 'shift'],
    });
    expect(matchesMacroTrigger(trigger, 'KeyPressed', { code: 'keyg', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(matchesMacroTrigger(trigger, 'KeyPressed', { code: 'keyg', ctrlKey: true, shiftKey: false })).toBe(false);
  });

  it('does not treat missing event fields as a match', () => {
    const trigger = { event: 'ButtonClicked' as const, filter: { kind: 'button' as const, value: 'var_replay' } };
    expect(matchesMacroTrigger(trigger, 'ButtonClicked', {})).toBe(false);
  });

  it('recognizes playlist completion as a valid macro event', () => {
    expect(isMacroEvent('ReplayPlaylistCompleted')).toBe(true);
    expect(matchesMacroTrigger(
      { event: 'ReplayPlaylistCompleted' },
      'ReplayPlaylistCompleted',
      { playlistSessionId: 'session-1', completedItemCount: 3 },
    )).toBe(true);
  });
});
