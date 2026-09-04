import { describe, expect, it } from 'vitest';
import { limitOverlayItems, parseOverlayLimit } from './overlayQuery';

describe('overlayQuery', () => {
  it('parses only positive numeric limits', () => {
    expect(parseOverlayLimit('5')).toBe(5);
    expect(parseOverlayLimit('0')).toBeNull();
    expect(parseOverlayLimit('-1')).toBeNull();
    expect(parseOverlayLimit('invalid')).toBeNull();
    expect(parseOverlayLimit(null)).toBeNull();
  });

  it('keeps the latest items when a limit is provided', () => {
    expect(limitOverlayItems(['a', 'b', 'c', 'd'], 2)).toEqual(['c', 'd']);
    expect(limitOverlayItems(['a', 'b'], null)).toEqual(['a', 'b']);
  });
});
