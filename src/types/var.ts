export type VarMode = 'goal' | 'var';
export type VarSpeed = 0.25 | 0.5 | 1 | 2;

export type VarStatus =
  | 'IDLE'
  | 'SAVING'          // OBS SaveReplayBuffer in progress
  | 'TRIMMING'        // FFmpeg trimming (Goal mode)
  | 'RE_ENCODING'     // FFmpeg re-encoding speed (reverse / slow-mo)
  | 'LOADING'         // Loading video into OBS Media Source
  | 'PLAYING'         // Replay actively playing in OBS
  | 'DECISION'        // VAR Decision graphic showing
  | 'ERROR';

export type VarDecision =
  | 'GOAL'
  | 'NO_GOAL'
  | 'PENALTY'
  | 'NO_PENALTY'
  | 'RED_CARD'
  | 'NO_RED_CARD'
  | 'CONFIRMED'
  | 'OVERTURNED'
  | 'CUSTOM';

export interface VarSettings {
  replayFolderPath: string;     // Default OBS replay folder path e.g. D:\OBS_football\replays
  goalSceneName: string;        // Default: 'Goal Replay'
  varSceneName: string;         // Default: 'VAR'
  mainSceneName: string;        // Default: 'Main Stream'
  mediaSourceName: string;      // Default: 'VAR_Replay_Source'
  soundSourceName: string;      // Default: 'VAR_Sound'
  overlaySourceName: string;    // Default: 'VAR_Overlay'
  goalTrimStart: number;        // Default: 10 seconds from end
  goalTrimDuration: number;     // Default: 10 seconds
  autoReturnToMain: boolean;   // Auto return to main scene after replay
  autoReturnDelaySec: number;  // Delay in seconds before auto return
}

export interface VarVideoControls {
  // Browser preview controls
  browserSpeed: number;         // HTML5 video.playbackRate (-2.0 to 2.0)
  browserZoom: number;          // 1.0 to 4.0 (CSS scale)
  browserPanX: number;          // Pixel offset
  browserPanY: number;
  browserPanXPercent?: number;   // Normalized % offset (-100% to 100%)
  browserPanYPercent?: number;   // Normalized % offset (-100% to 100%)
  currentTime?: number;         // Synced video playhead time in seconds
  isPlaying?: boolean;          // Video play/pause state
  inPoint: number;              // Trim point A in seconds
  outPoint: number;             // Trim point B in seconds
  duration: number;             // Total video duration in seconds

  // OBS broadcast controls
  obsZoom: number;              // 1.0 to 3.0 (SetSceneItemTransform scale)
  obsPanX: number;
  obsPanY: number;
  obsSpeed: VarSpeed;           // Speed active in OBS
  isReEncoding: boolean;        // FFmpeg active
}

export interface VarState {
  status: VarStatus;
  mode?: VarMode;
  rawClipPath?: string;         // Original path from OBS ReplayBufferSaved
  clipPath?: string;            // Current active clip path (may be trimmed/reversed)
  decision?: VarDecision;
  customDecisionText?: string;
  startedAt?: number;
  errorMessage?: string;
  videoControls: VarVideoControls;
}

export interface ClipItem {
  id: string;
  name: string;
  path: string;
  size: number;
  mtime: number;
  formattedDate: string;
  duration?: number;
  thumbnailUrl?: string;
  isNew?: boolean;
}

export interface HighlightPlaylistItem {
  id: string;
  title: string;
  clipPath: string;
  thumbnailUrl?: string;
  matchMinute?: string;
  inPoint: number;
  outPoint: number;
  duration: number;
  orderNumber: number; // 1, 2, 3...
  timestamp: number;
}

export interface VarLogEntry {
  id: string;
  mode: VarMode;
  decision?: VarDecision;
  customDecisionText?: string;
  matchMinute?: string;
  timestamp: number;
  clipPath?: string;
  obsSpeedUsed?: VarSpeed;
}
