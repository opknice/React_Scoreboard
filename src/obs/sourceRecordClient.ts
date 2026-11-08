import { callObsWithTimeout } from './obsRequest';
import { isSourceRecordTarget, SourceRecordError } from '../types/sourceRecord';
import type { SourceRecordConnection, SourceRecordFilter, SourceRecordSaveResult, SourceRecordTarget } from '../types/sourceRecord';

export { SourceRecordError } from '../types/sourceRecord';

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function envelope(result: unknown, sent: boolean): Record<string, unknown> {
  const data = object(result) ? result.responseData : undefined;
  if (!object(data) || data.protocolVersion !== 1 || typeof data.ok !== 'boolean') {
    throw new SourceRecordError('INVALID_RESPONSE', 'Source Record protocolVersion 1 ไม่ถูกต้อง', sent);
  }
  if (!data.ok) {
    if (!object(data.error) || typeof data.error.code !== 'string' || typeof data.error.message !== 'string') {
      throw new SourceRecordError('INVALID_RESPONSE', 'Source Record error ไม่ถูกต้อง', sent);
    }
    throw new SourceRecordError(data.error.code, data.error.message);
  }
  return data;
}

function isFilter(value: unknown): value is SourceRecordFilter {
  if (!object(value) || !isSourceRecordTarget(value) || !object(value.settings)) return false;
  const settings = value.settings;
  return (value.targetKind === 'source' || value.targetKind === 'scene')
    && ['enabled', 'replayEnabled', 'replayActive', 'busy'].every((key) => typeof value[key] === 'boolean')
    && Number.isInteger(settings.durationSeconds) && (settings.durationSeconds as number) >= 0
    && ['directory', 'filenameFormatting', 'format'].every((key) => typeof settings[key] === 'string')
    && [0, 1, 2].includes(settings.replayPerformance as number);
}

/** A scope owns all listeners/timers; cancellation also bounds an in-flight OBS call. */
function scope(obs: SourceRecordConnection, signal?: AbortSignal) {
  const controller = new AbortController();
  let reason = 'ABORTED';
  const abort = () => controller.abort();
  const disconnected = () => { reason = 'DISCONNECTED'; abort(); };
  signal?.addEventListener('abort', abort, { once: true });
  obs.on('ConnectionClosed', disconnected);
  if (signal?.aborted) abort();
  return {
    signal: controller.signal,
    reason: () => reason,
    expire: () => { reason = 'TIMEOUT'; abort(); },
    cleanup: () => { signal?.removeEventListener('abort', abort); obs.off('ConnectionClosed', disconnected); },
  };
}

function validateConnection(obs: SourceRecordConnection, signal?: AbortSignal) {
  if (signal?.aborted) throw new SourceRecordError('ABORTED', 'ยกเลิกการทำงาน');
  if (!obs || typeof obs.call !== 'function' || typeof obs.on !== 'function' || typeof obs.off !== 'function'
    || (obs as SourceRecordConnection & { isConnected?: boolean }).isConnected === false) {
    throw new SourceRecordError('OFFLINE', 'เชื่อมต่อ OBS ก่อนใช้งาน Source Record');
  }
}

export async function listSourceRecordFilters(obs: SourceRecordConnection, signal?: AbortSignal): Promise<SourceRecordFilter[]> {
  validateConnection(obs, signal);
  const request = scope(obs, signal);
  try {
    const result = await callObsWithTimeout(obs, 'CallVendorRequest', {
      vendorName: 'SourceRecord', requestType: 'ListFilters', requestData: {},
    }, request.signal);
    const data = envelope(result, false);
    if (!Array.isArray(data.filters) || !data.filters.every(isFilter)) {
      throw new SourceRecordError('INVALID_RESPONSE', 'รายการ Source Record Filter ไม่ถูกต้อง');
    }
    return data.filters;
  } catch (error) {
    if (error instanceof SourceRecordError) throw error;
    throw new SourceRecordError(request.signal.aborted ? request.reason() : 'TRANSPORT_ERROR', error instanceof Error ? error.message : String(error));
  } finally { request.cleanup(); }
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('ยกเลิกการรอ')); return; }
    const abort = () => { window.clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new Error('ยกเลิกการรอ')); };
    const timer = window.setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function saveSourceRecordReplay(
  obs: SourceRecordConnection, target: SourceRecordTarget, signal?: AbortSignal,
): Promise<SourceRecordSaveResult> {
  validateConnection(obs, signal);
  if (!isSourceRecordTarget(target)) throw new SourceRecordError('INVALID_TARGET', 'กรุณาเลือก Source และ Filter Source Record ที่มี UUID ถูกต้อง');
  const requestId = crypto.randomUUID();
  const request = scope(obs, signal);
  const deadline = Date.now() + 60000;
  const totalTimer = window.setTimeout(request.expire, 60000);
  let sent = false;
  try {
    const invoke = async (requestType: string, requestData: Record<string, unknown>) => {
      if (request.signal.aborted) throw new Error('Source Record ยกเลิกการรอ');
      sent = true;
      return envelope(await callObsWithTimeout(obs, 'CallVendorRequest', { vendorName: 'SourceRecord', requestType, requestData }, request.signal), true);
    };
    let data = await invoke('SaveReplay', { requestId, sourceUuid: target.sourceUuid, filterUuid: target.filterUuid });
    for (;;) {
      if (request.signal.aborted) throw new Error('Source Record ยกเลิกการรอ');
      if (data.requestId !== requestId || data.sourceUuid !== target.sourceUuid || data.filterUuid !== target.filterUuid) {
        throw new SourceRecordError('INVALID_RESPONSE', 'Source Record request หรือ target UUID ไม่ตรงกัน', true);
      }
      if (data.state === 'saved') {
        if (typeof data.path !== 'string' || !data.path.trim()) throw new SourceRecordError('INVALID_RESPONSE', 'Source Record ไม่ส่ง path ของไฟล์ที่บันทึก', true);
        return { requestId, sourceUuid: target.sourceUuid, filterUuid: target.filterUuid, path: data.path };
      }
      if (data.state === 'failed') {
        if (!object(data.error) || typeof data.error.code !== 'string' || typeof data.error.message !== 'string') {
          throw new SourceRecordError('INVALID_RESPONSE', 'Source Record failed ไม่มี error ที่ถูกต้อง', true);
        }
        throw new SourceRecordError(data.error.code, data.error.message);
      }
      if (data.state === 'outcome_unknown') throw new SourceRecordError('OUTCOME_UNKNOWN', 'Source Record ยังไม่ยืนยันไฟล์ที่บันทึก', true);
      if (data.state !== 'pending') throw new SourceRecordError('INVALID_RESPONSE', 'Source Record state ไม่ถูกต้อง', true);
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new SourceRecordError('TIMEOUT', 'Source Record รอผลเกิน 60 วินาที', true);
      await pause(Math.min(250, remaining), request.signal);
      data = await invoke('GetSaveStatus', { requestId });
    }
  } catch (error) {
    if (error instanceof SourceRecordError) throw error;
    throw new SourceRecordError(request.signal.aborted ? request.reason() : 'TRANSPORT_ERROR', error instanceof Error ? error.message : String(error), sent);
  } finally {
    window.clearTimeout(totalTimer);
    request.cleanup();
  }
}
