import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Team } from '../config/supabaseClient';
import LogoBrowserCropModal from './LogoBrowserCropModal';

const { publish } = vi.hoisted(() => ({ publish: vi.fn() }));
vi.mock('../hooks/useLogoCropPreviewSync', () => ({
  getLogoSyncSessionId: () => 'test-session',
  useLogoCropPreviewSync: () => ({ publish, status: 'connected' }),
}));
vi.mock('./LogoWithCrop', () => ({ default: () => <div>Logo preview</div> }));

const team: Team = {
  id: 'team-1', league_id: 'league-1', name: 'Test team', short_name: 'T',
  logo_url: 'https://example.com/logo.png', color_primary: '#fff', color_secondary: '#000',
  overlay_crop_metadata: null, logo_browser_crop_metadata: null,
};
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('browser frame editing', () => {
  it('resets the persisted custom crop and publishes the default-frame reset', async () => {
    const onReset = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<LogoBrowserCropModal isOpen team={team} cropMetadata={null} cropContext="logo-browser"
      initialFrameScalePercent={55} onReset={onReset} onClose={onClose} onSave={vi.fn()} />);
    expect((screen.getByRole('spinbutton', { name: /ความกว้าง/ }) as HTMLInputElement).value).toBe('105');
    fireEvent.click(screen.getByRole('button', { name: /รีเซ็ตทั้งหมด/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onReset).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'reset', crop: null }));
  });
  it('previews independent sizes, saves them and restores them when reopened', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const props = { isOpen: true, team, cropMetadata: null, cropContext: 'logo-browser' as const,
      onClose: vi.fn(), onReset: vi.fn(), onSave };
    const view = render(<LogoBrowserCropModal {...props} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByRole('spinbutton', { name: /ความกว้าง/ }), { target: { value: '200' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /ความสูง/ }), { target: { value: '100' } });
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'preview', context: 'logo-browser',
      crop: expect.objectContaining({ browserFrame: { width: 200, height: 100, lockAspectRatio: false } }) }));
    fireEvent.click(screen.getByRole('button', { name: /บันทึก Crop/ }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    const saved = onSave.mock.calls[0][0];
    view.unmount();
    render(<LogoBrowserCropModal {...props} cropMetadata={saved} />);
    expect((screen.getByRole('spinbutton', { name: /ความสูง/ }) as HTMLInputElement).value).toBe('100');
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });

  it('cancels drafts without saving and hides size controls for overlay', () => {
    const props = { isOpen: true, team, cropMetadata: null, cropContext: 'logo-browser' as const,
      onClose: vi.fn(), onReset: vi.fn(), onSave: vi.fn() };
    const view = render(<LogoBrowserCropModal {...props} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: /ความกว้าง/ }), { target: { value: '300' } });
    expect((screen.getByRole('spinbutton', { name: /ความสูง/ }) as HTMLInputElement).value).toBe('300');
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'cancelled', crop: null }));
    view.rerender(<LogoBrowserCropModal {...props} cropContext="overlay" />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
