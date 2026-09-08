import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ModalBackdrop from './ModalBackdrop';
import ModalCloseButton from './ModalCloseButton';
import ScoreboardLazyFallback from './scoreboard/ScoreboardLazyFallback';

afterEach(cleanup);

it('closes only the nested modal and respects its disabled state', () => {
  const outerClose = vi.fn();
  const innerClose = vi.fn();
  const view = (disabled: boolean) => (
    <ModalBackdrop onEscape={outerClose}>
      <div className="modal-content">
        <ModalCloseButton onClose={outerClose} />
        <ModalBackdrop onEscape={innerClose}>
          <div className="modal-content" data-testid="inner-modal">
            <ModalCloseButton onClose={innerClose} disabled={disabled} />
          </div>
        </ModalBackdrop>
      </div>
    </ModalBackdrop>
  );
  const { rerender } = render(view(true));
  fireEvent.click(within(screen.getByTestId('inner-modal')).getByRole('button', { name: 'ปิดหน้าต่าง' }));
  expect(innerClose).not.toHaveBeenCalled();
  rerender(view(false));
  fireEvent.click(within(screen.getByTestId('inner-modal')).getByRole('button', { name: 'ปิดหน้าต่าง' }));
  expect(innerClose).toHaveBeenCalledOnce();
  expect(outerClose).not.toHaveBeenCalled();
});

it('lets users close a modal while its content is loading', () => {
  const onClose = vi.fn();
  render(<ScoreboardLazyFallback onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: 'ปิดหน้าต่าง' }));
  expect(onClose).toHaveBeenCalledOnce();
});
