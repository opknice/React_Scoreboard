// useReplayChannel.ts
// Custom React hook for managing BroadcastChannel communication in Instant Replay system
// Requirements: 6.1, 6.8

import { useRef, useEffect, useCallback } from 'react';
import type { ChannelMessage } from '../types/instantReplay';

const CHANNEL_NAME = 'scoreboard_replay_v1';

interface ReplayChannelHook {
  channelRef: React.RefObject<BroadcastChannel | null>;
  send: (message: ChannelMessage) => void;
}

/**
 * Custom hook for managing BroadcastChannel lifecycle and type-safe messaging
 * 
 * Initializes a BroadcastChannel with name "scoreboard_replay_v1" on mount
 * and cleans up by closing the channel on unmount.
 * 
 * @returns Object containing channelRef and send method
 * 
 * @example
 * const { channelRef, send } = useReplayChannel();
 * 
 * // Listen for messages
 * useEffect(() => {
 *   const channel = channelRef.current;
 *   if (!channel) return;
 *   
 *   const handleMessage = (event: MessageEvent<ChannelMessage>) => {
 *     console.log('Received:', event.data);
 *   };
 *   
 *   channel.addEventListener('message', handleMessage);
 *   return () => channel.removeEventListener('message', handleMessage);
 * }, [channelRef]);
 * 
 * // Send messages
 * send({ type: 'cmd', action: 'play' });
 * 
 * **Validates: Requirements 6.1, 6.8**
 */
export function useReplayChannel(): ReplayChannelHook {
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Initialize channel on mount, cleanup on unmount
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  // Type-safe send method with optional chaining for safety
  const send = useCallback((message: ChannelMessage) => {
    channelRef.current?.postMessage(message);
  }, []);

  return { channelRef, send };
}
