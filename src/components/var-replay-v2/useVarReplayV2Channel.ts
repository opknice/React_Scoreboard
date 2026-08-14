import { useCallback, useEffect, useRef } from 'react';
import { VAR_REPLAY_V2_CHANNEL, type VarReplayV2Message } from './varReplayV2Protocol';

export function useVarReplayV2Channel() {
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel(VAR_REPLAY_V2_CHANNEL);
    channelRef.current = channel;

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  const send = useCallback((message: VarReplayV2Message) => {
    channelRef.current?.postMessage(message);
  }, []);

  return { channelRef, send };
}
