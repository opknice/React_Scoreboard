import type { ActionStep, CustomMacro } from '../types/macro';
import { getMacroEventOption } from './macroEventCatalog';
import { normalizeMacroFilter } from './macroTrigger';

export function describeMacroTrigger(macro: Pick<CustomMacro, 'trigger'>): string {
  const event = getMacroEventOption(macro.trigger.event);
  const filter = normalizeMacroFilter(macro.trigger);
  if (filter.kind === 'button' && filter.value) return `${event.label}: ${filter.value}`;
  if (filter.kind === 'key' && filter.value) return `${event.label}: ${filter.value}`;
  if (filter.kind === 'hotkey' && filter.value) return `${event.label}: ${filter.value}`;
  if (filter.kind === 'scene' && filter.value) return `${event.label}: ${filter.value}`;
  if (filter.kind === 'input' && filter.value) return `${event.label}: ${filter.value}`;
  return event.label;
}

export function describeAction(step: ActionStep): string {
  switch (step.type) {
    case 'wait': return `รอ ${((step.delayMs ?? 1000) / 1000).toFixed(1)} วินาที`;
    case 'switchScene': return `สลับไป Scene “${step.sceneName || 'ยังไม่ได้เลือก'}”`;
    case 'showSource': return `แสดง Source “${step.sourceName || 'ยังไม่ได้เลือก'}”`;
    case 'hideSource': return `ซ่อน Source “${step.sourceName || 'ยังไม่ได้เลือก'}”`;
    case 'openVarReplay': return 'เปิด VAR Replay';
    case 'closeVarReplay': return 'ปิด VAR Replay';
    case 'openReplayControl': return 'เปิด Replay Control';
    case 'closeReplayControl': return 'ปิด Replay Control';
    case 'saveReplayBuffer': return 'บันทึก Replay Buffer';
    case 'loadLatestReplay': return 'โหลด Replay ล่าสุด';
    default: return step.type;
  }
}

export function describeMacroActions(actions: ActionStep[]): string {
  if (actions.length === 0) return 'ยังไม่มีขั้นตอนการทำงาน';
  if (actions.length === 1) return describeAction(actions[0]);
  return `${describeAction(actions[0])} และอีก ${actions.length - 1} ขั้นตอน`;
}
