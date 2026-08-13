import type { CustomMacro } from '../types/macro';
import { MACRO_CHANNELS, postMacroChannelMessage } from './macroChannels';

export interface MacroExecutorContext {
  isProcessing: (macroId: string) => boolean;
  setProcessing: (macroId: string, value: boolean) => void;
  addLog: (macroId: string, message: string) => void;
  signal?: AbortSignal;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error('Macro ถูกยกเลิก');
}

function waitWithCancellation(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal);
    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    }, Math.max(0, delayMs));
    const handleAbort = () => {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener('abort', handleAbort);
      reject(new Error('Macro ถูกยกเลิก'));
    };
    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

function callObsWithTimeout(
  obsRef: any,
  requestType: string,
  requestData: Record<string, unknown> | undefined,
  signal?: AbortSignal,
): Promise<any> {
  throwIfAborted(signal);
  let timeoutId: number | null = null;
  let handleAbort: (() => void) | null = null;

  const operation = Promise.resolve(obsRef.call(requestType, requestData));
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`OBS timeout: ${requestType}`)), 5000);
  });
  const aborted = new Promise<never>((_, reject) => {
    handleAbort = () => reject(new Error('Macro ถูกยกเลิก'));
    signal?.addEventListener('abort', handleAbort, { once: true });
  });

  return Promise.race([operation, timeout, aborted]).finally(() => {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
    if (handleAbort) signal?.removeEventListener('abort', handleAbort);
  });
}

/**
 * Executes the supported custom-macro actions.
 * The executor is deliberately independent from React state so it can be tested
 * and reused by the subscription layer.
 */
export async function executeMacroActions(
  macro: CustomMacro,
  obsRef: any,
  context: MacroExecutorContext,
): Promise<boolean> {
  if (context.isProcessing(macro.id)) {
    context.addLog(macro.id, '⚠️ กำลังประมวลผลอยู่แล้ว ข้ามการทำงานซ้ำ...');
    return false;
  }

  context.setProcessing(macro.id, true);
  context.addLog(macro.id, `🚀 เริ่มทำงาน Macro "${macro.name}"`);

  try {
    for (let i = 0; i < macro.actions.length; i += 1) {
      throwIfAborted(context.signal);
      const step = macro.actions[i];
      context.addLog(macro.id, `ขั้นตอนที่ ${i + 1}/${macro.actions.length}: ${step.type}`);

      if (step.type === 'wait') {
        const delay = step.delayMs ?? 1000;
        context.addLog(macro.id, `⏳ กำลังรอ ${(delay / 1000).toFixed(1)} วินาที...`);
        await waitWithCancellation(delay, context.signal);
      } else if (step.type === 'switchScene') {
        if (step.sceneName) {
          context.addLog(macro.id, `🔄 กำลังสลับ Scene ไปที่ "${step.sceneName}"...`);
          await callObsWithTimeout(obsRef, 'SetCurrentProgramScene', { sceneName: step.sceneName }, context.signal);
        } else {
          context.addLog(macro.id, '⚠️ ไม่ได้ระบุชื่อ Scene ข้ามขั้นตอนนี้');
        }
      } else if (step.type === 'showSource' || step.type === 'hideSource') {
        const sceneName = step.sourceScene || 'Main Stream';
        const sourceName = step.sourceName;
        const isShow = step.type === 'showSource';

        if (sourceName) {
          context.addLog(
            macro.id,
            `${isShow ? '👁️ กำลังแสดง' : '🙈 กำลังซ่อน'} Source "${sourceName}" ใน Scene "${sceneName}"...`,
          );
          const result = await callObsWithTimeout(obsRef, 'GetSceneItemId', { sceneName, sourceName }, context.signal);
          if (result && result.sceneItemId !== undefined) {
            await callObsWithTimeout(obsRef, 'SetSceneItemEnabled', {
              sceneName,
              sceneItemId: result.sceneItemId,
              sceneItemEnabled: isShow,
            }, context.signal);
          } else {
            context.addLog(macro.id, `❌ ไม่พบ Source "${sourceName}" ใน Scene "${sceneName}"`);
          }
        } else {
          context.addLog(macro.id, '⚠️ ไม่ได้ระบุชื่อ Source ข้ามขั้นตอนนี้');
        }
      } else if (
        step.type === 'openVarReplay'
        || step.type === 'closeVarReplay'
        || step.type === 'openReplayControl'
        || step.type === 'closeReplayControl'
      ) {
        const isOpen = step.type.startsWith('open');
        const modalType = step.type.includes('Var') ? 'var' : 'replay';
        context.addLog(
          macro.id,
          `${isOpen ? '📹 กำลังเปิด' : '✕ กำลังปิด'} ${modalType === 'var' ? 'VAR Replay' : 'Replay Control'}...`,
        );
        const sent = postMacroChannelMessage(MACRO_CHANNELS.modalControl, {
          type: 'ModalControl',
          modalType,
          action: isOpen ? 'open' : 'close',
          timestamp: Date.now(),
        });
        context.addLog(macro.id, sent
          ? `✓ ส่งคำสั่ง ${isOpen ? 'เปิด' : 'ปิด'} ${modalType === 'var' ? 'VAR' : 'Replay'} แล้ว`
          : '❌ ไม่สามารถส่งคำสั่งไปยังหน้าควบคุมได้');
      } else if (step.type === 'saveReplayBuffer') {
        try {
          context.addLog(macro.id, '💾 กำลังบันทึก Replay Buffer...');
          await callObsWithTimeout(obsRef, 'SaveReplayBuffer', undefined, context.signal);
          context.addLog(macro.id, '✓ บันทึก Replay Buffer สำเร็จ!');
        } catch (error: any) {
          context.addLog(macro.id, `❌ ไม่สามารถบันทึก Replay Buffer: ${error?.message || error}`);
        }
      } else if (step.type === 'loadLatestReplay') {
        context.addLog(macro.id, '⚡ กำลังส่งคำสั่งโหลดรีเพลย์ล่าสุด...');
        const sent = postMacroChannelMessage(MACRO_CHANNELS.replayControl, {
          type: 'LoadLatestReplay',
          timestamp: Date.now(),
        });
        context.addLog(macro.id, sent ? '✓ ส่งคำสั่งโหลดรีเพลย์ล่าสุดแล้ว' : '❌ ไม่สามารถส่งคำสั่งโหลดรีเพลย์ได้');
      }
    }

    context.addLog(macro.id, `✅ Macro "${macro.name}" ทำงานเสร็จสมบูรณ์!`);
    return true;
  } catch (error: any) {
    context.addLog(macro.id, `❌ เกิดข้อผิดพลาด: ${error?.message || error}`);
    return false;
  } finally {
    context.setProcessing(macro.id, false);
  }
}
