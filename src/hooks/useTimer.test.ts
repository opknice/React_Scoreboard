import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTimerStore, useTimer, useTimerSnapshot } from './useTimer';

describe('timer store', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks elapsed wall-clock time and stops cleanly', () => {
    const store = createTimerStore();
    store.start1();

    vi.advanceTimersByTime(3_100);
    expect(store.getSnapshot()).toMatchObject({
      timer: 3,
      formattedTime: '00:03',
      isRunning: true,
    });

    store.pause();
    vi.advanceTimersByTime(2_000);
    expect(store.getSnapshot().timer).toBe(3);
    store.destroy();
  });

  it('updates timer subscribers without rerendering the store owner', () => {
    let ownerRenderCount = 0;
    const owner = renderHook(() => {
      ownerRenderCount += 1;
      return useTimer();
    });
    const renderCountAfterMount = ownerRenderCount;
    const subscriber = renderHook(() => useTimerSnapshot(owner.result.current));

    act(() => {
      owner.result.current.start1();
      vi.advanceTimersByTime(2_000);
    });

    expect(ownerRenderCount).toBe(renderCountAfterMount);
    expect(subscriber.result.current.timer).toBe(2);
    owner.unmount();
    subscriber.unmount();
  });

  it('uses the configured second-half start time', () => {
    const store = createTimerStore();
    store.setCountdownStartTime(45 * 60);
    store.start2();

    expect(store.getSnapshot()).toMatchObject({
      timer: 2_700,
      formattedTime: '45:00',
      half: '2nd',
    });
    expect(localStorage.getItem('countdownStartTime')).toBe('2700');
    store.destroy();
  });
});
