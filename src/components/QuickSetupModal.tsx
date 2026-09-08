import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useLocalFontOptions } from '../hooks/useLocalFontOptions';
import type { Team } from '../config/supabaseClient';
import {
  TEAM_NAME_MAX_FONT_SIZE,
  TEAM_NAME_MIN_FONT_SIZE,
  FONT_WEIGHT_OPTIONS,
  type TeamNameBrowserSettings,
} from '../types/teamNameBrowserSettings';
import {
  SCORE_MAX_FONT_SIZE,
  SCORE_MIN_FONT_SIZE,
  type ScoreBrowserSettings,
} from '../types/scoreBrowserSettings';
import type { LogoBrowserSettings } from '../types/logoBrowserSettings';
import { SCOREBOARD_EVENT_CHANNEL, SCOREBOARD_STATE_STORAGE_KEY } from '../types/scoreboardEvent';
import { getLogoSrc } from '../utils/logoResolver';
import { LOGO_FRAME_SIZE_PX, cropMetadataToJson, parseCropMetadata } from '../types/teamLogo';
import { getEffectiveLogoScalePercent, scaleLogoPixels } from '../types/leagueLogoSizing';
import type {
  TeamColorBrowserSettings,
  TeamColorBrowserSettingsPatch,
} from '../types/teamColorBrowserSettings';
import {
  DEFAULT_PLAYER_BROWSER_SETTINGS,
  PLAYER_BROWSER_CANVAS_HEIGHT,
  PLAYER_BROWSER_CANVAS_WIDTH,
  type PlayerBrowserElementSettings,
  type PlayerBrowserSettings,
} from '../types/playerBrowserSettings';
import LogoWithCrop from './LogoWithCrop';
const LogoBrowserCropModal = lazy(() => import('./LogoBrowserCropModal'));
import TeamColorBrowserSourcePanel from './TeamColorBrowserSourcePanel';
import ModalBackdrop from './ModalBackdrop';
import './QuickSetupModal.css';

interface QuickSetupModalProps {
  isOpen: boolean;
  teams: Team[];
  onUpdateTeam: (teamId: string, updates: Partial<Team>) => Promise<Team | null>;
  logoBrowserScalePercent?: number;
  tickerSpeed: number;
  closeLabel: string;
  onTickerSpeedChange: (speed: number) => void;
  teamNameSettings: TeamNameBrowserSettings;
  teamNameUrls: { A: string; B: string };
  teamNameObsBusy: boolean;
  teamNameObsConnected: boolean;
  teamNameObsMessage: string;
  onTeamNameSettingsChange: (patch: Partial<TeamNameBrowserSettings>) => void;
  onCopyTeamNameUrl: (side: 'A' | 'B') => void;
  scoreSettings: ScoreBrowserSettings;
  scoreUrls: { A: string; B: string; both: string };
  onScoreSettingsChange: (patch: Partial<ScoreBrowserSettings>) => void;
  onCopyScoreUrl: (side: 'A' | 'B' | 'both') => void;
  scoreObsBusy: boolean;
  scoreObsMessage: string;
  onQuickAddScore: () => void;
  teamColorSettings: TeamColorBrowserSettings;
  teamColorUrls: { A: string; B: string };
  onTeamColorSettingsChange: (patch: TeamColorBrowserSettingsPatch) => void;
  onCopyTeamColorUrl: (side: 'A' | 'B') => void;
  teamColorObsBusy: boolean;
  teamColorObsConnected: boolean;
  teamColorObsMessage: string;
  onQuickAddTeamColor: () => void;
  logoSettings: LogoBrowserSettings;
  onLogoSettingsChange: (patch: Partial<LogoBrowserSettings>) => void;
  logoUrls: { A: string; B: string };
  logoObsBusy: boolean;
  logoObsConnected: boolean;
  logoObsMessage: string;
  onCopyLogoUrl: (side: 'A' | 'B') => void;
  onQuickAddLogo: () => void;
  onQuickAddTeamNames: () => void;
  playerAutoHideEnabled: boolean;
  playerAutoHideSeconds: number;
  playerBrowserUrl: string;
  playerBrowserSettings: PlayerBrowserSettings;
  playerObsBusy: boolean;
  playerObsConnected: boolean;
  playerObsMessage: string;
  onPlayerAutoHideEnabledChange: (enabled: boolean) => void;
  onPlayerAutoHideSecondsChange: (seconds: number) => void;
  onCopyPlayerBrowserUrl: () => void;
  onPlayerBrowserSettingsChange: (settings: PlayerBrowserSettings) => void;
  onQuickAddPlayer: () => void;
  onOpenObsSetup: () => void;
  onCopyOverlay: (viewType: string, standaloneFile?: string) => void;
  onOpenLeagueManager?: () => void;
  onClose: () => void;
}

