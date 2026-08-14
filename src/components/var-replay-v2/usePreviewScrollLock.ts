import { useEffect } from 'react';

export function usePreviewScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    const body = document.body;
    const previous = {
      rootOverflowY: root.style.overflowY,
      bodyOverflowY: body.style.overflowY,
      bodyPaddingRight: body.style.paddingRight,
    };
    const scrollbarWidth = window.innerWidth - root.clientWidth;

    root.style.overflowY = 'hidden';
    body.style.overflowY = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      root.style.overflowY = previous.rootOverflowY;
      body.style.overflowY = previous.bodyOverflowY;
      body.style.paddingRight = previous.bodyPaddingRight;
    };
  }, [locked]);
}
