import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REPLAY_PLAYLIST_CONTROL_CHANNEL, REPLAY_PROTOCOL_VERSION } from '../types/instantReplay';
import InstantReplayScreen from './InstantReplayScreen';

const replayChannel = new EventTarget();
const send = vi.fn();

function emitReplayMessage(data: unknown) {
  const channel = replayChannel as EventTarget & {
    onmessage?: ((event: MessageEvent<unknown>) => void) | null;
  };
  channel.onmessage?.(new MessageEvent('message', { data }));
}

vi.mock('../hooks/useReplayChannel', () => ({
  useReplayChannel: () => ({ channelRef: { current: replayChannel }, send }),
}));

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  readonly postMessage = vi.fn();
  readonly name: string;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  close() {}
}

describe('InstantReplayScreen playlist monitoring', () => {
  beforeEach(() => {
    MockBroadcastChannel.instances = [];
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:replay'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    send.mockReset();
  });

  it('keeps reporting a media error after canplay and includes the active attempt identity', () => {
    const { container } = render(<InstantReplayScreen />);
    const video = container.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { configurable: true, value: 20 });
    Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 7.5 });

    act(() => {
      emitReplayMessage({
          type: 'file',
          data: new ArrayBuffer(4),
          mime: 'video/x-matroska',
          name: 'highlight.mkv',
          playbackId: 'playback-1',
          playlistItemId: 'item-1',
          playlistSessionId: 'session-1',
          protocolVersion: REPLAY_PROTOCOL_VERSION,
          attempt: 1,
          resumeTime: 7.5,
      });
      video.dispatchEvent(new Event('canplay'));
      video.dispatchEvent(new Event('playing'));
      video.dispatchEvent(new Event('error'));
    });

    const playlistChannel = MockBroadcastChannel.instances.find((channel) => channel.name === REPLAY_PLAYLIST_CONTROL_CHANNEL);
    expect(playlistChannel?.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ReplayPlaybackFailed',
      playbackId: 'playback-1',
      playlistSessionId: 'session-1',
      playlistItemId: 'item-1',
      attempt: 1,
      reason: 'decode_error',
      currentTime: 7.5,
    }));
  });

  it('normalizes a non-finite MKV duration in playlist completion events', () => {
    const { container } = render(<InstantReplayScreen />);
    const video = container.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { configurable: true, value: Number.POSITIVE_INFINITY });
    Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 12 });

    act(() => {
      emitReplayMessage({
          type: 'file',
          data: new ArrayBuffer(4),
          mime: 'video/x-matroska',
          name: 'highlight.mkv',
          playbackId: 'playback-1',
          playlistItemId: 'item-1',
          playlistSessionId: 'session-1',
          protocolVersion: REPLAY_PROTOCOL_VERSION,
          attempt: 1,
      });
      video.dispatchEvent(new Event('ended'));
    });

    const playlistChannel = MockBroadcastChannel.instances.find((channel) => channel.name === REPLAY_PLAYLIST_CONTROL_CHANNEL);
    expect(playlistChannel?.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ReplayPlaylistItemEnded',
      duration: null,
      currentTime: 12,
    }));
  });
});
