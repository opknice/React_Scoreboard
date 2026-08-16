import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createReplayFileId,
  createReplayPlaylistItem,
  type ReplayPlaylistItem,
} from '../types/instantReplay';

export const REPLAY_PLAYLIST_STORAGE_KEY = 'instantReplayPlaylist.v1';

function isReplayPlaylistItem(value: unknown): value is ReplayPlaylistItem {
  if (!value || typeof value !== 'object') return false;

  const item = value as Partial<ReplayPlaylistItem>;
  return typeof item.id === 'string'
    && typeof item.fileName === 'string'
    && typeof item.fileSize === 'number'
    && Number.isFinite(item.fileSize)
    && typeof item.lastModified === 'number'
    && Number.isFinite(item.lastModified)
    && typeof item.addedAt === 'number'
    && Number.isFinite(item.addedAt);
}

export function loadReplayPlaylist(): ReplayPlaylistItem[] {
  try {
    const raw = localStorage.getItem(REPLAY_PLAYLIST_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isReplayPlaylistItem);
  } catch {
    return [];
  }
}

export function saveReplayPlaylist(items: ReplayPlaylistItem[]): void {
  try {
    localStorage.setItem(REPLAY_PLAYLIST_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage can be unavailable in an embedded OBS browser source.
  }
}

export function resolveReplayPlaylistItem(
  item: ReplayPlaylistItem,
  files: File[],
): File | null {
  return files.find((file) => createReplayFileId(file) === item.id) || null;
}

export interface ReplayPlaylistController {
  items: ReplayPlaylistItem[];
  missingItems: ReplayPlaylistItem[];
  addFile: (file: File) => boolean;
  removeItem: (itemId: string) => void;
  moveItem: (itemId: string, direction: 'up' | 'down') => void;
  clear: () => void;
  resolveItem: (item: ReplayPlaylistItem, files?: File[]) => File | null;
}

/**
 * Owns playlist metadata only. File objects remain in the browser's active
 * folder state and are resolved immediately before playback.
 */
export function useReplayPlaylist(availableFiles: File[]): ReplayPlaylistController {
  const [items, setItems] = useState<ReplayPlaylistItem[]>(loadReplayPlaylist);

  useEffect(() => {
    saveReplayPlaylist(items);
  }, [items]);

  const addFile = useCallback((file: File): boolean => {
    const item = createReplayPlaylistItem(file);
    if (items.some((existing) => existing.id === item.id)) return false;
    setItems([...items, item]);
    return true;
  }, [items]);

  const removeItem = useCallback((itemId: string) => {
    setItems((current) => current.filter((item) => item.id !== itemId));
  }, []);

  const moveItem = useCallback((itemId: string, direction: 'up' | 'down') => {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === itemId);
      if (index < 0) return current;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return current;

      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const resolveItem = useCallback(
    (item: ReplayPlaylistItem, files = availableFiles) => resolveReplayPlaylistItem(item, files),
    [availableFiles],
  );

  const missingItems = useMemo(
    () => items.filter((item) => !resolveReplayPlaylistItem(item, availableFiles)),
    [availableFiles, items],
  );

  return {
    items,
    missingItems,
    addFile,
    removeItem,
    moveItem,
    clear,
    resolveItem,
  };
}
