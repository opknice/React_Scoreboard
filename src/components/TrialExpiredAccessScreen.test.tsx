import { fireEvent, render, screen } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import TrialExpiredAccessScreen from './TrialExpiredAccessScreen';

const user = {
  id: 'user-1',
  aud: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-09-09T00:00:00.000Z',
  email: 'viewer@example.com',
} as User;

function renderScreen() {
  const onRecheckAccess = vi.fn();
  const onLogout = vi.fn();

  render(
    <TrialExpiredAccessScreen
      user={user}
      reason="สิทธิ์ทดลองใช้งานหมดอายุแล้ว"
      isCheckingAccess={false}
      onRecheckAccess={onRecheckAccess}
      onLogout={onLogout}
    />,
  );

  return { onRecheckAccess, onLogout };
}

describe('TrialExpiredAccessScreen', () => {
  it('shows contact details and opens the contact dialog initially', () => {
    renderScreen();

    expect(screen.getByRole('heading', { name: 'ทดลองใช้ฟรีหมดอายุแล้ว' })).not.toBeNull();
    expect(screen.getByRole('dialog', { name: 'ต้องการใช้งาน MatchFlow Studio ต่อหรือไม่?' })).not.toBeNull();
    expect(screen.getAllByText('nicethanakrit')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /thanakrit\.nice/i })[0]?.getAttribute('href')).toBe(
      'https://www.facebook.com/thanakrit.nice',
    );
  });

  it('keeps the contact card available after closing the dialog', () => {
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'ปิดหน้าต่าง' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'ติดต่อ Admin เพื่อขอสิทธิ์ VIP' })).not.toBeNull();
  });

  it('requests an access recheck when the approval button is pressed', () => {
    const { onRecheckAccess } = renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'ฉันได้รับอนุมัติแล้ว — ตรวจสอบสิทธิ์อีกครั้ง' }));

    expect(onRecheckAccess).toHaveBeenCalledTimes(1);
  });
});
