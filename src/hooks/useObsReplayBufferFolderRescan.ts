import { useCallback, useEffect, useRef } from 'react';

/** Delay before rescan — OBS may still be writing the replay file to disk. */
const RESCAN_DELAY_MS = 1000;

/**
 * Returns an OBS event handler that rescans the connected video folder
 * when OBS fires ReplayBufferSaved.
 */
export function useObsReplayBufferFolderRescan(rescan: () => Promise<File[]>) {
  const rescanRef = useRef(rescan);
  rescanRef.current = rescan;
  const timeoutRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);

  const scheduleRescan = useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);

    timeoutRef.current = window.setTimeout(async () => {
      timeoutRef.current = null;
      if (inFlightRef.current) {
        pendingRef.current = true;
        return;
      }

      inFlightRef.current = true;
      try {
        const files = await rescanRef.current();
        console.log('[VideoFolder] Rescanned after ReplayBufferSaved:', files.length, 'files');
      } catch (error) {
        console.warn('[VideoFolder] Rescan after ReplayBufferSaved failed:', error);
      } finally {
        inFlightRef.current = false;
        if (pendingRef.current) {
          pendingRef.current = false;
          scheduleRescan();
        }
      }
    }, RESCAN_DELAY_MS);
  }, []);

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    pendingRef.current = false;
  }, []);

  return useCallback((eventType: string) => {
    if (eventType !== 'ReplayBufferSaved') return;

    scheduleRescan();
  }, [scheduleRescan]);
}
