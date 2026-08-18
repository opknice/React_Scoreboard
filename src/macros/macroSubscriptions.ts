import type { CustomMacro } from '../types/macro';
import { MACRO_CHANNELS, type MacroEventData } from './macroChannels';
import { matchesMacroTrigger } from './macroTrigger';

const CUSTOM_CHANNEL_EVENTS = new Set([
  'ReplayVideoEnded',
  'ReplayPlaylistCompleted',
  'ButtonClicked',
  'KeyPressed',
]);
const REPLAY_AUTOMATION_EVENTS = new Set(['ReplayVideoEnded', 'ReplayPlaylistCompleted']);

export interface MacroSubscriptionOptions {
  obsRef: any;
  macros: CustomMacro[];
  executeMacro: (macro: CustomMacro) => void;
  addLog: (macroId: string, message: string) => void;
}

export function checkKeyboardFilter(
  trigger: CustomMacro['trigger'],
  eventData: MacroEventData,
): boolean {
  return matchesMacroTrigger(trigger, 'KeyPressed', eventData);
}

function subscribeChannel(
  channelName: string,
  onMessage: (eventData: MacroEventData) => void,
): (() => void) | null {
  try {
    const channel = new BroadcastChannel(channelName);
    channel.onmessage = (event: MessageEvent<MacroEventData>) => onMessage(event.data || {});
    return () => channel.close();
  } catch (error) {
    console.error(`[MacroSubscription] Failed to create "${channelName}"`, error);
    return null;
  }
}

export function subscribeToMacroEvents(options: MacroSubscriptionOptions): () => void {
  const enabledMacros = options.macros.filter((macro) => macro.isEnabled && macro.trigger.event);
  if (enabledMacros.length === 0) return () => undefined;

  const cleanupFunctions: Array<() => void> = [];
  const macrosForEvent = (eventName: string) => enabledMacros.filter((macro) => macro.trigger.event === eventName);

  if ([...REPLAY_AUTOMATION_EVENTS].some((eventName) => macrosForEvent(eventName).length > 0)) {
    const cleanup = subscribeChannel(MACRO_CHANNELS.replayEvents, (eventData) => {
      const eventName = eventData.type;
      if (typeof eventName !== 'string' || !REPLAY_AUTOMATION_EVENTS.has(eventName)) return;

      macrosForEvent(eventName).forEach((macro) => {
        if (matchesMacroTrigger(macro.trigger, eventName, eventData)) options.executeMacro(macro);
      });
    });
    if (cleanup) cleanupFunctions.push(cleanup);
  }

  if (macrosForEvent('ButtonClicked').length > 0) {
    const cleanup = subscribeChannel(MACRO_CHANNELS.buttonEvents, (eventData) => {
      if (eventData.type !== 'ButtonClicked') return;
      macrosForEvent('ButtonClicked').forEach((macro) => {
        if (matchesMacroTrigger(macro.trigger, 'ButtonClicked', eventData)) options.executeMacro(macro);
      });
    });
    if (cleanup) cleanupFunctions.push(cleanup);
  }

  if (macrosForEvent('KeyPressed').length > 0) {
    const cleanup = subscribeChannel(MACRO_CHANNELS.keyboardEvents, (eventData) => {
      if (eventData.type !== 'KeyPressed') return;
      macrosForEvent('KeyPressed').forEach((macro) => {
        if (matchesMacroTrigger(macro.trigger, 'KeyPressed', eventData)) {
          options.addLog(macro.id, `⌨️ Key detected: ${String(eventData.code || '')}`);
          options.executeMacro(macro);
        }
      });
    });
    if (cleanup) cleanupFunctions.push(cleanup);
  }

  enabledMacros.forEach((macro) => {
    const eventName = macro.trigger.event;
    if (CUSTOM_CHANNEL_EVENTS.has(eventName)) return;

    const handler = (eventData: MacroEventData = {}) => {
      if (eventName === 'CustomEvent') {
        const action = eventData.action || (eventData.eventData as MacroEventData | undefined)?.action;
        if (!action) return;
        if (!matchesMacroTrigger(macro.trigger, eventName, eventData)) return;
        options.addLog(macro.id, `🎹 OBS Hotkey: ${String(action)}`);
        options.executeMacro(macro);
        return;
      }

      if (!matchesMacroTrigger(macro.trigger, eventName, eventData)) return;
      options.executeMacro(macro);
    };

    try {
      options.obsRef.on(eventName as any, handler);
      options.addLog(macro.id, `✨ กำลังรอฟังเหตุการณ์ "${eventName}"...`);
      cleanupFunctions.push(() => {
        try {
          options.obsRef.off(eventName as any, handler);
        } catch {
          // OBS client may already be disconnected.
        }
      });
    } catch (error) {
      console.error(`[MacroSubscription] Failed to register "${eventName}"`, error);
    }
  });

  return () => cleanupFunctions.forEach((cleanup) => cleanup());
}
