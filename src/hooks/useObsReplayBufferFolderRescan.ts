import { useCallback, useRef } from 'react';

/** Delay before rescan — OBS may still be writing the replay file to disk. */
const RESCAN_DELAY_MS = 1000;

/**
 * Returns an OBS event handler that rescans the connected video folder
 * when OBS fires ReplayBufferSaved.
 */
export function useObsReplayBufferFolderRescan(rescan: () => Promise<File[]>) {
  const rescanRef = useRef(rescan);
  rescanRef.current = rescan;

  return useCallback((eventType: string) => {
    if (eventType !== 'ReplayBufferSaved') return;

    window.setTimeout(() => {
      void rescanRef.current().then((files) => {
        console.log('[VideoFolder] Rescanned after ReplayBufferSaved:', files.length, 'files');
      });
    }, RESCAN_DELAY_MS);
  }, []);
}
