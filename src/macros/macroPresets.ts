import type { CustomMacro } from '../types/macro';

export interface MacroPreset {
  id: string;
  name: string;
  description: string;
  color: string;
  macro: Omit<CustomMacro, 'id' | 'logs' | 'lastTrigger'>;
}

export const MACRO_PRESETS: MacroPreset[] = [
  {
    id: 'var-replay-full',
    name: 'VAR Controller แบบเต็ม',
    description: 'เปิด VAR Controller แล้วโหลด Replay ล่าสุดอัตโนมัติ',
    color: '#8b5cf6',
    macro: {
      name: 'VAR Controller แบบเต็ม',
      color: '#8b5cf6',
      isEnabled: false,
      trigger: { event: 'ButtonClicked', filter: { kind: 'button', value: 'var_replay' } },
      actions: [
        { id: 'step_1', type: 'openVarReplay' },
        { id: 'step_2', type: 'wait', delayMs: 1000 },
        { id: 'step_3', type: 'loadLatestReplay' },
      ],
    },
  },
  {
    id: 'instant-replay-full',
    name: 'Instant Replay แบบเต็ม',
    description: 'เปิดหน้าควบคุม Replay แล้วโหลดคลิปล่าสุด',
    color: '#06b6d4',
    macro: {
      name: 'Instant Replay แบบเต็ม',
      color: '#06b6d4',
      isEnabled: false,
      trigger: { event: 'ButtonClicked', filter: { kind: 'button', value: 'instant_replay' } },
      actions: [
        { id: 'step_1', type: 'openReplayControl' },
        { id: 'step_2', type: 'wait', delayMs: 1000 },
        { id: 'step_3', type: 'loadLatestReplay' },
      ],
    },
  },
  {
    id: 'save-and-switch',
    name: 'บันทึก Replay แล้วเปลี่ยน Scene',
    description: 'บันทึก Replay Buffer แล้วสลับไปยัง Scene ที่เลือก',
    color: '#10b981',
    macro: {
      name: 'บันทึก Replay แล้วเปลี่ยน Scene',
      color: '#10b981',
      isEnabled: false,
      trigger: { event: 'ReplayBufferSaved' },
      actions: [
        { id: 'step_1', type: 'switchScene', sceneName: 'Main Stream' },
      ],
    },
  },
];

export function getMacroPreset(id: string): MacroPreset | undefined {
  return MACRO_PRESETS.find((preset) => preset.id === id);
}
