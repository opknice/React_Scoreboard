import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { BrowserPosition } from '../types/browserPositions';

export interface CanvasObject {
  id: string;
  label: string;
  position: BrowserPosition;
  maxX?: number;
  maxY?: number;
}
export interface CanvasGuides { x?: number; y?: number }

export function constrainCanvasPosition(position: BrowserPosition, object: CanvasObject): BrowserPosition {
  return { x: Math.min(object.maxX ?? 1920, Math.max(0, position.x)), y: Math.min(object.maxY ?? 1080, Math.max(0, position.y)) };
}

/** Snap anchor points in screen pixels so the tolerance stays usable at every preview scale. */
export function alignCanvasPosition(position: BrowserPosition, object: CanvasObject, objects: CanvasObject[], tolerance: number) {
  const result = constrainCanvasPosition(position, object);
  const guides: CanvasGuides = {};
  for (const axis of ['x', 'y'] as const) {
    const candidates = [0, axis === 'x' ? 960 : 540, axis === 'x' ? 1920 : 1080,
      ...objects.filter(item => item.id !== object.id).map(item => item.position[axis])];
    const max = axis === 'x' ? object.maxX ?? 1920 : object.maxY ?? 1080;
    const closest = candidates.filter(value => value <= max).sort((a, b) => Math.abs(a - result[axis]) - Math.abs(b - result[axis]))[0];
    if (closest !== undefined && Math.abs(closest - result[axis]) <= tolerance) {
      result[axis] = closest;
      guides[axis] = closest;
    }
  }
  return { position: result, guides };
}

interface Drag {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  origin: BrowserPosition;
  scale: number;
  target: HTMLElement;
  moved: boolean;
}

export function useCanvasObjectEditor(objects: CanvasObject[], scale: number, onMove: (id: string, position: BrowserPosition) => void) {
  const [selected, setSelected] = useState<string | null>(null);
  const [guides, setGuides] = useState<CanvasGuides>({});
  const [snap, setSnap] = useState(true);
  const drag = useRef<Drag | null>(null);
  const pending = useRef<{ x: number; y: number; alt: boolean } | null>(null);
  const animation = useRef<number | null>(null);
  const latest = useRef({ objects, onMove, snap });
  latest.current = { objects, onMove, snap };

  const flush = () => {
    animation.current = null;
    const active = drag.current;
    const point = pending.current;
    pending.current = null;
    if (!active || !point) return;
    const object = latest.current.objects.find(item => item.id === active.id);
    if (!object) return;
    const position = constrainCanvasPosition({
      x: Math.round(active.origin.x + (point.x - active.startX) / active.scale),
      y: Math.round(active.origin.y + (point.y - active.startY) / active.scale),
    }, object);
    const aligned = latest.current.snap && !point.alt
      ? alignCanvasPosition(position, object, latest.current.objects, 6 / active.scale)
      : { position, guides: {} };
    setGuides(aligned.guides);
    latest.current.onMove(active.id, aligned.position);
  };
  const clearPending = () => {
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = null;
    pending.current = null;
  };
  const finish = (cancel: boolean) => {
    const active = drag.current;
    if (!active) return;
    if (cancel) {
      clearPending();
      latest.current.onMove(active.id, active.origin);
    } else {
      if (animation.current !== null) cancelAnimationFrame(animation.current);
      flush();
    }
    drag.current = null;
    if (active.target.hasPointerCapture?.(active.pointerId)) active.target.releasePointerCapture(active.pointerId);
    setGuides({});
  };
  useEffect(() => () => {
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    const active = drag.current;
    drag.current = null;
    if (active?.target.hasPointerCapture?.(active.pointerId)) active.target.releasePointerCapture(active.pointerId);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>, id: string) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish(true);
      setSelected(null);
      setGuides({});
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setSelected(id); return; }
    if (!event.key.startsWith('Arrow') || event.ctrlKey || event.metaKey || event.altKey || drag.current) return;
    const object = latest.current.objects.find(item => item.id === id);
    if (!object) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 10 : 1;
    const x = object.position.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0);
    const y = object.position.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0);
    const position = constrainCanvasPosition({ x, y }, object);
    setSelected(id);
    // Keyboard nudges stay exact; guides show exact matches without pulling the object back.
    setGuides(alignCanvasPosition(position, object, latest.current.objects, 0).guides);
    latest.current.onMove(id, position);
  };

  const select = (id: string | null) => { setSelected(id); setGuides({}); };

  const objectProps = (id: string) => ({
    'data-canvas-object': id,
    'data-selected': selected === id,
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': objects.find(item => item.id === id)?.label,
    'aria-pressed': selected === id,
    onFocus: () => select(id),
    onClick: () => select(id),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => onKeyDown(event, id),
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || drag.current || scale <= 0) return;
      const object = latest.current.objects.find(item => item.id === id);
      if (!object) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.focus({ preventScroll: true });
      setSelected(id);
      setGuides({});
      drag.current = { id, pointerId: event.pointerId, origin: { ...object.position }, startX: event.clientX, startY: event.clientY, scale, target: event.currentTarget, moved: false };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (drag.current?.pointerId !== event.pointerId) return;
      if (!drag.current.moved && event.clientX === drag.current.startX && event.clientY === drag.current.startY) return;
      drag.current.moved = true;
      pending.current = { x: event.clientX, y: event.clientY, alt: event.altKey };
      if (animation.current === null) animation.current = requestAnimationFrame(flush);
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      if (drag.current?.pointerId !== event.pointerId) return;
      // A click alone selects; it must never snap or round an existing position.
      if (drag.current.moved || event.clientX !== drag.current.startX || event.clientY !== drag.current.startY) pending.current = { x: event.clientX, y: event.clientY, alt: event.altKey };
      finish(false);
    },
    onPointerCancel: (event: PointerEvent<HTMLElement>) => { if (drag.current?.pointerId === event.pointerId) finish(true); },
    onLostPointerCapture: (event: PointerEvent<HTMLElement>) => { if (drag.current?.pointerId === event.pointerId) finish(true); },
  });

  return { selected, setSelected: select, guides, snap, setSnap, objectProps };
}
