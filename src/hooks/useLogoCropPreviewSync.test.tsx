import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CropMetadata } from '../types/teamLogo';
import {
  useCropPreviewOverrides,
  useLogoCropPreviewSync,
  type LogoCropPreviewMessage,
} from './useLogoCropPreviewSync';
import {
  useLeagueLogoScalePreview,
  useLeagueLogoScalePreviewSync,
  type LeagueLogoScalePreviewMessage,
} from './useLeagueLogoScalePreviewSync';

vi.mock('../config/supabaseClient', () => ({ supabase: null }));

class FakeBroadcastChannel extends EventTarget {
  static instances = new Set<FakeBroadcastChannel>();
  readonly name: string;

  constructor(name: string) {
    super();
    this.name = name;
    FakeBroadcastChannel.instances.add(this);
  }

  postMessage(message: unknown): void {
    FakeBroadcastChannel.instances.forEach((channel) => {
      if (channel !== this && channel.name === this.name) {
        channel.dispatchEvent(new MessageEvent('message', { data: message }));
      }
    });
  }

  close(): void {
    FakeBroadcastChannel.instances.delete(this);
  }
}

const crop: CropMetadata = {
  x: 24,
  y: -10,
  width: 500,
  height: 500,
  zoom: 1.75,
  rotation: 5,
  aspectRatio: 1,
  createdAt: '2026-09-05T00:00:00.000Z',
};

function createMessage(
  action: LogoCropPreviewMessage['action'],
  sequence: number,
  context: LogoCropPreviewMessage['context'] = 'overlay',
): LogoCropPreviewMessage {
  return {
    type: 'LogoCropPreview',
    sessionId: 'test-session',
    editSessionId: 'edit-1',
    teamId: 'team-1',
    teamName: 'Alpha United',
    context,
    action,
    crop: action === 'cancelled' ? null : crop,
    sequence,
    timestamp: sequence,
  };
}

describe('logo crop preview sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeBroadcastChannel.instances.clear();
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    FakeBroadcastChannel.instances.clear();
  });

  it('applies a throttled overlay draft by team name and restores persisted crop on cancel', () => {
    const persistedCrop: CropMetadata = { ...crop, zoom: 1 };
    const { result } = renderHook(() => {
      const receiver = useCropPreviewOverrides({ sessionId: 'test-session', context: 'overlay' });
      const sender = useLogoCropPreviewSync({ sessionId: 'test-session', onMessage: () => undefined });
      return { receiver, sender };
    });

    expect(result.current.sender.status).toBe('local-only');

    act(() => {
      result.current.sender.publish(createMessage('preview', 1));
      vi.advanceTimersByTime(40);
    });

    // A missing teamId still works when the displayed team name matches.
    expect(result.current.receiver.resolveCrop(null, ' alpha united ', persistedCrop)).toEqual(crop);

    act(() => {
      result.current.sender.publish(createMessage('cancelled', 2));
    });

    expect(result.current.receiver.resolveCrop('team-1', 'Alpha United', persistedCrop)).toEqual(persistedCrop);
  });

  it('keeps Overlay and Logo Browser preview contexts independent', () => {
    const { result } = renderHook(() => {
      const receiver = useCropPreviewOverrides({ sessionId: 'test-session', context: 'overlay' });
      const sender = useLogoCropPreviewSync({ sessionId: 'test-session', onMessage: () => undefined });
      return { receiver, sender };
    });

    act(() => {
      result.current.sender.publish(createMessage('preview', 1, 'logo-browser'));
      vi.advanceTimersByTime(40);
    });

    expect(result.current.receiver.resolveCrop('team-1', 'Alpha United', null)).toBeNull();
  });

  it('previews league sizing and restores persisted values on cancel', () => {
    const persistedSizing = { overlayScalePercent: 100, logoBrowserScalePercent: 100 };
    const previewMessage: LeagueLogoScalePreviewMessage = {
      type: 'LeagueLogoScalePreview',
      sessionId: 'test-session',
      editSessionId: 'league-edit-1',
      leagueId: 'league-1',
      action: 'preview',
      sizing: { overlayScalePercent: 125, logoBrowserScalePercent: 140 },
      sequence: 1,
      timestamp: 1,
    };
    const { result } = renderHook(() => {
      const sizing = useLeagueLogoScalePreview({
        sessionId: 'test-session',
        leagueId: 'league-1',
        persistedSizing,
      });
      const sender = useLeagueLogoScalePreviewSync({
        sessionId: 'test-session',
        onMessage: () => undefined,
      });
      return { sizing, sender };
    });

    act(() => {
      result.current.sender.publish(previewMessage);
      vi.advanceTimersByTime(40);
    });
    expect(result.current.sizing).toEqual(previewMessage.sizing);

    act(() => {
      result.current.sender.publish({
        ...previewMessage,
        action: 'cancelled',
        sequence: 2,
        timestamp: 2,
      });
    });
    expect(result.current.sizing).toEqual(persistedSizing);
  });
});
