import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BrowserPositionEditor from './BrowserPositionEditor';
import { SCORE_POSITIONS } from '../types/browserPositions';

afterEach(cleanup);

it('edits A independently, ignores empty drafts, and resets both positions', () => {
  const onChange = vi.fn();
  const positions = { A: { x: 150, y: 200 }, B: { x: 1200, y: 300 } };
  render(<BrowserPositionEditor label="Score" positions={positions} defaults={SCORE_POSITIONS} anchor="top" onChange={onChange} />);
  const input = screen.getByLabelText('Score Team A X');
  fireEvent.change(input, { target: { value: '600' } });
  expect(onChange).toHaveBeenLastCalledWith({ A: { x: 600, y: 200 }, B: positions.B });
  fireEvent.change(input, { target: { value: '' } });
  expect(onChange).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'รีเซ็ตเฉพาะตำแหน่ง' }));
  expect(onChange).toHaveBeenLastCalledWith(SCORE_POSITIONS);
});
