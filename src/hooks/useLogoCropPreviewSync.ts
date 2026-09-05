import { useCallback, useRef, useState } from 'react';
import { isCropMetadata, type CropMetadata } from '../types/teamLogo';
import {
  useRealtimePreviewTransport,
  type PreviewConnectionStatus,
} from './useRealtimePreviewTransport';

export type LogoCropPreviewAction = 'preview' | 'saved' | 'cancelled' | 'reset';
export type CropPreviewContext = 'overlay' | 'logo-browser';
export type CropPreviewConnectionStatus = PreviewConnectionStatus;

export interface LogoCropPreviewMessage {
  type: 'LogoCropPreview';
  sessionId: string;
  editSessionId: string;
  teamId: string;
  teamName: string;
  context: CropPreviewContext;
  action: LogoCropPreviewAction;
  crop: CropMetadata | null;
  sequence: number;
  timestamp: number;
}

interface LastReceivedMessage {
  editSessionId: string;
  sequence: number;
  timestamp: number;
}

interface CropPreviewOverride {
  teamId: string;
  teamName: string;
  crop: CropMetadata | null;
}

const isCropPreviewThrottled = (message: LogoCropPreviewMessage): boolean => message.action === 'preview';

export function getLogoSyncSessionId(): string {
  const key = 'logoBrowserSyncSessionId';
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `logo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, created);
    return created;
  } catch {
    return 'logo-session-default';
  }
}

function normalizeTeamName(teamName: string): string {
  return teamName.trim().toLocaleLowerCase('th-TH');
}

function isLogoCropPreviewMessage(value: unknown): value is LogoCropPreviewMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<LogoCropPreviewMessage>;
  return message.type === 'LogoCropPreview'
    && typeof message.sessionId === 'string'
    && typeof message.editSessionId === 'string'
    && typeof message.teamId === 'string'
    && typeof message.teamName === 'string'
    && (message.context === 'overlay' || message.context === 'logo-browser')
    && (message.action === 'preview' || message.action === 'saved' || message.action === 'cancelled' || message.action === 'reset')
    && (message.crop === null || isCropMetadata(message.crop))
    && typeof message.sequence === 'number'
    && Number.isFinite(message.sequence)
    && typeof message.timestamp === 'number'
    && Number.isFinite(message.timestamp);
}

interface UseLogoCropPreviewSyncOptions {
  sessionId: string;
  onMessage: (message: LogoCropPreviewMessage) => void;
}

export interface CropPreviewSyncResult {
  publish: (message: LogoCropPreviewMessage) => void;
  status: CropPreviewConnectionStatus;
}

/** Bridges the editor to OBS: BroadcastChannel for local tabs and Supabase Broadcast for Chrome ↔ OBS. */
export function useLogoCropPreviewSync({ sessionId, onMessage }: UseLogoCropPreviewSyncOptions): CropPreviewSyncResult {
  return useRealtimePreviewTransport({
    sessionId,
    channelPrefix: 'logo-preview',
    eventName: 'logo-crop-preview',
    throttleMs: 40,
    isMessage: isLogoCropPreviewMessage,
    shouldThrottle: isCropPreviewThrottled,
    onMessage,
  });
}

interface UseCropPreviewOverridesOptions {
  sessionId: string;
  context: CropPreviewContext;
}

export interface CropPreviewOverridesResult {
  resolveCrop: (
    teamId: string | null | undefined,
    teamName: string,
    persistedCrop: CropMetadata | null | undefined,
  ) => CropMetadata | null;
  status: CropPreviewConnectionStatus;
}

/** Receives temporary crop values and resolves them over persisted Supabase values. */
export function useCropPreviewOverrides({
  sessionId,
  context,
}: UseCropPreviewOverridesOptions): CropPreviewOverridesResult {
  const [overridesById, setOverridesById] = useState<Record<string, CropPreviewOverride>>({});
  const [overridesByName, setOverridesByName] = useState<Record<string, CropPreviewOverride>>({});
  const lastMessageRef = useRef<Record<string, LastReceivedMessage>>({});

  const { status } = useLogoCropPreviewSync({
    sessionId,
    onMessage: (message) => {
      if (message.context !== context) return;

      const previous = lastMessageRef.current[message.teamId];
      const isSameEditSession = previous?.editSessionId === message.editSessionId;
      if (previous && isSameEditSession && message.sequence <= previous.sequence) return;
      if (previous && !isSameEditSession && message.timestamp < previous.timestamp) return;

      lastMessageRef.current[message.teamId] = {
        editSessionId: message.editSessionId,
        sequence: message.sequence,
        timestamp: message.timestamp,
      };

      const normalizedName = normalizeTeamName(message.teamName);
      if (message.action === 'cancelled') {
        setOverridesById((current) => {
          const next = { ...current };
          delete next[message.teamId];
          return next;
        });
        if (normalizedName) {
          setOverridesByName((current) => {
            const next = { ...current };
            delete next[normalizedName];
            return next;
          });
        }
        return;
      }

      const override: CropPreviewOverride = {
        teamId: message.teamId,
        teamName: message.teamName,
        crop: message.crop,
      };
      setOverridesById((current) => ({ ...current, [message.teamId]: override }));
      if (normalizedName) {
        setOverridesByName((current) => ({ ...current, [normalizedName]: override }));
      }
    },
  });

  const resolveCrop = useCallback((
    teamId: string | null | undefined,
    teamName: string,
    persistedCrop: CropMetadata | null | undefined,
  ): CropMetadata | null => {
    if (teamId && Object.prototype.hasOwnProperty.call(overridesById, teamId)) {
      return overridesById[teamId].crop;
    }
    const normalizedName = normalizeTeamName(teamName);
    if (normalizedName && Object.prototype.hasOwnProperty.call(overridesByName, normalizedName)) {
      return overridesByName[normalizedName].crop;
    }
    return persistedCrop ?? null;
  }, [overridesById, overridesByName]);

  return { resolveCrop, status };
}
