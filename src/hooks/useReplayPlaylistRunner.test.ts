import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReplayPlaylistItem, REPLAY_PROTOCOL_VERSION } from '../types/instantReplay';
import { useReplayPlaylistRunner } from './useReplayPlaylistRunner';

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  readonly name: string;

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage() {}
  close() {}

  emit(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }
}

function makeFile(name: string, lastModified: number): File {
  const file = new File(['video'], name, { type: 'video/x-matroska', lastModified });
  Object.defineProperty(file, 'arrayBuffer', { value: vi.fn(async () => new ArrayBuffer(5)) });
  return file;
}

function ready(screenId: string) {
  return {
    type: 'ReplayScreenReady',
    protocolVersion: REPLAY_PROTOCOL_VERSION,
    screenId,
    timestamp: Date.now(),
  };
}

describe('useReplayPlaylistRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockBroadcastChannel.instances = [];
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function setup(files: File[]) {
    const items = files.map((file, index) => createReplayPlaylistItem(file, index));
    const send = vi.fn();
    const onCompleted = vi.fn();
    let nextId = 0;
    const hook = renderHook(() => useReplayPlaylistRunner({
      items,
      resolveItem: (item, availableFiles = files) => availableFiles.find((file) => file.name === item.fileName) || null,
      send,
      createId: () => `id-${++nextId}`,
      onFileLoaded: vi.fn(),
      onError: vi.fn(),
      onCompleted,
    }));
    const channel = MockBroadcastChannel.instances[0];
    return { ...hook, channel, items, send, onCompleted };
  }

  it('retries once after three seconds without progress and resumes from the last confirmed time', async () => {
    const file = makeFile('highlight.mkv', 1);
    const { result, channel, send } = setup([file]);
    act(() => channel.emit(ready('screen-a')));
    await act(async () => result.current.start([file]));

    const firstFileMessage = send.mock.calls.find(([message]) => message.type === 'file')?.[0];
    expect(firstFileMessage.attempt).toBe(1);

    act(() => {
      channel.emit({
        type: 'ReplayPlaybackStarted',
        protocolVersion: REPLAY_PROTOCOL_VERSION,
        screenId: 'screen-a',
        playlistSessionId: firstFileMessage.playlistSessionId,
        playlistItemId: firstFileMessage.playlistItemId,
        playbackId: firstFileMessage.playbackId,
        attempt: 1,
        currentTime: 0,
        duration: 20,
        timestamp: Date.now(),
      });
      channel.emit({
        type: 'ReplayPlaybackProgress',
        protocolVersion: REPLAY_PROTOCOL_VERSION,
        screenId: 'screen-a',
        playlistSessionId: firstFileMessage.playlistSessionId,
        playlistItemId: firstFileMessage.playlistItemId,
        playbackId: firstFileMessage.playbackId,
        attempt: 1,
        currentTime: 7.5,
        duration: 20,
        timestamp: Date.now(),
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    const fileMessages = send.mock.calls.filter(([message]) => message.type === 'file').map(([message]) => message);
    expect(fileMessages).toHaveLength(2);
    expect(fileMessages[1]).toMatchObject({ attempt: 2, resumeTime: 7.5 });
    expect(result.current.status).toBe('retrying');
  });

  it('skips an item when the retry also stalls and completes with errors', async () => {
    const file = makeFile('broken.mkv', 1);
    const { result, channel, send, onCompleted } = setup([file]);
    act(() => channel.emit(ready('screen-a')));
    await act(async () => result.current.start([file]));

    const emitStarted = (message: Record<string, unknown>) => channel.emit({
      type: 'ReplayPlaybackStarted',
      protocolVersion: REPLAY_PROTOCOL_VERSION,
      screenId: 'screen-a',
      playlistSessionId: message.playlistSessionId,
      playlistItemId: message.playlistItemId,
      playbackId: message.playbackId,
      attempt: message.attempt,
      currentTime: message.resumeTime || 0,
      duration: 30,
      timestamp: Date.now(),
    });

    const first = send.mock.calls.find(([message]) => message.type === 'file')?.[0];
    act(() => emitStarted(first));
    await act(async () => vi.advanceTimersByTimeAsync(3_000));

    const second = send.mock.calls.filter(([message]) => message.type === 'file')[1][0];
    act(() => emitStarted(second));
    await act(async () => vi.advanceTimersByTimeAsync(3_000));

    expect(result.current.status).toBe('completed_with_errors');
    expect(result.current.failures).toMatchObject([{ fileName: 'broken.mkv', reason: 'stalled', attempts: 2 }]);
    expect(onCompleted).toHaveBeenCalledWith(expect.objectContaining({
      playedItemCount: 0,
      failures: expect.arrayContaining([expect.objectContaining({ fileName: 'broken.mkv' })]),
    }));
  });

  it('does not retry while at least one replay screen continues to make progress', async () => {
    const file = makeFile('healthy.mkv', 1);
    const { result, channel, send } = setup([file]);
    act(() => {
      channel.emit(ready('screen-a'));
      channel.emit(ready('screen-b'));
    });
    await act(async () => result.current.start([file]));
    const message = send.mock.calls.find(([candidate]) => candidate.type === 'file')?.[0];

    const emitProgress = (screenId: string, currentTime: number) => channel.emit({
      type: 'ReplayPlaybackProgress',
      protocolVersion: REPLAY_PROTOCOL_VERSION,
      screenId,
      playlistSessionId: message.playlistSessionId,
      playlistItemId: message.playlistItemId,
      playbackId: message.playbackId,
      attempt: 1,
      currentTime,
      duration: 20,
      timestamp: Date.now(),
    });

    act(() => emitProgress('screen-a', 0.1));
    await act(async () => vi.advanceTimersByTimeAsync(2_500));
    act(() => emitProgress('screen-b', 1));
    await act(async () => vi.advanceTimersByTimeAsync(1_000));

    expect(send.mock.calls.filter(([candidate]) => candidate.type === 'file')).toHaveLength(1);
    expect(result.current.status).toBe('playing');
  });

  it('advances only once when multiple screens report the same item ended', async () => {
    const firstFile = makeFile('first.mkv', 1);
    const secondFile = makeFile('second.mkv', 2);
    const { result, channel, send } = setup([firstFile, secondFile]);
    act(() => {
      channel.emit(ready('screen-a'));
      channel.emit(ready('screen-b'));
    });
    await act(async () => result.current.start([firstFile, secondFile]));
    const firstMessage = send.mock.calls.find(([message]) => message.type === 'file')?.[0];
    const ended = (screenId: string) => ({
      type: 'ReplayPlaylistItemEnded',
      videoElement: 'InstantReplayScreen',
      protocolVersion: REPLAY_PROTOCOL_VERSION,
      screenId,
      playlistSessionId: firstMessage.playlistSessionId,
      playlistItemId: firstMessage.playlistItemId,
      playbackId: firstMessage.playbackId,
      attempt: 1,
      fileName: firstMessage.name,
      currentTime: 10,
      duration: 10,
      timestamp: Date.now(),
    });

    await act(async () => {
      channel.emit(ended('screen-a'));
      await Promise.resolve();
    });
    act(() => channel.emit(ended('screen-b')));

    expect(send.mock.calls.filter(([message]) => message.type === 'file')).toHaveLength(2);
    expect(result.current.currentIndex).toBe(1);
  });

  it('invalidates a pending file read when stop is requested', async () => {
    let resolveRead: ((value: ArrayBuffer) => void) | null = null;
    const file = makeFile('slow.mkv', 1);
    Object.defineProperty(file, 'arrayBuffer', {
      value: vi.fn(() => new Promise<ArrayBuffer>((resolve) => { resolveRead = resolve; })),
    });
    const { result, channel, send } = setup([file]);
    act(() => channel.emit(ready('screen-a')));

    let startPromise: Promise<void>;
    act(() => { startPromise = result.current.start([file]); });
    await act(async () => Promise.resolve());
    act(() => result.current.stop());
    await act(async () => {
      resolveRead?.(new ArrayBuffer(4));
      await startPromise!;
    });

    expect(send.mock.calls.some(([message]) => message.type === 'file')).toBe(false);
    expect(result.current.status).toBe('stopped');
  });
});
