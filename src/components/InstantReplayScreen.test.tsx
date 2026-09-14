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

function playlistChannel(): MockBroadcastChannel | undefined {
  return MockBroadcastChannel.instances.find((channel) => channel.name === REPLAY_PLAYLIST_CONTROL_CHANNEL);
}

function fileMessage(playbackId: string, attempt: 1 | 2, resumeTime = 0) {
  return {
    type: 'file',
    data: new ArrayBuffer(4),
    mime: 'video/x-matroska',
    name: 'highlight.mkv',
    playbackId,
    playlistItemId: 'item-1',
    playlistSessionId: 'session-1',
    protocolVersion: REPLAY_PROTOCOL_VERSION,
    attempt,
    resumeTime,
  } as const;
}

function configureVideo(video: HTMLVideoElement, options: {
  duration?: number;
  currentTime?: number;
  readyState?: number;
  ended?: boolean;
} = {}) {
  Object.defineProperty(video, 'duration', {
    configurable: true,
    value: options.duration ?? 20,
  });
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    writable: true,
    value: options.currentTime ?? 0,
  });
  Object.defineProperty(video, 'readyState', {
    configurable: true,
    value: options.readyState ?? HTMLMediaElement.HAVE_CURRENT_DATA,
  });
  Object.defineProperty(video, 'ended', {
    configurable: true,
    value: options.ended ?? false,
  });
}

describe('InstantReplayScreen playlist monitoring', () => {
  beforeEach(() => {
    MockBroadcastChannel.instances = [];
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:replay-${Math.random()}`),
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

  it('waits for seeked before playing a resumed MKV', async () => {
    const play = vi.mocked(HTMLMediaElement.prototype.play);
    const { container } = render(<InstantReplayScreen />);

    act(() => emitReplayMessage(fileMessage('playback-2', 2, 7.5)));
    const video = container.querySelector('video') as HTMLVideoElement;
    configureVideo(video);

    act(() => {
      video.dispatchEvent(new Event('loadedmetadata'));
      video.dispatchEvent(new Event('loadeddata'));
    });

    expect(video.currentTime).toBe(7.5);
    expect(play).not.toHaveBeenCalled();

    await act(async () => {
      video.dispatchEvent(new Event('seeked'));
      await Promise.resolve();
    });

    expect(play).toHaveBeenCalledOnce();
  });

  it('reports a current media error with immutable attempt identity', () => {
    const { container } = render(<InstantReplayScreen />);
    act(() => emitReplayMessage(fileMessage('playback-1', 1, 7.5)));
    const video = container.querySelector('video') as HTMLVideoElement;
    configureVideo(video, { currentTime: 7.5 });

    act(() => {
      video.dispatchEvent(new Event('loadedmetadata'));
      video.dispatchEvent(new Event('seeked'));
      video.dispatchEvent(new Event('loadeddata'));
      video.dispatchEvent(new Event('playing'));
      video.dispatchEvent(new Event('error'));
    });

    expect(playlistChannel()?.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ReplayPlaybackFailed',
      playbackId: 'playback-1',
      playlistSessionId: 'session-1',
      playlistItemId: 'item-1',
      attempt: 1,
      reason: 'decode_error',
      currentTime: 7.5,
    }));
  });

  it('ignores terminal media events emitted by the replaced video element', () => {
    const { container } = render(<InstantReplayScreen />);
    act(() => emitReplayMessage(fileMessage('playback-1', 1)));
    const oldVideo = container.querySelector('video') as HTMLVideoElement;
    configureVideo(oldVideo, { currentTime: 6, ended: true });
    act(() => {
      oldVideo.dispatchEvent(new Event('loadedmetadata'));
      oldVideo.dispatchEvent(new Event('loadeddata'));
      oldVideo.dispatchEvent(new Event('playing'));
    });

    act(() => emitReplayMessage(fileMessage('playback-2', 2, 6)));
    const newVideo = container.querySelector('video') as HTMLVideoElement;
    expect(newVideo).not.toBe(oldVideo);
    playlistChannel()?.postMessage.mockClear();

    act(() => {
      oldVideo.dispatchEvent(new Event('error'));
      oldVideo.dispatchEvent(new Event('abort'));
      oldVideo.dispatchEvent(new Event('ended'));
    });

    expect(playlistChannel()?.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({
      playbackId: 'playback-2',
      type: expect.stringMatching(/ReplayPlaybackFailed|ReplayPlaylistItemEnded/),
    }));
  });

  it('flushes commands queued before the keyed video element mounts', async () => {
    const play = vi.mocked(HTMLMediaElement.prototype.play);
    const { container } = render(<InstantReplayScreen />);

    act(() => {
      emitReplayMessage(fileMessage('playback-1', 1));
      emitReplayMessage({
        type: 'cmd',
        action: 'setSpeed',
        value: 1.25,
        playbackId: 'playback-1',
        playlistSessionId: 'session-1',
      });
      emitReplayMessage({
        type: 'cmd',
        action: 'play',
        playbackId: 'playback-1',
        playlistSessionId: 'session-1',
      });
    });

    const video = container.querySelector('video') as HTMLVideoElement;
    configureVideo(video);
    expect(video.playbackRate).toBe(1.25);

    await act(async () => {
      video.dispatchEvent(new Event('loadedmetadata'));
      video.dispatchEvent(new Event('loadeddata'));
      await Promise.resolve();
    });
    expect(play).toHaveBeenCalledOnce();
  });

  it('normalizes a non-finite MKV duration and reports completion once', () => {
    const { container } = render(<InstantReplayScreen />);
    act(() => emitReplayMessage(fileMessage('playback-1', 1)));
    const video = container.querySelector('video') as HTMLVideoElement;
    configureVideo(video, { duration: Number.POSITIVE_INFINITY, currentTime: 12, ended: true });

    act(() => {
      video.dispatchEvent(new Event('loadedmetadata'));
      video.dispatchEvent(new Event('loadeddata'));
      video.dispatchEvent(new Event('playing'));
      video.dispatchEvent(new Event('ended'));
      video.dispatchEvent(new Event('ended'));
      video.dispatchEvent(new Event('error'));
    });

    const completions = playlistChannel()?.postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'ReplayPlaylistItemEnded');
    expect(completions).toHaveLength(1);
    expect(completions?.[0]).toEqual(expect.objectContaining({
      duration: null,
      currentTime: 12,
    }));
  });
});
