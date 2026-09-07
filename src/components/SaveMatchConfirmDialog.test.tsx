import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SaveMatchConfirmDialog from './SaveMatchConfirmDialog';

function renderDialog(overrides: Partial<React.ComponentProps<typeof SaveMatchConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  const result = render(
    <SaveMatchConfirmDialog
      isOpen
      teamAName="Alpha"
      teamBName="Beta"
      scoreA={2}
      scoreB={1}
      onConfirm={onConfirm}
      onClose={onClose}
      {...overrides}
    />,
  );

  return { ...result, onConfirm, onClose };
}

describe('SaveMatchConfirmDialog', () => {
  it('does not render when closed', () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('renders independently with its own dialog classes', () => {
    const { baseElement } = renderDialog();

    expect(screen.getByRole('alertdialog').textContent).toContain('(Alpha)  2 - 1  (Beta)');
    expect(baseElement.querySelector('.save-match-confirm-overlay')).not.toBeNull();
    expect(baseElement.querySelector('.league-modal-overlay')).toBeNull();
  });

  it('confirms once, closes on Escape, and ignores backdrop clicks', () => {
    const { baseElement, onConfirm, onClose } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'ยืนยัน' }));
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยัน' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    const overlay = baseElement.querySelector('.save-match-confirm-overlay');
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
