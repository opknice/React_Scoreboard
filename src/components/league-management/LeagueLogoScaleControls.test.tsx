import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { League, Team } from '../../config/supabaseClient';
import LeagueLogoScaleControls from './LeagueLogoScaleControls';

const syncMocks = vi.hoisted(() => ({ publish: vi.fn() }));

vi.mock('../../hooks/useLogoCropPreviewSync', () => ({
  getLogoSyncSessionId: () => 'sync-1',
}));

vi.mock('../../hooks/useLeagueLogoScalePreviewSync', () => ({
  useLeagueLogoScalePreviewSync: () => ({
    publish: syncMocks.publish,
    status: 'connected',
  }),
}));

const league: League = {
  id: 'league-1',
  name: 'Test League',
  is_active: true,
  settings: {
    theme: 'dark',
    logoSizing: {
      overlayScalePercent: 120,
      logoBrowserScalePercent: 140,
    },
  },
};

const teams: Team[] = [
  {
    id: 'team-1',
    league_id: 'league-1',
    name: 'Alpha',
    color_primary: '#fff',
    color_secondary: '#000',
    overlay_crop_metadata: null,
    logo_browser_crop_metadata: null,
  },
  {
    id: 'team-2',
    league_id: 'league-1',
    name: 'Beta',
    color_primary: '#fff',
    color_secondary: '#000',
    overlay_crop_metadata: {
      x: 0,
      y: 0,
      width: 500,
      height: 500,
      zoom: 1,
      rotation: 0,
      aspectRatio: 1,
      frameScalePercent: 110,
      createdAt: '2026-09-05T00:00:00.000Z',
    },
    logo_browser_crop_metadata: null,
  },
];

describe('LeagueLogoScaleControls', () => {
  beforeEach(() => syncMocks.publish.mockReset());

  it('loads saved values and reports inherited versus custom teams', () => {
    render(
      <LeagueLogoScaleControls
        league={league}
        teams={teams}
        onUpdateLeague={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Overlay Size slider')).toHaveProperty('value', '120');
    expect(screen.getByLabelText('Logo Browser Size slider')).toHaveProperty('value', '140');
    expect(screen.getByText('ใช้กับ 1 ทีม · Custom Crop 1 ทีม')).toBeTruthy();
    expect(screen.getByText('ใช้กับ 2 ทีม · Custom Crop 0 ทีม')).toBeTruthy();
  });

  it('publishes a preview and preserves unrelated settings when saved', async () => {
    const onUpdateLeague = vi.fn().mockResolvedValue(league);
    render(
      <LeagueLogoScaleControls
        league={league}
        teams={teams}
        onUpdateLeague={onUpdateLeague}
      />,
    );

    fireEvent.change(screen.getByLabelText('Overlay Size slider'), { target: { value: '150' } });

    await waitFor(() => {
      expect(syncMocks.publish).toHaveBeenCalledWith(expect.objectContaining({
        action: 'preview',
        sizing: { overlayScalePercent: 150, logoBrowserScalePercent: 140 },
      }));
    });

    fireEvent.click(screen.getByRole('button', { name: /บันทึกขนาด/ }));
    await waitFor(() => {
      expect(onUpdateLeague).toHaveBeenCalledWith('league-1', {
        settings: {
          theme: 'dark',
          logoSizing: { overlayScalePercent: 150, logoBrowserScalePercent: 140 },
        },
      });
    });
  });
});
