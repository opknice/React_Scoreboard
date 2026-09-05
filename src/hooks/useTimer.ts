import { useEffect, useRef, useSyncExternalStore } from 'react';

export interface TimerSnapshot {
  timer: number;
  isRunning: boolean;
  half: string;
  customText: string;
  countdownStartTime: number;
  formattedTime: string;
}

export interface TimerStore {
  getSnapshot: () => TimerSnapshot;
  subscribe: (listener: () => void) => () => void;
  start1: () => void;
  start2: () => void;
  pause: () => void;
  resume: () => void;
  halfpause: () => void;
  fulltime: () => void;
  resetToZero: () => void;
  setCountdownStartTime: (seconds: number) => void;
  setTimerValue: (seconds: number) => void;
  toggleHalf: () => void;
  setCustomText: (text: string) => void;
  destroy: () => void;
}

function normalizeSeconds(seconds: number): number {
  return Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : 0;
}

function formatTimer(timer: number, customText: string): string {
  if (customText) return customText;
  const minutes = String(Math.floor(timer / 60)).padStart(2, '0');
  const seconds = String(timer % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function readCountdownStartTime(): number {
  try {
    const saved = localStorage.getItem('countdownStartTime');
    return normalizeSeconds(saved ? Number.parseInt(saved, 10) : 0);
  } catch {
    return 0;
  }
}

export function createTimerStore(): TimerStore {
  const listeners = new Set<() => void>();
  const countdownStartTime = readCountdownStartTime();
  let snapshot: TimerSnapshot = {
    timer: 0,
    isRunning: false,
    half: '1st',
    customText: '',
    countdownStartTime,
    formattedTime: '00:00',
  };
  let baseTimer = 0;
  let startedAt: number | null = null;
  let intervalId: number | null = null;

  const emit = () => listeners.forEach((listener) => listener());

  const updateSnapshot = (patch: Partial<TimerSnapshot>) => {
    const next = { ...snapshot, ...patch };
    next.formattedTime = formatTimer(next.timer, next.customText);
    if (
      next.timer === snapshot.timer
      && next.isRunning === snapshot.isRunning
      && next.half === snapshot.half
      && next.customText === snapshot.customText
      && next.countdownStartTime === snapshot.countdownStartTime
      && next.formattedTime === snapshot.formattedTime
    ) {
      return;
    }
    snapshot = next;
    emit();
  };

  const clearTicker = () => {
    if (intervalId === null) return;
    window.clearInterval(intervalId);
    intervalId = null;
  };

  const syncTimer = () => {
    if (startedAt === null) return;
    const nextTimer = baseTimer + Math.floor((Date.now() - startedAt) / 1_000);
    if (nextTimer !== snapshot.timer) updateSnapshot({ timer: nextTimer });
  };

  const startTicker = () => {
    clearTicker();
    intervalId = window.setInterval(syncTimer, 1_000);
  };

  const stopAtCurrentTime = () => {
    syncTimer();
    baseTimer = snapshot.timer;
    startedAt = null;
    clearTicker();
  };

  const store: TimerStore = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start1: () => {
      baseTimer = 0;
      startedAt = Date.now();
      updateSnapshot({ timer: 0, half: '1st', customText: '', isRunning: true });
      startTicker();
    },
    start2: () => {
      baseTimer = snapshot.countdownStartTime;
      startedAt = Date.now();
      updateSnapshot({
        timer: baseTimer,
        half: '2nd',
        customText: '',
        isRunning: true,
      });
      startTicker();
    },
    pause: () => {
      stopAtCurrentTime();
      updateSnapshot({ isRunning: false });
    },
    resume: () => {
      baseTimer = snapshot.timer;
      startedAt = Date.now();
      updateSnapshot({ customText: '', isRunning: true });
      startTicker();
    },
    halfpause: () => {
      stopAtCurrentTime();
      updateSnapshot({ isRunning: false, half: '', customText: 'HT' });
    },
    fulltime: () => {
      stopAtCurrentTime();
      updateSnapshot({ isRunning: false, half: '', customText: 'FT' });
    },
    resetToZero: () => {
      startedAt = null;
      baseTimer = 0;
      clearTicker();
      // A new match always starts from the first half at 00:00.
      updateSnapshot({ timer: 0, isRunning: false, half: '1st', customText: '' });
    },
    setCountdownStartTime: (seconds) => {
      const nextSeconds = normalizeSeconds(seconds);
      updateSnapshot({ countdownStartTime: nextSeconds });
      try {
        localStorage.setItem('countdownStartTime', nextSeconds.toString());
      } catch {
        // Storage can be unavailable in restricted OBS browser contexts.
      }
    },
    setTimerValue: (seconds) => {
      const nextSeconds = normalizeSeconds(seconds);
      baseTimer = nextSeconds;
      if (startedAt !== null) startedAt = Date.now();
      updateSnapshot({ timer: nextSeconds });
    },
    toggleHalf: () => {
      updateSnapshot({
        customText: '',
        half: snapshot.half === '1st' ? '2nd' : '1st',
      });
    },
    setCustomText: (text) => updateSnapshot({ customText: text }),
    destroy: () => {
      clearTicker();
      listeners.clear();
    },
  };

  return store;
}

/** Creates one stable timer store without subscribing the owner component. */
export function useTimer(): TimerStore {
  const storeRef = useRef<TimerStore | null>(null);
  if (storeRef.current === null) storeRef.current = createTimerStore();
  const store = storeRef.current;

  useEffect(() => () => store.destroy(), [store]);
  return store;
}

/** Subscribes only the component that needs live timer values. */
export function useTimerSnapshot(store: TimerStore): TimerSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
