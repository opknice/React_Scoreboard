import { describe, expect, it, vi } from 'vitest';
import type { ActionStep, CustomMacro } from '../types/macro';
import { executeMacroActions } from './macroExecutor';

const groupUuid = '23c29fe4-1dd9-47c0-a166-ff488db47a60';

function makeMacro(type: ActionStep['type']): CustomMacro {
  return {
    id: 'macro-1', name: 'PlayGroup test', color: '#3b82f6', isEnabled: true,
    trigger: { event: 'ReplayBufferSaved' }, logs: [], lastTrigger: '',
    actions: [{ id: '1', type, playGroupUuid: groupUuid }],
  };
}

function makeContext() {
  return { isProcessing: () => false, setProcessing: vi.fn(), addLog: vi.fn() };
}

describe('PlayGroup automation execution', () => {
  it.each([['showPlayGroup', 'show'], ['hidePlayGroup', 'hide']] as const)(
    'sends %s to the configured group', async (type, action) => {
      const call = vi.fn().mockResolvedValue({ responseData: { ok: true, matched: 1 } });

      await expect(executeMacroActions(makeMacro(type), { call }, makeContext())).resolves.toBe(true);
      expect(call).toHaveBeenCalledExactlyOnceWith('CallVendorRequest', {
        vendorName: 'PlayGroup', requestType: 'RunAction', requestData: { action, group: groupUuid },
      });
    },
  );

  it('stops the macro if PlayGroup rejects the target group', async () => {
    const call = vi.fn().mockResolvedValue({ responseData: { ok: false, error: 'GROUP_NOT_FOUND', matched: 0 } });
    const context = makeContext();
    const macro = makeMacro('hidePlayGroup');
    macro.actions.push({ id: '2', type: 'switchScene', sceneName: 'Outro' });

    await expect(executeMacroActions(macro, { call }, context)).resolves.toBe(false);
    expect(call).toHaveBeenCalledTimes(1);
    expect(context.addLog).toHaveBeenCalledWith('macro-1', expect.stringContaining('GROUP_NOT_FOUND'));
  });
});
