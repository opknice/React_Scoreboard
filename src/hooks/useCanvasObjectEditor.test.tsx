import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { alignCanvasPosition, useCanvasObjectEditor, type CanvasObject } from './useCanvasObjectEditor';
import type { BrowserPosition } from '../types/browserPositions';

let frame: FrameRequestCallback | undefined;
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => { frame = undefined; });
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); frame = undefined; });

function Harness({ scale = 0.5, move = vi.fn() }: { scale?: number; move?: (id: string, position: BrowserPosition) => void }) {
  const [objects, setObjects] = useState<CanvasObject[]>([
    { id: 'A', label: 'Object A', position: { x: 100, y: 200 }, maxX: 1870, maxY: 1030 },
    { id: 'B', label: 'Object B', position: { x: 700, y: 800 } },
  ]);
  const editor = useCanvasObjectEditor(objects, scale, (id, position) => {
    move(id, position);
    setObjects(current => current.map(object => object.id === id ? { ...object, position } : object));
  });
  return <>
    {objects.map(object => <div key={object.id} {...editor.objectProps(object.id)}>{object.label}</div>)}
    <input aria-label="Unrelated input" />
    <output data-testid="positions">{JSON.stringify(objects.map(object => object.position))}</output>
    <output data-testid="guides">{JSON.stringify(editor.guides)}</output>
  </>;
}
const positions = () => JSON.parse(screen.getByTestId('positions').textContent ?? '[]');
const tick = () => act(() => { const callback = frame; frame = undefined; callback?.(0); });

describe('Canvas interaction', () => {
  it('selects without mutating coordinates; moves only the focused object by 1 or 10 px', () => {
    const move = vi.fn();
    render(<Harness move={move} />);
    const object = screen.getByRole('button', { name: 'Object A' });
    fireEvent.pointerDown(object, { clientX: 50, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(object, { clientX: 50, clientY: 100, pointerId: 1 });
    expect(move).not.toHaveBeenCalled();
    expect(object.getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(object, { key: 'ArrowRight' });
    fireEvent.keyDown(object, { key: 'ArrowDown', shiftKey: true });
    expect(positions()).toEqual([{ x: 101, y: 210 }, { x: 700, y: 800 }]);
    fireEvent.keyDown(screen.getByLabelText('Unrelated input'), { key: 'ArrowRight' });
    expect(move).toHaveBeenCalledTimes(2);
  });
  it('converts pointer movement at half scale and flushes the final position on release', () => {
    render(<Harness />);
    const object = screen.getByRole('button', { name: 'Object A' });
    fireEvent.pointerDown(object, { clientX: 50, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(object, { clientX: 100, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(object, { clientX: 125, clientY: 175, pointerId: 1 });
    expect(positions()).toEqual([{ x: 250, y: 350 }, { x: 700, y: 800 }]);
  });
  it('snaps to another object, shows guides, and supports Alt to move freely', () => {
    render(<Harness />);
    const object = screen.getByRole('button', { name: 'Object A' });
    fireEvent.pointerDown(object, { clientX: 50, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(object, { clientX: 347, clientY: 397, pointerId: 1 });
    tick();
    expect(positions()[0]).toEqual({ x: 700, y: 800 });
    expect(JSON.parse(screen.getByTestId('guides').textContent!)).toEqual({ x: 700, y: 800 });
    fireEvent.pointerUp(object, { clientX: 347, clientY: 397, pointerId: 1, altKey: true });
    expect(positions()[0]).toEqual({ x: 694, y: 794 });
  });
  it('restores the original position on Escape or pointer cancellation', () => {
    const move = vi.fn();
    render(<Harness move={move} />);
    const object = screen.getByRole('button', { name: 'Object A' });
    for (const cancel of ['escape', 'pointercancel']) {
      fireEvent.pointerDown(object, { clientX: 50, clientY: 100, pointerId: 1 });
      fireEvent.pointerMove(object, { clientX: 100, clientY: 150, pointerId: 1 });
      tick();
      if (cancel === 'escape') fireEvent.keyDown(object, { key: 'Escape' });
      else fireEvent.pointerCancel(object, { pointerId: 1 });
      expect(positions()[0]).toEqual({ x: 100, y: 200 });
    }
  });
  it('clamps movement and ignores other pointers or queued frames after unmount', () => {
    const move = vi.fn();
    const { unmount } = render(<Harness move={move} />);
    const object = screen.getByRole('button', { name: 'Object A' });
    fireEvent.pointerDown(object, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(object, { clientX: 100, clientY: 100, pointerId: 2 });
    tick();
    expect(move).not.toHaveBeenCalled();
    fireEvent.pointerUp(object, { clientX: 5000, clientY: -5000, pointerId: 1 });
    expect(positions()[0]).toEqual({ x: 1870, y: 0 });
    fireEvent.pointerDown(object, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(object, { clientX: 100, clientY: 100, pointerId: 1 });
    unmount();
    tick();
    expect(move).toHaveBeenCalledTimes(1);
  });
  it('aligns to the canvas center and never snaps outside object bounds', () => {
    const object = { id: 'A', label: 'A', position: { x: 0, y: 0 }, maxX: 1800, maxY: 1000 };
    expect(alignCanvasPosition({ x: 955, y: 543 }, object, [object], 6)).toEqual({ position: { x: 960, y: 540 }, guides: { x: 960, y: 540 } });
    expect(alignCanvasPosition({ x: 1919, y: 1079 }, object, [object], 6).position).toEqual({ x: 1800, y: 1000 });
  });
});
