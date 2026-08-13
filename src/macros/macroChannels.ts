export const MACRO_CHANNELS = {
  replayEvents: 'replay-events',
  buttonEvents: 'button-events',
  keyboardEvents: 'keyboard-events',
  modalControl: 'modal-control',
  replayControl: 'replay-control',
} as const;

export type MacroEventData = Record<string, unknown>;

const channelCache = new Map<string, BroadcastChannel>();

function getMacroChannel(channelName: string): BroadcastChannel {
  const cached = channelCache.get(channelName);
  if (cached) return cached;

  const channel = new BroadcastChannel(channelName);
  channelCache.set(channelName, channel);
  return channel;
}

export function postMacroChannelMessage(channelName: string, message: MacroEventData): boolean {
  try {
    const channel = getMacroChannel(channelName);
    channel.postMessage(message);
    return true;
  } catch (error) {
    console.error(`[MacroChannel] Failed to post message on "${channelName}"`, error);
    return false;
  }
}

export function closeMacroChannels(): void {
  channelCache.forEach((channel) => channel.close());
  channelCache.clear();
}
