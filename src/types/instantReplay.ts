// Instant Replay TypeScript Type Definitions
// Requirements: 6.3, 6.4, 6.5

// ============================================================================
// Channel Message Types (Discriminated Union)
// ============================================================================

/**
 * Internal channel used only to hand off completed playlist items from the
 * OBS screen back to the replay controller. It is deliberately separate from
 * the public automation channel so Auto Macros do not run for every item.
 */
export const REPLAY_PLAYLIST_CONTROL_CHANNEL = 'replay-playlist-control';
export const REPLAY_PROTOCOL_VERSION = 2 as const;

/**
 * Message type for sending video file data from Control Panel to Screen Mode
 * Validates: Requirement 6.3
 */
export interface FileMessage {
  type: 'file';
  data: ArrayBuffer;
  mime: string;
  name: string;
  /** Identifies one file transfer/playback attempt. */
  playbackId?: string;
  /** Present when the file is being played by the playlist runner. */
  playlistItemId?: string;
  playlistSessionId?: string;
  /** Protocol v2 fields used by the resilient playlist runner. */
  protocolVersion?: typeof REPLAY_PROTOCOL_VERSION;
  attempt?: 1 | 2;
  resumeTime?: number;
  targetScreenId?: string;
}

/**
 * Message type for sending playback commands from Control Panel to Screen Mode
 * Validates: Requirement 6.4
 */
export interface CommandMessage {
  type: 'cmd';
  action: 'play' | 'pause' | 'seek' | 'setA' | 'setB' | 'clearLoop' | 'setSpeed';
  value?: number;
  playbackId?: string;
  playlistSessionId?: string;
  targetScreenId?: string;
}

/**
 * Message type for sending status updates from Screen Mode to Control Panel
 * Validates: Requirement 6.5
 */
export interface StatusMessage {
  type: 'status';
  playbackId?: string;
  duration: number;
  currentTime: number;
  markerA: number | null;
  markerB: number | null;
}

/**
 * Discriminated union of all channel message types
 * Used for type-safe BroadcastChannel communication
 */
export type ChannelMessage = FileMessage | CommandMessage | StatusMessage;

/** Event emitted by the replay screen when the current video reaches its end. */
export interface ReplayVideoEndedEvent {
  type: 'ReplayVideoEnded';
  videoElement: 'InstantReplayScreen';
  fileName?: string;
  playbackId?: string;
  timestamp: number;
  duration: number;
  currentTime: number;
}

/** Internal event: one item in a playlist reached its natural end. */
export interface ReplayPlaylistItemEndedEvent {
  type: 'ReplayPlaylistItemEnded';
  videoElement: 'InstantReplayScreen';
  fileName: string;
  playbackId: string;
  playlistItemId: string;
  playlistSessionId: string;
  timestamp: number;
  duration: number | null;
  currentTime: number;
  protocolVersion: typeof REPLAY_PROTOCOL_VERSION;
  screenId: string;
  attempt: 1 | 2;
}

export type ReplayPlaybackFailureReason =
  | 'stalled'
  | 'decode_error'
  | 'load_error'
  | 'play_error';

export interface ReplayPlaylistFailure {
  itemId: string;
  fileName: string;
  reason: ReplayPlaybackFailureReason;
  failedAt: number;
  lastConfirmedTime: number;
  attempts: number;
}

interface ReplayScreenEventBase {
  protocolVersion: typeof REPLAY_PROTOCOL_VERSION;
  screenId: string;
  timestamp: number;
}

interface ReplayPlaybackEventBase extends ReplayScreenEventBase {
  playlistSessionId: string;
  playlistItemId: string;
  playbackId: string;
  attempt: 1 | 2;
}

export interface ReplayScreenReadyEvent extends ReplayScreenEventBase {
  type: 'ReplayScreenReady';
}

export interface ReplayScreenHeartbeatEvent extends ReplayScreenEventBase {
  type: 'ReplayScreenHeartbeat';
  playbackId?: string;
}

export interface ReplayMediaReceivedEvent extends ReplayPlaybackEventBase {
  type: 'ReplayMediaReceived';
}

export interface ReplayMediaReadyEvent extends ReplayPlaybackEventBase {
  type: 'ReplayMediaReady';
  duration: number | null;
}

export interface ReplayPlaybackStartedEvent extends ReplayPlaybackEventBase {
  type: 'ReplayPlaybackStarted';
  currentTime: number;
  duration: number | null;
}

export interface ReplayPlaybackProgressEvent extends ReplayPlaybackEventBase {
  type: 'ReplayPlaybackProgress';
  currentTime: number;
  duration: number | null;
}

export interface ReplayPlaybackWaitingEvent extends ReplayPlaybackEventBase {
  type: 'ReplayPlaybackWaiting' | 'ReplayPlaybackStalled';
  currentTime: number;
}

export interface ReplayPlaybackFailedEvent extends ReplayPlaybackEventBase {
  type: 'ReplayPlaybackFailed';
  reason: Exclude<ReplayPlaybackFailureReason, 'stalled'>;
  currentTime: number;
  mediaErrorCode?: number;
}

