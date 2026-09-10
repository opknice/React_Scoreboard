import {
  TEAM_COLOR_MAX_BORDER_WIDTH,
  TEAM_COLOR_MAX_SHADOW_BLUR,
  TEAM_COLOR_MAX_SHADOW_OFFSET,
  TEAM_COLOR_MAX_SHADOW_SPREAD,
  TEAM_COLOR_MAX_WIDTH,
  TEAM_COLOR_MAX_HEIGHT,
  TEAM_COLOR_MIN_HEIGHT,
  TEAM_COLOR_MIN_WIDTH,
  type TeamColorAppearance,
  type TeamColorBrowserSettings,
  type TeamColorBrowserSettingsPatch,
  type TeamColorReference,
  type TeamColorShapePreset,
} from '../types/teamColorBrowserSettings';
import './TeamColorBrowserSourcePanel.css';

interface TeamColorBrowserSourcePanelProps {
  settingsOnly?: boolean;
  settings: TeamColorBrowserSettings;
  urls: { A: string; B: string };
  onSettingsChange: (patch: TeamColorBrowserSettingsPatch) => void;
  onCopyUrl: (side: 'A' | 'B') => void;
  obsBusy: boolean;
  obsConnected: boolean;
  obsMessage: string;
  onQuickAdd: () => void;
}

