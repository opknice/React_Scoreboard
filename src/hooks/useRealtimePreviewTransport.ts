import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../config/supabaseClient';
import { SCOREBOARD_EVENT_CHANNEL } from '../types/scoreboardEvent';

export type PreviewConnectionStatus = 'connecting' | 'connected' | 'local-only' | 'error';

export interface SessionPreviewMessage {
  sessionId: string;
}

interface RealtimeChannelEntry {
  sessionId: string;
  channel: RealtimeChannel;
  isReady: boolean;
}

interface UseRealtimePreviewTransportOptions<TMessage extends SessionPreviewMessage> {
  sessionId: string;
  channelPrefix: string;
  eventName: string;
  throttleMs: number;
  isMessage: (value: unknown) => value is TMessage;
  shouldThrottle: (message: TMessage) => boolean;
  onMessage: (message: TMessage) => void;
}

export interface RealtimePreviewTransportResult<TMessage> {
  publish: (message: TMessage) => void;
  status: PreviewConnectionStatus;
}

/** Shared local-tab and Supabase Broadcast transport for temporary OBS previews. */
export function useRealtimePreviewTransport<TMessage extends SessionPreviewMessage>({
  sessionId,
  channelPrefix,
  eventName,
  throttleMs,
  isMessage,
  shouldThrottle,
  onMessage,
}: UseRealtimePreviewTransportOptions<TMessage>): RealtimePreviewTransportResult<TMessage> {
  const callbackRef = useRef(onMessage);
  const validatorRef = useRef(isMessage);
  const browserChannelRef = useRef<BroadcastChannel | null>(null);
  const channelEntriesRef = useRef<RealtimeChannelEntry[]>([]);
  const latestMessageRef = useRef<Map<string, TMessage>>(new Map());
  const pendingMessageRef = useRef<TMessage | null>(null);
  const throttleTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<PreviewConnectionStatus>(supabase ? 'connecting' : 'local-only');
  callbackRef.current = onMessage;
  validatorRef.current = isMessage;

  const updateStatus = useCallback((nextStatus: PreviewConnectionStatus) => {
    if (mountedRef.current) setStatus(nextStatus);
  }, []);

  const sendRemote = useCallback((entry: RealtimeChannelEntry, message: TMessage) => {
    if (!entry.isReady) return;
    void entry.channel
      .send({ type: 'broadcast', event: eventName, payload: message })
      .then((result) => {
        if (result !== 'ok') updateStatus('error');
      })
      .catch(() => updateStatus('error'));
  }, [eventName, updateStatus]);

  const publishImmediately = useCallback((message: TMessage) => {
    const messages = message.sessionId === 'default'
      ? [message]
      : [message, { ...message, sessionId: 'default' }];

    messages.forEach((candidate) => {
      latestMessageRef.current.set(candidate.sessionId, candidate);
      browserChannelRef.current?.postMessage(candidate);
      const entry = channelEntriesRef.current.find((item) => item.sessionId === candidate.sessionId);
      if (entry) sendRemote(entry, candidate);
    });
  }, [sendRemote]);

  useEffect(() => {
    mountedRef.current = true;
    const effectiveSessionId = sessionId || 'default';
    const channelNames = Array.from(new Set([effectiveSessionId, 'default']));
    const client = supabase;
    let isDisposed = false;

    const deliverMessage = (value: unknown) => {
      if (!validatorRef.current(value) || value.sessionId !== effectiveSessionId) return;
      callbackRef.current(value);
    };

    try {
      const browserChannel = new BroadcastChannel(SCOREBOARD_EVENT_CHANNEL);
      browserChannel.addEventListener('message', (event: MessageEvent<unknown>) => deliverMessage(event.data));
      browserChannelRef.current = browserChannel;
    } catch {
      browserChannelRef.current = null;
    }

    if (client) {
      updateStatus('connecting');
      channelEntriesRef.current = channelNames.map((channelSessionId) => {
        const entry: RealtimeChannelEntry = {
          sessionId: channelSessionId,
          channel: client.channel(`${channelPrefix}:${channelSessionId}`),
          isReady: false,
        };

        entry.channel
          .on('broadcast', { event: eventName }, ({ payload }) => deliverMessage(payload))
          .subscribe((subscriptionStatus) => {
            if (isDisposed) return;
            if (subscriptionStatus === 'SUBSCRIBED') {
              entry.isReady = true;
              updateStatus('connected');
              const latestMessage = latestMessageRef.current.get(channelSessionId);
              if (latestMessage) sendRemote(entry, latestMessage);
              return;
            }
            if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
              entry.isReady = false;
              updateStatus('error');
            }
          });

        return entry;
      });
    } else {
      updateStatus('local-only');
    }

    return () => {
      isDisposed = true;
      mountedRef.current = false;
      if (throttleTimerRef.current !== null) {
        window.clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      pendingMessageRef.current = null;
      browserChannelRef.current?.close();
      browserChannelRef.current = null;
      const entries = channelEntriesRef.current;
      channelEntriesRef.current = [];
      if (client) entries.forEach(({ channel }) => { void client.removeChannel(channel); });
    };
  }, [channelPrefix, eventName, sendRemote, sessionId, updateStatus]);

  const publish = useCallback((message: TMessage) => {
    if (!shouldThrottle(message)) {
      if (throttleTimerRef.current !== null) {
        window.clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      pendingMessageRef.current = null;
      publishImmediately(message);
      return;
    }

    pendingMessageRef.current = message;
    if (throttleTimerRef.current !== null) return;
    throttleTimerRef.current = window.setTimeout(() => {
      throttleTimerRef.current = null;
      const latest = pendingMessageRef.current;
      pendingMessageRef.current = null;
      if (latest) publishImmediately(latest);
    }, throttleMs);
  }, [publishImmediately, shouldThrottle, throttleMs]);

  return { publish, status };
}
