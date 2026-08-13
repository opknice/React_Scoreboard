import { useCallback, useEffect, useRef, useState } from 'react';
import type { CustomMacro, MacroRuntimeStatus } from '../types/macro';
import { executeMacroActions as runMacroActions } from '../macros/macroExecutor';
import { loadCustomMacros, saveCustomMacros } from '../macros/macroStorage';
import { subscribeToMacroEvents } from '../macros/macroSubscriptions';

function createDefaultMacro(): Omit<CustomMacro, 'id'> {
  return {
    name: 'Automation ใหม่',
    color: '#3b82f6',
    isEnabled: false,
    trigger: {
      event: 'ReplayBufferSaved',
      filter: { kind: 'any' },
    },
    actions: [
      { id: '1', type: 'wait', delayMs: 1000 },
      { id: '2', type: 'switchScene', sceneName: 'Main Stream' },
    ],
    logs: [],
    lastTrigger: '',
  };
}

const INITIAL_PRESET_MACROS: CustomMacro[] = [];

export function useCustomMacros(obs: any) {
  const [macros, setMacros] = useState<CustomMacro[]>(() => loadCustomMacros(INITIAL_PRESET_MACROS));
  const [runtimeStatus, setRuntimeStatus] = useState<Record<string, MacroRuntimeStatus>>({});
  const processingRef = useRef<Record<string, boolean>>({});
  const abortControllersRef = useRef<Record<string, AbortController | undefined>>({});
  const saveTimerRef = useRef<number | null>(null);
  const obsApiRef = useRef(obs);
  const macrosRef = useRef(macros);
  obsApiRef.current = obs;
  macrosRef.current = macros;

  useEffect(() => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveCustomMacros(macros);
      saveTimerRef.current = null;
    }, 250);

    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, [macros]);

  useEffect(() => () => {
    Object.values(abortControllersRef.current).forEach((controller) => controller?.abort());
  }, []);

  const addMacroLog = useCallback((macroId: string, message: string) => {
    const time = new Date().toLocaleTimeString();
    const logEntry = `[${time}] ${message}`;

    setMacros((previous) => previous.map((macro) => (
      macro.id === macroId
        ? { ...macro, logs: [...(macro.logs || []).slice(-14), logEntry] }
        : macro
    )));
    console.log(`[CustomMacro:${macroId}]`, message);
  }, []);

  const executeMacro = useCallback(async (macro: CustomMacro) => {
    if (processingRef.current[macro.id]) {
      addMacroLog(macro.id, '⚠️ กำลังประมวลผลอยู่แล้ว ข้ามการทำงานซ้ำ...');
      return;
    }

    const obsRef = obsApiRef.current.getObsRef();
    if (!obsRef) {
      setRuntimeStatus((previous) => ({ ...previous, [macro.id]: 'offline' }));
      addMacroLog(macro.id, '❌ OBS ยังไม่ได้เชื่อมต่อ ไม่สามารถทำงาน Macro ได้');
      return;
    }

    setRuntimeStatus((previous) => ({ ...previous, [macro.id]: 'running' }));
    const controller = new AbortController();
    abortControllersRef.current[macro.id] = controller;

    try {
      const completed = await runMacroActions(macro, obsRef, {
        isProcessing: (macroId) => Boolean(processingRef.current[macroId]),
        setProcessing: (macroId, value) => {
          processingRef.current[macroId] = value;
        },
        addLog: addMacroLog,
        signal: controller.signal,
      });

      if (completed) {
        setRuntimeStatus((previous) => ({ ...previous, [macro.id]: 'success' }));
        setMacros((previous) => previous.map((item) => (
          item.id === macro.id
            ? { ...item, lastTrigger: new Date().toLocaleTimeString() }
            : item
        )));
      } else {
        setRuntimeStatus((previous) => ({ ...previous, [macro.id]: 'error' }));
      }
    } finally {
      if (abortControllersRef.current[macro.id] === controller) {
        delete abortControllersRef.current[macro.id];
      }
    }
  }, [addMacroLog]);

  const runMacro = useCallback((macroId: string) => {
    const macro = macrosRef.current.find((item) => item.id === macroId);
    if (macro) void executeMacro(macro);
  }, [executeMacro]);

  const subscriptionSignature = JSON.stringify(
    macros.map((macro) => ({
      id: macro.id,
      isEnabled: macro.isEnabled,
      trigger: macro.trigger,
      actions: macro.actions,
    })),
  );

  useEffect(() => {
    if (!obs.isConnected) return undefined;

    const obsRef = obsApiRef.current.getObsRef();
    if (!obsRef) return undefined;

    return subscribeToMacroEvents({
      obsRef,
      macros: macrosRef.current,
      executeMacro,
      addLog: addMacroLog,
    });
  }, [obs.isConnected, subscriptionSignature, executeMacro, addMacroLog]);

  const addMacro = useCallback((newMacro?: Partial<CustomMacro>) => {
    const generatedId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36);
    const id = `macro_${generatedId}`;
    const created: CustomMacro = {
      ...createDefaultMacro(),
      ...newMacro,
      id,
    };
    setMacros((previous) => [...previous, created]);
    return id;
  }, []);

  const updateMacro = useCallback((id: string, updated: Partial<CustomMacro>) => {
    setMacros((previous) => previous.map((macro) => (
      macro.id === id ? { ...macro, ...updated } : macro
    )));
  }, []);

  const deleteMacro = useCallback((id: string) => {
    abortControllersRef.current[id]?.abort();
    setMacros((previous) => previous.filter((macro) => macro.id !== id));
    delete processingRef.current[id];
    setRuntimeStatus((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }, []);

  const toggleMacro = useCallback((id: string, isEnabled: boolean) => {
    if (!isEnabled) abortControllersRef.current[id]?.abort();
    setMacros((previous) => previous.map((macro) => (
      macro.id === id ? { ...macro, isEnabled } : macro
    )));
  }, []);

  const clearMacroLogs = useCallback((id: string) => {
    setMacros((previous) => previous.map((macro) => (
      macro.id === id ? { ...macro, logs: [] } : macro
    )));
  }, []);

  return {
    customMacros: macros,
    runtimeStatus,
    addMacro,
    updateMacro,
    deleteMacro,
    toggleMacro,
    clearMacroLogs,
    runMacro,
  };
}
