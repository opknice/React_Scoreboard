import { describe, expect, it, vi } from 'vitest';
import { executeMacroActions } from './macroExecutor';
import { loadCustomMacros, saveCustomMacros } from './macroStorage';
import { describeAction } from './macroSummary';
import { saveSourceRecordReplay } from '../obs/sourceRecordClient';
import type { CustomMacro } from '../types/macro';

vi.mock('../obs/sourceRecordClient', () => ({ saveSourceRecordReplay: vi.fn() }));
const target = { sourceUuid: '23456789-1234-4123-8123-123456789abc', filterUuid: '34567890-1234-4123-8123-123456789abc', sourceName: 'Camera', filterName: 'Highlights' };
const makeMacro = (): CustomMacro => ({ id: 'sr', name: 'Source Record', color: '#fff', isEnabled: true,
  trigger: { event: 'ReplayBufferSaved' }, logs: [], lastTrigger: '',
  actions: [{ id: 'save', type: 'saveSourceRecordReplay', sourceRecordTarget: target }, { id: 'next', type: 'switchScene', sceneName: 'Outro' }] });
const context = () => ({ isProcessing: () => false, setProcessing: vi.fn(), addLog: vi.fn() });

describe('Source Record macro actions', () => {
  it('source_record_action_round_trips alongside legacy macros', () => {
    const macro = makeMacro(); const legacy = { ...macro, id: 'legacy', actions: [{ id: 'wait', type: 'wait' as const, delayMs: 50 }] };
    saveCustomMacros([macro, legacy]); expect(loadCustomMacros()).toEqual([macro, legacy]);
  });
  it('summary_names_the_selected_filter', () => {
    expect(describeAction(makeMacro().actions[0])).toContain('Highlights');
    expect(describeAction(makeMacro().actions[0])).toContain('Camera');
  });
  it('source_record_runs_next_action_only_after_saved', async () => {
    let resolveSave!: (value: any) => void;
    vi.mocked(saveSourceRecordReplay).mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
    const call = vi.fn().mockResolvedValue({}); const ctx = context();
    const execution = executeMacroActions(makeMacro(), { call }, ctx);
    expect(call).not.toHaveBeenCalled();
    expect(ctx.addLog.mock.calls.flat().join(' ')).not.toContain('D:\\saved.mkv');
    resolveSave({ requestId: target.sourceUuid, ...target, path: 'D:\\saved.mkv' });
    await expect(execution).resolves.toBe(true);
    expect(call).toHaveBeenCalledExactlyOnceWith('SetCurrentProgramScene', { sceneName: 'Outro' });
    expect(ctx.addLog.mock.calls.flat().join(' ')).toContain('D:\\saved.mkv');
  });
  it.each([false, true])('source_record_failure_stops_macro (outcomeUnknown=%s)', async (outcomeUnknown) => {
    vi.mocked(saveSourceRecordReplay).mockRejectedValue(Object.assign(new Error('SAVE_FAILED'), { outcomeUnknown }));
    const call = vi.fn(); const ctx = context();
    await expect(executeMacroActions(makeMacro(), { call }, ctx)).resolves.toBe(false);
    expect(call).not.toHaveBeenCalled();
    expect(ctx.addLog.mock.calls.flat().join(' ')).not.toContain('เสร็จสมบูรณ์');
  });
  it('missing_uuid_sends_nothing', async () => {
    vi.mocked(saveSourceRecordReplay).mockClear();
    const macro = makeMacro(); macro.actions[0].sourceRecordTarget = { ...target, filterUuid: '' };
    await expect(executeMacroActions(macro, { call: vi.fn() }, context())).resolves.toBe(false);
    expect(saveSourceRecordReplay).not.toHaveBeenCalled();
    saveCustomMacros([macro]); expect(loadCustomMacros()).toEqual([macro]);
  });
});
