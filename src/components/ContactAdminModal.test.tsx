import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ContactAdminModal from './ContactAdminModal';

describe('ContactAdminModal', () => {
  it('shows the signed-in email and all admin contact methods', () => {
    render(<ContactAdminModal userEmail="viewer@example.com" onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'ติดต่อ Admin' })).not.toBeNull();
    expect(screen.getByText('viewer@example.com')).not.toBeNull();
    expect(screen.getByRole('img', { name: 'QR Code สำหรับเพิ่มเพื่อน LINE Admin' }).getAttribute('src')).toBe('/LineAdd.jpg');
    expect(screen.getByRole('link', { name: 'เปิด LINE' }).getAttribute('href')).toBe('https://line.me/ti/p/Z8lsk-RlcJ');
    expect(screen.getByRole('link', { name: /thanakrit\.nice/i }).getAttribute('href')).toBe(
      'https://www.facebook.com/thanakrit.nice',
    );
    expect(screen.getByRole('link', { name: /086-4187346/ }).getAttribute('href')).toBe('tel:0864187346');
  });

  it('copies the signed-in email', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<ContactAdminModal userEmail="viewer@example.com" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'คัดลอกอีเมล viewer@example.com' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('viewer@example.com'));
    expect(screen.getByText('คัดลอกแล้ว')).not.toBeNull();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<ContactAdminModal userEmail="viewer@example.com" onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
