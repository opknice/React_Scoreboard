import ModalCloseButton from './ModalCloseButton';
import BrowserSourceWorkspace, { type BrowserSourceKind } from './BrowserSourceWorkspace';
import BrowserSourcePreview from './BrowserSourcePreview';
import BrowserPositionEditor from './BrowserPositionEditor';
import { TEAM_NAME_POSITIONS, LOGO_POSITIONS, SCORE_POSITIONS, type BrowserPosition } from '../types/browserPositions';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useBrowserSourcePreviewState } from '../hooks/useBrowserSourcePreviewState';
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
import { SCOREBOARD_EVENT_CHANNEL } from '../types/scoreboardEvent';
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
const LogoBrowserCropModal = lazy(() => import('./LogoBrowserCropModal'));
import TeamColorBrowserSourcePanel from './TeamColorBrowserSourcePanel';
import ModalBackdrop from './ModalBackdrop';
import './QuickSetupModal.css';

interface QuickSetupModalProps {
  isOpen: boolean;
  browserSourceSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  browserSourceLeagueId?: string | null;
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
  browserSourceSaveStatus,
  browserSourceLeagueId,
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
  const [openPanel, setOpenPanel] = useState<BrowserSourceKind>('player');
  const [isCustomBrowserSourceOpen, setIsCustomBrowserSourceOpen] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const wasEditorOpen = useRef(false);
  useEffect(() => {
    if (wasEditorOpen.current && !isCustomBrowserSourceOpen) launcher.current?.focus();
    wasEditorOpen.current = isCustomBrowserSourceOpen;
    if (!isCustomBrowserSourceOpen) setCropModalTeam(null);
  }, [isCustomBrowserSourceOpen]);
  const [isFootballLeagueTableOpen, setIsFootballLeagueTableOpen] = useState(false);
  const { fontOptions, localFontMessage, loading: fontsLoading, refresh: loadLocalFonts } = useLocalFontOptions(
    isOpen && isCustomBrowserSourceOpen && (openPanel === 'team-name' || openPanel === 'score'),
  );
  const displayedFontOptions = useMemo(() => {
    const options = new Map(fontOptions.map(option => [option.value, option]));
    for (const family of [teamNameSettings.fontFamily, scoreSettings.fontFamily]) {
      if (family && !options.has(family)) options.set(family, { value: family, label: family });
    }
    return [...options.values()];
  }, [fontOptions, teamNameSettings.fontFamily, scoreSettings.fontFamily]);
  const [cropModalTeam, setCropModalTeam] = useState<Team | null>(null);
  const { match } = useBrowserSourcePreviewState();
  const matchState = match ?? { nameA: 'Team A', nameB: 'Team B' };

