import { useCallback, useRef } from 'react';
import { ReplayEventContext } from './replayEventContext';

/**
 * ReplayEventContext
 * 
 * ให้บริการระบบ event สำหรับ Instant Replay Controller
 * เพื่อให้ส่ง custom events ไปยัง macro system ได้
 */

export function ReplayEventProvider({ children }: { children: React.ReactNode }) {
  const listenersRef = useRef<Array<(eventType: string, data?: any) => void>>([]);

  const emitReplayEvent = useCallback((eventType: string, data?: any) => {
    console.log(`[ReplayEvent] Emitting: ${eventType}`, data);
    console.log(`[ReplayEvent] Number of listeners: ${listenersRef.current.length}`);
    listenersRef.current.forEach((listener, index) => {
      try {
        console.log(`[ReplayEvent] Calling listener ${index + 1}/${listenersRef.current.length}`);
        listener(eventType, data);
      } catch (error) {
        console.error('[ReplayEvent] Listener error:', error);
      }
    });
    console.log(`[ReplayEvent] Finished emitting ${eventType}`);
  }, []);

  const onReplayEvent = useCallback((listener: (eventType: string, data?: any) => void) => {
    console.log('[ReplayEvent] Registering new listener, total:', listenersRef.current.length + 1);
    listenersRef.current.push(listener);
    return () => {
      const index = listenersRef.current.indexOf(listener);
      if (index > -1) {
        listenersRef.current.splice(index, 1);
        console.log('[ReplayEvent] Unregistered listener, remaining:', listenersRef.current.length);
      }
    };
  }, []);

  return (
    <ReplayEventContext.Provider value={{ emitReplayEvent, onReplayEvent }}>
      {children}
    </ReplayEventContext.Provider>
  );
}
