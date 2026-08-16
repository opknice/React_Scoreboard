import { useCallback, useEffect, useMemo, useState } from 'react';

export const VAR_REPLAY_KEYBINDINGS_STORAGE_KEY = 'var-replay-v2-keybindings:v1';

export type ReplayShortcutAction =
  | 'playPause'
  | 'stop'
  | 'setMarkerA'
  | 'setMarkerB'
  | 'toggleLoop'
  | 'clearMarkers'
  | 'zoomIn'
  | 'zoomOut'
  | 'resetTransform';

export type ReplayKeyBinding = {
  action: ReplayShortcutAction;
  code: string;
  label: string;
  ctrlKey: boolean;
  shiftKey?: boolean;
  altKey: boolean;
  metaKey: boolean;
};

export type ReplayShortcutDefinition = {
  action: ReplayShortcutAction;
  label: string;
  description: string;
};

export const REPLAY_SHORTCUT_DEFINITIONS: ReplayShortcutDefinition[] = [
  { action: 'playPause', label: 'เล่น / หยุดชั่วคราว', description: 'สลับสถานะการเล่นวิดีโอ' },
  { action: 'stop', label: 'หยุดและกลับต้นคลิป', description: 'หยุดวิดีโอและกลับไปเวลาเริ่มต้น' },
  { action: 'setMarkerA', label: 'ตั้งจุด A', description: 'กำหนดจุดเริ่มต้นของช่วง Replay' },
  { action: 'setMarkerB', label: 'ตั้งจุด B', description: 'กำหนดจุดสิ้นสุดของช่วง Replay' },
  { action: 'toggleLoop', label: 'เปิด / ปิด Loop', description: 'เล่นวนซ้ำระหว่างจุด A และ B' },
  { action: 'clearMarkers', label: 'ล้างจุด A/B', description: 'ล้างจุด Replay ทั้งหมด' },
  { action: 'zoomIn', label: 'เพิ่ม Zoom', description: 'เพิ่ม Zoom ทีละ 0.1x' },
  { action: 'zoomOut', label: 'ลด Zoom', description: 'ลด Zoom ทีละ 0.1x' },
  { action: 'resetTransform', label: 'รีเซ็ต Zoom / Pan', description: 'คืนค่า Zoom และตำแหน่งภาพเริ่มต้น' },
];

const DEFAULT_REPLAY_KEYBINDINGS: ReplayKeyBinding[] = [
  { action: 'playPause', code: 'Space', label: 'Space', ctrlKey: false, altKey: false, metaKey: false },
  { action: 'stop', code: 'KeyS', label: 'S', ctrlKey: false, altKey: false, metaKey: false },
  { action: 'setMarkerA', code: 'KeyA', label: 'A', ctrlKey: false, altKey: false, metaKey: false },
  { action: 'setMarkerB', code: 'KeyB', label: 'B', ctrlKey: false, altKey: false, metaKey: false },
  { action: 'toggleLoop', code: 'KeyL', label: 'L', ctrlKey: false, altKey: false, metaKey: false },
  { action: 'clearMarkers', code: 'KeyR', label: 'R', ctrlKey: false, altKey: false, metaKey: false },
  { action: 'zoomIn', code: 'Equal', label: '+ / =', ctrlKey: false, shiftKey: undefined, altKey: false, metaKey: false },
  { action: 'zoomOut', code: 'Minus', label: '-', ctrlKey: false, altKey: false, metaKey: false },
  { action: 'resetTransform', code: 'Digit0', label: '0', ctrlKey: false, altKey: false, metaKey: false },
];

const ACTION_SET = new Set<ReplayShortcutAction>(REPLAY_SHORTCUT_DEFINITIONS.map(({ action }) => action));

