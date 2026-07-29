import { useEffect } from 'react';

/**
 * Custom hook to disable zoom (wheel zoom, keyboard Ctrl+/-, touch pinch zoom)
 * specifically for display pages like overlays and standalone tables.
 */
export function useDisableZoom() {
  useEffect(() => {
    // 1. Prevent wheel zoom (Ctrl + wheel)
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    // 2. Prevent keyboard zoom (Ctrl/Cmd + +, -, 0, =)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (
          ['+', '-', '=', '0', 'NumpadAdd', 'NumpadSubtract'].includes(e.key) ||
          ['Equal', 'Minus', 'Digit0', 'NumpadAdd', 'NumpadSubtract'].includes(e.code)
        ) {
          e.preventDefault();
        }
      }
    };

    // 3. Prevent pinch zoom on touch devices
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    // 4. Set viewport meta tag to disable user scaling
    let metaViewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    const originalContent = metaViewport ? metaViewport.getAttribute('content') : null;

    if (metaViewport) {
      metaViewport.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
      );
    } else {
      metaViewport = document.createElement('meta');
      metaViewport.name = 'viewport';
      metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.head.appendChild(metaViewport);
    }

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
      if (metaViewport && originalContent !== null) {
        metaViewport.setAttribute('content', originalContent);
      }
    };
  }, []);
}
