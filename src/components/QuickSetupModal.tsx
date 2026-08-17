import { useCallback, useEffect, useState } from 'react';
import type { FirebaseSaveTarget } from '../utils/excelParser';
import {
  TEAM_NAME_FONT_OPTIONS,
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
import {
  LOGO_MAX_SIZE,
  LOGO_MIN_SIZE,
  type LogoBrowserSettings,
} from '../types/logoBrowserSettings';
import { SCOREBOARD_EVENT_CHANNEL, SCOREBOARD_STATE_STORAGE_KEY } from '../types/scoreboardEvent';
import { getLogoSrc, normalizeTeamKey } from '../utils/logoResolver';
import { getCropMetadataFromLocalStorage } from '../utils/logoCropMetadata';
import LogoWithCrop from './LogoWithCrop';
import LogoBrowserCropModal from './LogoBrowserCropModal';
import './QuickSetupModal.css';

interface LocalFontData {
  family: string;
  fullName?: string;
  style?: string;
}

interface FontAccessWindow extends Window {
  queryLocalFonts?: () => Promise<LocalFontData[]>;
}

interface FontOption {
  value: string;
  label: string;
}

interface QuickSetupModalProps {
  isOpen: boolean;
  targets: FirebaseSaveTarget[];
  selectedTargetId: string;
  tickerSpeed: number;
  closeLabel: string;
  onTargetChange: (targetId: string) => void;
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
  logoSettings: LogoBrowserSettings;
  onLogoSettingsChange: (patch: Partial<LogoBrowserSettings>) => void;
  logoUrls: { A: string; B: string };
  logoObsBusy: boolean;
  logoObsConnected: boolean;
  logoObsMessage: string;
  onCopyLogoUrl: (side: 'A' | 'B') => void;
  onQuickAddLogo: () => void;
  onQuickAddTeamNames: () => void;
  onOpenObsSetup: () => void;
  onCopyOverlay: (viewType: string, standaloneFile?: string) => void;
  onOpenDatabase: () => void;
  onClose: () => void;
}

export default function QuickSetupModal({
  isOpen,
  targets,
  selectedTargetId,
  tickerSpeed,
  closeLabel,
  onTargetChange,
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
  logoSettings,
  onLogoSettingsChange,
  logoUrls,
  logoObsBusy,
  logoObsConnected,
  logoObsMessage,
  onCopyLogoUrl,
  onQuickAddLogo,
  onQuickAddTeamNames,
  onOpenObsSetup,
  onCopyOverlay,
  onOpenDatabase,
  onClose,
}: QuickSetupModalProps) {
  const [openPanel, setOpenPanel] = useState<'team-name' | 'score' | 'logo' | null>(null);
  const [fontOptions, setFontOptions] = useState<FontOption[]>(TEAM_NAME_FONT_OPTIONS);
  const [localFontMessage, setLocalFontMessage] = useState('กำลังโหลด Font ในเครื่อง...');
  const [logoPreviewSide, setLogoPreviewSide] = useState<'A' | 'B' | 'both'>('both');
  const [cropModalTarget, setCropModalTarget] = useState<{ teamSide: 'A' | 'B'; teamName: string; logoUrl: string } | null>(null);
  const [matchState, setMatchState] = useState(() => {
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
        sizeA: patch.sizeA,
        sizeB: patch.sizeB,
        backgroundMode: patch.backgroundMode,
        timestamp: Date.now(),
      });
      bc.close();
    } catch {}
  };

  useEffect(() => {
    const handleCropUpdate = () => {
      setMatchState((current) => ({ ...current }));
    };
    window.addEventListener('logoCropUpdated', handleCropUpdate);
    return () => window.removeEventListener('logoCropUpdated', handleCropUpdate);
  }, []);

  const loadLocalFonts = useCallback(async () => {
    const queryLocalFonts = typeof window === 'undefined'
      ? undefined
      : (window as FontAccessWindow).queryLocalFonts;

    if (!queryLocalFonts) {
      setLocalFontMessage('Browser นี้ไม่รองรับการอ่านรายชื่อ Font ในเครื่อง ใช้รายการสำรอง');
      return;
    }

    try {
      const fonts = await queryLocalFonts();
      const options = new Map<string, FontOption>(
        TEAM_NAME_FONT_OPTIONS.map((option) => [option.value, option]),
      );
      fonts.forEach((font) => {
        const family = font.family.trim();
        if (family && !options.has(family)) {
          options.set(family, { value: family, label: `${family} (ในเครื่อง)` });
        }
      });
      setFontOptions(Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label)));
      setLocalFontMessage(`พบ Font ในเครื่อง ${fonts.length} รายการ`);
    } catch {
      setLocalFontMessage('ไม่ได้รับสิทธิ์อ่าน Font ในเครื่อง ใช้รายการสำรอง');
    }
  }, []);

  useEffect(() => {
    if (!isOpen) setOpenPanel(null);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) void loadLocalFonts();
  }, [isOpen, loadLocalFonts]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <h3><i className="fas fa-sliders"></i> Quick Setup</h3>
        <p style={{ color: 'var(--text-muted-color)', marginBottom: '12px' }}>คัดลอก Overlay URL ไปใส่เป็น Browser Source ใน OBS Studio</p>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>เลือกลีกฟุตบอล:</label>
          <select style={{ width: '100%' }} value={selectedTargetId} onChange={(event) => onTargetChange(event.target.value)}>
            {targets.length === 0 ? <option value="">⚠️ โหลดไฟล์ Excel ก่อน</option> : targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
          </select>
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
                {fontOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <div className="quick-setup-local-font-row">
                <span>{localFontMessage}</span>
                <button type="button" className="btn-secondary" onClick={() => void loadLocalFonts()}>โหลดใหม่</button>
              </div>
            </label>

            {(['A', 'B'] as const).map((side) => {
              const modeKey = side === 'A' ? 'fontModeA' : 'fontModeB';
              const sizeKey = side === 'A' ? 'fontSizeA' : 'fontSizeB';
              const weightKey = side === 'A' ? 'fontWeightA' : 'fontWeightB';
              const mode = teamNameSettings[modeKey];
              return (
                <div key={side} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                  <label style={{ fontSize: '12px', color: '#cbd5e1' }}>
                    Team {side} ขนาดตัวอักษร
                    <select
                      style={{ width: '100%', marginTop: '4px' }}
                      value={mode}
                      onChange={(event) => onTeamNameSettingsChange({ [modeKey]: event.target.value } as Partial<TeamNameBrowserSettings>)}
                    >
                      <option value="auto">Auto ตามความยาวชื่อ</option>
                      <option value="manual">กำหนดเอง</option>
                    </select>
                  </label>
                  <label style={{ fontSize: '12px', color: '#cbd5e1' }}>
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
                  <label style={{ fontSize: '12px', color: '#cbd5e1' }}>
                    น้ำหนัก Font
                    <select
                      style={{ width: '100%', marginTop: '4px' }}
                      value={teamNameSettings[weightKey]}
                      onChange={(event) => onTeamNameSettingsChange({ [weightKey]: Number(event.target.value) } as Partial<TeamNameBrowserSettings>)}
                    >
                      {FONT_WEIGHT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
              );
            })}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
              <div style={{ padding: '8px', background: '#111827', borderRadius: '6px', textAlign: 'center', fontFamily: teamNameSettings.fontFamily }}>
                <small style={{ display: 'block', color: '#94a3b8' }}>Preview A</small>
                <span style={{ fontSize: teamNameSettings.fontModeA === 'manual' ? `${teamNameSettings.fontSizeA}px` : 'clamp(1.5rem, 2vw, 2.5rem)', fontWeight: teamNameSettings.fontWeightA }}>Team A</span>
              </div>
              <div style={{ padding: '8px', background: '#111827', borderRadius: '6px', textAlign: 'center', fontFamily: teamNameSettings.fontFamily }}>
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
              พรีวิวและปรับขนาด/ตัดขอบ (Crop/Resize) โลโก้สำหรับ Logo Browser Source แบบ Realtime
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
                    const cropData = getCropMetadataFromLocalStorage(normalizeTeamKey(teamName))?.crop || null;
                    const basePreviewSize = 55;
                    const previewDisplaySize = Math.max(24, Math.min(125, Math.round(basePreviewSize * (logoSettings.sizeA / 190))));

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
                          A: {teamName} ({logoSettings.sizeA}px)
                        </span>
                      </div>
                    );
                  })()}

                  {(logoPreviewSide === 'both' || logoPreviewSide === 'B') && (() => {
                    const teamName = matchState.nameB;
                    const logoSrc = getLogoSrc(matchState.logoB, teamName);
                    const cropData = getCropMetadataFromLocalStorage(normalizeTeamKey(teamName))?.crop || null;
                    const basePreviewSize = 55;
                    const previewDisplaySize = Math.max(24, Math.min(125, Math.round(basePreviewSize * (logoSettings.sizeB / 190))));

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
                          B: {teamName} ({logoSettings.sizeB}px)
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Interactive Size Sliders, Presets & Crop Buttons */}
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {(['A', 'B'] as const).map((side) => {
                  const sizeKey = side === 'A' ? 'sizeA' : 'sizeB';
                  const teamName = side === 'A' ? matchState.nameA : matchState.nameB;
                  const logoUrl = getLogoSrc(side === 'A' ? matchState.logoA : matchState.logoB, teamName);

                  return (
                    <div key={side} style={{ backgroundColor: '#0f172a', padding: '8px 10px', borderRadius: '6px', border: '1px solid #1e293b' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: side === 'A' ? '#38bdf8' : '#fb7185' }}>
                          Logo {side} Size
                        </span>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input
                            type="number"
                            min={LOGO_MIN_SIZE}
                            max={LOGO_MAX_SIZE}
                            value={logoSettings[sizeKey]}
                            onChange={(event) => handleLogoSettingsUpdate({ [sizeKey]: Number(event.target.value) } as Partial<LogoBrowserSettings>)}
                            style={{
                              width: '56px',
                              padding: '2px 4px',
                              borderRadius: '4px',
                              backgroundColor: '#1e293b',
                              border: '1px solid #334155',
                              color: '#fff',
                              fontSize: '11px',
                              textAlign: 'center',
                            }}
                          />
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '2px 6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
                            onClick={() => setCropModalTarget({ teamSide: side, teamName, logoUrl })}
                          >
                            ✂️ Crop
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={LOGO_MIN_SIZE}
                        max={LOGO_MAX_SIZE}
                        value={logoSettings[sizeKey]}
                        onChange={(event) => handleLogoSettingsUpdate({ [sizeKey]: Number(event.target.value) } as Partial<LogoBrowserSettings>)}
                        style={{ width: '100%', accentColor: side === 'A' ? '#0284c7' : '#e11d48' }}
                      />
                      <div style={{ display: 'flex', gap: '3px', marginTop: '4px' }}>
                        {[120, 190, 250, 320].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            style={{
                              flex: 1,
                              padding: '2px 0',
                              fontSize: '9px',
                              backgroundColor: logoSettings[sizeKey] === preset ? (side === 'A' ? '#0284c7' : '#e11d48') : '#1e293b',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                            }}
                            onClick={() => handleLogoSettingsUpdate({ [sizeKey]: preset } as Partial<LogoBrowserSettings>)}
                          >
                            {preset}px
                          </button>
                        ))}
                      </div>
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
            {cropModalTarget && (
              <LogoBrowserCropModal
                isOpen={!!cropModalTarget}
                onClose={() => setCropModalTarget(null)}
                teamSide={cropModalTarget.teamSide}
                teamName={cropModalTarget.teamName}
                logoUrl={cropModalTarget.logoUrl}
              />
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
                {fontOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <div className="quick-setup-local-font-row">
                <span>{localFontMessage}</span>
                <button type="button" className="btn-secondary" onClick={() => void loadLocalFonts()}>โหลดใหม่</button>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="btn-primary" style={{ background: '#3b82f6', borderColor: '#3b82f6', fontWeight: 'bold' }} onClick={onOpenObsSetup}><i className="fas fa-download"></i> 📦 ดาวน์โหลด OBS Scene Collection</button>
          <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 0' }}></div>
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
          <button className="btn-secondary" style={{ background: '#8b5cf6', borderColor: '#8b5cf6' }} onClick={onOpenDatabase}><i className="fas fa-database"></i> จัดการฐานข้อมูล (Firebase)</button>
        </div>
        <div style={{ marginTop: '16px', textAlign: 'right' }}><button className="btn-secondary" onClick={onClose}>{closeLabel}</button></div>
      </div>
    </div>
  );
}
