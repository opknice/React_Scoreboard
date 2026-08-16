import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createReplayPlaylistItem,
  type ReplayPlaylistItem,
} from '../types/instantReplay';
import {
  loadReplayPlaylist,
  resolveReplayPlaylistItem,
  saveReplayPlaylist,
  useReplayPlaylist,
} from './useReplayPlaylist';

function makeFile(name: string, size = 100, lastModified = 1): File {
  return new File([new Uint8Array(size)], name, {
    type: 'video/mp4',
    lastModified,
  });
}

describe('useReplayPlaylist', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists playlist metadata and resolves it to the active File object', () => {
    const file = makeFile('highlight.mp4', 120, 42);
    const item = createReplayPlaylistItem(file, 1234);

    saveReplayPlaylist([item]);

    expect(loadReplayPlaylist()).toEqual([item]);
    expect(resolveReplayPlaylistItem(item, [file])).toBe(file);
    expect(resolveReplayPlaylistItem(item, [makeFile('other.mp4')])).toBeNull();
  });

  it('ignores malformed persisted entries', () => {
    const validItem: ReplayPlaylistItem = {
      id: 'valid',
      fileName: 'valid.mp4',
      fileSize: 10,
      lastModified: 20,
      addedAt: 30,
    };
    localStorage.setItem('instantReplayPlaylist.v1', JSON.stringify([
      validItem,
      { id: 'invalid', fileName: 'broken.mp4' },
      null,
    ]));

    expect(loadReplayPlaylist()).toEqual([validItem]);
  });

  it('prevents duplicates and supports reorder, removal, and clear', () => {
    const first = makeFile('first.mp4', 100, 1);
    const second = makeFile('second.mp4', 200, 2);
    const { result } = renderHook(() => useReplayPlaylist([first, second]));

    act(() => expect(result.current.addFile(first)).toBe(true));
    act(() => expect(result.current.addFile(first)).toBe(false));
    act(() => expect(result.current.addFile(second)).toBe(true));

    expect(result.current.items.map((item) => item.fileName)).toEqual(['first.mp4', 'second.mp4']);

    act(() => result.current.moveItem(result.current.items[1].id, 'up'));
    expect(result.current.items.map((item) => item.fileName)).toEqual(['second.mp4', 'first.mp4']);

    act(() => result.current.removeItem(result.current.items[0].id));
    expect(result.current.items.map((item) => item.fileName)).toEqual(['first.mp4']);

    act(() => result.current.clear());
    expect(result.current.items).toEqual([]);
  });
});