const COLOR_REFERENCE_OPTIONS: Array<{ value: TeamColorReference; label: string }> = [
  { value: 'primary', label: 'สีหลักของทีม' },
  { value: 'secondary', label: 'สีรองของทีม' },
  { value: 'custom', label: 'กำหนดสีเอง' },
];

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="team-color-control-field">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step = 0.01,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="team-color-control-field">
      {label}: {value}{suffix}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default function TeamColorBrowserSourcePanel({
  settingsOnly = false,
  settings,
  urls,
  onSettingsChange,
  onCopyUrl,
  obsBusy,
  obsConnected,
  obsMessage,
  onQuickAdd,
}: TeamColorBrowserSourcePanelProps) {
  const { appearance } = settings;
  const updateAppearance = <K extends keyof TeamColorAppearance>(
    key: K,
    value: TeamColorAppearance[K],
  ) => {
    onSettingsChange({ appearance: { [key]: value } as Partial<TeamColorAppearance> });
  };

  return (
    <div className="team-color-controls">
      <div className="team-color-control-group">
        <div className="team-color-control-group-title">รูปทรงและขนาด</div>
        <div className="team-color-control-grid">
          <label className="team-color-control-field">
            รูปทรง
            <select
              value={appearance.preset}
              onChange={(event) => updateAppearance('preset', event.target.value as TeamColorShapePreset)}
            >
              <option value="circle">วงกลม</option>
              <option value="square">สี่เหลี่ยม</option>
              <option value="custom">กำหนดเอง</option>
            </select>
          </label>
          <NumberField label="กว้าง (px)" value={appearance.width} min={TEAM_COLOR_MIN_WIDTH} max={TEAM_COLOR_MAX_WIDTH} onChange={(value) => updateAppearance('width', value)} />
          <NumberField label="สูง (px)" value={appearance.height} min={TEAM_COLOR_MIN_HEIGHT} max={TEAM_COLOR_MAX_HEIGHT} onChange={(value) => updateAppearance('height', value)} />
          <NumberField label="ความโค้ง (px)" value={appearance.borderRadius} min={0} max={Math.floor(Math.min(appearance.width, appearance.height) / 2)} onChange={(value) => updateAppearance('borderRadius', value)} />
        </div>
      </div>

      <div className="team-color-control-group">
        <div className="team-color-control-group-title">สีพื้นหลัง (สีทีม)</div>
        <div className="team-color-control-grid">
          <small style={{ color: '#94a3b8', fontSize: '11px', gridColumn: '1 / -1' }}>
            กล่องที่ 1 ใช้สี Primary และกล่องที่ 2 ใช้สี Secondary จากทีมปัจจุบัน
          </small>
          <RangeField label="ความโปร่งใส" value={appearance.fillOpacity} min={0} max={1} suffix="" onChange={(value) => updateAppearance('fillOpacity', value)} />
        </div>
      </div>

      <div className="team-color-control-group">
        <div className="team-color-control-group-title">
          <label><input type="checkbox" checked={appearance.borderEnabled} onChange={(event) => updateAppearance('borderEnabled', event.target.checked)} /> เปิดใช้กรอบ</label>
        </div>
        {appearance.borderEnabled ? <div className="team-color-control-grid">
          <label className="team-color-control-field">
            แหล่งสีกรอบ
            <select value={appearance.borderColorSource} onChange={(event) => updateAppearance('borderColorSource', event.target.value as TeamColorReference)}>
              {COLOR_REFERENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="team-color-control-field">
            สีกรอบ Custom
            <input type="color" value={appearance.customBorderColor} disabled={appearance.borderColorSource !== 'custom'} onChange={(event) => updateAppearance('customBorderColor', event.target.value)} />
          </label>
          <NumberField label="ความหนากรอบ (px)" value={appearance.borderWidth} min={0} max={TEAM_COLOR_MAX_BORDER_WIDTH} onChange={(value) => updateAppearance('borderWidth', value)} />
          <RangeField label="ความโปร่งใสกรอบ" value={appearance.borderOpacity} min={0} max={1} onChange={(value) => updateAppearance('borderOpacity', value)} />
        </div> : null}
      </div>

      <div className="team-color-control-group">
        <div className="team-color-control-group-title">
          <label><input type="checkbox" checked={appearance.shadowEnabled} onChange={(event) => updateAppearance('shadowEnabled', event.target.checked)} /> เปิดใช้เงา</label>
        </div>
        {appearance.shadowEnabled ? <div className="team-color-control-grid">
          <label className="team-color-control-field">
            สีเงา
            <input type="color" value={appearance.shadowColor} onChange={(event) => updateAppearance('shadowColor', event.target.value)} />
          </label>
          <RangeField label="ความโปร่งใสเงา" value={appearance.shadowOpacity} min={0} max={1} onChange={(value) => updateAppearance('shadowOpacity', value)} />
          <NumberField label="Blur (px)" value={appearance.shadowBlur} min={0} max={TEAM_COLOR_MAX_SHADOW_BLUR} onChange={(value) => updateAppearance('shadowBlur', value)} />
          <NumberField label="Spread (px)" value={appearance.shadowSpread} min={0} max={TEAM_COLOR_MAX_SHADOW_SPREAD} onChange={(value) => updateAppearance('shadowSpread', value)} />
          <NumberField label="Offset X (px)" value={appearance.shadowOffsetX} min={-TEAM_COLOR_MAX_SHADOW_OFFSET} max={TEAM_COLOR_MAX_SHADOW_OFFSET} onChange={(value) => updateAppearance('shadowOffsetX', value)} />
          <NumberField label="Offset Y (px)" value={appearance.shadowOffsetY} min={-TEAM_COLOR_MAX_SHADOW_OFFSET} max={TEAM_COLOR_MAX_SHADOW_OFFSET} onChange={(value) => updateAppearance('shadowOffsetY', value)} />
        </div> : null}
      </div>

      <div className="team-color-control-group">
        <div className="team-color-control-group-title">ตำแหน่งบน Canvas</div>
        <div className="team-color-control-grid">
          {(['A1', 'A2', 'B1', 'B2'] as const).map((slot) => (
            <div key={slot}>
              <div style={{ color: slot.startsWith('A') ? '#93c5fd' : '#fda4af', fontSize: '11px', fontWeight: 700, marginBottom: '5px' }}>
                Team {slot[0]} · {slot.endsWith('1') ? 'Primary' : 'Secondary'}
              </div>
              <div className="team-color-control-grid">
                <NumberField label="X (px)" value={settings.positions[slot].x} min={0} max={1920 - appearance.width} onChange={(value) => onSettingsChange({ positions: { [slot]: { x: value } } })} />
                <NumberField label="Y (px)" value={settings.positions[slot].y} min={0} max={1080 - appearance.height} onChange={(value) => onSettingsChange({ positions: { [slot]: { y: value } } })} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {!settingsOnly && <><details>
        <summary style={{ color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}>URL สำหรับ Browser Source</summary>
        <div className="team-color-url-list" style={{ marginTop: '7px' }}>
          {(['A', 'B'] as const).map((side) => (
            <div className="team-color-url-row" key={side}>
              <span>{side}: {urls[side]}</span>
              <button type="button" className="btn-secondary" style={{ padding: '4px 7px', fontSize: '11px' }} onClick={() => onCopyUrl(side)}>Copy</button>
            </div>
          ))}
        </div>
      </details>

      <div style={{ display: 'grid', gap: '6px' }}>
        <button type="button" className="btn-success" disabled={obsBusy || !obsConnected} onClick={onQuickAdd}>
          <i className="fas fa-plug"></i> Quick Add / Update to OBS
        </button>
        <div style={{ fontSize: '11px', color: obsConnected ? '#86efac' : '#fca5a5' }} role="status">
          {obsConnected ? 'OBS WebSocket: Connected' : 'OBS WebSocket: ยังไม่เชื่อมต่อ'}
          {obsMessage ? ` — ${obsMessage}` : ''}
        </div>
      </div>
      </>}
    </div>
  );
}
