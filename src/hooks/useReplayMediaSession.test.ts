import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REPLAY_PROTOCOL_VERSION, type FileMessage } from '../types/instantReplay';
import { useReplayMediaSession } from './useReplayMediaSession';

function message(playbackId: string): FileMessage {
  return {
    type: 'file',
    data: new ArrayBuffer(4),
    mime: 'video/x-matroska',
    name: 'highlight.mkv',
    playbackId,
    playlistItemId: 'item-1',
    playlistSessionId: 'session-1',
    protocolVersion: REPLAY_PROTOCOL_VERSION,
    attempt: playbackId === 'playback-2' ? 2 : 1,
    resumeTime: 7.5,
  };
}

describe('useReplayMediaSession', () => {
  const createObjectURL = vi.fn<() => string>();
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    let nextUrl = 0;
    createObjectURL.mockImplementation(() => `blob:session-${++nextUrl}`);
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('creates immutable keyed sessions and revokes replaced Blob URLs', () => {
    const { result, unmount } = renderHook(() => useReplayMediaSession());

    act(() => { result.current.activate(message('playback-1'), 'video/x-matroska'); });
    const first = result.current.session;
    expect(first).toMatchObject({
      key: 'playback-1',
      playbackId: 'playback-1',
      attempt: 1,
      resumeTime: 7.5,
      isPlaylist: true,
    });

    act(() => { result.current.activate(message('playback-2'), 'video/x-matroska'); });
    expect(result.current.session).toMatchObject({ key: 'playback-2', attempt: 2 });
    expect(first).toMatchObject({ key: 'playback-1', attempt: 1 });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:session-1');

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:session-2');
  });
});
