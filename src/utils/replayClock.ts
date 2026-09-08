/** Only timeline consumers subscribe to high-frequency playback time. */
export function createReplayClock() {
  let time = 0;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => time,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setTime: (next: number) => {
      if (!Number.isFinite(next) || next < 0 || next === time) return;
      time = next;
      listeners.forEach(listener => listener());
    },
  };
}

export type ReplayClock = ReturnType<typeof createReplayClock>;
