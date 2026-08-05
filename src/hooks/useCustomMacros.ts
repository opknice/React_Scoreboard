import { useState, useEffect, useRef } from 'react';
import type { CustomMacro } from '../types/macro';

const DEFAULT_MACRO: Omit<CustomMacro, 'id'> = {
  name: 'Macro ใหม่ของฉัน',
  color: '#3b82f6',
  isEnabled: false,
  trigger: {
    event: 'ReplayBufferSaved',
    filterKey: '',
    filterValue: ''
  },
  actions: [
    { id: '1', type: 'wait', delayMs: 1000 },
    { id: '2', type: 'switchScene', sceneName: 'Main Stream' }
  ],
  logs: [],
  lastTrigger: ''
};

const INITIAL_PRESET_MACROS: CustomMacro[] = [
  {
    id: 'preset_replay',
    name: 'สลับไปหน้า Replay (อัตโนมัติ)',
    color: '#10b981',
    isEnabled: localStorage.getItem('replayAutoSwitch') === 'true',
    trigger: {
      event: 'ReplayBufferSaved',
      filterKey: '',
      filterValue: ''
    },
    actions: [
      { id: 'step_1', type: 'wait', delayMs: 3500 },
      { id: 'step_2', type: 'switchScene', sceneName: 'Replay' }
    ],
    logs: [],
    lastTrigger: ''
  },
  {
    id: 'preset_mainstream',
    name: 'สลับกลับหน้าหลัก Main Stream (อัตโนมัติ)',
    color: '#8b5cf6',
    isEnabled: localStorage.getItem('mainStreamAutoSwitch') === 'true',
    trigger: {
      event: 'MediaInputPlaybackEnded',
      filterKey: 'inputName',
      filterValue: 'Source Replay'
    },
    actions: [
      { id: 'step_1', type: 'switchScene', sceneName: 'Main Stream' },
      { id: 'step_2', type: 'wait', delayMs: 2000 },
      { id: 'step_3', type: 'showSource', sourceScene: 'Main Stream', sourceName: 'Goal_Alert' },
      { id: 'step_4', type: 'wait', delayMs: 3000 },
      { id: 'step_5', type: 'hideSource', sourceScene: 'Main Stream', sourceName: 'Goal_Alert' },
      { id: 'step_6', type: 'wait', delayMs: 1000 },
      { id: 'step_7', type: 'showSource', sourceScene: 'Main Stream', sourceName: 'Main_events' }
    ],
    logs: [],
    lastTrigger: ''
  }
];