export type ReplayPlaylistControlEvent =
  | ReplayScreenReadyEvent
  | ReplayScreenHeartbeatEvent
  | ReplayMediaReceivedEvent
  | ReplayMediaReadyEvent
  | ReplayPlaybackStartedEvent
  | ReplayPlaybackProgressEvent
  | ReplayPlaybackWaitingEvent
  | ReplayPlaybackFailedEvent
  | ReplayPlaylistItemEndedEvent;

/** Public automation event: the active playlist finished all its items. */
export interface ReplayPlaylistCompletedEvent {
  type: 'ReplayPlaylistCompleted';
  videoElement: 'InstantReplayScreen';
  playlistSessionId: string;
  completedItemCount: number;
  lastPlaylistItemId?: string;
  timestamp: number;
  outcome?: 'completed' | 'completed_with_errors';
  playedItemCount?: number;
  failedItemCount?: number;
  failedItems?: ReplayPlaylistFailure[];
}

export interface ReplayPlaylistItem {
  /** Stable identity derived from the file metadata. */
  id: string;
  fileName: string;
  fileSize: number;
  lastModified: number;
  addedAt: number;
}

export type ReplayPlaylistStatus =
  | 'idle'
  | 'loading'
  | 'waiting_for_screen'
  | 'playing'
  | 'stalled'
  | 'retrying'
  | 'advancing'
  | 'completed'
  | 'completed_with_errors'
  | 'stopped'
  | 'screen_unavailable';

export function createReplayFileId(file: Pick<File, 'name' | 'size' | 'lastModified'>): string {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
}

export function createReplayPlaylistItem(file: File, addedAt = Date.now()): ReplayPlaylistItem {
  return {
    id: createReplayFileId(file),
    fileName: file.name,
    fileSize: file.size,
    lastModified: file.lastModified,
    addedAt,
  };
}

export function isReplayVideoEndedEvent(value: unknown): value is ReplayVideoEndedEvent {
  if (!value || typeof value !== 'object') return false;

  const event = value as Partial<ReplayVideoEndedEvent> & {
    playlistItemId?: unknown;
    playlistSessionId?: unknown;
  };
  return event.type === 'ReplayVideoEnded'
    && event.videoElement === 'InstantReplayScreen'
    // Reject legacy playlist-shaped events so stale screens cannot trigger
    // the single-Replay automation by accident.
    && !('playlistItemId' in event)
    && !('playlistSessionId' in event)
    && typeof event.timestamp === 'number'
    && Number.isFinite(event.duration)
    && Number.isFinite(event.currentTime);
}

export function isReplayPlaylistItemEndedEvent(value: unknown): value is ReplayPlaylistItemEndedEvent {
  if (!value || typeof value !== 'object') return false;

  const event = value as Partial<ReplayPlaylistItemEndedEvent>;
  return event.type === 'ReplayPlaylistItemEnded'
    && event.videoElement === 'InstantReplayScreen'
    && typeof event.fileName === 'string'
    && typeof event.playbackId === 'string'
    && typeof event.playlistItemId === 'string'
    && typeof event.playlistSessionId === 'string'
    && event.protocolVersion === REPLAY_PROTOCOL_VERSION
    && typeof event.screenId === 'string'
    && (event.attempt === 1 || event.attempt === 2)
    && typeof event.timestamp === 'number'
    && Number.isFinite(event.timestamp)
    && (event.duration === null || (typeof event.duration === 'number' && Number.isFinite(event.duration)))
    && typeof event.currentTime === 'number'
    && Number.isFinite(event.currentTime);
}

export function isReplayPlaylistControlEvent(value: unknown): value is ReplayPlaylistControlEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<ReplayPlaylistControlEvent>;
  if (event.protocolVersion !== REPLAY_PROTOCOL_VERSION
    || typeof event.screenId !== 'string'
    || typeof event.timestamp !== 'number'
    || !Number.isFinite(event.timestamp)
    || typeof event.type !== 'string') return false;

  if (event.type === 'ReplayScreenReady') return true;
  if (event.type === 'ReplayScreenHeartbeat') {
    const heartbeat = event as Partial<ReplayScreenHeartbeatEvent>;
    return heartbeat.playbackId === undefined || typeof heartbeat.playbackId === 'string';
  }
  if (event.type === 'ReplayPlaylistItemEnded') return isReplayPlaylistItemEndedEvent(event);

  const playbackEvent = event as Partial<ReplayPlaybackEventBase>;
  const hasPlaybackIdentity = typeof playbackEvent.playlistSessionId === 'string'
    && typeof playbackEvent.playlistItemId === 'string'
    && typeof playbackEvent.playbackId === 'string'
    && (playbackEvent.attempt === 1 || playbackEvent.attempt === 2);
  if (!hasPlaybackIdentity) return false;

  if (event.type === 'ReplayMediaReceived') return true;
  if (event.type === 'ReplayMediaReady') {
    const ready = event as Partial<ReplayMediaReadyEvent>;
    return ready.duration === null || (typeof ready.duration === 'number' && Number.isFinite(ready.duration));
  }
  if (event.type === 'ReplayPlaybackStarted' || event.type === 'ReplayPlaybackProgress') {
    const progress = event as Partial<ReplayPlaybackStartedEvent | ReplayPlaybackProgressEvent>;
    return typeof progress.currentTime === 'number'
      && Number.isFinite(progress.currentTime)
      && (progress.duration === null || (typeof progress.duration === 'number' && Number.isFinite(progress.duration)));
  }
  if (event.type === 'ReplayPlaybackWaiting' || event.type === 'ReplayPlaybackStalled') {
    const waiting = event as Partial<ReplayPlaybackWaitingEvent>;
    return typeof waiting.currentTime === 'number' && Number.isFinite(waiting.currentTime);
  }
  if (event.type === 'ReplayPlaybackFailed') {
    const failed = event as Partial<ReplayPlaybackFailedEvent>;
    return (failed.reason === 'decode_error' || failed.reason === 'load_error' || failed.reason === 'play_error')
      && typeof failed.currentTime === 'number'
      && Number.isFinite(failed.currentTime)
      && (failed.mediaErrorCode === undefined
        || (typeof failed.mediaErrorCode === 'number' && Number.isFinite(failed.mediaErrorCode)));
  }
  return false;
}

