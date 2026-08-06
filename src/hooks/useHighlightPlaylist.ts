import { useState, useEffect, useCallback, useRef } from 'react';
import { useOBSWebSocket } from './useOBSWebSocket';
import type { HighlightPlaylistItem, VarSettings } from '../types/var';

export function useHighlightPlaylist(
  obs: ReturnType<typeof useOBSWebSocket>,
  settings: VarSettings
) {
  const [playlist, setPlaylist] = useState<HighlightPlaylistItem[]>(() => {
    const saved = localStorage.getItem('playinstant_highlight_playlist');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Ignore parse error
      }
    }
    return [];
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPlayingLoop, setIsPlayingLoop] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const isLoopingRef = useRef<boolean>(false);
  isLoopingRef.current = isPlayingLoop;

  // Persist playlist to localStorage
  useEffect(() => {
    localStorage.setItem('playinstant_highlight_playlist', JSON.stringify(playlist));
  }, [playlist]);

  // Recalculate order numbers chronologically
  const normalizeOrderNumbers = useCallback((items: HighlightPlaylistItem[]) => {
    return items.map((item, index) => ({
      ...item,
      orderNumber: index + 1,
    }));
  }, []);

  // Add clip to highlight playlist
  const addHighlight = useCallback(
    async (
      clipPath: string,
      title?: string,
      matchMinute?: string,
      inPoint: number = 0,
      outPoint: number = 0
    ) => {
      let trimmedPath = clipPath;

      // Perform trim if in/out points specified
      if (outPoint > inPoint) {
        try {
          const res = await fetch('/api/ffmpeg/trim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: clipPath,
              start: inPoint,
              duration: outPoint - inPoint,
            }),
          });
          const data = await res.json();
          if (res.ok && data.outputPath) {
            trimmedPath = data.outputPath;
          }
        } catch (err) {
          console.warn('[useHighlightPlaylist] Trim failed, using raw clip:', err);
        }
      }

      // Generate thumbnail
      let thumbnailUrl: string | undefined = undefined;
      try {
        const thumbRes = await fetch('/api/ffmpeg/thumbnail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: trimmedPath,
            time: 0.5,
          }),
        });
        const thumbData = await thumbRes.json();
        if (thumbRes.ok && thumbData.outputPath) {
          thumbnailUrl = `/api/video?path=${encodeURIComponent(thumbData.outputPath)}`;
        }
      } catch (err) {
        // Thumbnail generation optional
      }

      const count = playlist.length + 1;
      const newItem: HighlightPlaylistItem = {
        id: 'hl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        title: title || `ประตู ${count}`,
        clipPath: trimmedPath,
        thumbnailUrl,
        matchMinute,
        inPoint,
        outPoint,
        duration: Math.max(0, outPoint - inPoint),
        orderNumber: count,
        timestamp: Date.now(),
      };

      setPlaylist((prev) => normalizeOrderNumbers([...prev, newItem]));
      setSelectedId(newItem.id);
    },
    [playlist.length, normalizeOrderNumbers]
  );

  // Remove item by id
  const removeItem = useCallback(
    (id: string) => {
      setPlaylist((prev) => normalizeOrderNumbers(prev.filter((item) => item.id !== id)));
      if (selectedId === id) setSelectedId(null);
    },
    [selectedId, normalizeOrderNumbers]
  );

  // Rename item
  const renameItem = useCallback((id: string, newTitle: string) => {
    setPlaylist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item))
    );
  }, []);

  // Move item up
  const moveItemUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      setPlaylist((prev) => {
        const newArr = [...prev];
        const temp = newArr[index - 1];
        newArr[index - 1] = newArr[index];
        newArr[index] = temp;
        return normalizeOrderNumbers(newArr);
      });
    },
    [normalizeOrderNumbers]
  );

  // Move item down
  const moveItemDown = useCallback(
    (index: number) => {
      if (index >= playlist.length - 1) return;
      setPlaylist((prev) => {
        const newArr = [...prev];
        const temp = newArr[index + 1];
        newArr[index + 1] = newArr[index];
        newArr[index] = temp;
        return normalizeOrderNumbers(newArr);
      });
    },
    [playlist.length, normalizeOrderNumbers]
  );

  // Keyboard shortcut listener for [Delete] or [Backspace] key to remove selected clip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is inside an input/textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        removeItem(selectedId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, removeItem]);

  // OBS Play Specific Highlight Item
  const playItemOnOBS = useCallback(
    async (item: HighlightPlaylistItem) => {
      if (!obs.isConnected) return;

      try {
        await obs.call('SetInputSettings', {
          inputName: settings.mediaSourceName,
          inputSettings: {
            local_file: item.clipPath,
            restart_on_activate: true,
          },
        });
        await obs.call('TriggerMediaInputAction', {
          inputName: settings.mediaSourceName,
          mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART',
        });
        await obs.call('SetCurrentProgramScene', {
          sceneName: settings.goalSceneName,
        }).catch(() => {});
      } catch (err) {
        console.error('[useHighlightPlaylist] Failed to play item on OBS:', err);
      }
    },
    [obs, settings]
  );

  // Start Loop NDI Playback
  const startLoopPlay = useCallback(async () => {
    if (playlist.length === 0) return;
    setIsPlayingLoop(true);
    setCurrentIndex(0);
    playItemOnOBS(playlist[0]);
  }, [playlist, playItemOnOBS]);

  // Stop Loop Playback & Restore OBS Standby
  const stopLoopPlay = useCallback(async () => {
    setIsPlayingLoop(false);

    if (obs.isConnected) {
      try {
        // Fetch standby video path or generate
        const standbyRes = await fetch('/api/ffmpeg/standby', { method: 'POST' });
        const standbyData = await standbyRes.json();
        const standbyPath = standbyData.outputPath;

        if (standbyPath) {
          await obs.call('SetInputSettings', {
            inputName: settings.mediaSourceName,
            inputSettings: {
              local_file: standbyPath,
              looping: true,
              restart_on_activate: false,
            },
          });
        }
        await obs.call('SetCurrentProgramScene', {
          sceneName: settings.mainSceneName,
        }).catch(() => {});
      } catch (err) {
        console.warn('[useHighlightPlaylist] Failed to restore standby:', err);
      }
    }
  }, [obs, settings]);

  const playlistRef = useRef<HighlightPlaylistItem[]>(playlist);
  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  // Listen for OBS MediaInputPlaybackEnded event to advance loop playback
  useEffect(() => {
    const obsRef = obs.getObsRef();
    if (!obsRef || !obs.isConnected) return;

    const handleMediaEnded = (data: any) => {
      if (data.inputName === settings.mediaSourceName && isLoopingRef.current) {
        const currentPlaylist = playlistRef.current;
        if (currentPlaylist.length === 0) return;

        setCurrentIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % currentPlaylist.length;
          if (currentPlaylist[nextIndex]) {
            playItemOnOBS(currentPlaylist[nextIndex]);
          }
          return nextIndex;
        });
      }
    };

    try {
      obsRef.on('MediaInputPlaybackEnded', handleMediaEnded);
    } catch (err) {
      // Ignore
    }

    return () => {
      try {
        obsRef.off('MediaInputPlaybackEnded', handleMediaEnded);
      } catch {
        // Ignore
      }
    };
  }, [obs.isConnected, settings.mediaSourceName, playItemOnOBS]);

  return {
    playlist,
    selectedId,
    setSelectedId,
    isPlayingLoop,
    currentIndex,
    addHighlight,
    removeItem,
    renameItem,
    moveItemUp,
    moveItemDown,
    playItemOnOBS,
    startLoopPlay,
    stopLoopPlay,
  };
}
