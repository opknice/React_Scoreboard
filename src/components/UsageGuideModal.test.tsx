import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UsageGuideModal from './UsageGuideModal';

describe('UsageGuideModal', () => {
  it('shows the approved guide sections and changes the active section', () => {
    render(<UsageGuideModal onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'วิธีการใช้งาน MatchFlow Studio' })).not.toBeNull();
    expect(screen.getByText('เตรียมระบบให้พร้อมก่อนเปิดแผงควบคุมการแข่งขัน')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /ตั้งค่า OBS และ Browser Source/ }));

    expect(screen.getByRole('heading', { name: 'ตั้งค่า OBS และ Browser Source' })).not.toBeNull();
    expect(screen.getByText('เชื่อม MatchFlow Studio เข้ากับฉากถ่ายทอดของ OBS')).not.toBeNull();
    expect(screen.queryByRole('link', { name: /วิดีโอ/i })).toBeNull();
  });

  it('closes when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<UsageGuideModal onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