export function isReplayPlaylistCompletedEvent(value: unknown): value is ReplayPlaylistCompletedEvent {
  if (!value || typeof value !== 'object') return false;

  const event = value as Partial<ReplayPlaylistCompletedEvent>;
  return event.type === 'ReplayPlaylistCompleted'
    && event.videoElement === 'InstantReplayScreen'
    && typeof event.playlistSessionId === 'string'
    && typeof event.completedItemCount === 'number'
    && Number.isInteger(event.completedItemCount)
    && event.completedItemCount >= 0
    && typeof event.timestamp === 'number'
    && Number.isFinite(event.timestamp)
    && (event.outcome === undefined || event.outcome === 'completed' || event.outcome === 'completed_with_errors')
    && (event.playedItemCount === undefined
      || (Number.isInteger(event.playedItemCount) && (event.playedItemCount ?? -1) >= 0))
    && (event.failedItemCount === undefined
      || (Number.isInteger(event.failedItemCount) && (event.failedItemCount ?? -1) >= 0))
    && (event.failedItems === undefined || Array.isArray(event.failedItems));
}

// ============================================================================
// Component State Interfaces
// ============================================================================

/**
 * Control Panel component state
 * Manages file system access, video state, and settings
 */
export interface ControlState {
  // File system state
  folderHandle: FileSystemDirectoryHandle | null;
  videoFiles: File[];
  loadedFileName: string;
  
  // Video state (mirrored from screen)
  duration: number;
  currentTime: number;
  markerA: number | null;
  markerB: number | null;
  
  // Settings
  replayDuration: number;  // Default: 8
  autoTrim: boolean;       // Default: true
  autoLoad: boolean;       // Default: false
  
  // UI state
  folderName: string;
  lastScanTimestamp: number;
}

/**
 * Screen Mode component state
 * Manages video playback and loop enforcement
 */
export interface ScreenState {
  // Video element
  videoRef: React.RefObject<HTMLVideoElement>;
  objectUrl: string | null;
  hasVideo: boolean;
  
  // Loop markers
  loopA: number | null;
  loopB: number | null;
}

/**
 * Video playback state
 * Represents current video metadata and playback position
 */
export interface VideoState {
  duration: number;       // seconds
  currentTime: number;    // seconds
  markerA: number | null; // seconds, loop start
  markerB: number | null; // seconds, loop end
  isPlaying: boolean;
}

// ============================================================================
// Settings and Metadata Interfaces
// ============================================================================

/**
 * Replay system settings schema
 * Persisted to LocalStorage
 */
export interface ReplaySettings {
  replayDuration: number;  // seconds (3-30)
  autoTrim: boolean;
  autoLoad: boolean;
  folderName: string;      // Display name only (handle cannot be persisted)
}

/**
 * Video file metadata
 * Extracted from File object
 */
export interface VideoFileMetadata {
  name: string;
  size: number;           // bytes
  lastModified: number;   // Unix timestamp (milliseconds)
  type: string;           // MIME type
}

// ============================================================================
// Type Guard Functions
// ============================================================================

/**
 * Type guard to check if a message is a FileMessage
 * @param msg - Channel message to check
 * @returns true if message is FileMessage
 */
export function isFileMessage(msg: ChannelMessage): msg is FileMessage {
  return msg.type === 'file';
}

/**
 * Type guard to check if a message is a CommandMessage
 * @param msg - Channel message to check
 * @returns true if message is CommandMessage
 */
export function isCommandMessage(msg: ChannelMessage): msg is CommandMessage {
  return msg.type === 'cmd';
}

/**
 * Type guard to check if a message is a StatusMessage
 * @param msg - Channel message to check
 * @returns true if message is StatusMessage
 */
export function isStatusMessage(msg: ChannelMessage): msg is StatusMessage {
  return msg.type === 'status';
}
