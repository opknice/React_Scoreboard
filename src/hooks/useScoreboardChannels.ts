import { useEffect } from 'react';
import { MACRO_CHANNELS, postMacroChannelMessage } from '../macros/macroChannels';

export function broadcastScoreboardButton(buttonId: string): void {
  postMacroChannelMessage(MACRO_CHANNELS.buttonEvents, {
    type: 'ButtonClicked',
    buttonId,
    timestamp: Date.now(),
  });
}

export function useScoreboardKeyboardBroadcast(): void {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput = target && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.isContentEditable
      );
      if (isInput) return;
      if (event.defaultPrevented || event.repeat) return;

      postMacroChannelMessage(MACRO_CHANNELS.keyboardEvents, {
        type: 'KeyPressed',
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        timestamp: Date.now(),
      });
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
}

interface UseModalControlChannelOptions {
  onVarReplay: (open: boolean) => void;
  onReplay: (open: boolean) => void;
}

export function useModalControlChannel({
  onVarReplay,
  onReplay,
}: UseModalControlChannelOptions): void {
  useEffect(() => {
    let channel: BroadcastChannel | null = null;

    try {
      channel = new BroadcastChannel(MACRO_CHANNELS.modalControl);
      channel.onmessage = (event: MessageEvent) => {
        const data = event.data;
        if (!data || data.type !== 'ModalControl') return;

        const isOpen = data.action === 'open';
        if (data.modalType === 'var') onVarReplay(isOpen);
        if (data.modalType === 'replay') onReplay(isOpen);
      };
    } catch (error) {
      console.error('[ModalControl] Failed to create BroadcastChannel:', error);
    }

    return () => {
      channel?.close();
    };
  }, [onReplay, onVarReplay]);
}