export function useCustomMacros(obs: any) {
  const [macros, setMacros] = useState<CustomMacro[]>(() => {
    try {
      const saved = localStorage.getItem('customMacrosList');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load custom macros from localStorage', e);
    }
    return INITIAL_PRESET_MACROS;
  });

  const processingRef = useRef<Record<string, boolean>>({});

  // Save to localStorage when macros state changes
  useEffect(() => {
    try {
      localStorage.setItem('customMacrosList', JSON.stringify(macros));
    } catch (e) {
      console.error('Failed to save custom macros to localStorage', e);
    }
  }, [macros]);

  // Helper: add log to specific macro
  const addMacroLog = (macroId: string, message: string) => {
    const time = new Date().toLocaleTimeString();
    const logEntry = `[${time}] ${message}`;
    setMacros((prev) =>
      prev.map((m) => {
        if (m.id !== macroId) return m;
        return {
          ...m,
          logs: [...(m.logs || []).slice(-14), logEntry]
        };
      })
    );
    console.log(`[CustomMacro:${macroId}]`, message);
  };

  // Helper: execute action steps for a macro
  const executeMacroActions = async (macro: CustomMacro, obsRef: any) => {
    if (processingRef.current[macro.id]) {
      addMacroLog(macro.id, '⚠️ กำลังประมวลผลอยู่แล้ว ข้ามการทำงานซ้ำ...');
      return;
    }

    processingRef.current[macro.id] = true;
    addMacroLog(macro.id, `🚀 เริ่มทำงาน Macro "${macro.name}"`);

    try {
      for (let i = 0; i < macro.actions.length; i++) {
        const step = macro.actions[i];
        addMacroLog(macro.id, `ขั้นตอนที่ ${i + 1}/${macro.actions.length}: ${step.type}`);

        if (step.type === 'wait') {
          const delay = step.delayMs || 1000;
          addMacroLog(macro.id, `⏳ กำลังรอ ${(delay / 1000).toFixed(1)} วินาที...`);
          await new Promise((res) => setTimeout(res, delay));
        } else if (step.type === 'switchScene') {
          if (step.sceneName) {
            addMacroLog(macro.id, `🔄 กำลังสลับ Scene ไปที่ "${step.sceneName}"...`);
            await obsRef.call('SetCurrentProgramScene', { sceneName: step.sceneName });
          } else {
            addMacroLog(macro.id, `⚠️ ไม่ได้ระบุชื่อ Scene ข้ามขั้นตอนนี้`);
          }
        } else if (step.type === 'showSource' || step.type === 'hideSource') {
          const sceneName = step.sourceScene || 'Main Stream';
          const sourceName = step.sourceName;
          const isShow = step.type === 'showSource';

          if (sourceName) {
            addMacroLog(macro.id, `${isShow ? '👁️ กำลังแสดง' : '🙈 กำลังซ่อน'} Source "${sourceName}" ใน Scene "${sceneName}"...`);
            const res = await obsRef.call('GetSceneItemId', { sceneName, sourceName });
            if (res && res.sceneItemId !== undefined) {
              await obsRef.call('SetSceneItemEnabled', {
                sceneName,
                sceneItemId: res.sceneItemId,
                sceneItemEnabled: isShow
              });
            } else {
              addMacroLog(macro.id, `❌ ไม่พบ Source "${sourceName}" ใน Scene "${sceneName}"`);
            }
          } else {
            addMacroLog(macro.id, `⚠️ ไม่ได้ระบุชื่อ Source ข้ามขั้นตอนนี้`);
          }
        }
      }

      addMacroLog(macro.id, `✅ Macro "${macro.name}" ทำงานเสร็จสมบูรณ์!`);
      setMacros((prev) =>
        prev.map((m) => (m.id === macro.id ? { ...m, lastTrigger: new Date().toLocaleTimeString() } : m))
      );
    } catch (err: any) {
      addMacroLog(macro.id, `❌ เกิดข้อผิดพลาด: ${err?.message || err}`);
    } finally {
      processingRef.current[macro.id] = false;
    }
  };

  // Subscribe to OBS events for active custom macros
  useEffect(() => {
    if (!obs.isConnected) return;
    const obsRef = obs.getObsRef();
    if (!obsRef) return;

    const enabledMacros = macros.filter((m) => m.isEnabled && m.trigger.event);
    if (enabledMacros.length === 0) return;

    // Group listeners by event type
    const eventHandlers: { eventName: string; handler: (data: any) => void }[] = [];

    enabledMacros.forEach((macro) => {
      const eventName = macro.trigger.event;

      const handler = (data: any) => {
        // Filter check if configured
        if (macro.trigger.filterKey && macro.trigger.filterValue) {
          const actualVal = data ? String(data[macro.trigger.filterKey] || '') : '';
          if (actualVal !== macro.trigger.filterValue) {
            return; // Filter mismatch
          }
        }

        executeMacroActions(macro, obsRef);
      };

      try {
        obsRef.on(eventName as any, handler);
        eventHandlers.push({ eventName, handler });
        addMacroLog(macro.id, `✨ กำลังรอฟังเหตุการณ์ "${eventName}"...`);
      } catch (e) {
        console.error(`Failed to register listener for ${eventName}`, e);
      }
    });

    return () => {
      eventHandlers.forEach(({ eventName, handler }) => {
        try {
          obsRef.off(eventName as any, handler);
        } catch (e) {}
      });
    };
  }, [obs.isConnected, JSON.stringify(macros.map((m) => ({ id: m.id, isEnabled: m.isEnabled, trigger: m.trigger, actions: m.actions })))]);

  // Actions
  const addMacro = (newMacro?: Partial<CustomMacro>) => {
    const id = 'macro_' + Date.now();
    const created: CustomMacro = {
      ...DEFAULT_MACRO,
      ...newMacro,
      id
    };
    setMacros((prev) => [...prev, created]);
    return id;
  };

  const updateMacro = (id: string, updated: Partial<CustomMacro>) => {
    setMacros((prev) => prev.map((m) => (m.id === id ? { ...m, ...updated } : m)));
  };

  const deleteMacro = (id: string) => {
    setMacros((prev) => prev.filter((m) => m.id !== id));
  };

  const toggleMacro = (id: string, isEnabled: boolean) => {
    setMacros((prev) => prev.map((m) => (m.id === id ? { ...m, isEnabled } : m)));
  };

  const clearMacroLogs = (id: string) => {
    setMacros((prev) => prev.map((m) => (m.id === id ? { ...m, logs: [] } : m)));
  };

  return {
    customMacros: macros,
    addMacro,
    updateMacro,
    deleteMacro,
    toggleMacro,
    clearMacroLogs
  };
}
