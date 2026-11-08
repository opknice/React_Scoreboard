import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listSourceRecordFilters, saveSourceRecordReplay } from './sourceRecordClient';
import type { SourceRecordConnection } from '../types/sourceRecord';

const sourceUuid = '23456789-1234-4123-8123-123456789abc';
const filterUuid = '34567890-1234-4123-8123-123456789abc';
const target = { sourceUuid, filterUuid, sourceName: 'Camera', filterName: 'Replay' };
const row = { ...target, targetKind: 'source', enabled: true, replayEnabled: true, replayActive: true, busy: false,
  settings: { durationSeconds: 20, directory: 'D:\\Clips', filenameFormatting: '%CCYY', format: 'mkv', replayPerformance: 1 } };
const envelope = (data: object) => ({ responseData: { protocolVersion: 1, ok: true, ...data } });

function connection() {
  const listeners = new Set<() => void>();
  const call = vi.fn();
  const on = vi.fn((_event, listener: () => void) => listeners.add(listener));
  const off = vi.fn((_event, listener: () => void) => listeners.delete(listener));
  return { obs: { call, on, off } as unknown as SourceRecordConnection, call, listeners, on, off };
}

describe('Source Record protocol client', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { expect(vi.getTimerCount()).toBe(0); vi.useRealTimers(); });

  it('waits_for_saved_and_preserves_filter_settings', async () => {
    const { obs, call, listeners } = connection();
    call.mockImplementation(async (_type, data) => envelope({ ...target, requestId: data.requestData.requestId,
      state: data.requestType === 'SaveReplay' ? 'pending' : 'saved', path: 'D:\\Clips\\A\\replay.mkv' }));
    const promise = saveSourceRecordReplay(obs, target);
    await vi.advanceTimersByTimeAsync(250);
    await expect(promise).resolves.toMatchObject({ path: 'D:\\Clips\\A\\replay.mkv', sourceUuid, filterUuid });
    expect(call).toHaveBeenNthCalledWith(1, 'CallVendorRequest', { vendorName: 'SourceRecord', requestType: 'SaveReplay',
      requestData: { requestId: expect.any(String), sourceUuid, filterUuid } });
    expect(call).toHaveBeenNthCalledWith(2, 'CallVendorRequest', { vendorName: 'SourceRecord', requestType: 'GetSaveStatus',
      requestData: { requestId: expect.any(String) } });
    expect(listeners.size).toBe(0);
  });

  it('retains_uuid_on_rename and reads all settings', async () => {
    const { obs, call } = connection();
    call.mockResolvedValue(envelope({ filters: [{ ...row, sourceName: 'Renamed' }] }));
    await expect(listSourceRecordFilters(obs)).resolves.toEqual([{ ...row, sourceName: 'Renamed' }]);
  });

  it.each([
    ['wrong_protocol', { protocolVersion: 2, ok: true, filters: [] }],
    ['malformed_list', { protocolVersion: 1, ok: true, filters: [{ ...row, settings: { ...row.settings, replayPerformance: 'Balanced' } }] }],
    ['fractional_duration', { protocolVersion: 1, ok: true, filters: [{ ...row, settings: { ...row.settings, durationSeconds: 2.5 } }] }],
  ])('rejects_%s', async (_name, responseData) => {
    const { obs, call } = connection(); call.mockResolvedValue({ responseData });
    await expect(listSourceRecordFilters(obs)).rejects.toMatchObject({ outcomeUnknown: false });
  });

  it.each(['request', 'target', 'path', 'protocol', 'envelope'])('rejects invalid saved %s', async (invalid) => {
    const { obs, call } = connection();
    call.mockImplementation(async (_type, data) => {
      const result = envelope({ ...target, requestId: data.requestData.requestId, state: 'saved', path: 'D:\\saved.mkv' });
      if (invalid === 'request') result.responseData = { ...result.responseData, requestId: sourceUuid } as typeof result.responseData;
      if (invalid === 'target') Object.assign(result.responseData, { filterUuid: sourceUuid });
      if (invalid === 'path') Object.assign(result.responseData, { path: '' });
      if (invalid === 'protocol') result.responseData.protocolVersion = 99;
      if (invalid === 'envelope') Object.assign(result.responseData, { ok: 'true' });
      return result;
    });
    await expect(saveSourceRecordReplay(obs, target)).rejects.toMatchObject({ outcomeUnknown: true });
  });

  it('distinguishes_plugin_failure_from_unknown_transport_outcome', async () => {
    const { obs, call } = connection();
    call.mockResolvedValue({ responseData: { protocolVersion: 1, ok: false, error: { code: 'BUFFER_NOT_READY', message: 'Not ready' } } });
    await expect(saveSourceRecordReplay(obs, target)).rejects.toMatchObject({ code: 'BUFFER_NOT_READY', outcomeUnknown: false });
    call.mockRejectedValue(new Error('socket lost'));
    await expect(saveSourceRecordReplay(obs, target)).rejects.toMatchObject({ outcomeUnknown: true });
  });

  it('bounds_each_call_to_5000ms', async () => {
    const { obs, call, listeners } = connection(); call.mockReturnValue(new Promise(() => {}));
    const outcome = saveSourceRecordReplay(obs, target).catch((error) => error);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await outcome).toMatchObject({ outcomeUnknown: true });
    expect(listeners.size).toBe(0); expect(call).toHaveBeenCalledTimes(1);
  });

  it('stops_at_60000ms', async () => {
    const { obs, call, listeners } = connection();
    call.mockImplementation(async (_type, data) => envelope({ ...target, requestId: data.requestData.requestId, state: 'pending' }));
    const outcome = saveSourceRecordReplay(obs, target).catch((error) => error);
    await vi.advanceTimersByTimeAsync(60000);
    expect(await outcome).toMatchObject({ outcomeUnknown: true });
    expect(listeners.size).toBe(0);
  });

  it.each(['abort', 'disconnect'])('%s_stops_polling_without_retry', async (reason) => {
    const { obs, call, listeners } = connection(); const controller = new AbortController();
    call.mockImplementation(async (_type, data) => envelope({ ...target, requestId: data.requestData.requestId, state: 'pending' }));
    const outcome = saveSourceRecordReplay(obs, target, controller.signal).catch((error) => error);
    await vi.advanceTimersByTimeAsync(1);
    if (reason === 'abort') controller.abort(); else listeners.forEach((listener) => listener());
    expect(await outcome).toMatchObject({ outcomeUnknown: true });
    expect(call).toHaveBeenCalledTimes(1); expect(listeners.size).toBe(0);
  });

  it('invalid target and pre-send abort send nothing', async () => {
    const { obs, call } = connection(); const controller = new AbortController(); controller.abort();
    await expect(saveSourceRecordReplay(obs, target, controller.signal)).rejects.toMatchObject({ outcomeUnknown: false });
    await expect(saveSourceRecordReplay(obs, { ...target, filterUuid: '' })).rejects.toMatchObject({ outcomeUnknown: false });
    expect(call).not.toHaveBeenCalled();
  });
});
