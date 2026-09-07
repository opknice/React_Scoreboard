import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ModalBackdrop from './ModalBackdrop';

describe('ModalBackdrop', () => {
  it('ignores backdrop clicks and prevents them from reaching an ancestor modal', () => {
    const onAncestorClick = vi.fn();

    render(
      <div onClick={onAncestorClick}>
        <ModalBackdrop data-testid="modal-backdrop">
          <button type="button">ปิด</button>
        </ModalBackdrop>
      </div>,
    );

    fireEvent.click(screen.getByTestId('modal-backdrop'));
    fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));

    expect(onAncestorClick).not.toHaveBeenCalled();
  });

  it('sends Escape only to the topmost open modal', () => {
    const onFirstEscape = vi.fn();
    const onSecondEscape = vi.fn();

    render(
      <>
        <ModalBackdrop onEscape={onFirstEscape} data-testid="first-modal" />
        <ModalBackdrop onEscape={onSecondEscape} data-testid="second-modal" />
      </>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onSecondEscape).toHaveBeenCalledTimes(1);
    expect(onFirstEscape).not.toHaveBeenCalled();
  });
});
