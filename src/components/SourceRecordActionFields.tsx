import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { listSourceRecordFilters } from '../obs/sourceRecordClient';
import type { SourceRecordConnection, SourceRecordFilter, SourceRecordTarget } from '../types/sourceRecord';

interface Props {
  obs?: SourceRecordConnection;
  isConnected: boolean;
  value?: SourceRecordTarget;
  onChange: (target: SourceRecordTarget | undefined) => void;
  onValidityChange?: (valid: boolean) => void;
}

const fieldStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 7,
  border: '1px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: '0.9rem',
};

function readiness(filter: SourceRecordFilter) {
  if (!filter.enabled) return 'Filter ถูกปิด';
  if (!filter.replayEnabled) return 'Replay Buffer ถูกปิด';
  if (!filter.replayActive) return 'Buffer ยังไม่พร้อม';
  if (filter.busy) return 'กำลังบันทึกหรือรอผลเดิม';
  return 'พร้อมบันทึก';
}

export default function SourceRecordActionFields({ obs, isConnected, value, onChange, onValidityChange }: Props): React.JSX.Element {
  const [filters, setFilters] = useState<SourceRecordFilter[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [sourceUuid, setSourceUuid] = useState(value?.sourceUuid || '');
  const latest = useRef({ value, onChange, onValidityChange });
  latest.current = { value, onChange, onValidityChange };

  useEffect(() => { if (value?.sourceUuid) setSourceUuid(value.sourceUuid); }, [value?.sourceUuid]);

  useEffect(() => {
    setFilters(null);
    setLoadError('');
    if (!obs || !isConnected) { latest.current.onValidityChange?.(true); return; }
    const controller = new AbortController();
    listSourceRecordFilters(obs, controller.signal).then((rows) => {
      if (controller.signal.aborted) return;
      setFilters(rows);
      const saved = latest.current.value;
      const match = rows.find((row) => row.sourceUuid === saved?.sourceUuid && row.filterUuid === saved?.filterUuid);
      latest.current.onValidityChange?.(!saved || !!match);
      if (match && saved && (match.sourceName !== saved.sourceName || match.filterName !== saved.filterName)) {
        latest.current.onChange({ sourceUuid: match.sourceUuid, sourceName: match.sourceName, filterUuid: match.filterUuid, filterName: match.filterName });
      }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : String(error));
    });
    return () => controller.abort();
  }, [obs, isConnected, refresh]);

  const online = !!obs && isConnected;
  const rows = online ? filters : null;
  const sources = [...new Map(rows?.map((row) => [row.sourceUuid, row])).values()];
  const options = rows?.filter((row) => row.sourceUuid === sourceUuid) || [];
  const selected = rows?.find((row) => row.sourceUuid === value?.sourceUuid && row.filterUuid === value?.filterUuid);
  const missing = !!value && rows !== null && !selected;
  const status = !online ? 'เชื่อมต่อ OBS เพื่อโหลด Source Record (คงเป้าหมายที่บันทึกไว้)'
    : loadError ? '' : rows === null ? 'กำลังโหลด Source Record…'
      : missing ? 'ไม่พบ Filter เดิม กรุณาเลือกใหม่ด้วย UUID'
        : rows.length === 0 ? 'ไม่พบ Source Record Filter ใน Scene Collection นี้' : '';

  return <div style={{ display: 'grid', gap: 8 }}>
    <select aria-label="เลือก Source หรือ Scene" style={fieldStyle} value={sourceUuid} disabled={!rows?.length}
      onChange={(event) => { setSourceUuid(event.target.value); onChange(undefined); onValidityChange?.(false); }}>
      <option value="">เลือก Source หรือ Scene…</option>
      {sourceUuid && !sources.some((source) => source.sourceUuid === sourceUuid)
        && <option value={sourceUuid}>{value?.sourceName || sourceUuid}</option>}
      {sources.map((source) => <option key={source.sourceUuid} value={source.sourceUuid}>{source.sourceName} ({source.targetKind === 'scene' ? 'Scene' : 'Source'})</option>)}
    </select>
    <select aria-label="เลือก Filter Source Record" style={fieldStyle} value={value?.sourceUuid === sourceUuid ? value.filterUuid : ''}
      disabled={!options.length} onChange={(event) => {
        const chosen = options.find((row) => row.filterUuid === event.target.value);
        onChange(chosen ? { sourceUuid: chosen.sourceUuid, sourceName: chosen.sourceName, filterUuid: chosen.filterUuid, filterName: chosen.filterName } : undefined);
        onValidityChange?.(!!chosen);
      }}>
      <option value="">เลือก Filter Source Record…</option>
      {value?.sourceUuid === sourceUuid && !options.some((filter) => filter.filterUuid === value.filterUuid)
        && <option value={value.filterUuid}>{value.filterName || value.filterUuid}</option>}
      {options.map((filter) => <option key={filter.filterUuid} value={filter.filterUuid}>{filter.filterName} — {readiness(filter)}</option>)}
    </select>
    <button type="button" disabled={!online} style={{ ...fieldStyle, width: 'auto', justifySelf: 'start', cursor: 'pointer' }}
      onClick={() => setRefresh((current) => current + 1)}>รีเฟรช Source Record</button>
    {status && <small role="status" style={{ color: missing ? '#fca5a5' : '#94a3b8' }}>{status}</small>}
    {loadError && online && <small role="alert" style={{ color: '#fca5a5' }}>โหลด Source Record ไม่สำเร็จ: {loadError}</small>}
    {selected && <small style={{ color: '#a7f3d0' }}>{selected.settings.durationSeconds} วินาที · {readiness(selected)}<br />
      {selected.settings.directory} · {selected.settings.format} · {['Normal', 'Balanced', 'Low CPU'][selected.settings.replayPerformance]}</small>}
    <small style={{ color: '#94a3b8' }}>ใช้การตั้งค่าจาก Filter Source Record</small>
    <small style={{ color: '#64748b' }}>ไฟล์บันทึกบนเครื่อง OBS · By nice.Thanakrit</small>
  </div>;
}
