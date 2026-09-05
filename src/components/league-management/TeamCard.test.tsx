import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Team } from '../../config/supabaseClient';
import TeamCard from './TeamCard';

const team: Team = {
  id: 'team-1',
  league_id: 'league-1',
  name: 'Alpha United',
  short_name: 'ALP',
  logo_url: 'https://example.com/alpha.png',
  color_primary: '#ffffff',
  color_secondary: '#000000',
  overlay_crop_metadata: {
    x: 0,
    y: 0,
    width: 500,
    height: 500,
    zoom: 1,
    rotation: 0,
    aspectRatio: 1,
    createdAt: '2026-09-05T00:00:00.000Z',
  },
  logo_browser_crop_metadata: null,
};

function renderTeamCard() {
  const onEdit = vi.fn();
  const onOpenCrop = vi.fn();
  const onResetContext = vi.fn();
  const onDelete = vi.fn();

  render(
    <TeamCard
      team={team}
      leagueLogoSizing={{ overlayScalePercent: 125, logoBrowserScalePercent: 150 }}
      onEdit={onEdit}
      onOpenCrop={onOpenCrop}
      onResetContext={onResetContext}
      onDelete={onDelete}
    />,
  );

  return { onEdit, onOpenCrop, onResetContext, onDelete };
}

describe('TeamCard', () => {
  it('shows fixed frames and independent crop states', () => {
    renderTeamCard();
    const logoStatuses = screen.getByLabelText('สถานะโลโก้');

    expect(within(logoStatuses).getByText('Overlay Crop')).toBeTruthy();
    expect(within(logoStatuses).getByText('Browser Crop')).toBeTruthy();
    expect(within(logoStatuses).queryByText(/League \d+%/)).toBeNull();
    expect(within(logoStatuses).queryByText('Contain')).toBeNull();
  });

  it('keeps Overlay and Logo Browser actions separate', () => {
    const { onOpenCrop } = renderTeamCard();

    fireEvent.click(screen.getByRole('button', { name: 'Overlay Crop' }));
    expect(onOpenCrop).toHaveBeenCalledWith(team, 'overlay');

    fireEvent.click(screen.getByRole('button', { name: 'Browser Crop' }));
    expect(onOpenCrop).toHaveBeenCalledWith(team, 'logo-browser');
  });

  it('keeps destructive actions inside the more menu', () => {
    const { onDelete } = renderTeamCard();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    expect(screen.queryByRole('menuitem', { name: 'ลบทีม' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'คำสั่งเพิ่มเติมสำหรับทีม Alpha United' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'ลบทีม' }));

    expect(onDelete).toHaveBeenCalledWith(team);
    vi.restoreAllMocks();
  });
});
