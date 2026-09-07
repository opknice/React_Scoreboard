import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LEAGUE_DETAIL_LABELS,
  type LeagueDetailLabels,
} from '../types/leagueDetailLabels';
import LeagueDetailLabelsModal from './LeagueDetailLabelsModal';

function renderModal(overrides: Partial<React.ComponentProps<typeof LeagueDetailLabelsModal>> = {}) {
  const props: React.ComponentProps<typeof LeagueDetailLabelsModal> = {
    isOpen: true,
    activeLeagueId: 'league-1',
    initialLabels: { ...DEFAULT_LEAGUE_DETAIL_LABELS },
    onSave: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  };

  render(<LeagueDetailLabelsModal {...props} />);
  return props;
}

describe('LeagueDetailLabelsModal', () => {
  it('edits and immediately saves the league labels', async () => {
    const initialLabels: LeagueDetailLabels = {
      ...DEFAULT_LEAGUE_DETAIL_LABELS,
      label4: 'รอบเดิม',
    };
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderModal({ initialLabels, onSave, onClose });

    const label4Input = screen.getByPlaceholderText('ข้อความ Label 4');
    expect((label4Input as HTMLInputElement).value).toBe('รอบเดิม');
    fireEvent.change(label4Input, { target: { value: 'รอบใหม่' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        ...initialLabels,
        label4: 'รอบใหม่',
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('cancels without saving the draft', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderModal({ onSave, onClose });

    fireEvent.change(screen.getByPlaceholderText('ข้อความ Label 5'), { target: { value: 'ไม่บันทึก' } });
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the modal open when its backdrop is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    const backdrop = document.querySelector('.modal-overlay');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
