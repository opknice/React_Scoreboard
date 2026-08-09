// useReplayChannel.test.ts
// Unit tests for useReplayChannel custom hook

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useReplayChannel } from './useReplayChannel';
import type { ChannelMessage } from '../types/instantReplay';

describe('useReplayChannel', () => {
  let mockChannel: {
    postMessage: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Mock BroadcastChannel
    mockChannel = {
      postMessage: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // @ts-expect-error - Mocking global BroadcastChannel
    global.BroadcastChannel = vi.fn(function() {
      return mockChannel;
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should initialize BroadcastChannel with correct name on mount', () => {
    renderHook(() => useReplayChannel());

    expect(globalThis.BroadcastChannel).toHaveBeenCalledWith('scoreboard_replay_v1');
    expect(globalThis.BroadcastChannel).toHaveBeenCalledTimes(1);
  });

  it('should return channelRef and send function', () => {
    const { result } = renderHook(() => useReplayChannel());

    expect(result.current).toHaveProperty('channelRef');
    expect(result.current).toHaveProperty('send');
    expect(typeof result.current.send).toBe('function');
    expect(result.current.channelRef.current).toBe(mockChannel);
  });

  it('should send FileMessage via postMessage', () => {
    const { result } = renderHook(() => useReplayChannel());

    const fileMessage: ChannelMessage = {
      type: 'file',
      data: new ArrayBuffer(100),
      mime: 'video/mp4',
      name: 'test.mp4',
    };

    result.current.send(fileMessage);

    expect(mockChannel.postMessage).toHaveBeenCalledWith(fileMessage);
    expect(mockChannel.postMessage).toHaveBeenCalledTimes(1);
  });

  it('should send CommandMessage via postMessage', () => {
    const { result } = renderHook(() => useReplayChannel());

    const commandMessage: ChannelMessage = {
      type: 'cmd',
      action: 'play',
    };

    result.current.send(commandMessage);

    expect(mockChannel.postMessage).toHaveBeenCalledWith(commandMessage);
    expect(mockChannel.postMessage).toHaveBeenCalledTimes(1);
  });

  it('should send CommandMessage with value', () => {
    const { result } = renderHook(() => useReplayChannel());

    const seekMessage: ChannelMessage = {
      type: 'cmd',
      action: 'seek',
      value: 15.5,
    };

    result.current.send(seekMessage);

    expect(mockChannel.postMessage).toHaveBeenCalledWith(seekMessage);
  });

  it('should send StatusMessage via postMessage', () => {
    const { result } = renderHook(() => useReplayChannel());

    const statusMessage: ChannelMessage = {
      type: 'status',
      duration: 30,
      currentTime: 15,
      markerA: 10,
      markerB: 25,
    };

    result.current.send(statusMessage);

    expect(mockChannel.postMessage).toHaveBeenCalledWith(statusMessage);
    expect(mockChannel.postMessage).toHaveBeenCalledTimes(1);
  });

  it('should send multiple messages in sequence', () => {
    const { result } = renderHook(() => useReplayChannel());

    const messages: ChannelMessage[] = [
      { type: 'cmd', action: 'play' },
      { type: 'cmd', action: 'pause' },
      { type: 'cmd', action: 'seek', value: 10 },
    ];

    messages.forEach((msg) => result.current.send(msg));

    expect(mockChannel.postMessage).toHaveBeenCalledTimes(3);
    messages.forEach((msg, index) => {
      expect(mockChannel.postMessage).toHaveBeenNthCalledWith(index + 1, msg);
    });
  });

  it('should close channel on component unmount', () => {
    const { unmount } = renderHook(() => useReplayChannel());

    expect(mockChannel.close).not.toHaveBeenCalled();

    unmount();

    expect(mockChannel.close).toHaveBeenCalledTimes(1);
  });

  it('should set channelRef to null after cleanup', () => {
    const { result, unmount } = renderHook(() => useReplayChannel());

    expect(result.current.channelRef.current).toBe(mockChannel);

    unmount();

    expect(result.current.channelRef.current).toBeNull();
  });

  it('should handle send when channel is null gracefully', () => {
    const { result, unmount } = renderHook(() => useReplayChannel());

    // Unmount to close and nullify channel
    unmount();

    // Attempting to send after unmount should not throw
    const message: ChannelMessage = { type: 'cmd', action: 'play' };

    expect(() => result.current.send(message)).not.toThrow();
    expect(mockChannel.postMessage).not.toHaveBeenCalled();
  });

  it('should maintain stable send function reference', () => {
    const { result, rerender } = renderHook(() => useReplayChannel());

    const firstSend = result.current.send;

    rerender();

    const secondSend = result.current.send;

    expect(firstSend).toBe(secondSend);
  });

  it('should handle all command action types', () => {
    const { result } = renderHook(() => useReplayChannel());

    const actions: Array<'play' | 'pause' | 'seek' | 'setA' | 'setB' | 'clearLoop'> = [
      'play',
      'pause',
      'seek',
      'setA',
      'setB',
      'clearLoop',
    ];

    actions.forEach((action) => {
      const message: ChannelMessage = {
        type: 'cmd',
        action,
        value: action === 'seek' || action === 'setA' || action === 'setB' ? 10 : undefined,
      };

      result.current.send(message);
    });

    expect(mockChannel.postMessage).toHaveBeenCalledTimes(actions.length);
  });

  it('should allow accessing channelRef for message listening', () => {
    const { result } = renderHook(() => useReplayChannel());

    // Verify channelRef can be accessed for adding event listeners
    const channel = result.current.channelRef.current;

    expect(channel).toBe(mockChannel);
    expect(channel?.addEventListener).toBeDefined();
    expect(channel?.removeEventListener).toBeDefined();
  });
});
