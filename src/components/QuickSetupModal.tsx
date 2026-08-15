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
  onUpdateScore: () => void;
  onQuickAddTeamNames: () => void;
  onUpdateTeamNames: () => void;
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
  onUpdateScore,
  onQuickAddTeamNames,
  onUpdateTeamNames,
  onOpenObsSetup,
  onCopyOverlay,
  onOpenDatabase,
  onClose,
}: QuickSetupModalProps) {
  const [openPanel, setOpenPanel] = useState<'team-name' | 'score' | null>(null);
  const [fontOptions, setFontOptions] = useState<FontOption[]>(TEAM_NAME_FONT_OPTIONS);
  const [localFontMessage, setLocalFontMessage] = useState('กำลังโหลด Font ในเครื่อง...');

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
              <button className="btn-primary" disabled={teamNameObsBusy || !teamNameObsConnected} onClick={onUpdateTeamNames}>
                <i className="fas fa-rotate"></i> Update Existing Team Name Sources
              </button>
            </div>
            <div style={{ fontSize: '11px', color: teamNameObsConnected ? '#86efac' : '#fca5a5' }}>
              {teamNameObsConnected ? 'OBS WebSocket: Connected' : 'OBS WebSocket: ยังไม่เชื่อมต่อ'}
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
              <button className="btn-primary" disabled={scoreObsBusy || !teamNameObsConnected} onClick={onUpdateScore}>
                <i className="fas fa-rotate"></i> Update Existing Score Sources
              </button>
            </div>
            <div style={{ fontSize: '11px', color: teamNameObsConnected ? '#86efac' : '#fca5a5' }}>
              {teamNameObsConnected ? 'OBS WebSocket: Connected' : 'OBS WebSocket: ยังไม่เชื่อมต่อ'}
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
