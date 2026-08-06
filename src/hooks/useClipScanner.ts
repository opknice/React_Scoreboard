import { useState, useEffect, useCallback, useRef } from 'react';
import { useOBSWebSocket } from './useOBSWebSocket';
import type { ClipItem } from '../types/var';

export function useClipScanner(obs: ReturnType<typeof useOBSWebSocket>, customDir?: string) {
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const scanClips = useCallback(async (dir?: string) => {
    // Prevent event object from being passed as directory path
    const targetDir = (typeof dir === 'string') ? dir : (customDir || '');
    
    setLoading(true);
    setError(null);
    
    console.log('[useClipScanner] Scanning directory:', targetDir || '(default replays folder)');
    
    try {
      const query = targetDir ? `?dir=${encodeURIComponent(targetDir)}` : '';
      const res = await fetch(`/api/clips/scan${query}`);
      const data = await res.json();
      
      console.log('[useClipScanner] API Response:', data);
      
      if (!res.ok) throw new Error(data.error || 'Failed to scan clips');
      
      // Only update clips if we got valid data
      if (data.clips && Array.isArray(data.clips)) {
        console.log(`[useClipScanner] Found ${data.clips.length} clips`);
        setClips(data.clips);
      } else {
        // If no clips found, set empty array
        console.log('[useClipScanner] No clips found, clearing list');
        setClips([]);
      }
    } catch (err: any) {
      setError(err.message || 'Error scanning replay clips');
      // Keep existing clips on error instead of clearing them
      console.error('[useClipScanner] Scan error:', err);
    } finally {
      setLoading(false);
    }
  }, [customDir]);

  // Initial scan on mount
  useEffect(() => {
    scanClips();
  }, [scanClips]);

  const rescanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for OBS ReplayBufferSaved event to auto-detect new clips
  useEffect(() => {
    const obsRef = obs.getObsRef();
    if (!obsRef || !obs.isConnected) return;

    const handleReplaySaved = (data: any) => {
      const savedPath: string = data.savedReplayPath || data.outputPath || '';
      console.log('[useClipScanner] New replay buffer saved:', savedPath);
      if (savedPath) {
        const fileName = savedPath.split(/[/\\]/).pop() || 'New_Replay.mkv';
        const newClip: ClipItem = {
          id: fileName + '_' + Date.now(),
          name: fileName,
          path: savedPath,
          size: 0,
          mtime: Date.now(),
          formattedDate: new Date().toLocaleTimeString('th-TH'),
          isNew: true,
        };

        setClips((prev) => [newClip, ...prev]);

        // Trigger full rescan after 1.5 seconds to get correct file stats
        if (rescanTimerRef.current) {
          clearTimeout(rescanTimerRef.current);
        }
        rescanTimerRef.current = setTimeout(() => {
          scanClips();
          rescanTimerRef.current = null;
        }, 1500);
      }
    };

    try {
      obsRef.on('ReplayBufferSaved', handleReplaySaved);
    } catch (err) {
      console.error('[useClipScanner] Error subscribing to ReplayBufferSaved:', err);
    }

    return () => {
      if (rescanTimerRef.current) {
        clearTimeout(rescanTimerRef.current);
        rescanTimerRef.current = null;
      }
      try {
        obsRef.off('ReplayBufferSaved', handleReplaySaved);
      } catch {
        // Ignore
      }
    };
  }, [obs.isConnected, scanClips]);

  return { clips, setClips, loading, error, scanClips };
}