export default function QuickSetupModal({
  isOpen,
  teams,
  onUpdateTeam,
  logoBrowserScalePercent = 100,
  tickerSpeed,
  closeLabel,
  onTickerSpeedChange,
  teamNameSettings,
  teamNameUrls,
  teamNameObsBusy,
  teamNameObsConnected,
  teamNameObsMessage,
  onTeamNameSettingsChange,
  onCopyTeamNameUrl,
  scoreSettings,
  scoreUrls,
  onScoreSettingsChange,
  onCopyScoreUrl,
  scoreObsBusy,
  scoreObsMessage,
  onQuickAddScore,
  teamColorSettings,
  teamColorUrls,
  onTeamColorSettingsChange,
  onCopyTeamColorUrl,
  teamColorObsBusy,
  teamColorObsConnected,
  teamColorObsMessage,
  onQuickAddTeamColor,
  logoSettings,
  onLogoSettingsChange,
  logoUrls,
  logoObsBusy,
  logoObsConnected,
  logoObsMessage,
  onCopyLogoUrl,
  onQuickAddLogo,
  onQuickAddTeamNames,
  playerAutoHideEnabled,
  playerAutoHideSeconds,
  playerBrowserUrl,
  playerBrowserSettings,
  playerObsBusy,
  playerObsConnected,
  playerObsMessage,
  onPlayerAutoHideEnabledChange,
  onPlayerAutoHideSecondsChange,
  onCopyPlayerBrowserUrl,
  onPlayerBrowserSettingsChange,
  onQuickAddPlayer,
  onOpenObsSetup,
  onCopyOverlay,
  onOpenLeagueManager,
  onClose,
}: QuickSetupModalProps) {
  const [openPanel, setOpenPanel] = useState<'team-name' | 'team-color' | 'score' | 'logo' | null>(null);
  const [isCustomBrowserSourceOpen, setIsCustomBrowserSourceOpen] = useState(false);
  const [isPlayerBroadcastOpen, setIsPlayerBroadcastOpen] = useState(false);
  const [isFootballLeagueTableOpen, setIsFootballLeagueTableOpen] = useState(false);
  const { fontOptions, localFontMessage, loading: fontsLoading, refresh: loadLocalFonts } = useLocalFontOptions(
    isOpen && (openPanel === 'team-name' || openPanel === 'score'),
  );
  const displayedFontOptions = useMemo(() => {
    const options = new Map(fontOptions.map(option => [option.value, option]));
    for (const family of [teamNameSettings.fontFamily, scoreSettings.fontFamily]) {
      if (family && !options.has(family)) options.set(family, { value: family, label: family });
    }
    return [...options.values()];
  }, [fontOptions, teamNameSettings.fontFamily, scoreSettings.fontFamily]);
  const [logoPreviewSide, setLogoPreviewSide] = useState<'A' | 'B' | 'both'>('both');
  const [cropModalTeam, setCropModalTeam] = useState<Team | null>(null);
  const [matchState] = useState(() => {
    try {
      const saved = localStorage.getItem(SCOREBOARD_STATE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          nameA: parsed.nameA || 'Team A',
          nameB: parsed.nameB || 'Team B',
          logoA: parsed.logoA || '',
          logoB: parsed.logoB || '',
        };
      }
    } catch {}
    return { nameA: 'Team A', nameB: 'Team B', logoA: '', logoB: '' };
  });

  const handleLogoSettingsUpdate = (patch: Partial<LogoBrowserSettings>) => {
    onLogoSettingsChange(patch);
    window.dispatchEvent(new Event('logoSettingsUpdated'));
    try {
      const bc = new BroadcastChannel(SCOREBOARD_EVENT_CHANNEL);
      bc.postMessage({
        type: 'LogoSettingsUpdated',
        backgroundMode: patch.backgroundMode,
        timestamp: Date.now(),
      });
      bc.close();
    } catch {}
  };

  const getSupabaseTeam = (teamName: string): Team | undefined => {
    const normalizedName = teamName.trim().toLowerCase();
    return teams.find((team) => team.name.trim().toLowerCase() === normalizedName);
  };

  const updatePlayerElement = (
    element: keyof PlayerBrowserSettings,
    field: keyof PlayerBrowserElementSettings,
    value: number,
  ) => {
    onPlayerBrowserSettingsChange({
      ...playerBrowserSettings,
      [element]: {
        ...playerBrowserSettings[element],
        [field]: value,
      },
    });
  };

  useEffect(() => {
    if (!isOpen) {
      setOpenPanel(null);
      setIsCustomBrowserSourceOpen(false);
      setIsPlayerBroadcastOpen(false);
      setIsFootballLeagueTableOpen(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <ModalBackdrop className="modal-overlay" onEscape={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <h3><i className="fas fa-sliders"></i> Quick Setup</h3>
        <div style={{ display: 'flex', marginBottom: '10px' }}>
          <button type="button" className="btn-primary" style={{ width: '100%', background: '#3b82f6', borderColor: '#3b82f6', fontWeight: 'bold' }} onClick={onOpenObsSetup}>
            <i className="fas fa-download"></i> 📦 ดาวน์โหลด OBS Scene Collection
          </button>
        </div>
        <div className="quick-setup-panel quick-setup-panel--custom-browser-source">
          <button
            type="button"
            className="quick-setup-panel-toggle"
            aria-expanded={isCustomBrowserSourceOpen}
            aria-controls="custom-browser-source-content"
            onClick={() => setIsCustomBrowserSourceOpen((current) => !current)}
          >
            <span><i className="fas fa-code"></i> Custom Browser Source</span>
            <i className={`fas fa-chevron-${isCustomBrowserSourceOpen ? 'up' : 'down'}`} aria-hidden="true"></i>
          </button>
          {isCustomBrowserSourceOpen ? <div id="custom-browser-source-content" className="quick-setup-panel-content">

          <div className="quick-setup-panel quick-setup-panel--player" aria-label="ตั้งค่าการแสดงนักเตะ">
            <button
              type="button"
              className="quick-setup-panel-toggle"
              aria-expanded={isPlayerBroadcastOpen}
              aria-controls="player-browser-source-content"
              onClick={() => setIsPlayerBroadcastOpen((current) => !current)}
            >
              <span><i className="fas fa-user-shield" /> Player Browser Source</span>
              <i className={`fas fa-chevron-${isPlayerBroadcastOpen ? 'up' : 'down'}`} aria-hidden="true" />
            </button>

            {isPlayerBroadcastOpen ? <div id="player-browser-source-content" className="quick-setup-panel-content">
              <section className="scoreboard-player-control-group" aria-labelledby="player-auto-hide-title">
                <div className="scoreboard-player-section-heading scoreboard-player-auto-hide-heading" id="player-auto-hide-title">
                  <span><strong><i className="fas fa-clock" /> ซ่อนอัตโนมัติ</strong><span>กำหนดเวลาซ่อนนักเตะหลังจากแสดงผล</span></span>
                  <label className="scoreboard-player-switch">
                    <input
                      type="checkbox"
                      checked={playerAutoHideEnabled}
                      onChange={(event) => onPlayerAutoHideEnabledChange(event.target.checked)}
                      aria-label="เปิดใช้การซ่อนนักเตะอัตโนมัติ"
                    />
                    <span aria-hidden="true" />
                  </label>
                </div>
                <div className="scoreboard-player-auto-hide-fields">
                  <label htmlFor="player-auto-hide-seconds">ระยะเวลา</label>
                  <div className="scoreboard-player-duration-input">
                    <input
                      id="player-auto-hide-seconds"
                      type="number"
                      min={1}
                      step={1}
                      value={playerAutoHideSeconds}
                      onChange={(event) => {
                        const next = Number.parseInt(event.target.value, 10);
                        if (Number.isFinite(next) && next > 0) onPlayerAutoHideSecondsChange(next);
                      }}
                      disabled={!playerAutoHideEnabled}
                      aria-label="จำนวนวินาทีซ่อนอัตโนมัติ"
                    />
                    <span>วินาที</span>
                  </div>
                </div>
              </section>

              <section className="quick-player-canvas-editor" aria-labelledby="player-canvas-title">
                <div className="quick-player-canvas-heading">
                  <div>
                    <strong id="player-canvas-title"><i className="fas fa-up-down-left-right" /> ตำแหน่งบน Canvas</strong>
                    <span>Canvas {PLAYER_BROWSER_CANVAS_WIDTH} × {PLAYER_BROWSER_CANVAS_HEIGHT}px · ใช้ร่วมกันทุกนักเตะ</span>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => onPlayerBrowserSettingsChange(DEFAULT_PLAYER_BROWSER_SETTINGS)}
                  >
                    <i className="fas fa-rotate-left" /> รีเซ็ตค่าเริ่มต้น
                  </button>
                </div>

                <div className="quick-player-canvas-fields">
                  {([
                    ['image', 'รูปนักเตะ', 720],
                    ['jersey', 'หมายเลขเสื้อ', 240],
                    ['name', 'ชื่อ', 180],
                  ] as const).map(([element, label, maxSize]) => (
                    <div key={element} className="quick-player-canvas-field-row">
                      <strong>{label}</strong>
                      <label>X<input type="number" min={0} max={PLAYER_BROWSER_CANVAS_WIDTH} value={playerBrowserSettings[element].x} onChange={(event) => updatePlayerElement(element, 'x', Number(event.target.value))} /></label>
                      <label>Y<input type="number" min={0} max={PLAYER_BROWSER_CANVAS_HEIGHT} value={playerBrowserSettings[element].y} onChange={(event) => updatePlayerElement(element, 'y', Number(event.target.value))} /></label>
                      <label>{element === 'name' || element === 'jersey' ? 'ขนาดตัวอักษร' : 'ขนาด'}<input type="number" min={8} max={maxSize} value={playerBrowserSettings[element].size} onChange={(event) => updatePlayerElement(element, 'size', Number(event.target.value))} /></label>
                    </div>
                  ))}
                </div>
              </section>

              <section className="scoreboard-player-control-group scoreboard-player-obs-group" aria-labelledby="player-obs-title">
                <div className="scoreboard-player-section-heading" id="player-obs-title">
                  <span><strong><i className="fas fa-plug" /> เชื่อมต่อ OBS Browser Source</strong><span>เพิ่มหรืออัปเดต Player Browser Source ในฉากหลักของ OBS</span></span>
                </div>
                <button type="button" className="btn-success" disabled={playerObsBusy || !playerObsConnected} onClick={onQuickAddPlayer}>
                  <i className="fas fa-plug" /> Quick Add to OBS
                </button>
                <div className="scoreboard-player-obs-status" role="status">
                  <span className={playerObsConnected ? 'is-connected' : 'is-disconnected'}>
                    OBS WebSocket: {playerObsConnected ? 'Connected' : 'ยังไม่เชื่อมต่อ'}
                  </span>
                  {playerObsMessage ? <span> — {playerObsMessage}</span> : null}
                </div>
                <details className="scoreboard-player-url-details">
                  <summary>URL สำหรับ Browser Source</summary>
                  <div className="scoreboard-player-url-list">
                    <div className="scoreboard-player-url-row">
                      <span>{playerBrowserUrl}</span>
                      <button type="button" className="btn-secondary" onClick={onCopyPlayerBrowserUrl}>Copy</button>
                    </div>
                  </div>
                </details>
              </section>
            </div> : null}
          </div>
        <div className="quick-setup-panel quick-setup-panel--team-name">
          <button
            type="button"
            className="quick-setup-panel-toggle"
            aria-expanded={openPanel === 'team-name'}
            onClick={() => setOpenPanel((current) => current === 'team-name' ? null : 'team-name')}
          >
            <span><i className="fas fa-font"></i> Team Name Browser Source</span>
            <i className={`fas fa-chevron-${openPanel === 'team-name' ? 'up' : 'down'}`} aria-hidden="true"></i>
          </button>
          {openPanel === 'team-name' ? <div className="quick-setup-panel-content">
          <div style={{ display: 'grid', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: '#cbd5e1' }}>
              Font
              <select
                style={{ width: '100%', marginTop: '4px' }}
                value={teamNameSettings.fontFamily}
                onChange={(event) => onTeamNameSettingsChange({ fontFamily: event.target.value as TeamNameBrowserSettings['fontFamily'] })}
              >
                {displayedFontOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <div className="quick-setup-local-font-row">
                <span>{localFontMessage}</span>
                <button type="button" className="btn-secondary" disabled={fontsLoading} onClick={loadLocalFonts}>โหลดใหม่</button>
              </div>
            </label>

            {(['A', 'B'] as const).map((side) => {
              const modeKey = side === 'A' ? 'fontModeA' : 'fontModeB';
              const sizeKey = side === 'A' ? 'fontSizeA' : 'fontSizeB';
              const weightKey = side === 'A' ? 'fontWeightA' : 'fontWeightB';
              const colorKey = side === 'A' ? 'textColorA' : 'textColorB';
              const mode = teamNameSettings[modeKey];
              return (
                <div key={side} className="quick-setup-team-name-settings-row">
                  <label className="quick-setup-team-name-field" style={{ fontSize: '12px', color: '#cbd5e1' }}>
                    Team {side}
                    <select
                      style={{ width: '100%', marginTop: '4px' }}
                      value={mode}
                      onChange={(event) => onTeamNameSettingsChange({ [modeKey]: event.target.value } as Partial<TeamNameBrowserSettings>)}
                    >
                      <option value="auto">Auto ตามความยาวชื่อ</option>
                      <option value="manual">กำหนดเอง</option>
                    </select>
                  </label>
                  <label className="quick-setup-team-name-field" style={{ fontSize: '12px', color: '#cbd5e1' }}>
                    ขนาด px
                    <input
                      type="number"
                      min={TEAM_NAME_MIN_FONT_SIZE}
                      max={TEAM_NAME_MAX_FONT_SIZE}
                      disabled={mode !== 'manual'}
                      style={{ width: '100%', marginTop: '4px' }}
                      value={teamNameSettings[sizeKey]}
                      onChange={(event) => onTeamNameSettingsChange({ [sizeKey]: Number(event.target.value) } as Partial<TeamNameBrowserSettings>)}
                    />
                  </label>
                  <label className="quick-setup-team-name-field" style={{ fontSize: '12px', color: '#cbd5e1' }}>
                    น้ำหนัก Font
                    <select
                      style={{ width: '100%', marginTop: '4px' }}
                      value={teamNameSettings[weightKey]}
                      onChange={(event) => onTeamNameSettingsChange({ [weightKey]: Number(event.target.value) } as Partial<TeamNameBrowserSettings>)}
                    >
                      {FONT_WEIGHT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="quick-setup-team-name-field" style={{ fontSize: '12px', color: '#cbd5e1' }}>
                    สีข้อความ
                    <input
                      className="quick-setup-team-name-color-input"
                      type="color"
                      value={teamNameSettings[colorKey]}
                      aria-label={`สีข้อความ Team ${side}`}
                      onChange={(event) => onTeamNameSettingsChange({ [colorKey]: event.target.value } as Partial<TeamNameBrowserSettings>)}
                      style={{ marginTop: '4px' }}
                    />
                  </label>
                </div>
              );
            })}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
              <div style={{ padding: '8px', background: '#111827', borderRadius: '6px', textAlign: 'center', fontFamily: teamNameSettings.fontFamily, color: teamNameSettings.textColorA }}>
                <small style={{ display: 'block', color: '#94a3b8' }}>Preview A</small>
                <span style={{ fontSize: teamNameSettings.fontModeA === 'manual' ? `${teamNameSettings.fontSizeA}px` : 'clamp(1.5rem, 2vw, 2.5rem)', fontWeight: teamNameSettings.fontWeightA }}>Team A</span>
              </div>
              <div style={{ padding: '8px', background: '#111827', borderRadius: '6px', textAlign: 'center', fontFamily: teamNameSettings.fontFamily, color: teamNameSettings.textColorB }}>
                <small style={{ display: 'block', color: '#94a3b8' }}>Preview B</small>
                <span style={{ fontSize: teamNameSettings.fontModeB === 'manual' ? `${teamNameSettings.fontSizeB}px` : 'clamp(1.5rem, 2vw, 2.5rem)', fontWeight: teamNameSettings.fontWeightB }}>Team B</span>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '6px', marginTop: '4px' }}>
              <button className="btn-success" disabled={teamNameObsBusy || !teamNameObsConnected} onClick={onQuickAddTeamNames}>
                <i className="fas fa-plug"></i> Quick Add to OBS
              </button>
            </div>
            <div style={{ fontSize: '11px', color: teamNameObsConnected ? '#86efac' : '#fca5a5', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span>{teamNameObsConnected ? 'OBS WebSocket: Connected' : 'OBS WebSocket: ยังไม่เชื่อมต่อ'}</span>
              {teamNameObsConnected && (
                <span style={{ backgroundColor: '#065f46', color: '#6ee7b7', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, fontSize: '10px' }}>
                  ⚡ Auto Sync OBS: Active
                </span>
              )}
              {teamNameObsMessage ? ` — ${teamNameObsMessage}` : ''}
            </div>
            <details style={{ fontSize: '11px', color: '#94a3b8' }}>
              <summary>URL สำหรับ Browser Source แยกทีม</summary>
              <div style={{ display: 'grid', gap: '6px', marginTop: '6px' }}>
                {(['A', 'B'] as const).map((side) => (
                  <div key={side} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px', alignItems: 'center' }}>
                    <span style={{ overflowWrap: 'anywhere' }}>{side}: {teamNameUrls[side]}</span>
                    <button className="btn-secondary" style={{ padding: '4px 7px', fontSize: '11px' }} onClick={() => onCopyTeamNameUrl(side)}>Copy</button>
                  </div>
                ))}
              </div>
            </details>
          </div>
          </div> : null}
        </div>

        <div className="quick-setup-panel quick-setup-panel--team-color">
          <button
            type="button"
            className="quick-setup-panel-toggle"
            aria-expanded={openPanel === 'team-color'}
            onClick={() => setOpenPanel((current) => current === 'team-color' ? null : 'team-color')}
          >
            <span><i className="fas fa-palette"></i> Team Color Browser Source</span>
            <i className={`fas fa-chevron-${openPanel === 'team-color' ? 'up' : 'down'}`} aria-hidden="true"></i>
          </button>
          {openPanel === 'team-color' ? <div className="quick-setup-panel-content">
            <TeamColorBrowserSourcePanel
              settings={teamColorSettings}
              urls={teamColorUrls}
              onSettingsChange={onTeamColorSettingsChange}
              onCopyUrl={onCopyTeamColorUrl}
              obsBusy={teamColorObsBusy}
              obsConnected={teamColorObsConnected}
              obsMessage={teamColorObsMessage}
              onQuickAdd={onQuickAddTeamColor}
            />
          </div> : null}
        </div>

        <div className="quick-setup-panel quick-setup-panel--logo">
          <button
            type="button"
            className="quick-setup-panel-toggle"
            aria-expanded={openPanel === 'logo'}
            onClick={() => setOpenPanel((current) => current === 'logo' ? null : 'logo')}
          >
            <span><i className="fas fa-shield-halved"></i> Logo Browser Source</span>
            <i className={`fas fa-chevron-${openPanel === 'logo' ? 'up' : 'down'}`} aria-hidden="true"></i>
          </button>
          {openPanel === 'logo' ? <div className="quick-setup-panel-content">
            <p style={{ margin: '0 0 8px', color: '#cbd5e1', fontSize: '12px' }}>
              ขนาดลีก {logoBrowserScalePercent}% ({LOGO_FRAME_SIZE_PX}px → {scaleLogoPixels(LOGO_FRAME_SIZE_PX, logoBrowserScalePercent)}px) — ทีมที่ Crop แล้วจะใช้ขนาด Custom ของตัวเอง
            </p>

            {/* Live Preview Box */}
            <div style={{
              backgroundColor: '#090d16',
              border: '1px solid #1e293b',
              borderRadius: '10px',
              padding: '12px',
              marginBottom: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fas fa-eye"></i> Live Preview Canvas (Logo Browser Source)
                </span>
                <div style={{ display: 'flex', gap: '4px', backgroundColor: '#1e293b', padding: '2px', borderRadius: '6px' }}>
                  {(['both', 'A', 'B'] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      style={{
                        padding: '3px 8px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: logoPreviewSide === side ? '#0284c7' : 'transparent',
                        color: logoPreviewSide === side ? '#ffffff' : '#94a3b8',
                      }}
                      onClick={() => setLogoPreviewSide(side)}
                    >
                      {side === 'both' ? 'Both Sides' : `Side ${side}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Simulated OBS Canvas Frame */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '150px',
                  borderRadius: '8px',
                  backgroundColor: '#040711',
                  backgroundImage: logoSettings.backgroundMode === 'normal'
                    ? 'none'
                    : 'linear-gradient(45deg, #0f172a 25%, transparent 25%), linear-gradient(-45deg, #0f172a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0f172a 75%), linear-gradient(-45deg, transparent 75%, #0f172a 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                  border: '1px solid #334155',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ position: 'relative', width: '100%', height: '100%', pointerEvents: 'none' }}>
                  {(logoPreviewSide === 'both' || logoPreviewSide === 'A') && (() => {
                    const teamName = matchState.nameA;
                    const logoSrc = getLogoSrc(matchState.logoA, teamName);
                    const cropData = parseCropMetadata(getSupabaseTeam(teamName)?.logo_browser_crop_metadata);
                    const effectiveScale = getEffectiveLogoScalePercent(cropData, logoBrowserScalePercent);
                    const previewDisplaySize = scaleLogoPixels(55, effectiveScale);

                    return (
                      <div
                        style={{
                          position: 'absolute',
                          left: '10%',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: `${previewDisplaySize}px`,
                          height: `${previewDisplaySize}px`,
                          backgroundColor: logoSettings.backgroundMode === 'normal' ? 'rgba(0,0,0,0.8)' : 'transparent',
                          borderRadius: logoSettings.backgroundMode === 'normal' ? '8px' : '0',
                          padding: logoSettings.backgroundMode === 'normal' ? '6px' : '0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxSizing: 'border-box',
                          border: '1px dashed #0284c7',
                        }}
                      >
                        {cropData ? (
                          <LogoWithCrop url={logoSrc} crop={cropData} alt={teamName} />
                        ) : (
                          <img src={logoSrc} alt={teamName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        )}
                        <span style={{ position: 'absolute', bottom: '-16px', fontSize: '9px', color: '#38bdf8', whiteSpace: 'nowrap' }}>
                          A: {teamName} ({effectiveScale}% · {scaleLogoPixels(LOGO_FRAME_SIZE_PX, effectiveScale)}px)
                        </span>
                      </div>
                    );
                  })()}

                  {(logoPreviewSide === 'both' || logoPreviewSide === 'B') && (() => {
                    const teamName = matchState.nameB;
                    const logoSrc = getLogoSrc(matchState.logoB, teamName);
                    const cropData = parseCropMetadata(getSupabaseTeam(teamName)?.logo_browser_crop_metadata);
                    const effectiveScale = getEffectiveLogoScalePercent(cropData, logoBrowserScalePercent);
                    const previewDisplaySize = scaleLogoPixels(55, effectiveScale);

                    return (
                      <div
                        style={{
                          position: 'absolute',
                          right: '10%',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: `${previewDisplaySize}px`,
                          height: `${previewDisplaySize}px`,
                          backgroundColor: logoSettings.backgroundMode === 'normal' ? 'rgba(0,0,0,0.8)' : 'transparent',
                          borderRadius: logoSettings.backgroundMode === 'normal' ? '8px' : '0',
                          padding: logoSettings.backgroundMode === 'normal' ? '6px' : '0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxSizing: 'border-box',
                          border: '1px dashed #f43f5e',
                        }}
                      >
                        {cropData ? (
                          <LogoWithCrop url={logoSrc} crop={cropData} alt={teamName} />
                        ) : (
                          <img src={logoSrc} alt={teamName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        )}
                        <span style={{ position: 'absolute', bottom: '-16px', fontSize: '9px', color: '#fb7185', whiteSpace: 'nowrap' }}>
                          B: {teamName} ({effectiveScale}% · {scaleLogoPixels(LOGO_FRAME_SIZE_PX, effectiveScale)}px)
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Effective frame summaries and per-team Crop buttons */}
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {(['A', 'B'] as const).map((side) => {
                  const teamName = side === 'A' ? matchState.nameA : matchState.nameB;
                  const supabaseTeam = getSupabaseTeam(teamName);
                  const cropData = parseCropMetadata(supabaseTeam?.logo_browser_crop_metadata);
                  const effectiveScale = getEffectiveLogoScalePercent(cropData, logoBrowserScalePercent);

                  return (
                    <div key={side} style={{ backgroundColor: '#0f172a', padding: '8px 10px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: side === 'A' ? '#38bdf8' : '#fb7185' }}>
                          Logo {side} · {cropData ? 'Custom' : 'League'} {effectiveScale}%
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ width: '100%', minHeight: '36px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                        onClick={() => supabaseTeam && setCropModalTeam(supabaseTeam)}
                        disabled={!supabaseTeam?.logo_url}
                        title={supabaseTeam?.logo_url ? 'ตั้งค่า Crop โลโก้สำหรับ Logo Browser Source ใน Supabase' : 'เลือกทีมจากลีก Supabase ที่มีโลโก้ก่อน'}
                      >
                        ✂️ ปรับรูปด้วย Crop
                      </button>
                    </div>
                  );
                })}
              </div>

              <label style={{ fontSize: '12px', color: '#cbd5e1' }}>
                โหมดพื้นหลัง (Background Mode)
                <select
                  style={{ width: '100%', marginTop: '4px' }}
                  value={logoSettings.backgroundMode}
                  onChange={(event) => handleLogoSettingsUpdate({ backgroundMode: event.target.value as LogoBrowserSettings['backgroundMode'] })}
                >
                  <option value="transparent">โปร่งใส (Transparent)</option>
                  <option value="normal">ปกติ / กล่องดำ (Normal)</option>
                </select>
              </label>

              <div style={{ display: 'grid', gap: '6px', marginTop: '4px' }}>
                {(['A', 'B'] as const).map((side) => (
                  <div key={side} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px', alignItems: 'center' }}>
                    <span style={{ overflowWrap: 'anywhere', fontSize: '11px', color: '#94a3b8' }}>{side}: {logoUrls[side]}</span>
                    <button className="btn-secondary" style={{ padding: '4px 7px', fontSize: '11px' }} onClick={() => onCopyLogoUrl(side)}>Copy</button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gap: '6px', marginTop: '6px' }}>
                <button className="btn-success" disabled={logoObsBusy || !logoObsConnected} onClick={onQuickAddLogo}>
                  <i className="fas fa-plug"></i> Quick Add Logo A/B to OBS
                </button>
              </div>
              <div style={{ marginTop: '4px', fontSize: '11px', color: logoObsConnected ? '#86efac' : '#fca5a5', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span>{logoObsConnected ? 'OBS WebSocket: Connected' : 'OBS WebSocket: ยังไม่เชื่อมต่อ'}</span>
                {logoObsConnected && (
                  <span style={{ backgroundColor: '#065f46', color: '#6ee7b7', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, fontSize: '10px' }}>
                    ⚡ Auto Sync OBS: Active
                  </span>
                )}
                {logoObsMessage ? ` — ${logoObsMessage}` : ''}
              </div>
            </div>

            {/* Logo Browser Crop Modal */}
            {cropModalTeam && (
              <Suspense fallback={<div role="status">กำลังโหลดเครื่องมือตัดภาพ...</div>}>
                <LogoBrowserCropModal
                  isOpen
                  onClose={() => setCropModalTeam(null)}
                  team={cropModalTeam}
                  cropMetadata={cropModalTeam.logo_browser_crop_metadata}
                  cropContext="logo-browser"
                  initialFrameScalePercent={
                    parseCropMetadata(cropModalTeam.logo_browser_crop_metadata)?.frameScalePercent
                    ?? logoBrowserScalePercent
                  }
                  onSave={async (crop) => {
                    await onUpdateTeam(cropModalTeam.id, {
                      logo_browser_crop_metadata: cropMetadataToJson(crop),
                    });
                  }}
                  onReset={async () => {
                    await onUpdateTeam(cropModalTeam.id, {
                      logo_browser_crop_metadata: null,
                    });
                  }}
                />
              </Suspense>
            )}
          </div> : null}
        </div>

        <div className="quick-setup-panel quick-setup-panel--score">
          <button
            type="button"
            className="quick-setup-panel-toggle"
            aria-expanded={openPanel === 'score'}
            onClick={() => setOpenPanel((current) => current === 'score' ? null : 'score')}
          >
            <span><i className="fas fa-hashtag"></i> Score Browser Source</span>
            <i className={`fas fa-chevron-${openPanel === 'score' ? 'up' : 'down'}`} aria-hidden="true"></i>
          </button>
          {openPanel === 'score' ? <div className="quick-setup-panel-content">
          <div style={{ display: 'grid', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: '#cbd5e1' }}>
              Font ของ Score
              <select
                style={{ width: '100%', marginTop: '4px' }}
                value={scoreSettings.fontFamily}
                onChange={(event) => onScoreSettingsChange({ fontFamily: event.target.value as ScoreBrowserSettings['fontFamily'] })}
              >
                {displayedFontOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <div className="quick-setup-local-font-row">
                <span>{localFontMessage}</span>
                <button type="button" className="btn-secondary" disabled={fontsLoading} onClick={loadLocalFonts}>โหลดใหม่</button>
              </div>
            </label>

            {(['A', 'B'] as const).map((side) => {
              const modeKey = side === 'A' ? 'fontModeA' : 'fontModeB';
              const sizeKey = side === 'A' ? 'fontSizeA' : 'fontSizeB';
              const weightKey = side === 'A' ? 'fontWeightA' : 'fontWeightB';
              const mode = scoreSettings[modeKey];
              return (
                <div key={side} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                  <label style={{ fontSize: '12px', color: '#cbd5e1' }}>
                    Score {side} ขนาดตัวอักษร
                    <select
                      style={{ width: '100%', marginTop: '4px' }}
                      value={mode}
                      onChange={(event) => onScoreSettingsChange({ [modeKey]: event.target.value } as Partial<ScoreBrowserSettings>)}
                    >
                      <option value="auto">Auto ตามจำนวนหลัก</option>
                      <option value="manual">กำหนดเอง</option>
                    </select>
                  </label>
                  <label style={{ fontSize: '12px', color: '#cbd5e1' }}>
                    ขนาด px
                    <input
                      type="number"
                      min={SCORE_MIN_FONT_SIZE}
                      max={SCORE_MAX_FONT_SIZE}
                      disabled={mode !== 'manual'}
                      style={{ width: '100%', marginTop: '4px' }}
                      value={scoreSettings[sizeKey]}
                      onChange={(event) => onScoreSettingsChange({ [sizeKey]: Number(event.target.value) } as Partial<ScoreBrowserSettings>)}
                    />
                  </label>
                  <label style={{ fontSize: '12px', color: '#cbd5e1' }}>
                    น้ำหนัก Font
                    <select
                      style={{ width: '100%', marginTop: '4px' }}
                      value={scoreSettings[weightKey]}
                      onChange={(event) => onScoreSettingsChange({ [weightKey]: Number(event.target.value) } as Partial<ScoreBrowserSettings>)}
                    >
                      {FONT_WEIGHT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
              );
            })}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ padding: '8px', background: '#111827', borderRadius: '6px', textAlign: 'center', fontFamily: scoreSettings.fontFamily }}>
                <small style={{ display: 'block', color: '#94a3b8' }}>Score A</small>
                <span style={{ fontSize: scoreSettings.fontModeA === 'manual' ? `${scoreSettings.fontSizeA}px` : 'clamp(2.4rem, 3vw, 4rem)', fontWeight: scoreSettings.fontWeightA }}>0</span>
              </div>
              <div style={{ padding: '8px', background: '#111827', borderRadius: '6px', textAlign: 'center', fontFamily: scoreSettings.fontFamily }}>
                <small style={{ display: 'block', color: '#94a3b8' }}>Score B</small>
                <span style={{ fontSize: scoreSettings.fontModeB === 'manual' ? `${scoreSettings.fontSizeB}px` : 'clamp(2.4rem, 3vw, 4rem)', fontWeight: scoreSettings.fontWeightB }}>0</span>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '6px' }}>
              <button className="btn-success" disabled={scoreObsBusy || !teamNameObsConnected} onClick={onQuickAddScore}>
                <i className="fas fa-plug"></i> Quick Add Score A/B to OBS
              </button>
            </div>
            <div style={{ fontSize: '11px', color: teamNameObsConnected ? '#86efac' : '#fca5a5', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span>{teamNameObsConnected ? 'OBS WebSocket: Connected' : 'OBS WebSocket: ยังไม่เชื่อมต่อ'}</span>
              {teamNameObsConnected && (
                <span style={{ backgroundColor: '#065f46', color: '#6ee7b7', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, fontSize: '10px' }}>
                  ⚡ Auto Sync OBS: Active
                </span>
              )}
              {scoreObsMessage ? ` — ${scoreObsMessage}` : ''}
            </div>
            <details style={{ fontSize: '11px', color: '#94a3b8' }}>
              <summary>URL สำหรับ Score</summary>
              <div style={{ display: 'grid', gap: '6px', marginTop: '6px' }}>
                {(['A', 'B', 'both'] as const).map((side) => (
                  <div key={side} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px', alignItems: 'center' }}>
                    <span style={{ overflowWrap: 'anywhere' }}>{side}: {scoreUrls[side]}</span>
                    <button className="btn-secondary" style={{ padding: '4px 7px', fontSize: '11px' }} onClick={() => onCopyScoreUrl(side)}>Copy</button>
                  </div>
                ))}
              </div>
            </details>
          </div>
          </div> : null}
        </div>
        </div> : null}
        </div>

        <div className="quick-setup-panel quick-setup-panel--football-league-table">
          <button
            type="button"
            className="quick-setup-panel-toggle"
            aria-expanded={isFootballLeagueTableOpen}
            aria-controls="football-league-table-content"
            onClick={() => setIsFootballLeagueTableOpen((current) => !current)}
          >
            <span><i className="fas fa-trophy"></i> Football League Table</span>
            <i className={`fas fa-chevron-${isFootballLeagueTableOpen ? 'up' : 'down'}`} aria-hidden="true"></i>
          </button>
          {isFootballLeagueTableOpen ? <div id="football-league-table-content" className="quick-setup-panel-content">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="btn-primary" onClick={() => onCopyOverlay('table')}><i className="fas fa-table"></i> Copy League Table URL</button>
          <button className="btn-success" onClick={() => onCopyOverlay('results')}><i className="fas fa-list"></i> Copy Match Results URL</button>
          <button className="btn-primary" style={{ background: '#0ea5e9', borderColor: '#0ea5e9', fontWeight: 'bold' }} onClick={() => onCopyOverlay('combined', 'all-score-combined')}><i className="fas fa-trophy"></i> Copy Combined All Score & Table URL</button>
          <div style={{ padding: '10px 12px', backgroundColor: '#262626', borderRadius: '6px', border: '1px solid #ffb74d' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#ffb74d', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}><i className="fas fa-gauge-high"></i> ตั้งค่าความเร็วการวิ่งของตัวหนังสือ (Live Ticker):</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              <select style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', backgroundColor: '#1e1e1e', color: '#fff', border: '1px solid #555', fontSize: '13px' }} value={tickerSpeed} onChange={(event) => onTickerSpeedChange(parseInt(event.target.value, 10) || 75)}>
                <option value={150}>🐢 ช้ามากพิเศษ (Ultra Slow - 150s)</option><option value={120}>🐢 ช้ามาก (Very Slow - 120s)</option><option value={90}>🚶 ช้า / อ่านง่าย (Slow - 90s)</option><option value={75}>✨ ปานกลาง (Normal - 75s) [แนะนำ]</option><option value={50}>🏃 ค่อนข้างเร็ว (Medium - 50s)</option><option value={35}>⚡ เร็ว (Fast - 35s)</option>
              </select>
              <span style={{ fontSize: '12px', color: '#aaa', whiteSpace: 'nowrap' }}>{tickerSpeed} วินาที/รอบ</span>
            </div>
            <button className="btn-warning" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onCopyOverlay('ticker')}><i className="fas fa-tv"></i> Copy Live Ticker URL (ความเร็ว {tickerSpeed}s)</button>
          </div>
          {onOpenLeagueManager && (
            <button className="btn-primary" style={{ background: '#0284c7', borderColor: '#0284c7', fontWeight: 'bold' }} onClick={onOpenLeagueManager}>
              <i className="fas fa-trophy"></i> 🏆 จัดการฐานข้อมูลลีก & ตารางแข่ง (Supabase)
            </button>
          )}
        </div>
          </div> : null}
        </div>
        <div style={{ marginTop: '16px', textAlign: 'right' }}><button className="btn-secondary" onClick={onClose}>{closeLabel}</button></div>
      </div>
    </ModalBackdrop>
  );
}
