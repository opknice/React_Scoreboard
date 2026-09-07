import { useEffect, useId, useRef, type ComponentPropsWithoutRef, type MouseEvent } from 'react';

type ModalBackdropProps = Omit<
  ComponentPropsWithoutRef<'div'>,
  'onClick' | 'onMouseDown' | 'onMouseUp'
> & {
  onEscape?: () => void;
};

const escapeStack: string[] = [];
const escapeHandlers = new Map<string, () => void>();
let escapeListenerAttached = false;

function handleGlobalEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented) return;

  const topmostId = escapeStack[escapeStack.length - 1];
  const handler = topmostId ? escapeHandlers.get(topmostId) : undefined;
  if (!handler) return;

  event.preventDefault();
  event.stopPropagation();
  handler();
}

function registerEscapeHandler(id: string, handler: () => void): () => void {
  escapeStack.push(id);
  escapeHandlers.set(id, handler);

  if (!escapeListenerAttached) {
    window.addEventListener('keydown', handleGlobalEscape);
    escapeListenerAttached = true;
  }

  return () => {
    const index = escapeStack.lastIndexOf(id);
    if (index >= 0) escapeStack.splice(index, 1);
    escapeHandlers.delete(id);
    if (escapeStack.length === 0 && escapeListenerAttached) {
      window.removeEventListener('keydown', handleGlobalEscape);
      escapeListenerAttached = false;
    }
  };
}

function stopBackdropClickPropagation(event: MouseEvent<HTMLDivElement>): void {
  // Backdrop clicks are intentionally ignored. Explicit buttons and Escape
  // remain the only supported ways to dismiss an open modal.
  event.stopPropagation();
}

export default function ModalBackdrop({ children, onEscape, ...props }: ModalBackdropProps) {
  const id = useId();
  const escapeHandlerRef = useRef(onEscape);
  escapeHandlerRef.current = onEscape;
  const hasEscapeHandler = onEscape !== undefined;

  useEffect(() => {
    if (!hasEscapeHandler) return undefined;
    return registerEscapeHandler(id, () => escapeHandlerRef.current?.());
  }, [id, hasEscapeHandler]);

  return (
    <div {...props} onClick={stopBackdropClickPropagation}>
      {children}
    </div>
  );
}