  const handleLogoSettingsUpdate = (patch: Partial<LogoBrowserSettings>) => {
    onLogoSettingsChange(patch);
    window.dispatchEvent(new Event('logoSettingsUpdated'));
    try {
      const bc = new BroadcastChannel(SCOREBOARD_EVENT_CHANNEL);
      bc.postMessage({
        type: 'LogoSettingsUpdated',
        leagueId: browserSourceLeagueId ?? null,
        settings: logoSettings,
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
      setOpenPanel('player');
      setIsCustomBrowserSourceOpen(false);
      setIsFootballLeagueTableOpen(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const moveCanvasObject = (id: string, position: BrowserPosition) => {
    if (openPanel === 'player' && (id === 'image' || id === 'jersey' || id === 'name')) {
      onPlayerBrowserSettingsChange({ ...playerBrowserSettings, [id]: { ...playerBrowserSettings[id], ...position } });
    } else if (openPanel === 'team-color' && (id === 'A1' || id === 'A2' || id === 'B1' || id === 'B2')) {
      onTeamColorSettingsChange({ positions: { [id]: position } });
    } else if (id === 'A' || id === 'B') {
      if (openPanel === 'team-name') onTeamNameSettingsChange({ positions: { ...teamNameSettings.positions, [id]: position } });
      if (openPanel === 'logo') handleLogoSettingsUpdate({ positions: { ...logoSettings.positions, [id]: position } });
      if (openPanel === 'score') onScoreSettingsChange({ positions: { ...scoreSettings.positions, [id]: position } });
    }
  };

  const obsOptions = {
    player: { connected: playerObsConnected, busy: playerObsBusy, message: playerObsMessage, add: onQuickAddPlayer, urls: [{ label: 'Player', url: playerBrowserUrl, copy: onCopyPlayerBrowserUrl }] },
    'team-name': { connected: teamNameObsConnected, busy: teamNameObsBusy, message: teamNameObsMessage, add: onQuickAddTeamNames, urls: (['A', 'B'] as const).map(side => ({ label: side, url: teamNameUrls[side], copy: () => onCopyTeamNameUrl(side) })) },
    'team-color': { connected: teamColorObsConnected, busy: teamColorObsBusy, message: teamColorObsMessage, add: onQuickAddTeamColor, urls: (['A', 'B'] as const).map(side => ({ label: side, url: teamColorUrls[side], copy: () => onCopyTeamColorUrl(side) })) },
    logo: { connected: logoObsConnected, busy: logoObsBusy, message: logoObsMessage, add: onQuickAddLogo, urls: (['A', 'B'] as const).map(side => ({ label: side, url: logoUrls[side], copy: () => onCopyLogoUrl(side) })) },
    score: { connected: teamNameObsConnected, busy: scoreObsBusy, message: scoreObsMessage, add: onQuickAddScore, urls: (['A', 'B', 'both'] as const).map(side => ({ label: side, url: scoreUrls[side], copy: () => onCopyScoreUrl(side) })) },
  };
  if (isCustomBrowserSourceOpen) return (
    <BrowserSourceWorkspace
      selected={openPanel} onSelect={setOpenPanel}
      onBack={() => setIsCustomBrowserSourceOpen(false)} onClose={onClose}
      obs={obsOptions[openPanel]}
      saveStatus={openPanel === 'player' || openPanel === 'logo' ? undefined : browserSourceSaveStatus}
      preview={<BrowserSourcePreview key={openPanel} kind={openPanel} player={playerBrowserSettings} teamName={teamNameSettings} teamColor={teamColorSettings} logo={logoSettings} score={scoreSettings} teams={teams} logoScale={logoBrowserScalePercent} onMove={moveCanvasObject} />}
    >
          <div className="quick-setup-panel quick-setup-panel--player" aria-label="ตั้งค่าการแสดงนักเตะ">
            {openPanel === 'player' ? <div id="player-browser-source-content" className="quick-setup-panel-content">
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

            </div> : null}
          </div>
        <div className="quick-setup-panel quick-setup-panel--team-name">
          {openPanel === 'team-name' ? <div className="quick-setup-panel-content">
          <BrowserPositionEditor showPreview={false} label="Team Name" positions={teamNameSettings.positions} defaults={TEAM_NAME_POSITIONS} onChange={positions => onTeamNameSettingsChange({ positions })} />
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


          </div>
          </div> : null}
        </div>

        <div className="quick-setup-panel quick-setup-panel--team-color">
          {openPanel === 'team-color' ? <div className="quick-setup-panel-content">
            <TeamColorBrowserSourcePanel settingsOnly
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
          {openPanel === 'logo' ? <div className="quick-setup-panel-content">
            <BrowserPositionEditor showPreview={false} label="Logo" positions={logoSettings.positions} defaults={LOGO_POSITIONS} onChange={positions => handleLogoSettingsUpdate({ positions })} />
            <p style={{ margin: '0 0 8px', color: '#cbd5e1', fontSize: '12px' }}>
              ขนาดลีก {logoBrowserScalePercent}% ({LOGO_FRAME_SIZE_PX}px → {scaleLogoPixels(LOGO_FRAME_SIZE_PX, logoBrowserScalePercent)}px) — ทีมที่ Crop แล้วจะใช้ขนาด Custom ของตัวเอง
            </p>

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
          {openPanel === 'score' ? <div className="quick-setup-panel-content">
          <BrowserPositionEditor showPreview={false} label="Score" positions={scoreSettings.positions} defaults={SCORE_POSITIONS} anchor="top" onChange={positions => onScoreSettingsChange({ positions })} />
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



          </div>
          </div> : null}
        </div>

    </BrowserSourceWorkspace>
  );


  return (
    <ModalBackdrop className="modal-overlay" onEscape={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <ModalCloseButton onClose={onClose} />
        <h3><i className="fas fa-sliders"></i> Quick Setup</h3>
        <div style={{ display: 'flex', marginBottom: '10px' }}>
          <button type="button" className="btn-primary" style={{ width: '100%', background: '#3b82f6', borderColor: '#3b82f6', fontWeight: 'bold' }} onClick={onOpenObsSetup}>
            <i className="fas fa-download"></i> 📦 ดาวน์โหลด OBS Scene Collection
          </button>
        </div>
        <button ref={launcher} type="button" className="browser-source-launcher" onClick={() => setIsCustomBrowserSourceOpen(true)}>
          <i className="fas fa-sliders" aria-hidden="true" />
          <span><strong>Custom Browser Source</strong><small>เปิดตัวแก้ไข Browser Source · ทั้ง 5 ประเภท</small></span>
          <i className="fas fa-arrow-right" aria-hidden="true" />
        </button>

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
