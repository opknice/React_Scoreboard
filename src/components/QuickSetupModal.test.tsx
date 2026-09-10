import { useState, type ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import QuickSetupModal from './QuickSetupModal';
import { DEFAULT_TEAM_NAME_BROWSER_SETTINGS } from '../types/teamNameBrowserSettings';
import { DEFAULT_SCORE_BROWSER_SETTINGS } from '../types/scoreBrowserSettings';
import { DEFAULT_LOGO_BROWSER_SETTINGS } from '../types/logoBrowserSettings';
import { DEFAULT_TEAM_COLOR_BROWSER_SETTINGS } from '../types/teamColorBrowserSettings';
import { DEFAULT_PLAYER_BROWSER_SETTINGS } from '../types/playerBrowserSettings';

vi.mock('../hooks/useLocalFontOptions', () => ({ useLocalFontOptions: () => ({ fontOptions: [{ value: 'Inter', label: 'Inter' }], localFontMessage: '', loading: false, refresh: vi.fn() }) }));
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  localStorage.clear();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function props(): ComponentProps<typeof QuickSetupModal> {
  return {
    isOpen: true,
    teams: [],
    tickerSpeed: 75,
    closeLabel: 'ปิด',
    teamNameSettings: DEFAULT_TEAM_NAME_BROWSER_SETTINGS,
    scoreSettings: DEFAULT_SCORE_BROWSER_SETTINGS,
    teamColorSettings: DEFAULT_TEAM_COLOR_BROWSER_SETTINGS,
    logoSettings: DEFAULT_LOGO_BROWSER_SETTINGS,
    playerBrowserSettings: DEFAULT_PLAYER_BROWSER_SETTINGS,
    teamNameUrls: { A: 'https://example.test/name-a', B: 'https://example.test/name-b' },
    logoUrls: { A: 'https://example.test/logo-a', B: 'https://example.test/logo-b' },
    teamColorUrls: { A: 'https://example.test/color-a', B: 'https://example.test/color-b' },
    scoreUrls: { A: 'https://example.test/score-a', B: 'https://example.test/score-b', both: 'https://example.test/score' },
    playerBrowserUrl: 'https://example.test/player',
    playerAutoHideEnabled: true,
    playerAutoHideSeconds: 5,
    teamNameObsBusy: false,
    teamNameObsConnected: true,
    teamNameObsMessage: '',
    scoreObsBusy: false,
    scoreObsMessage: '',
    teamColorObsBusy: false,
    teamColorObsConnected: true,
    teamColorObsMessage: '',
    logoObsBusy: false,
    logoObsConnected: true,
    logoObsMessage: '',
    playerObsBusy: false,
    playerObsConnected: true,
    playerObsMessage: '',
    onUpdateTeam: vi.fn(async () => null),
    onTickerSpeedChange: vi.fn(),
    onTeamNameSettingsChange: vi.fn(),
    onCopyTeamNameUrl: vi.fn(),
    onScoreSettingsChange: vi.fn(),
    onCopyScoreUrl: vi.fn(),
    onQuickAddScore: vi.fn(),
    onTeamColorSettingsChange: vi.fn(),
    onCopyTeamColorUrl: vi.fn(),
    onQuickAddTeamColor: vi.fn(),
    onLogoSettingsChange: vi.fn(),
    onCopyLogoUrl: vi.fn(),
    onQuickAddLogo: vi.fn(),
    onQuickAddTeamNames: vi.fn(),
    onPlayerAutoHideEnabledChange: vi.fn(),
    onPlayerAutoHideSecondsChange: vi.fn(),
    onCopyPlayerBrowserUrl: vi.fn(),
    onPlayerBrowserSettingsChange: vi.fn(),
    onQuickAddPlayer: vi.fn(),
    onOpenObsSetup: vi.fn(),
    onCopyOverlay: vi.fn(),
    onOpenLeagueManager: vi.fn(),
    onClose: vi.fn(),
  };
}
function launch() {
  fireEvent.click(screen.getByRole('button', { name: /เปิดตัวแก้ไข Browser Source/ }));
}
function select(name: string) {
  fireEvent.click(within(screen.getByRole('navigation', { name: 'ประเภท Browser Source' })).getByRole('button', { name: new RegExp(name) }));
}
describe('Browser Source workspace integration', () => {
  it('connects Canvas keyboard movement to the correct settings for all five types', () => {
    const options = props();
    render(<QuickSetupModal {...options} />);
    launch();
    const cases = [
      { section: 'Player', object: 'รูปนักเตะ', callback: options.onPlayerBrowserSettingsChange },
      { section: 'Team Name', object: 'ชื่อทีม A', callback: options.onTeamNameSettingsChange },
      { section: 'Team Color', object: 'สีทีม A1', callback: options.onTeamColorSettingsChange },
      { section: 'Logo', object: 'โลโก้ A', callback: options.onLogoSettingsChange },
      { section: 'Score', object: 'คะแนน A', callback: options.onScoreSettingsChange },
    ];
    for (const item of cases) {
      select(item.section);
      const object = screen.getByRole('button', { name: item.object });
      fireEvent.keyDown(object, { key: 'ArrowRight' });
      expect(item.callback).toHaveBeenCalledTimes(1);
      fireEvent.keyDown(object, { key: 'Escape' });
      expect(screen.getByRole('dialog')).toBeTruthy();
    }
    expect(options.onPlayerBrowserSettingsChange).toHaveBeenCalledWith({ ...DEFAULT_PLAYER_BROWSER_SETTINGS, image: { ...DEFAULT_PLAYER_BROWSER_SETTINGS.image, x: DEFAULT_PLAYER_BROWSER_SETTINGS.image.x + 1 } });
    expect(options.onTeamColorSettingsChange).toHaveBeenCalledWith({ positions: { A1: { x: DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.positions.A1.x + 1, y: DEFAULT_TEAM_COLOR_BROWSER_SETTINGS.positions.A1.y } } });
    expect(options.onScoreSettingsChange).toHaveBeenCalledWith({ positions: { ...DEFAULT_SCORE_BROWSER_SETTINGS.positions, A: { ...DEFAULT_SCORE_BROWSER_SETTINGS.positions.A, x: DEFAULT_SCORE_BROWSER_SETTINGS.positions.A.x + 1 } } });
  });
  it('opens one editor, switches all five sources, and returns focus to Quick Setup', () => {
    render(<QuickSetupModal {...props()} />);
    launch();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    for (const [label, kind] of [['Player', 'player'], ['Team Name', 'team-name'], ['Team Color', 'team-color'], ['Logo', 'logo'], ['Score', 'score']]) {
      select(label);
      expect(screen.getByRole('group', { name: `Canvas ${kind}` })).toBeTruthy();
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
    }
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /เปิดตัวแก้ไข Browser Source/ }));
  });
  it('routes OBS and Copy actions to the selected source only', () => {
    const options = props();
    render(<QuickSetupModal {...options} />);
    launch();
    select('Score');
    expect(screen.queryByRole('textbox', { name: 'URL A' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'OBS / URL' }));
    expect(screen.getByRole('textbox', { name: 'URL A' }).getAttribute('value')).toBe(options.scoreUrls.A);
    fireEvent.click(screen.getByRole('button', { name: 'Copy A' }));
    expect(options.onCopyScoreUrl).toHaveBeenCalledWith('A');
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่ม / อัปเดต Score ใน OBS' }));
    expect(options.onQuickAddScore).toHaveBeenCalledTimes(1);
    expect(options.onQuickAddLogo).not.toHaveBeenCalled();
    select('Team Color');
    expect(screen.getByRole('tab', { name: 'ตั้งค่าการแสดงผล' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่ม / อัปเดต Team Color ใน OBS' }));
    expect(options.onQuickAddTeamColor).toHaveBeenCalledTimes(1);
  });
  it('updates settings and preview together and preserves edits across source navigation', () => {
    const options = props();
    function Harness() {
      const [settings, setSettings] = useState(DEFAULT_TEAM_NAME_BROWSER_SETTINGS);
      return <QuickSetupModal {...options} teamNameSettings={settings} onTeamNameSettingsChange={patch => setSettings(current => ({ ...current, ...patch }))} />;
    }
    render(<Harness />);
    launch();
    select('Team Name');
    fireEvent.change(screen.getByLabelText('Team Name Team A X'), { target: { value: '640' } });
    const canvas = screen.getByRole('group', { name: 'Canvas team-name' });
    expect((canvas.querySelector('.team-name-instance') as HTMLElement).style.left).toBe('640px');
    select('Logo');
    select('Team Name');
    expect((screen.getByLabelText('Team Name Team A X') as HTMLInputElement).value).toBe('640');
    fireEvent.click(screen.getByRole('button', { name: 'รีเซ็ตเฉพาะตำแหน่ง' }));
    expect((screen.getByLabelText('Team Name Team A X') as HTMLInputElement).value).toBe(String(DEFAULT_TEAM_NAME_BROWSER_SETTINGS.positions.A.x));
  });
  it('disables OBS writes when disconnected and displays actual save errors', () => {
    const options = props();
    render(<QuickSetupModal {...options} teamNameObsConnected={false} browserSourceSaveStatus="error" />);
    launch();
    select('Team Name');
    expect((screen.getByRole('button', { name: 'เพิ่ม / อัปเดต Team Name ใน OBS' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('บันทึกไม่สำเร็จ');
    fireEvent.click(screen.getByRole('button', { name: 'ปิดตัวแก้ไข Browser Source' }));
    expect(options.onClose).toHaveBeenCalledTimes(1);
  });
  it('preserves the OBS and URL callbacks for every source', () => {
    const options = props();
    render(<QuickSetupModal {...options} />);
    launch();
    const cases = [
      { label: 'Player', copyLabel: 'Player', copy: options.onCopyPlayerBrowserUrl, add: options.onQuickAddPlayer },
      { label: 'Team Name', copyLabel: 'A', copy: options.onCopyTeamNameUrl, add: options.onQuickAddTeamNames },
      { label: 'Team Color', copyLabel: 'A', copy: options.onCopyTeamColorUrl, add: options.onQuickAddTeamColor },
      { label: 'Logo', copyLabel: 'A', copy: options.onCopyLogoUrl, add: options.onQuickAddLogo },
      { label: 'Score', copyLabel: 'A', copy: options.onCopyScoreUrl, add: options.onQuickAddScore },
    ];
    for (const item of cases) {
      select(item.label);
      fireEvent.click(screen.getByRole('tab', { name: 'OBS / URL' }));
      fireEvent.click(screen.getByRole('button', { name: `Copy ${item.copyLabel}` }));
      fireEvent.click(screen.getByRole('button', { name: `เพิ่ม / อัปเดต ${item.label} ใน OBS` }));
      expect(item.copy).toHaveBeenCalledTimes(1);
      expect(item.add).toHaveBeenCalledTimes(1);
    }
  });
});
