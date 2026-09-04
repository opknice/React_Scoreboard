interface QueueState<Value> {
  hasQueuedValue: boolean;
  queuedValue: Value | undefined;
  running: Promise<void> | null;
}

export interface LatestAsyncByKeyQueue<Key, Value> {
  enqueue: (key: Key, value: Value) => Promise<void>;
  clear: () => void;
}

/**
 * Serializes async work per key and coalesces pending values.
 * While one value is in flight, intermediate updates are replaced so only
 * the most recent pending value is processed next.
 */
export function createLatestAsyncByKeyQueue<Key, Value>(
  worker: (key: Key, value: Value) => Promise<void>,
  onError?: (error: unknown, key: Key) => void,
): LatestAsyncByKeyQueue<Key, Value> {
  const states = new Map<Key, QueueState<Value>>();

  const drain = async (key: Key, state: QueueState<Value>): Promise<void> => {
    while (state.hasQueuedValue) {
      const value = state.queuedValue as Value;
      state.hasQueuedValue = false;
      state.queuedValue = undefined;

      try {
        await worker(key, value);
      } catch (error: unknown) {
        onError?.(error, key);
      }
    }
  };

  return {
    enqueue: (key, value) => {
      let state = states.get(key);
      if (!state) {
        state = {
          hasQueuedValue: false,
          queuedValue: undefined,
          running: null,
        };
        states.set(key, state);
      }

      state.queuedValue = value;
      state.hasQueuedValue = true;

      if (!state.running) {
        const currentState = state;
        const running = drain(key, currentState).finally(() => {
          currentState.running = null;
          if (!currentState.hasQueuedValue && states.get(key) === currentState) {
            states.delete(key);
          }
        });
        currentState.running = running;
        return running;
      }

      return state.running;
    },
    clear: () => {
      states.forEach((state) => {
        state.hasQueuedValue = false;
        state.queuedValue = undefined;
      });
      states.clear();
    },
  };
}
