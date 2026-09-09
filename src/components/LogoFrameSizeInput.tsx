import { useEffect, useState } from 'react';

interface Props {
  value: number;
  onChange: (value: number) => void;
}

/** Keep partial typing local; only publish valid sizes to the live preview. */
export default function LogoFrameSizeInput({ value, onChange }: Props) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  return <input type="number" min={48} max={570} step={1} value={draft}
    onChange={(event) => {
      setDraft(event.target.value);
      const next = event.target.valueAsNumber;
      if (Number.isFinite(next) && next >= 48 && next <= 570) onChange(next);
    }}
    onBlur={() => {
      const next = draft.trim() ? Number(draft) : Number.NaN;
      if (Number.isFinite(next)) onChange(Math.min(570, Math.max(48, next)));
      setDraft(String(value));
    }}
    style={{ width: '76px', padding: '6px', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '4px' }} />;
}
