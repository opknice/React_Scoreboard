import { describe, expect, it } from 'vitest';
import { limitOverlayItems, parseOverlayLimit, parseTickerDuration } from './overlayQuery';

describe('overlayQuery', () => {
  it('parses only positive numeric limits', () => {
    expect(parseOverlayLimit('5')).toBe(5);
    expect(parseOverlayLimit('0')).toBeNull();
    expect(parseOverlayLimit('-1')).toBeNull();
    expect(parseOverlayLimit('invalid')).toBeNull();
    expect(parseOverlayLimit('5garbage')).toBeNull();
    expect(parseOverlayLimit('5.5')).toBeNull();
    expect(parseOverlayLimit(null)).toBeNull();
  });

  it('keeps the latest items when a limit is provided', () => {
    expect(limitOverlayItems(['a', 'b', 'c', 'd'], 2)).toEqual(['c', 'd']);
    expect(limitOverlayItems(['a', 'b'], null)).toEqual(['a', 'b']);
  });

  it('accepts only positive whole-second ticker durations', () => {
    expect(parseTickerDuration('120')).toBe(120);
    expect(parseTickerDuration(' 30 ')).toBe(30);
    expect(parseTickerDuration('0')).toBe(75);
    expect(parseTickerDuration('-5')).toBe(75);
    expect(parseTickerDuration('10seconds')).toBe(75);
    expect(parseTickerDuration(undefined, 90)).toBe(90);
  });
});
