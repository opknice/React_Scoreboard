import { useId } from 'react';
import { normalizeBrowserPositions, type BrowserPositions } from '../types/browserPositions';
import './BrowserPositionEditor.css';

interface Props {
  showPreview?: boolean;
  label: string;
  positions: BrowserPositions;
  defaults: BrowserPositions;
  anchor?: 'center' | 'top';
  onChange: (positions: BrowserPositions) => void;
}

export default function BrowserPositionEditor({ label, positions, defaults, anchor = 'center', onChange, showPreview = true }: Props) {
  const id = useId();
  const current = normalizeBrowserPositions(positions, defaults);
  return (
    <section className="browser-position-editor" aria-labelledby={id}>
      <strong id={id}>{label} · ตำแหน่งบน Canvas</strong>
      <p>1920 × 1080 px · จุดอ้างอิง: {anchor === 'center' ? 'กึ่งกลาง' : 'กึ่งกลางแนวนอน / ขอบบน'}</p>
      <div className="browser-position-fields">
        {(['A', 'B'] as const).map(side => (
          <fieldset key={side}>
            <legend>Team {side}</legend>
            {(['x', 'y'] as const).map(axis => (
              <label key={axis}>{axis.toUpperCase()} (px)
                <input type="number" min={0} max={axis === 'x' ? 1920 : 1080} step="any"
                  aria-label={`${label} Team ${side} ${axis.toUpperCase()}`}
                  value={current[side][axis]}
                  onChange={event => {
                    // An empty draft must not jump the source to zero.
                    if (!event.target.value.trim() || !Number.isFinite(event.target.valueAsNumber)) return;
                    onChange(normalizeBrowserPositions({ ...current, [side]: { ...current[side], [axis]: event.target.valueAsNumber } }, defaults));
                  }} />
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      {showPreview && <div className="browser-position-preview" role="img" aria-label={`${label} แผนผังตำแหน่งบน Canvas`}>
        {(['A', 'B'] as const).map(side => (
          <span key={side} className={`browser-position-marker browser-position-marker--${side}`}
            style={{ left: `${current[side].x / 1920 * 100}%`, top: `${current[side].y / 1080 * 100}%` }}>
            <span>{side}</span>
          </span>
        ))}
      </div>}
      <small>วัตถุอาจล้นขอบเมื่อวางใกล้ขอบ Canvas</small>
      <button type="button" className="btn-secondary" onClick={() => onChange(normalizeBrowserPositions(defaults, defaults))}>รีเซ็ตเฉพาะตำแหน่ง</button>
    </section>
  );
}
