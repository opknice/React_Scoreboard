import { useRef, useState } from 'react';
import {
  MAX_LOGO_SCALE_PERCENT,
  MIN_LOGO_SCALE_PERCENT,
  type LeagueLogoSizingSettings,
} from '../types/leagueLogoSizing';
import {
  useRealtimePreviewTransport,
  type PreviewConnectionStatus,
} from './useRealtimePreviewTransport';

export type LeagueLogoScalePreviewAction = 'preview' | 'saved' | 'cancelled';

export interface LeagueLogoScalePreviewMessage {
  type: 'LeagueLogoScalePreview';
  sessionId: string;
  editSessionId: string;
  leagueId: string;
  action: LeagueLogoScalePreviewAction;
  sizing: LeagueLogoSizingSettings;
  sequence: number;
  timestamp: number;
}

interface LastReceivedMessage {
  editSessionId: string;
  sequence: number;
  timestamp: number;
}

function isValidScale(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= MIN_LOGO_SCALE_PERCENT
    && value <= MAX_LOGO_SCALE_PERCENT;
}

function isLeagueLogoScalePreviewMessage(value: unknown): value is LeagueLogoScalePreviewMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<LeagueLogoScalePreviewMessage>;
  const sizing = message.sizing as Partial<LeagueLogoSizingSettings> | undefined;
  return message.type === 'LeagueLogoScalePreview'
    && typeof message.sessionId === 'string'
    && typeof message.editSessionId === 'string'
    && typeof message.leagueId === 'string'
    && (message.action === 'preview' || message.action === 'saved' || message.action === 'cancelled')
    && Boolean(sizing)
    && isValidScale(sizing?.overlayScalePercent)
    && isValidScale(sizing?.logoBrowserScalePercent)
    && typeof message.sequence === 'number'
    && Number.isFinite(message.sequence)
    && typeof message.timestamp === 'number'
    && Number.isFinite(message.timestamp);
}

const isScalePreviewThrottled = (message: LeagueLogoScalePreviewMessage): boolean => message.action === 'preview';

interface UseLeagueLogoScalePreviewSyncOptions {
  sessionId: string;
  onMessage: (message: LeagueLogoScalePreviewMessage) => void;
}

export interface LeagueLogoScalePreviewSyncResult {
  publish: (message: LeagueLogoScalePreviewMessage) => void;
  status: PreviewConnectionStatus;
}

export function useLeagueLogoScalePreviewSync({
  sessionId,
  onMessage,
}: UseLeagueLogoScalePreviewSyncOptions): LeagueLogoScalePreviewSyncResult {
  return useRealtimePreviewTransport({
    sessionId,
    channelPrefix: 'league-logo-size-preview',
    eventName: 'league-logo-size-preview',
    throttleMs: 40,
    isMessage: isLeagueLogoScalePreviewMessage,
    shouldThrottle: isScalePreviewThrottled,
    onMessage,
  });
}

interface UseLeagueLogoScalePreviewOptions {
  sessionId: string;
  leagueId: string | null | undefined;
  persistedSizing: LeagueLogoSizingSettings;
}

/** Resolves a temporary slider value over the persisted league settings. */
export function useLeagueLogoScalePreview({
  sessionId,
  leagueId,
  persistedSizing,
}: UseLeagueLogoScalePreviewOptions): LeagueLogoSizingSettings {
  const [previewByLeague, setPreviewByLeague] = useState<Record<string, LeagueLogoSizingSettings>>({});
  const lastMessageRef = useRef<Record<string, LastReceivedMessage>>({});

  useLeagueLogoScalePreviewSync({
    sessionId,
    onMessage: (message) => {
      if (message.leagueId !== leagueId) return;
      const previous = lastMessageRef.current[message.leagueId];
      const isSameEditSession = previous?.editSessionId === message.editSessionId;
      if (previous && isSameEditSession && message.sequence <= previous.sequence) return;
      if (previous && !isSameEditSession && message.timestamp < previous.timestamp) return;

      lastMessageRef.current[message.leagueId] = {
        editSessionId: message.editSessionId,
        sequence: message.sequence,
        timestamp: message.timestamp,
      };

      if (message.action === 'cancelled') {
        setPreviewByLeague((current) => {
          const next = { ...current };
          delete next[message.leagueId];
          return next;
        });
        return;
      }

      setPreviewByLeague((current) => ({ ...current, [message.leagueId]: message.sizing }));
    },
  });

  return leagueId && previewByLeague[leagueId]
    ? previewByLeague[leagueId]
    : persistedSizing;
}