function getStorage(storage?: Storage) {
  if (storage) return storage;
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function getDefaultReplayKeybindings() {
  return DEFAULT_REPLAY_KEYBINDINGS.map((binding) => ({ ...binding }));
}

function isReplayShortcutAction(value: unknown): value is ReplayShortcutAction {
  return typeof value === 'string' && ACTION_SET.has(value as ReplayShortcutAction);
}

function isValidStoredBinding(value: unknown): value is ReplayKeyBinding {
  if (!value || typeof value !== 'object') return false;
  const binding = value as Partial<ReplayKeyBinding>;
  return isReplayShortcutAction(binding.action)
    && typeof binding.code === 'string'
    && typeof binding.label === 'string'
    && typeof binding.ctrlKey === 'boolean'
    && (binding.shiftKey === undefined || typeof binding.shiftKey === 'boolean')
    && typeof binding.altKey === 'boolean'
    && typeof binding.metaKey === 'boolean';
}

function modifiersOverlap(left: boolean | undefined, right: boolean | undefined) {
  return left === undefined || right === undefined || left === right;
}

export function bindingsConflict(left: ReplayKeyBinding, right: ReplayKeyBinding) {
  if (!left.code || !right.code || left.code !== right.code) return false;
  return left.ctrlKey === right.ctrlKey
    && left.altKey === right.altKey
    && left.metaKey === right.metaKey
    && modifiersOverlap(left.shiftKey, right.shiftKey);
}

export function findReplayBindingConflict(
  bindings: ReplayKeyBinding[],
  candidate: ReplayKeyBinding,
  excludedAction?: ReplayShortcutAction,
) {
  return bindings.find((binding) => binding.action !== excludedAction && bindingsConflict(binding, candidate))?.action;
}

export function loadReplayKeybindings(storage?: Storage) {
  const defaults = getDefaultReplayKeybindings();
  const targetStorage = getStorage(storage);
  if (!targetStorage) return defaults;

  try {
    const raw = targetStorage.getItem(VAR_REPLAY_KEYBINDINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const saved: unknown = JSON.parse(raw);
    if (!Array.isArray(saved)) return defaults;

    const result = defaults.map((binding) => ({ ...binding }));
    for (const value of saved) {
      if (!isValidStoredBinding(value)) continue;
      const currentIndex = result.findIndex((binding) => binding.action === value.action);
      if (currentIndex < 0) continue;
      const conflict = findReplayBindingConflict(result, value, value.action);
      if (conflict) continue;
      result[currentIndex] = { ...value };
    }
    return result;
  } catch {
    return defaults;
  }
}

export function saveReplayKeybindings(bindings: ReplayKeyBinding[], storage?: Storage) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return;
  try {
    targetStorage.setItem(VAR_REPLAY_KEYBINDINGS_STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // localStorage can be unavailable in embedded or restricted browser contexts.
  }
}

function getCodeLabel(code: string) {
  if (code === 'Space') return 'Space';
  if (code === 'Equal') return '=';
  if (code === 'Minus') return '-';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

export function formatReplayBinding(binding?: ReplayKeyBinding) {
  if (!binding?.code) return 'ไม่ได้กำหนด';
  if (binding.label === '+ / =' && binding.code === 'Equal') return '+ / =';
  const modifiers = [
    binding.ctrlKey ? 'Ctrl' : '',
    binding.altKey ? 'Alt' : '',
    binding.metaKey ? 'Meta' : '',
    binding.shiftKey ? 'Shift' : '',
  ].filter(Boolean);
  return [...modifiers, binding.label || getCodeLabel(binding.code)].join('+');
}

export function createReplayBindingFromEvent(action: ReplayShortcutAction, event: KeyboardEvent): ReplayKeyBinding | null {
  if (!event.code || event.code === 'ControlLeft' || event.code === 'ControlRight' || event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.code === 'AltLeft' || event.code === 'AltRight' || event.code === 'MetaLeft' || event.code === 'MetaRight') {
    return null;
  }
  return {
    action,
    code: event.code,
    label: getCodeLabel(event.code),
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
  };
}

export function matchesReplayBinding(event: KeyboardEvent, binding: ReplayKeyBinding) {
  if (!binding.code || event.code !== binding.code) return false;
  return event.ctrlKey === binding.ctrlKey
    && event.altKey === binding.altKey
    && event.metaKey === binding.metaKey
    && (binding.shiftKey === undefined || event.shiftKey === binding.shiftKey);
}

export function useReplayKeybindings() {
  const [bindings, setBindings] = useState<ReplayKeyBinding[]>(() => loadReplayKeybindings());

  useEffect(() => {
    saveReplayKeybindings(bindings);
  }, [bindings]);

  const updateBinding = useCallback((binding: ReplayKeyBinding) => {
    setBindings((current) => current.map((item) => item.action === binding.action ? { ...binding } : item));
  }, []);

  const clearBinding = useCallback((action: ReplayShortcutAction) => {
    setBindings((current) => current.map((item) => item.action === action ? { ...item, code: '', label: '', shiftKey: false } : item));
  }, []);

  const resetBindings = useCallback(() => {
    setBindings(getDefaultReplayKeybindings());
  }, []);

  const bindingByAction = useMemo(() => new Map(bindings.map((binding) => [binding.action, binding])), [bindings]);

  return { bindings, bindingByAction, updateBinding, clearBinding, resetBindings };
}
