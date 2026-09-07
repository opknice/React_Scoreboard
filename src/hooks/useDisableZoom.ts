import { useEffect } from 'react';

interface ZoomLockMetrics {
  innerWidth: number;
  innerHeight: number;
  initialDpr: number;
  currentDpr: number;
}

export interface ZoomLockCompensation {
  cssZoom: number;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Page zoom changes both DPR and the layout viewport. Reconstruct the logical
 * viewport from the DPR ratio so responsive units can retain their baseline.
 */
export function calculateZoomLockCompensation({
  innerWidth,
  innerHeight,
  initialDpr,
  currentDpr,
}: ZoomLockMetrics): ZoomLockCompensation {
  const safeInitialDpr = initialDpr > 0 ? initialDpr : 1;
  const safeCurrentDpr = currentDpr > 0 ? currentDpr : safeInitialDpr;
  const zoomRatio = safeCurrentDpr / safeInitialDpr;
  const boundedZoomRatio = Math.min(5, Math.max(0.25, zoomRatio));

  return {
    cssZoom: 1 / boundedZoomRatio,
    viewportWidth: Math.max(1, innerWidth * boundedZoomRatio),
    viewportHeight: Math.max(1, innerHeight * boundedZoomRatio),
  };
}

/**
 * Custom hook to disable zoom (wheel zoom, keyboard Ctrl+/-, touch pinch zoom)
 * and automatically lock scale against OBS CEF / Browser Zoom in display pages.
 */
export function useDisableZoom(lockScale = true) {
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

    // 5. Anti-Zoom DPR Compensation (Cancels OBS CEF Browser Zoom)
    const initialDpr = window.devicePixelRatio || 1;
    const originalZoom = document.body.style.getPropertyValue('zoom');
    const root = document.documentElement;
    const originalLockedWidth = root.style.getPropertyValue('--zoom-locked-viewport-width');
    const originalLockedHeight = root.style.getPropertyValue('--zoom-locked-viewport-height');
    let lastAppliedSignature = '';

    const handleDprCompensation = () => {
      if (!lockScale) return;
      const currentDpr = window.devicePixelRatio || 1;
      const compensation = calculateZoomLockCompensation({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        initialDpr,
        currentDpr,
      });
      const targetZoom = String(Number(compensation.cssZoom.toFixed(4)));
      const viewportWidth = `${Number(compensation.viewportWidth.toFixed(2))}px`;
      const viewportHeight = `${Number(compensation.viewportHeight.toFixed(2))}px`;
      const signature = `${targetZoom}:${viewportWidth}:${viewportHeight}`;

      // Avoid forcing style recalculation when zoom and viewport are unchanged.
      if (signature === lastAppliedSignature) return;
      document.body.style.setProperty('zoom', targetZoom);
      root.style.setProperty('--zoom-locked-viewport-width', viewportWidth);
      root.style.setProperty('--zoom-locked-viewport-height', viewportHeight);
      lastAppliedSignature = signature;
    };

    handleDprCompensation();

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('resize', handleDprCompensation);
    document.addEventListener('visibilitychange', handleDprCompensation);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleDprCompensation);
    }

    // Some OBS CEF zoom changes do not emit resize. Keep a low-frequency
    // fallback, but the cached value prevents repeated DOM writes.
    const interval = window.setInterval(handleDprCompensation, 1_000);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('resize', handleDprCompensation);
      document.removeEventListener('visibilitychange', handleDprCompensation);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleDprCompensation);
      }
      window.clearInterval(interval);
      if (originalZoom) {
        document.body.style.setProperty('zoom', originalZoom);
      } else {
        document.body.style.removeProperty('zoom');
      }
      if (originalLockedWidth) {
        root.style.setProperty('--zoom-locked-viewport-width', originalLockedWidth);
      } else {
        root.style.removeProperty('--zoom-locked-viewport-width');
      }
      if (originalLockedHeight) {
        root.style.setProperty('--zoom-locked-viewport-height', originalLockedHeight);
      } else {
        root.style.removeProperty('--zoom-locked-viewport-height');
      }
      if (metaViewport && originalContent !== null) {
        metaViewport.setAttribute('content', originalContent);
      }
    };
  }, [lockScale]);
}
