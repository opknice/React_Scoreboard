import type OBSWebSocket from 'obs-websocket-js';

export type SourceRecordConnection = Pick<OBSWebSocket, 'call' | 'on' | 'off'>;

export interface SourceRecordTarget {
  sourceUuid: string;
  sourceName: string;
  filterUuid: string;
  filterName: string;
}

export interface SourceRecordFilter extends SourceRecordTarget {
  targetKind: 'source' | 'scene';
  enabled: boolean;
  replayEnabled: boolean;
  replayActive: boolean;
  busy: boolean;
  settings: {
    durationSeconds: number;
    directory: string;
    filenameFormatting: string;
    format: string;
    replayPerformance: 0 | 1 | 2;
  };
}

export interface SourceRecordSaveResult {
  requestId: string;
  sourceUuid: string;
  filterUuid: string;
  path: string;
}

export class SourceRecordError extends Error {
  readonly code: string;
  readonly outcomeUnknown: boolean;

  constructor(code: string, message: string, outcomeUnknown = false) {
    super(`${code}: ${message}${outcomeUnknown ? ' — ยังไม่ทราบผลบันทึก ห้ามสั่งบันทึกซ้ำอัตโนมัติ ตรวจสอบผลเดิมหรือปิดแล้วเปิด Replay Buffer ของ Filter เพื่อรีเซ็ต (ประวัติ Buffer จะถูกล้าง)' : ''}`);
    this.name = 'SourceRecordError';
    this.code = code;
    this.outcomeUnknown = outcomeUnknown;
  }
}

export function isSourceRecordUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isSourceRecordTarget(value: unknown): value is SourceRecordTarget {
  if (!value || typeof value !== 'object') return false;
  const target = value as SourceRecordTarget;
  return isSourceRecordUuid(target.sourceUuid) && isSourceRecordUuid(target.filterUuid)
    && typeof target.sourceName === 'string' && typeof target.filterName === 'string';
}
