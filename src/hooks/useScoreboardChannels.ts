import { useEffect } from 'react';
import { MACRO_CHANNELS, postMacroChannelMessage } from '../macros/macroChannels';
import {
  SCOREBOARD_EVENT_CHANNEL,
  SCOREBOARD_STATE_STORAGE_KEY,
  type GoalScoredPayload,
  type ScoreboardStatePayload,
} from '../types/scoreboardEvent';

export function broadcastScoreboardButton(buttonId: string): void {
  postMacroChannelMessage(MACRO_CHANNELS.buttonEvents, {
    type: 'ButtonClicked',
    buttonId,
    timestamp: Date.now(),
  });
}

export function broadcastGoalScored(payload: GoalScoredPayload): void {
  const eventId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `goal_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  postMacroChannelMessage(SCOREBOARD_EVENT_CHANNEL, {
    type: 'GoalScored',
    eventId,
    ...payload,
    timestamp: Date.now(),
  });
}

export function broadcastScoreboardState(payload: ScoreboardStatePayload): void {
  const eventId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `state_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const event = {
    type: 'ScoreboardState' as const,
    eventId,
    ...payload,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(SCOREBOARD_STATE_STORAGE_KEY, JSON.stringify(event));
  } catch {
    // localStorage may be unavailable in an embedded or restricted browser.
  }

  postMacroChannelMessage(SCOREBOARD_EVENT_CHANNEL, event);
}

export function requestScoreboardState(): void {
  postMacroChannelMessage(SCOREBOARD_EVENT_CHANNEL, {
    type: 'ScoreboardStateRequest',
    timestamp: Date.now(),
  });
}

export function broadcastTeamNameAnimationCompleted(eventId: string, team: 'A' | 'B'): void {
  postMacroChannelMessage(SCOREBOARD_EVENT_CHANNEL, {
    type: 'TeamNameAnimationCompleted',
    eventId,
    team,
    timestamp: Date.now(),
  });
}

export function useScoreboardStateResponder(payload: ScoreboardStatePayload): void {
  const {
    scoreA,
    scoreB,
    nameA,
    nameB,
    logoA,
    logoB,
    colorA1,
    colorA2,
    colorB1,
    colorB2,
  } = payload;

  useEffect(() => {
    let channel: BroadcastChannel | null = null;

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!event.data || typeof event.data !== 'object') return;
      if ((event.data as { type?: unknown }).type !== 'ScoreboardStateRequest') return;
      broadcastScoreboardState({
        scoreA,
        scoreB,
        nameA,
        nameB,
        logoA,
        logoB,
        colorA1,
        colorA2,
        colorB1,
        colorB2,
      });
    };

    try {
      channel = new BroadcastChannel(SCOREBOARD_EVENT_CHANNEL);
      channel.addEventListener('message', handleMessage);
    } catch (error) {
      console.error('[ScoreboardState] Failed to create response channel:', error);
    }

    return () => {
      channel?.removeEventListener('message', handleMessage);
      channel?.close();
    };
  }, [
    colorA1,
    colorA2,
    colorB1,
    colorB2,
    logoA,
    logoB,
    nameA,
    nameB,
    scoreA,
    scoreB,
  ]);
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
