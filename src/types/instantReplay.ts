// Instant Replay TypeScript Type Definitions
// Requirements: 6.3, 6.4, 6.5

import type { ReplayFileReference, ReplayHttpReference } from '../utils/replayFileStore';

// ============================================================================
// Channel Message Types (Discriminated Union)
// ============================================================================

/**
 * Message type for sending video file data from Control Panel to Screen Mode
 * Validates: Requirement 6.3
 */
export interface FileMessage {
  type: 'file';
  data: ArrayBuffer;
  mime: string;
  name: string;
}

/** Metadata-only message. The actual video is shared through IndexedDB. */
export interface FileReferenceMessage {
  type: 'fileRef';
  file: ReplayFileReference;
}

/** URL message for OBS Browser Source streaming from the local dev server. */
export interface FileUrlMessage {
  type: 'fileUrl';
  file: ReplayHttpReference;
}

/**
 * Message type for sending playback commands from Control Panel to Screen Mode
 * Validates: Requirement 6.4
 */
export interface CommandMessage {
  type: 'cmd';
  action: 'play' | 'pause' | 'seek' | 'setA' | 'setB' | 'clearLoop' | 'setSpeed';
  value?: number;
}

/**
 * Message type for sending status updates from Screen Mode to Control Panel
 * Validates: Requirement 6.5
 */
export interface StatusMessage {
  type: 'status';
  duration: number;
  currentTime: number;
  markerA: number | null;
  markerB: number | null;
  /** Optional for backwards compatibility with older Screen builds. */
  isPlaying?: boolean;
}

/** Playback failure reported by the Screen so the Controller can show a useful error. */
export interface PlaybackErrorMessage {
  type: 'playbackError';
  name?: string;
  message: string;
  code?: number;
}

/**
 * Discriminated union of all channel message types
 * Used for type-safe BroadcastChannel communication
 */
export type ChannelMessage = FileMessage | FileReferenceMessage | FileUrlMessage | CommandMessage | StatusMessage | PlaybackErrorMessage;

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
